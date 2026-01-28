let currentDownload = null;
let downloadHistory = [];
let currentView = "main";
let mrmSettings = {
  useCookies: true,
  retryCount: 3,
  timeout: 30,
  debugMode: false,
  cookieSource: "auto", // "auto" or "custom"
  cookies: [],
  autoRetrievedCookies: [],
  hideAIListing: true,
};

// --- UTILITIES ---

// Utility: Get cookies based on settings
function getCookiesToUse() {
  if (mrmSettings.cookieSource === "auto") {
    return (mrmSettings.autoRetrievedCookies && mrmSettings.autoRetrievedCookies.length > 0)
      ? mrmSettings.autoRetrievedCookies
      : [];
  }
  return (mrmSettings.cookies && mrmSettings.cookies.length > 0)
    ? mrmSettings.cookies
    : [];
}

// Utility: Get retry count
function getRetryCount() {
  return mrmSettings.retryCount || 3;
}

// Utility: Get timeout value
function getTimeout() {
  return (mrmSettings.timeout || 30) * 1000;
}

// Utility: Update element text content
function updateStatusText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

// Utility: Set element display
function setElementDisplay(id, display) {
  const el = document.getElementById(id);
  if (el) el.style.display = display;
}

// Utility: Set element width
function setElementWidth(id, width) {
  const el = document.getElementById(id);
  if (el) el.style.width = width;
}

// Utility: Get file extension from blob
function getFileExtension(blob, fallback = 'jpg') {
  if (!blob.type) return fallback;
  const parts = blob.type.split('/');
  return parts[1] || fallback;
}

// Utility: Convert blob to base64
function blobToBase64(blob) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(blob);
  });
}

// Utility: Load image from source
function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

// --- CORE ---

document.addEventListener("DOMContentLoaded", async function () {
  await loadDownloadHistory();
  await loadSettings();
  await checkPageContent();
  setupEventListeners();
  updateUI();

  const version = await browser.runtime.getManifest().version;
  document.getElementById("version").textContent = `v${version}`;
});

async function loadDownloadHistory() {
  try {
    const result = await browser.storage.local.get(["downloadHistory"]);
    downloadHistory = result.downloadHistory || [];
  } catch (error) {
    console.error("[MRM] Error loading download history:", error);
    downloadHistory = [];
  }
}

async function saveDownloadHistory() {
  try {
    await browser.storage.local.set({ downloadHistory });
  } catch (error) {
    console.error("[MRM] Error saving download history:", error);
  }
}

async function loadSettings() {
  try {
    const result = await browser.storage.local.get(["mrmSettings"]);
    if (result.mrmSettings) {
      mrmSettings = { ...mrmSettings, ...result.mrmSettings };
    }
    if (mrmSettings.debugMode) {
      console.log("[MRM] Settings loaded:", mrmSettings);
    }
  } catch (error) {
    console.error("[MRM] Error loading settings:", error);
  }
}

function getCookieHeaders() {
  if (!mrmSettings.useCookies) return {};

  const cookiesToUse = getCookiesToUse();
  if (cookiesToUse.length === 0) return {};

  const cookieString = cookiesToUse
    .map((cookie) => `${cookie.name}=${cookie.value}`)
    .join("; ");

  if (mrmSettings.debugMode) {
    console.log(`[MRM Debug] Using ${cookiesToUse.length} cookies (${mrmSettings.cookieSource})`);
  }

  return { Cookie: cookieString };
}

