// ==UserScript==
// @name         MRM Downloader (CF COOKIE REQUIRED)
// @namespace    https://nyt92.eu.org
// @version      2025-3-20
// @description  Download video and bulk images from myreadingmanga manga/doujin page.
// @author       nyt92
// @match        https://myreadingmanga.info/*
// @exclude      https://myreadingmanga.info/about/
// @exclude      https://myreadingmanga.info/whats-that-book/
// @exclude      https://myreadingmanga.info/upload
// @exclude      https://myreadingmanga.info/popular/*
// @exclude      https://myreadingmanga.info/video/*
// @exclude      https://myreadingmanga.info/cats/*
// @exclude      https://myreadingmanga.info/pairing/*
// @exclude      https://myreadingmanga.info/group/*
// @exclude      https://myreadingmanga.info/privacy-policy/
// @exclude      https://myreadingmanga.info/dmca-notice/
// @exclude      https://myreadingmanga.info/contact/
// @exclude      https://myreadingmanga.info/terms-service/
// @exclude      https://myreadingmanga.info/sitemap/
// @exclude      https://myreadingmanga.info/my-bookmark/
// @exclude      https://myreadingmanga.info/tag/*
// @exclude      https://myreadingmanga.info/genre/*
// @exclude      https://myreadingmanga.info/status/*
// @exclude      https://myreadingmanga.info/lang/*
// @exclude      https://myreadingmanga.info/yaoi-manga/*
// @exclude      https://myreadingmanga.info/manhwa/*
// @connect      myreadingmanga.info
// @connect      i1.myreadingmanga.info
// @connect      i2.myreadingmanga.info
// @connect      i3.myreadingmanga.info
// @connect      i4.myreadingmanga.info
// @connect      i5.myreadingmanga.info
// @connect      i6.myreadingmanga.info
// @supportURL   https://github.com/NYT92/mrm-downloader
// @icon         https://www.google.com/s2/favicons?sz=64&domain=myreadingmanga.info
// @require      https://cdnjs.cloudflare.com/ajax/libs/jszip/3.7.1/jszip.min.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/FileSaver.js/2.0.5/FileSaver.min.js
// @grant        GM_xmlhttpRequest
// @license      GPLv3
// @downloadURL https://update.greasyfork.org/scripts/507784/MRM%20Downloader.user.js
// @updateURL https://update.greasyfork.org/scripts/507784/MRM%20Downloader.meta.js
// ==/UserScript==

