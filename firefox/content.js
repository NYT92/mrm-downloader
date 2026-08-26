// MRM Downloader Firefox Extension Content Script
// Reference: https://github.com/NYT92/mrm-downloader/raw/refs/heads/main/mrm.user.js

(function () {
  "use strict";

  const imageSelectors = [
    ".img-myreadingmanga",
    ".img-myreadingmanga img",
    ".entry-content img",
    ".separator img",
    "img[decoding='async']",
  ];

  const excludedPaths = [
    "/about/",
    "/upload/",
    "/whats-that-book/",
    "/popular/",
    "/video/",
    "/cats/",
    "/pairing/",
    "/group/",
    "/privacy-policy/",
    "/dmca-notice/",
    "/contact/",
    "/terms-service/",
    "/sitemap/",
    "/my-bookmark/",
    "/tag/",
    "/genre/",
    "/status/",
    "/lang/",
    "/yaoi-manga/",
    "/manhwa/",
  ];

  const includedPaths = ["/tag/ai-generate/"];

  const currentPath = window.location.pathname;

  // Check if path should be included despite being in excluded paths
  const isIncluded = includedPaths.some((path) => currentPath.startsWith(path));
  const isExcluded = excludedPaths.some((path) => currentPath.startsWith(path));

  // Early return only if excluded AND not in included paths
  const shouldExclude = isExcluded && !isIncluded;

  function getImageSources() {
    let imageSources = [];
    for (const selector of imageSelectors) {
      const images = document.querySelectorAll(selector);
      if (images.length > 0) {
        imageSources = Array.from(images)
          .map((img) => img.src || img.dataset.src)
          .filter(Boolean);
        break;
      }
    }
    return imageSources;
  }

  function checkHasImages() {
    let hasImages = false;
    for (const selector of imageSelectors) {
      if (document.querySelectorAll(selector).length > 0) {
        hasImages = true;
        break;
      }
    }
    return hasImages;
  }

  function getVideoSource() {
    const videoElement = document.querySelector("#MRM_video > video > source");
    return videoElement ? videoElement.src : null;
  }

  function getTitle() {
    return (
      document
        .querySelector(".entry-header h1.entry-title")
        ?.textContent.trim() || "Untitled"
    );
  }

  console.log(getTitle());

  function getCurrentPage() {
    const pageElement = document.querySelector(".page-numbers.current");
    return pageElement ? pageElement.textContent.trim() : "1";
  }

  function determineContentType() {
    const checkVidinTag = Array.from(
      document.querySelectorAll(".entry-categories a"),
    ).map((tag) => tag.textContent.trim().toLowerCase());

    const hasVideo = document.querySelector("#MRM_video") !== null;
    const hasYouTube =
      document.querySelector("iframe[src*='youtube.com']") !== null;
    const isHomePage = document.querySelector(".content-archive") !== null;
    const hasImages = checkHasImages();

    if (shouldExclude || hasYouTube || isHomePage) {
      return { type: "none", reason: "excluded_page" };
    }

    if (checkVidinTag.includes("video") && hasVideo) {
      return { type: "video", hasContent: true };
    } else if (!checkVidinTag.includes("video") && hasImages) {
      return { type: "images", hasContent: true, supportsPdf: true };
    } else {
      return { type: "none", reason: "no_content" };
    }
  }

  // This is the only effective method of bypassing CORS and CF check for absolutely no reason but who knews...
  function ensurePageFetchBridge() {
    if (document.getElementById("mrm-page-fetch-bridge")) return;
    const script = document.createElement("script");
    script.id = "mrm-page-fetch-bridge";
    script.textContent = `(() => {
      if (window.__mrmPageFetchBridgeInstalled) return;
      window.__mrmPageFetchBridgeInstalled = true;
      window.addEventListener('message', async (e) => {
        try {
          const data = e.data;
          if (!data || data.source !== 'mrm-extension' || data.type !== 'MRM_PAGE_FETCH_REQUEST') return;
          const { requestId, url, options, wantBody, responseType } = data;
          const opts = Object.assign({ credentials: 'include', cache: 'no-store', mode: 'cors' }, options || {});
          const res = await fetch(url, opts);
          // Only return lightweight info needed for testing; avoid large bodies
          const headers = Array.from(res.headers.entries());
          if (wantBody) {
            let body;
            if (responseType === 'text') {
              body = await res.text();
            } else if (responseType === 'json') {
              body = await res.json();
            } else {
              const buffer = await res.arrayBuffer();
              // Transfer the ArrayBuffer to avoid copying
              window.postMessage({
                source: 'mrm-page',
                type: 'MRM_PAGE_FETCH_RESPONSE',
                requestId,
                ok: res.ok,
                status: res.status,
                statusText: res.statusText,
                headers,
                body: buffer,
                responseType: 'arraybuffer'
              }, '*', [buffer]);
              return;
            }
            window.postMessage({
              source: 'mrm-page',
              type: 'MRM_PAGE_FETCH_RESPONSE',
              requestId,
              ok: res.ok,
              status: res.status,
              statusText: res.statusText,
              headers,
              body,
              responseType: responseType || 'text'
            }, '*');
          } else {
            window.postMessage({
              source: 'mrm-page',
              type: 'MRM_PAGE_FETCH_RESPONSE',
              requestId,
              ok: res.ok,
              status: res.status,
              statusText: res.statusText,
              headers
            }, '*');
          }
        } catch (err) {
          window.postMessage({
            source: 'mrm-page',
            type: 'MRM_PAGE_FETCH_RESPONSE',
            requestId: e.data && e.data.requestId,
            ok: false,
            error: err && err.message ? err.message : String(err)
          }, '*');
        }
      }, false);
    })();`;
    document.documentElement.appendChild(script);
    script.remove();
  }

  function hideAIListing() {
    const aiListing = document.querySelectorAll(".tag-ai-generate");

    if (!aiListing.length) return;

    for (const element of aiListing) {
      element.addEventListener("click", (event) => {
        if (
          confirm(
            "Are you sure you want to view generated AI images instead of people hard work & creativity? You can still view it at least but think about it...",
          )
        ) {
          element.style.filter = "none";
          element.style.opacity = "1";
        } else {
          event.preventDefault();
        }
      });
      element.style.filter = "blur(10px)";
      element.style.opacity = "0.5";
    }
  }

  async function initHideAIListing() {
    try {
      const result = await browser.storage.local.get(["mrmSettings"]);
      const settings = result.mrmSettings || {};
      const isEnabled = settings.hideAIListing !== false;

      if (isEnabled) {
        if (document.readyState === "loading") {
          document.addEventListener("DOMContentLoaded", hideAIListing);
        } else {
          hideAIListing();
        }
      }
    } catch (error) {
      console.error("[MRM] Error loading settings:", error);
      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", hideAIListing);
      } else {
        hideAIListing();
      }
    }
  }

  function styleBookmarks() {
    if (document.getElementById("mrm-bookmark-styles")) return;
    const style = document.createElement("style");
    style.id = "mrm-bookmark-styles";
    style.textContent = `
      #bottom.bookmark {
        margin: 24px 0;
        text-align: center;
      }
      .upb_add_remove_links {
        display: flex;
        justify-content: center;
        gap: 8px;
      }
      .upb_bookmark_control {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 8px 18px;
        border-radius: 8px;
        font-size: 14px;
        font-weight: 500;
        text-decoration: none !important;
        transition: all 0.2s ease;
      }
      .upb_add_bookmark {
        background: #f97316;
        color: #fff !important;
        border: 1px solid #ea580c;
      }
      .upb_add_bookmark:hover {
        background: #ea580c !important;
        color: #fff;
      }
      .upb_del_bookmark {
        background: #fff;
        color: #dc2626 !important;
        border: 1px solid #fca5a5;
      }
      .upb_del_bookmark:hover {
        background: #fef2f2;
        color: #b91c1c !important;
        border-color: #f87171;
      }
    `;
    document.head.appendChild(style);
  }

  function dupBookmarkToTop() {
    if (document.getElementById("mrm-bookmark-top")) return;
    const entryHeader = document.querySelector(".entry-header");
    const bottomBookmark = document.querySelector("#bottom.bookmark");
    if (!entryHeader || !bottomBookmark) return;

    const topBookmark = bottomBookmark.cloneNode(true);
    topBookmark.id = "mrm-bookmark-top";
    topBookmark.style.marginTop = "0";
    topBookmark.style.marginBottom = "12px";
    entryHeader.parentNode.insertBefore(topBookmark, entryHeader);
  }

  function initBookmarkDup() {
    styleBookmarks();
    dupBookmarkToTop();
    const observer = new MutationObserver(() => {
      dupBookmarkToTop();
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initBookmarkDup);
  } else {
    initBookmarkDup();
    initHideAIListing();
  }

  if (shouldExclude) return;

  browser.runtime.onMessage.addListener((message) => {
    if (message && message.type === "GET_MRM_DATA") {
      const contentType = determineContentType();

      return Promise.resolve({
        images: getImageSources(),
        video: getVideoSource(),
        title: getTitle(),
        page: getCurrentPage(),
        contentType: contentType.type,
        hasContent: contentType.hasContent || false,
        supportsPdf: contentType.supportsPdf || false,
        reason: contentType.reason,
      });
    }

    if (message && message.type === "DETECT_PAGINATION") {
      // Detect the last page number from pagination
      const paginationLinks = document.querySelectorAll(".page-numbers");
      let lastPage = 1;

      paginationLinks.forEach((link) => {
        const pageNum = parseInt(link.textContent.trim());
        if (!isNaN(pageNum) && pageNum > lastPage) {
          lastPage = pageNum;
        }
      });

      // Also check for "next" link to see if there are more pages
      const nextLink = document.querySelector(".page-numbers.next");
      if (nextLink) {
        // If there's a next link, try to extract the page number from it
        const href = nextLink.getAttribute("href");
        if (href) {
          const match = href.match(/\/page\/(\d+)\//);
          if (match) {
            const nextPage = parseInt(match[1]);
            if (nextPage > lastPage) {
              lastPage = nextPage;
            }
          }
        }
      }

      return Promise.resolve({
        lastPage: lastPage,
        currentPage: getCurrentPage(),
      });
    }

    if (message && message.type === "PAGE_FETCH") {
      // Proxy a fetch through the page context so first-party cookies and referrer apply
      ensurePageFetchBridge();

      const requestId = `mrm_${Date.now()}_${Math.random()
        .toString(36)
        .slice(2)}`;

      return new Promise((resolve) => {
        function handleMessage(event) {
          const data = event.data;
          if (
            !data ||
            data.source !== "mrm-page" ||
            data.type !== "MRM_PAGE_FETCH_RESPONSE"
          )
            return;
          if (data.requestId !== requestId) return;
          window.removeEventListener("message", handleMessage, false);
          resolve({
            ok: !!data.ok,
            status: data.status,
            statusText: data.statusText,
            headers: data.headers,
            // include body and responseType when requested
            body: data.body,
            responseType: data.responseType,
            error: data.error || null,
          });
        }

        window.addEventListener("message", handleMessage, false);

        window.postMessage(
          {
            source: "mrm-extension",
            type: "MRM_PAGE_FETCH_REQUEST",
            requestId,
            url: message.url,
            options: message.options || { method: "GET" },
            // forward wantBody and responseType through to the page
            wantBody: !!message.wantBody,
            responseType: message.responseType || "arraybuffer",
          },
          "*",
        );
      });
    }
  });
})();
