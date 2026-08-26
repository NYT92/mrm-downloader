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
  const isIncluded = includedPaths.some((path) => currentPath.startsWith(path));
  const isExcluded = excludedPaths.some((path) => currentPath.startsWith(path));
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
    for (const selector of imageSelectors) {
      if (document.querySelectorAll(selector).length > 0) return true;
    }
    return false;
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

  function getCurrentPage() {
    const pageElement = document.querySelector(".page-numbers.current");
    return pageElement ? pageElement.textContent.trim() : "1";
  }

  function determineContentType() {
    const checkVidinTag = Array.from(
      document.querySelectorAll(".entry-categories a")
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

  function ensurePageFetchBridge() {
    return new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage({ type: "INSTALL_PAGE_FETCH_BRIDGE" }, () => {
          resolve();
        });
      } catch (_) {
        resolve();
      }
    });
  }

  function hideAIListing() {
    const aiListing = document.querySelectorAll(".tag-ai-generate");
    if (!aiListing.length) return;

    for (const element of aiListing) {
      element.addEventListener("click", (event) => {
        if (confirm("Are you sure you want to view generated AI images instead of people hard work?")) {
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
      const result = await chrome.storage.local.get(["mrmSettings"]);
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
      #bottom.bookmark { margin: 24px 0; text-align: center; }
      .upb_add_remove_links { display: flex; justify-content: center; gap: 8px; }
      .upb_bookmark_control { display: inline-flex; align-items: center; gap: 6px; padding: 8px 18px; border-radius: 8px; font-size: 14px; font-weight: 500; text-decoration: none !important; transition: all 0.2s ease; }
      .upb_add_bookmark { background: #f97316; color: #fff !important; border: 1px solid #ea580c; }
      .upb_add_bookmark:hover { background: #ea580c !important; color: #fff; }
      .upb_del_bookmark { background: #fff; color: #dc2626 !important; border: 1px solid #fca5a5; }
      .upb_del_bookmark:hover { background: #fef2f2; color: #b91c1c !important; border-color: #f87171; }
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
    const observer = new MutationObserver(() => dupBookmarkToTop());
    observer.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      initBookmarkDup();
      initHideAIListing();
    });
  } else {
    initBookmarkDup();
    initHideAIListing();
  }

  if (shouldExclude) return;

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
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
      const paginationLinks = document.querySelectorAll(".page-numbers");
      let lastPage = 1;

      paginationLinks.forEach((link) => {
        const pageNum = parseInt(link.textContent.trim());
        if (!isNaN(pageNum) && pageNum > lastPage) {
          lastPage = pageNum;
        }
      });

      const nextLink = document.querySelector(".page-numbers.next");
      if (nextLink) {
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
      ensurePageFetchBridge().then(() => {
        const requestId = `mrm_${Date.now()}_${Math.random().toString(36).slice(2)}`;

        function handleMessage(event) {
          const data = event.data;
          if (!data || data.source !== "mrm-page" || data.type !== "MRM_PAGE_FETCH_RESPONSE") return;
          if (data.requestId !== requestId) return;
          window.removeEventListener("message", handleMessage, false);
          clearTimeout(timeoutId);
          sendResponse({
            ok: !!data.ok,
            status: data.status,
            statusText: data.statusText,
            headers: data.headers,
            body: data.body,
            responseType: data.responseType,
            error: data.error || null,
          });
        }

        window.addEventListener("message", handleMessage, false);
        const timeoutId = setTimeout(() => {
          try { window.removeEventListener("message", handleMessage, false); } catch (_) {}
          try { sendResponse({ ok: false, error: "PAGE_FETCH_TIMEOUT" }); } catch (_) {}
        }, 8000);
        window.postMessage({
          source: "mrm-extension",
          type: "MRM_PAGE_FETCH_REQUEST",
          requestId,
          url: message.url,
          options: message.options || { method: "GET" },
          wantBody: !!message.wantBody,
          responseType: message.responseType || "bytes",
        }, "*");
      });
      return true;
    }
  });
})();