// THIS USERSCRIPT IS LICENSE UNDER THE GPLv3 License
(function () {
  ("use strict");

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
  if (excludedPaths.some((path) => currentPath.startsWith(path))) {
    return;
  }

  const wpadminbar = document.querySelector("#wpadminbar");
  if (wpadminbar) {
    wpadminbar.remove();
    document.documentElement.setAttribute(
      "style",
      "margin-top: 0px !important;"
    );
  }

  const style = document.createElement("style");
  style.textContent = `
    .mrm-dl-btn {
      background-color: #ffab23;
      border-radius: 5px;
      display: inline-block;
      cursor: pointer;
      color: black;
      font-size: 16px;
      font-weight: bold;
      padding: 16px 32px;
      text-decoration: none;
    }
    .mrm-dl-btn:hover {
      background-color:rgb(196, 120, 24);
    }
    .mrm-dl-btn:active {
      position: relative;
      top: 1px;
    }
  `;
  document.head.appendChild(style);

  function saveCookies() {
    const cookies = prompt("Please paste your cookies here:");
    if (cookies) {
      localStorage.setItem("mrm_cookies", cookies);
      alert("Cookies saved!");
      window.location.reload();
    }
  }

  const cookiesBtn = document.createElement("button");
  cookiesBtn.setAttribute("class", "mrm-dl-btn");
  cookiesBtn.id = "saveCookiesBtn";
  cookiesBtn.textContent = "Load 🍪";
  cookiesBtn.style.cssText =
    "position: fixed; bottom: 10px; right: 10px; z-index: 9999;";
  document.body.appendChild(cookiesBtn);

  cookiesBtn.addEventListener("click", saveCookies);

  const title =
    document
      .querySelector(".entry-header h1.entry-title")
      ?.textContent.trim() || "Untitled";

  const imageDlBtn = document.createElement("button");
  imageDlBtn.setAttribute("class", "mrm-dl-btn");
  imageDlBtn.id = "downloadImagesBtn";
  imageDlBtn.textContent = "Download Images (.zip)";
  imageDlBtn.style.cssText =
    "position: fixed; top: 10px; right: 10px; z-index: 9999;";

  const videoDlBtn = document.createElement("button");
  videoDlBtn.setAttribute("class", "mrm-dl-btn");
  videoDlBtn.id = "downloadVideoBtn";
  videoDlBtn.textContent = "Download Video";
  videoDlBtn.style.cssText =
    "position: fixed; top: 10px; right: 10px; z-index: 9999;";

  const progressBar = document.createElement("div");
  progressBar.id = "downloadProgress";
  progressBar.style.cssText =
    "position: fixed; top:120px; right: 10px; width: 235px; right: 10px; height: 20px; background-color: #f0f0f0; display: none; z-index: 9999;";

  const progressInner = document.createElement("div");
  progressInner.style.cssText =
    "width: 0%; height: 100%; background-color: #4CAF50; transition: width 0.5s;";
  progressBar.appendChild(progressInner);

  const progressText = document.createElement("div");
  progressText.style.cssText =
    "position: fixed; top: 145px; right: 10px; z-index: 9999; display: none;";
  progressText.textContent = "Preparing download...";

  const checkVidinTag = Array.from(
    document.querySelectorAll(".entry-categories a")
  ).map((tag) => tag.textContent.trim().toLowerCase());

  const hasVideo = document.querySelector("#MRM_video") !== null;
  const hasYouTube =
    document.querySelector("iframe[src*='youtube.com']") !== null;
  const isHomePage = document.querySelector(".content-archive") !== null;

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
  if (
    excludedPaths.some((path) => currentPath.startsWith(path)) ||
    hasYouTube ||
    isHomePage
  ) {
    return;
  }
  if (checkVidinTag.includes("video") && hasVideo) {
    document.body.appendChild(videoDlBtn);
  } else if (!checkVidinTag.includes("video") && hasImages) {
    document.body.appendChild(imageDlBtn);
  } else {
    return;
  }

  document.body.appendChild(progressBar);
  document.body.appendChild(progressText);

  console.log(
    "Info: Cookies are required for this script to work due to browser limitations and Cloudflare protection. See https://github.com/NYT92/mrm-downloader/tree/main?tab=readme-ov-file#using-the-script for more information."
  );

  const savedCookies = localStorage.getItem("mrm_cookies");

  const lastAlertTime = localStorage.getItem("mrm_last_alert");
  const ONE_WEEK = 7 * 24 * 60 * 60 * 1000;

  if (!savedCookies) {
    const currentTime = Date.now();
    if (!lastAlertTime || currentTime - parseInt(lastAlertTime) > ONE_WEEK) {
      alert(
        "Please set the cookies first before downloading images. See https://github.com/NYT92/mrm-downloader/tree/main?tab=readme-ov-file#using-the-script for more information. This alert will not show again until week has passed."
      );
      localStorage.setItem("mrm_last_alert", currentTime.toString());
    }
    imageDlBtn.style.display = "none";
    videoDlBtn.style.display = "none";
    return;
  }
  const cookiesValue = savedCookies || "";

  imageDlBtn.addEventListener("click", function () {
    imageDlBtn.disabled = true;
    imageDlBtn.textContent = "Downloading...";

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

    if (imageSources.length === 0) {
      alert(
        "No images found on this page. Check the console for debugging information."
      );
      imageDlBtn.disabled = false;
      imageDlBtn.textContent = "Download Images (.zip)";
      return;
    }

    const pageElement = document.querySelector(".post-page-numbers.current");
    const page = pageElement ? pageElement.textContent.trim() : "1";

    const zip = new JSZip();

    progressBar.style.display = "block";
    progressText.style.display = "block";
    progressInner.style.width = "0%";

    function getExtensionFromMimeType(mimeType) {
      const mimeToExt = {
        "image/jpeg": "jpg",
        "image/png": "png",
        "image/gif": "gif",
        "image/webp": "webp",
        "image/jpg": "jpg",
        "text/html": "html",
      };
      return mimeToExt[mimeType.toLowerCase()];
    }

    function addImageToZip(src, index) {
      return new Promise((resolve, reject) => {
        progressText.textContent = `Downloading image ${index + 1} of ${
          imageSources.length
        }...`;

        GM_xmlhttpRequest({
          method: "GET",
          url: src,
          headers: {
            Cookie: cookiesValue,
          },
          responseType: "arraybuffer",
          onload: function (response) {
            try {
              const arrayBuffer = response.response;
              const byteArray = new Uint8Array(arrayBuffer);
              let mimeType = "image/jpeg";
              try {
                const contentTypeMatch = response.responseHeaders.match(
                  /Content-Type:\s*(\S+)/i
                );
                if (contentTypeMatch && contentTypeMatch[1]) {
                  mimeType = contentTypeMatch[1];
                }
              } catch (headerError) {
                console.warn(
                  `Could not parse Content-Type header for ${src}:`,
                  headerError
                );
              }

              const blob = new Blob([byteArray], { type: mimeType });

              if (blob.type.includes("text/html")) {
                alert(
                  "The script have detected the Cloudflare is blocking the page. You need to re-enter the cookies info due to Cloudflare resetting the cookies or the cookies is expired. See https://github.com/NYT92/mrm-downloader/tree/main?tab=readme-ov-file#using-the-script for more information."
                );
                reject(new Error("Invalid cookies"));
                window.location.reload();
              } else {
                const ext = getExtensionFromMimeType(blob.type);
                const fileName = `image_${index + 1}.${ext}`;
                zip.file(fileName, blob, { binary: true });
                console.log(
                  `Added ${fileName} to ZIP (${blob.size} bytes, type: ${blob.type})`
                );

                const progress = ((index + 1) / imageSources.length) * 100;
                progressInner.style.width = `${progress}%`;
                resolve();
              }
            } catch (error) {
              console.error(`Error processing ${src}:`, error);
              reject(error);
            }
          },
          onerror: function (error) {
            console.error(`Error fetching ${src}:`, error);
            reject(error);
          },
        });
      });
    }

    Promise.all(imageSources.map(addImageToZip))
      .then(() => {
        progressText.textContent = "Creating ZIP file...";
        return zip.generateAsync({ type: "blob" });
      })
      .then(function (content) {
        const safeTitle = title.replace(/[^a-z0-9]/gi, "_").toLowerCase();
        const fileName = `${safeTitle}_ch${page}.zip`;
        saveAs(content, fileName);
        console.log("ZIP file saved successfully");
        progressBar.style.display = "none";
        progressText.style.display = "none";
        imageDlBtn.disabled = false;
        imageDlBtn.textContent = "Download Images (.zip)";
      })
      .catch((error) => {
        console.error("Error creating ZIP file:", error);
        alert(
          "An error occurred while creating the ZIP file. Please check the console for details."
        );
        progressBar.style.display = "none";
        progressText.style.display = "none";
        imageDlBtn.disabled = false;
        imageDlBtn.textContent = "Download Images (.zip)";
      });
  });

  videoDlBtn.addEventListener("click", function () {
    videoDlBtn.disabled = true;
    videoDlBtn.textContent = "Downloading...";

    const videoElement = document.querySelector("#MRM_video > video > source");
    if (!videoElement) {
      alert("No video found on this page.");
      videoDlBtn.disabled = false;
      videoDlBtn.textContent = "Download Video";
      return;
    }

    const videoSrc = videoElement.src;
    if (!videoSrc) {
      alert("Unable to find video source.");
      videoDlBtn.disabled = false;
      videoDlBtn.textContent = "Download Video";
      return;
    }

    progressBar.style.display = "block";
    progressText.style.display = "block";
    progressText.textContent = "Starting video download...";
    progressInner.style.width = "0%";

    GM_xmlhttpRequest({
      method: "GET",
      url: videoSrc,
      headers: {
        Cookie: cookiesValue,
      },
      responseType: "arraybuffer",
      onprogress: function (progress) {
        if (progress.lengthComputable) {
          const percentComplete = (progress.loaded / progress.total) * 100;
          progressInner.style.width = percentComplete + "%";
          const downloadedMB = (progress.loaded / (1024 * 1024)).toFixed(2);
          const totalMB = (progress.total / (1024 * 1024)).toFixed(2);
          console.log(`Downloaded: ${downloadedMB}MB / ${totalMB}MB`);
          progressText.textContent = `Downloaded: ${downloadedMB}MB / ${totalMB}MB`;
        }
      },
      onload: function (response) {
        const blob = new Blob([response.response], { type: "video/mp4" });
        if (new Blob([response.response]).type.includes("text/html")) {
          alert(
            "The script have detected the Cloudflare is blocking the page. You need to re-enter the cookies info due to Cloudflare resetting the cookies or the cookies is expired. See https://github.com/NYT92/mrm-downloader/tree/main?tab=readme-ov-file#using-the-script for more information."
          );
          window.location.reload();
        } else {
          const safeTitle = title.replace(/[^a-z0-9]/gi, "_").toLowerCase();
          const fileName = `${safeTitle}.mp4`;
          saveAs(blob, fileName);
          console.log("Video downloaded successfully");
          progressBar.style.display = "none";
          progressText.style.display = "none";
          videoDlBtn.disabled = false;
          videoDlBtn.textContent = "Download Video";
        }
      },
      onerror: function (error) {
        console.error("Error downloading video:", error);
        alert(
          "An error occurred while downloading the video. Please check the console for details."
        );
        progressBar.style.display = "none";
        progressText.style.display = "none";
        videoDlBtn.disabled = false;
        videoDlBtn.textContent = "Download Video";
      },
    });
  });
})();