async function setCookiesInBrowser(url) {
  if (!mrmSettings.useCookies) {
    if (mrmSettings.debugMode) console.log(`[MRM Debug] Cookie usage disabled`);
    return;
  }

  const cookiesToUse = getCookiesToUse();
  if (cookiesToUse.length === 0) {
    if (mrmSettings.debugMode) console.log(`[MRM Debug] No cookies to set`);
    return;
  }

  const urlObj = new URL(url);
  if (mrmSettings.debugMode) {
    console.log(`[MRM Debug] Setting ${cookiesToUse.length} cookies for ${urlObj.origin}`);
  }

  for (const cookie of cookiesToUse) {
    try {
      // Try different domain configurations for better compatibility
      const domains = [
        cookie.domain, // Original domain
        urlObj.hostname, // Exact hostname
        `.${urlObj.hostname}`, // Domain with leading dot
        `.${urlObj.hostname.split(".").slice(-2).join(".")}`, // Parent domain
      ].filter(Boolean);

      let cookieSet = false;
      for (const domain of domains) {
        try {
          const cookieDetails = {
            url: url,
            name: cookie.name,
            value: cookie.value,
            domain: domain,
            path: cookie.path || "/",
            secure: cookie.secure || urlObj.protocol === "https:",
            httpOnly: cookie.httpOnly || false,
          };

          // Add partition key if available
          if (cookie.partitionKey) {
            cookieDetails.partitionKey = cookie.partitionKey;
          }

          await browser.cookies.set(cookieDetails);
          console.log(
            `[MRM Debug] Successfully set cookie: ${cookie.name} for domain: ${domain}`
          );
          cookieSet = true;
          break;
        } catch (domainError) {
          console.log(
            `[MRM Debug] Failed to set cookie ${cookie.name} for domain ${domain}:`,
            domainError.message
          );
        }
      }

      if (!cookieSet) {
        console.error(
          `[MRM Debug] Failed to set cookie ${cookie.name} for any domain`
        );
      }
    } catch (error) {
      console.error(`[MRM Debug] Failed to set cookie ${cookie.name}:`, error);
    }
  }
}

async function fetchWithSettings(url, options = {}) {
  await setCookiesInBrowser(url);

  const tab = await getActiveTab();
  const retryCount = getRetryCount();

  const pageFetchOptions = {
    method: (options && options.method) || "GET",
  };
  if (options && options.headers && options.headers.Referer) {
    pageFetchOptions.referrer = options.headers.Referer;
  }

  if (mrmSettings.debugMode) console.log(`[MRM Debug] (Page) Fetching ${url}`);

  let lastError;
  for (let attempt = 1; attempt <= retryCount; attempt++) {
    try {
      if (mrmSettings.debugMode) console.log(`[MRM Debug] (Page) Fetch attempt ${attempt} for ${url}`);
      const pageResponse = await browser.tabs.sendMessage(tab.id, {
        type: "PAGE_FETCH",
        url,
        options: pageFetchOptions,
        wantBody: true,
        responseType: "arraybuffer",
      });

      if (!pageResponse) throw new Error("No response from page context");

      if (!pageResponse.ok) {
        throw new Error(`HTTP error: ${pageResponse.status || 'Request failed'}`);
      }

      const headers = new Headers(pageResponse.headers || []);
      const contentType = headers.get("content-type") || "application/octet-stream";
      const blob = new Blob([pageResponse.body], { type: contentType });

      return {
        ok: true,
        status: pageResponse.status,
        headers,
        blob: async () => blob,
      };
    } catch (error) {
      lastError = error;
      console.error(`[MRM Debug] (Page) Fetch attempt ${attempt} failed:`, error.message);
      if (attempt < retryCount) {
        const waitTime = Math.pow(2, attempt - 1) * 1000;
        await new Promise((resolve) => setTimeout(resolve, waitTime));
      }
    }
  }

  if (mrmSettings.debugMode) console.log(`[MRM Debug] Falling back to extension-context fetch for ${url}`);

  const fallbackHeaders = {
    "User-Agent": navigator.userAgent,
    Accept: "image/webp,image/avif,image/*,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5",
    "Accept-Encoding": "gzip, deflate, br",
    DNT: "1",
    Connection: "keep-alive",
    "Sec-Fetch-Dest": "image",
    "Sec-Fetch-Mode": "no-cors",
    "Sec-Fetch-Site": "same-site",
    ...(options.headers || {}),
  };

  const fallbackOptions = {
    ...options,
    headers: fallbackHeaders,
    timeout: getTimeout(),
    credentials: "include",
    mode: "cors",
  };

  let lastFallbackError;
  for (let attempt = 1; attempt <= retryCount; attempt++) {
    try {
      if (mrmSettings.debugMode) console.log(`[MRM Debug] (Ext) Fetch attempt ${attempt} for ${url}`);
      const res = await fetch(url, fallbackOptions);
      if (!res.ok && mrmSettings.debugMode) {
        console.error(`[MRM Debug] (Ext) Response status: ${res.status}`);
      }
      return res;
    } catch (err) {
      lastFallbackError = err;
      console.error(`[MRM Debug] (Ext) Fetch attempt ${attempt} failed:`, err.message);
      if (attempt < retryCount) {
        const waitTime = Math.pow(2, attempt - 1) * 1000;
        await new Promise((resolve) => setTimeout(resolve, waitTime));
      }
    }
  }

  throw lastError || lastFallbackError || new Error("Fetch failed");
}

