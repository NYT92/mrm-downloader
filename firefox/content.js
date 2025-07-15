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
      return { type: "images", hasContent: true };
    } else {
      return { type: "none", reason: "no_content" };
    }
  }

  // Listen for messages from popup
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
        reason: contentType.reason,
      });
    }
  });
})();
