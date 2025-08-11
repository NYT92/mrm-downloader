// MRM Downloader Chrome Extension Content Script
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
    const pageElement = document.querySelector(".post-page-numbers.current");
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
      return { type: "images", hasContent: true };
    } else {
      return { type: "none", reason: "no_content" };
    }
  }

  // Listen for messages from popup
  function ensurePageFetchBridge() {
    return new Promise((resolve) => {
      // Ask background service worker to install the bridge in MAIN world
      try {
        chrome.runtime.sendMessage({ type: "INSTALL_PAGE_FETCH_BRIDGE" }, () => {
          // Ignore errors; resolve regardless to proceed
          resolve();
        });
      } catch (_) {
        resolve();
      }
    });
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message && message.type === "GET_MRM_DATA") {
      const contentType = determineContentType();

      sendResponse({
        images: getImageSources(),
        video: getVideoSource(),
        title: getTitle(),
        page: getCurrentPage(),
        contentType: contentType.type,
        hasContent: contentType.hasContent || false,
        reason: contentType.reason,
      });
      return false;
    }

    if (message && message.type === "PAGE_FETCH") {
      // Ensure bridge is installed via background (avoids inline script injection blocked by CSP)
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
      return true; // keep the channel open for async sendResponse
    }
  });
})(); 