function addToHistory(download) {
  const historyItem = {
    id: Date.now(),
    title: download.title,
    url: download.url,
    type: download.type,
    timestamp: new Date().toISOString(),
    status: download.status || "completed",
    progress: download.progress || 100,
  };

  downloadHistory.unshift(historyItem);
  if (downloadHistory.length > 50) {
    downloadHistory = downloadHistory.slice(0, 50);
  }

  saveDownloadHistory();
}

async function getActiveTab() {
  let [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function getMRMData() {
  const tab = await getActiveTab();
  return browser.tabs.sendMessage(tab.id, { type: "GET_MRM_DATA" });
}

let tabsUrl;

function getTabsUrl(tabs) {
  for (const tab of tabs) {
    tabsUrl = tab.url;
  }
}

function onError(error) {
  console.error(`Error: ${error}`);
}

async function checkPageContent() {
  try {
    browser.tabs
      .query({ url: "*://*.myreadingmanga.info/*" })
      .then(getTabsUrl, onError);

    const data = await getMRMData();
    if (tabsUrl.includes("myreadingmanga.info")) {
      // Update page number display
      if (data && data.page) {
        updateStatusText("pageNumber", data.page);
      }

      if (data && data.contentType) {
        const isVideo = data.contentType === "video";
        const isImages = data.contentType === "images";
        const hasImages = data.images && data.images.length > 0;
        const hasVideo = !!data.video;

        setElementDisplay("downloadVideoBtn", (isVideo || hasVideo) ? "block" : "none");
        setElementDisplay("downloadImagesBtn", (isImages || hasImages) ? "block" : "none");
        setElementDisplay("downloadPdfBtn", (isImages && hasImages && !hasVideo) ? "block" : "none");
        setElementDisplay("downloadAllBtn", (hasImages && hasVideo) ? "block" : "none");

        if (isImages || hasImages) {
          updateStatusText("downloadImagesBtn", "Download Images (ZIP)");
          updateStatusText("pdfImageCount", data.images.length);
          updateStatusText("imageCount", data.images.length);
        }

        updateStatusText("mangaTitle", data.title || "Manga Content");
        updateStatusText("statusText", (hasImages || hasVideo) ? "Ready" : "No content found");
      } else {
        // Fallback or no content
        ["downloadImagesBtn", "downloadPdfBtn", "downloadVideoBtn", "downloadAllBtn"].forEach(id => setElementDisplay(id, "none"));
        updateStatusText("mangaTitle", "No content selected");
        updateStatusText("statusText", "Navigate to a MyReadingManga page");
      }
    } else {
      ["downloadImagesBtn", "downloadPdfBtn", "downloadVideoBtn", "downloadAllBtn"].forEach(id => setElementDisplay(id, "none"));
      updateStatusText("mangaTitle", "No content selected");
      updateStatusText("statusText", "Navigate to a MyReadingManga page");
    }
  } catch (error) {
    console.error("[MRM] Error checking page content:", error);
    document.getElementById("statusText").textContent =
      "Error or not on Myreadingmanga page";
  }
}

//event listeners
function setupEventListeners() {
  document
    .getElementById("downloadImagesBtn")
    .addEventListener("click", handleDownloadClick);

  document
    .getElementById("downloadPdfBtn")
    .addEventListener("click", handlePdfDownloadClick);

  document
    .getElementById("downloadVideoBtn")
    .addEventListener("click", handleDownloadClick);

  document
    .getElementById("downloadAllBtn")
    .addEventListener("click", handleDownloadAllClick);

  document
    .getElementById("downloadBtn")
    .addEventListener("click", handleDownloadClick);

  document
    .getElementById("cancelBtn")
    .addEventListener("click", handleDeleteClick);

  document
    .getElementById("settingsBtn")
    .addEventListener("click", handleSettingsClick);

  document
    .getElementById("bulkDownloadBtn")
    .addEventListener("click", handleBulkDownloadClick);

  document.getElementById("historyBtn").addEventListener("click", showHistory);

  document.getElementById("backToMainBtn").addEventListener("click", showMain);

  document
    .getElementById("clearHistoryBtn")
    .addEventListener("click", clearHistory);

  document.getElementById("aboutBtn").addEventListener("click", () => {
    alert(
      "Download bulk images/videos from MRM. This tool is only intended to use for downloading & archiving media from MyReadingManga, please support the real artists and other works."
    );
  });
}

function showHistory() {
  currentView = "history";
  setElementDisplay("mainContent", "none");
  setElementDisplay("historyContent", "block");
  renderHistory();
}

function showMain() {
  currentView = "main";
  setElementDisplay("mainContent", "block");
  setElementDisplay("historyContent", "none");
}

function updateUI() {
  ["mainView", "historyView", "settingsView"].forEach(id => {
    setElementDisplay(id, currentView === id.replace("View", "") ? "block" : "none");
  });

  if (currentView === "history") renderHistory();
  if (currentView === "settings") renderSettings();
}
function renderHistory() {
  const historyList = document.getElementById("historyList");
  const emptyHistory = document.getElementById("emptyHistory");

  if (downloadHistory.length === 0) {
    historyList.innerHTML = "";
    emptyHistory.style.display = "block";
    return;
  }

  emptyHistory.style.display = "none";

  historyList.innerHTML = downloadHistory
    .map((item) => {
      const date = new Date(item.timestamp).toLocaleDateString();
      const time = new Date(item.timestamp).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
      const typeIcon =
        item.type === "video" ? "📹" : item.type === "pdf" ? "📄" : "🖼️";
      const statusColor =
        item.status === "completed"
          ? "text-green-600"
          : item.status === "failed"
            ? "text-red-600"
            : "text-yellow-600";

      return `
      <div class="history-item flex items-center justify-between p-3 border border-gray-200 rounded-lg">
        <div class="flex items-center space-x-3 flex-1">
          <span class="text-xl">${typeIcon}</span>
          <div class="flex-1 min-w-0">
            <p class="text-sm font-medium text-gray-900 break-words overflow-hidden line-clamp-2 max-w-full">${item.title
        }</p>
            <p class="text-xs text-gray-500">${date} at ${time}</p>
            <span class="text-xs ${statusColor} font-medium">${item.status === "completed"
          ? "✅"
          : item.status === "failed"
            ? "❌"
            : "⬇️"
        }</span>
            <button class="open-url-btn text-blue-600 hover:text-blue-800 text-sm" data-url="${item.url
        }">Open</button>
          </div>
        </div>
      </div>
    `;
    })
    .join("");

  const openButtons = historyList.querySelectorAll(".open-url-btn");
  openButtons.forEach((button) => {
    button.addEventListener("click", function () {
      const url = this.getAttribute("data-url");
      if (url) {
        openUrl(url);
      }
    });
  });
}

// open the external url
async function openUrl(url) {
  try {
    const validUrl = new URL(url);

    await browser.tabs.create({
      url: validUrl.href,
      active: true,
    });

    window.close();
  } catch (error) {
    console.error("[MRM] Error opening URL:", error);
    alert("Invalid URL or unable to open the link");
  }
}

// clear the history
async function clearHistory() {
  if (confirm("Are you sure you want to clear all download history?")) {
    downloadHistory = [];
    await saveDownloadHistory();
    renderHistory();
  }
}

function setDownloadButtonState(isDisabled, text) {
  const buttons = ["downloadImagesBtn", "downloadBtn", "downloadAllBtn", "downloadPdfBtn"];
  buttons.forEach(id => {
    const btn = document.getElementById(id);
    if (!btn) return;
    btn.disabled = isDisabled;

    // Handle special text scenarios
    if (text) {
      if (id === "downloadAllBtn") {
        updateStatusText("allButtonText", text);
      } else if (id === "downloadPdfBtn") {
        updateStatusText("pdfButtonText", text);
      } else {
        btn.textContent = text;
      }
    }
  });
}

async function handlePdfDownloadClick() {
  try {
    const data = await getMRMData();
    if (!data) {
      alert("No content found on this page.");
      setDownloadButtonState(false);
      return;
    }

    if (data.images && data.images.length > 0) {
      await downloadPdf(data.images, data.title, data.page);
    } else {
      alert("No images found to generate PDF.");
      setDownloadButtonState(false, "Generate PDF");
    }
  } catch (error) {
    console.error("[MRM] PDF download error:", error);
    setDownloadButtonState(false, "Generate PDF");
    alert("Failed to generate PDF. Check console for details.");
  }
}

async function handleDownloadClick() {
  try {
    const data = await getMRMData();
    if (!data) {
      alert("No content found on this page.");
      setDownloadButtonState(false);
      return;
    }

    if (data.contentType) {
      switch (data.contentType) {
        case "video":
          if (data.video) {
            await downloadVideo(data.video, data.title);
          } else {
            alert("Video content detected but no video source found.");
            setDownloadButtonState(false, "Download video");
          }
          break;

        case "images":
          if (data.images && data.images.length > 0) {
            await downloadImages(data.images, data.title, data.page);
          } else {
            alert("Image content detected but no images found.");
            setDownloadButtonState(false, "Download images (ZIP)");
          }
          break;

        default:
          alert("No downloadable content found.");
          setDownloadButtonState(false);
          break;
      }
    } else {
      const hasImages = data.images && data.images.length > 0;
      const hasVideo = data.video;

      if (hasImages && !hasVideo) {
        await downloadImages(data.images, data.title, data.page);
      } else if (hasVideo && !hasImages) {
        await downloadVideo(data.video, data.title);
      } else if (hasImages && hasVideo) {
        const choice = confirm(
          "This page has both images and video. Click OK for images, Cancel for video."
        );
        if (choice) {
          await downloadImages(data.images, data.title, data.page);
        } else {
          await downloadVideo(data.video, data.title);
        }
      } else {
        alert("No downloadable content found.");
        setDownloadButtonState(false);
      }
    }
  } catch (error) {
    console.error("[MRM] Download error:", error);
    alert("Download failed. Check console for details.");
    setDownloadButtonState(false);
  }
}

async function handleDownloadAllClick() {
  try {
    const data = await getMRMData();
    if (!data) {
      alert("No content found on this page.");
      setDownloadButtonState(false);
      return;
    }

    const hasImages = data.images && data.images.length > 0;
    const hasVideo = !!data.video;

    if (!hasImages && !hasVideo) {
      alert("No downloadable content found.");
      setDownloadButtonState(false);
      return;
    }

    await downloadAllMedia({
      images: hasImages ? data.images : [],
      videoUrl: hasVideo ? data.video : null,
      title: data.title,
      page: data.page || "1",
    });
  } catch (error) {
    console.error("[MRM] Download all error:", error);
    alert("Download failed. Check console for details.");
    setDownloadButtonState(false);
  }
}

function handleDeleteClick() {
  if (currentDownload) {
    if (confirm("Are you sure you want to cancel this download?")) {
      currentDownload = null;
      setProgress(0, "Cancelled");
      updateStatus("Cancelled");
      setDownloadButtonState(false);
    }
  } else {
    alert("No active download to cancel.");
  }
}

function handleBulkDownloadClick() {
  window.location.href = "bulk-download.html";
}

function handleSettingsClick() {
  window.location.href = "settings.html";
}

function setProgress(percent, text) {
  if (percent > 0 && percent < 100) {
    setElementDisplay("downloadCard", "block");
  } else if (percent === 100) {
    setTimeout(() => {
      setElementDisplay("downloadCard", "none");
    }, 1500);
  } else {
    setElementDisplay("downloadCard", "none");
  }

  setElementWidth("progressBar", percent + "%");

  // Update percentage text
  updateStatusText("progressText", Math.round(percent) + "%");

  if (text) {
    updateStatusText("downloadStatus", text);
    updateStatusText("progressStatus", text);
    if (currentDownload) {
      updateStatusText("downloadTitle", `Downloading ${currentDownload.type}...`);
    }
  }

  if (mrmSettings.debugMode) {
    console.log(`[MRM] Progress: ${percent}% - ${text}`);
  }
}

function updateStatus(status) {
  updateStatusText("statusText", status);
}

function updateUI() {
  if (downloadHistory.length > 0 && currentView === "main") {
    const latest = downloadHistory[0];
    if (latest.status === "completed") {
      return;
    }
    document.querySelector("h2").textContent = latest.title;
    updateStatus(latest.status);
    setProgress(latest.progress);
  }
}

async function downloadImages(images, title, page = "1") {
  if (!images.length) {
    alert("No images found on this page.");
    setDownloadButtonState(false, "Download images (ZIP)");
    return;
  }

  const tab = await getActiveTab();
  currentDownload = { type: "images", title, url: tab.url };
  updateStatus("Downloading images...");
  setDownloadButtonState(true, "Downloading...");
  setProgress(0, "Starting download...");

  const zip = new JSZip();

  try {
    for (let i = 0; i < images.length; i++) {
      const percent = ((i + 1) / images.length) * 90;
      setProgress(percent, `Downloading image ${i + 1} of ${images.length}...`);

      try {
        // Add referrer header for image requests
        const response = await fetchWithSettings(images[i], {
          headers: {
            Referer: tab.url,
          },
        });
        if (!response.ok) throw new Error(`HTTP error: ${response.status}`);

        const blob = await response.blob();
        const ext = getFileExtension(blob);
        zip.file(`image_${i + 1}.${ext}`, blob, { binary: true });

        if (mrmSettings.debugMode) {
          console.log(`[MRM] Downloaded image ${i + 1}/${images.length}`);
        }
      } catch (e) {
        console.error("[MRM] Error downloading image", images[i], e);
        if (mrmSettings.debugMode) {
          console.error("[MRM Debug] Image download error details:", e);
        }
      }
    }

    setProgress(95, "Creating ZIP file...");
    console.log("[MRM] Zipping images...");

    const content = await zip.generateAsync({ type: "blob" });
    console.log("[MRM] ZIP file created");

    setProgress(100, "Saving file...");

    // const safeTitle = title.replace(/[^a-z0-9]/gi, "_").toLowerCase();
    const filename = `${title} - Page ${page}.zip`;

    saveAs(content, filename);

    addToHistory({
      title: `${title} - Page ${page}`,
      url: tab.url,
      type: "images",
      status: "completed",
      progress: 100,
    });

    updateStatus("Download completed");
    currentDownload = null;
    setDownloadButtonState(false, "Download images (ZIP) ]");

    console.log("[MRM] Images download completed");
  } catch (error) {
    console.error("[MRM] Images download error:", error);
    updateStatus("Download failed");
    setProgress(0, "Download failed");
    addToHistory({
      title,
      url: tab.url,
      type: "images",
      status: "failed",
      progress: 0,
    });
    currentDownload = null;
    setDownloadButtonState(false, "Download Images (ZIP)");
    alert("Images download failed. Check console for details.");
  }
}

async function downloadVideo(videoUrl, title) {
  if (!videoUrl) {
    alert("No video found on this page.");
    setDownloadButtonState(false, "Download video");
    return;
  }

  const tab = await getActiveTab();
  currentDownload = { type: "video", title, url: tab.url };
  updateStatus("Downloading video...");

  // Start with immediate visual feedback
  setProgress(5, "Initializing download...");
  setDownloadButtonState(true, "Downloading...");

  try {
    // Simulate progress during fetch to show activity
    let progressInterval = setInterval(() => {
      const progressBar = document.getElementById("progressBar");
      const currentProgress = progressBar ? parseInt(progressBar.style.width) || 5 : 5;
      if (currentProgress < 45) {
        setProgress(currentProgress + 2, "Fetching video...");
      }
    }, 300);

    // Add referrer header for video requests
    const response = await fetchWithSettings(videoUrl, {
      headers: {
        Referer: tab.url,
      },
    });

    clearInterval(progressInterval);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    setProgress(50, "Processing video...");

    // Try to get content length for better progress tracking
    const contentLength = response.headers?.get?.('content-length');
    let blob;

    if (contentLength && response.body && typeof response.body.getReader === 'function') {
      // Stream the response with progress tracking
      const total = parseInt(contentLength, 10);
      let loaded = 0;
      const reader = response.body.getReader();
      const chunks = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        chunks.push(value);
        loaded += value.length;

        // Progress from 50% to 85% based on download progress
        const downloadProgress = 50 + Math.floor((loaded / total) * 35);
        setProgress(downloadProgress, `Downloading video... ${Math.floor((loaded / total) * 100)}%`);
      }

      // Combine chunks into blob
      const contentType = response.headers?.get?.('content-type') || 'video/mp4';
      blob = new Blob(chunks, { type: contentType });
    } else {
      // Fallback: show incremental progress during blob conversion
      setProgress(60, "Processing video data...");
      await new Promise(resolve => setTimeout(resolve, 100));
      setProgress(75, "Almost done...");
      blob = await response.blob();
    }

    setProgress(90, "Saving video...");

    // const safeTitle = title.replace(/[^a-z0-9]/gi, "_").toLowerCase();
    const ext = getFileExtension(blob, "mp4");
    const filename = `${title}.${ext}`;

    saveAs(blob, filename);

    setProgress(100, "Download completed");

    addToHistory({
      title,
      url: tab.url,
      type: "video",
      status: "completed",
      progress: 100,
    });

    updateStatus("Download completed");
    currentDownload = null;
    setDownloadButtonState(false, "Download video");

    console.log("[MRM] Video download completed");
  } catch (error) {
    console.error("[MRM] Video download error:", error);
    updateStatus("Download failed");
    setProgress(0, "Download failed");
    addToHistory({
      title,
      url: tab.url,
      type: "video",
      status: "failed",
      progress: 0,
    });
    currentDownload = null;
    setDownloadButtonState(false, "Download video");
    alert("Video download failed. Check console for details.");
  }
}

async function downloadAllMedia({ images, videoUrl, title, page = "1" }) {
  const hasImages = images && images.length > 0;
  const hasVideo = !!videoUrl;

  if (!hasImages && !hasVideo) {
    alert("No images or video to download.");
    return;
  }

  const tab = await getActiveTab();
  currentDownload = { type: "all", title, url: tab.url };
  updateStatus("Downloading media...");
  setDownloadButtonState(true, "Downloading...");
  setProgress(0, "Preparing files...");

  const zip = new JSZip();

  try {
    let progressBase = 0;
    let progressSpan = hasImages && hasVideo ? 45 : 90;

    // Images first
    if (hasImages) {
      for (let i = 0; i < images.length; i++) {
        const percent = progressBase + ((i + 1) / images.length) * progressSpan;
        setProgress(
          percent,
          `Downloading image ${i + 1} of ${images.length}...`
        );
        try {
          const response = await fetchWithSettings(images[i], {
            headers: { Referer: tab.url },
          });
          if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
          const blob = await response.blob();
          const ext = getFileExtension(blob);
          zip.file(`images/image_${i + 1}.${ext}`, blob, { binary: true });
        } catch (e) {
          console.error("[MRM] Error downloading image", images[i], e);
        }
      }
      progressBase += progressSpan;
    }

    // Then video
    if (hasVideo) {
      setProgress(progressBase + 5, "Fetching video...");
      const response = await fetchWithSettings(videoUrl, {
        headers: { Referer: tab.url },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const blob = await response.blob();
      const guessedExt = (() => {
        const byMime =
          blob.type && blob.type.includes("/") ? blob.type.split("/")[1] : null;
        const byUrl = videoUrl.split(".").pop();
        const candidate = (byMime || byUrl || "mp4").split(/[?#]/)[0];
        return candidate.length > 5 ? "mp4" : candidate;
      })();
      zip.file(`video/video.${guessedExt}`, blob, { binary: true });
      setProgress(progressBase + 45, "Added video to ZIP...");
    }

    setProgress(95, "Creating ZIP file...");
    const content = await zip.generateAsync({ type: "blob" });

    const safeTitle = title.replace(/[^a-z0-9]/gi, "_").toLowerCase();
    const filename = `${safeTitle}_p${page}_all.zip`;
    saveAs(content, filename);

    setProgress(100, "Saved ZIP file");

    addToHistory({
      title: `${title} - Page ${page}`,
      url: tab.url,
      type: "all",
      status: "completed",
      progress: 100,
    });

    updateStatus("Download completed");
    currentDownload = null;
    setDownloadButtonState(false, "Download All (ZIP)");
  } catch (error) {
    console.error("[MRM] All media download error:", error);
    updateStatus("Download failed");
    setProgress(0, "Download failed");
    addToHistory({
      title,
      url: tab.url,
      type: "all",
      status: "failed",
      progress: 0,
    });
    currentDownload = null;
    setDownloadButtonState(false, "Download All (ZIP)");
    alert("All media download failed. Check console for details.");
  }
}

async function downloadPdf(images, title, page = "1") {
  if (!images.length) {
    alert("No images found on this page.");
    setPdfButtonState(false, "Generate PDF");
    return;
  }

  const tab = await getActiveTab();
  currentDownload = { type: "pdf", title, url: tab.url };
  updateStatus("Generating PDF...");
  setPdfButtonState(true, "Generating...");
  setProgress(0, "Initializing PDF generation...");

  try {
    let jsPDF;
    if (window.jspdf && window.jspdf.jsPDF) {
      jsPDF = window.jspdf.jsPDF;
    } else if (window.jsPDF) {
      jsPDF = window.jsPDF;
    } else {
      throw new Error(
        "jsPDF library not found. Please check if jspdf.umd.min.js is loaded correctly."
      );
    }

    let pdf = null;

    for (let i = 0; i < images.length; i++) {
      const percent = ((i + 1) / images.length) * 90;
      setProgress(percent, `Processing image ${i + 1} of ${images.length}...`);

      try {
        // Add referrer header for PDF image requests
        const response = await fetchWithSettings(images[i], {
          headers: {
            Referer: tab.url,
          },
        });
        if (!response.ok) throw new Error(`HTTP error: ${response.status}`);

        const blob = await response.blob();
        const base64 = await blobToBase64(blob);
        const img = await loadImage(base64);

        // Initialize PDF on first image with page size matching image resolution (no borders)
        const orientation = img.width > img.height ? "l" : "p";
        if (!pdf) {
          pdf = new jsPDF(orientation, "px", [img.width, img.height]);
        } else {
          pdf.addPage([img.width, img.height], orientation);
        }

        // Choose image format based on mime (default to JPEG)
        const imgFormat = base64.toLowerCase().includes("png") ? "PNG" : "JPEG";

        pdf.addImage(base64, imgFormat, 0, 0, img.width, img.height);

        if (mrmSettings.debugMode) {
          console.log(`[MRM] Added image ${i + 1}/${images.length} to PDF`);
        }
      } catch (e) {
        console.error("[MRM] Error processing image for PDF", images[i], e);
        if (mrmSettings.debugMode) {
          console.error("[MRM Debug] PDF image processing error details:", e);
        }
      }
    }

    setProgress(95, "Finalizing PDF...");
    console.log("[MRM] PDF generation complete, saving...");

    const safeTitle = title.replace(/[^a-z0-9]/gi, "_").toLowerCase();
    const filename = `${safeTitle}_p${page}_manga.pdf`;

    pdf.save(filename);

    setProgress(100, "PDF saved!");

    addToHistory({
      title: `${title} - Page ${page} (PDF)`,
      url: tab.url,
      type: "pdf",
      status: "completed",
      progress: 100,
    });

    updateStatus("PDF generation completed");
    currentDownload = null;
    setPdfButtonState(false, "Generate PDF");

    console.log("[MRM] PDF generation completed");
  } catch (error) {
    console.error("[MRM] PDF generation error:", error);
    updateStatus("PDF generation failed");
    setProgress(0, "PDF generation failed");
    addToHistory({
      title,
      url: tab.url,
      type: "pdf",
      status: "failed",
      progress: 0,
    });
    currentDownload = null;
    setPdfButtonState(false, "Generate PDF");
    alert("PDF generation failed. Check console for details.");
  }
}
