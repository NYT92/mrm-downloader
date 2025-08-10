// MRM Downloader Firefox Extension Content Script
// Reference: https://github.com/NYT92/mrm-downloader/raw/refs/heads/main/mrm.user.js

(function () {
  "use strict";

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
  const currentPath = window.location.pathname;
  if (excludedPaths.some((path) => currentPath.startsWith(path))) return;

  function getImageSources() {
    const imageSelectors = [
      ".img-myreadingmanga",
      ".img-myreadingmanga img",
      ".entry-content img",
      ".separator img",
      "img[decoding='async']",
    ];
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
    const imageSelectors = [
      ".img-myreadingmanga",
      ".img-myreadingmanga img",
      ".entry-content img",
      ".separator img",
      "img[decoding='async']",
    ];

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

    if (
      excludedPaths.some((path) => currentPath.startsWith(path)) ||
      hasYouTube ||
      isHomePage
    ) {
      return { type: "none", reason: "excluded_page" };
    }

    // Apply the same content detection logic as userscript
    if (checkVidinTag.includes("video") && hasVideo) {
      return { type: "video", hasContent: true };
    } else if (!checkVidinTag.includes("video") && hasImages) {
      return { type: "images", hasContent: true, supportsPdf: true };
    } else {
      return { type: "none", reason: "no_content" };
    }
  }

  // Listen for messages from popup
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
          "*"
        );
      });
    }
  });
})();
