// MRM Bulk Downloader
// IndexedDB for persistent storage

const DB_NAME = 'MRMBulkDownloader';
const DB_VERSION = 1;
const STORE_NAME = 'bulkDownloads';

let db = null;
let currentBulkDownload = null;
let processingTabId = null;
let isPaused = false;
let isCancelled = false;
let mrmSettings = {
  useCookies: true,
  retryCount: 3,
  timeout: 30,
  debugMode: true,
  cookieSource: "auto", // "auto" or "custom"
  cookies: [],
  autoRetrievedCookies: [],
  hideAIListing: true,
};

// IndexedDB Setup
async function initDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const objectStore = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        objectStore.createIndex('timestamp', 'timestamp', { unique: false });
        objectStore.createIndex('status', 'status', { unique: false });
      }
    };
  });
}

// Save bulk download state to IndexedDB
async function saveBulkDownloadState(state) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const objectStore = transaction.objectStore(STORE_NAME);
    const request = objectStore.put(state);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Get bulk download state from IndexedDB
async function getBulkDownloadState(id) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const objectStore = transaction.objectStore(STORE_NAME);
    const request = objectStore.get(id);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Get all incomplete bulk downloads
async function getIncompleteBulkDownloads() {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const objectStore = transaction.objectStore(STORE_NAME);
    const index = objectStore.index('status');
    const request = index.getAll('in-progress');

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Delete bulk download state
async function deleteBulkDownloadState(id) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const objectStore = transaction.objectStore(STORE_NAME);
    const request = objectStore.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// Utility: Sanitize filename
function sanitizeFilename(filename) {
  return filename.replace(/[/*?:"<>|]/g, "_");
}

// Utility: Get file extension from blob
function getFileExtension(blob, fallback = 'jpg') {
  if (!blob.type) return fallback;
  const parts = blob.type.split('/');
  return parts[1] || fallback;
}

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

// Utility: Get timeout value
function getTimeout() {
  return (mrmSettings.timeout || 30) * 1000;
}

// Utility: Get retry count
function getRetryCount() {
  return mrmSettings.retryCount || 3;
}

// Utility: Get tab by ID or active tab
async function getTab(tabId = null) {
  return tabId ? await browser.tabs.get(tabId) : await getActiveTab();
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

// Utility: Set element value
function setElementValue(id, value) {
  const el = document.getElementById(id);
  if (el) el.value = value;
}

// Get active tab
async function getActiveTab() {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  return tab;
}

// Get MRM data from content script
async function getMRMData(tabId = null) {
  const tab = await getTab(tabId);
  return browser.tabs.sendMessage(tab.id, { type: 'GET_MRM_DATA' });
}

// Load settings
async function loadSettings() {
  try {
    const result = await browser.storage.local.get(['mrmSettings']);
    if (result.mrmSettings) {
      mrmSettings = { ...mrmSettings, ...result.mrmSettings };
    }
  } catch (error) {
    console.error('[MRM Bulk] Error loading settings:', error);
  }
}

// Detect latest page number
async function detectLatestPage() {
  try {
    const tab = await getActiveTab();
    const baseUrl = getBaseUrl(tab.url);

    // Try to find pagination on current page
    const data = await getMRMData();

    // Send message to content script to detect pagination
    const paginationData = await browser.tabs.sendMessage(tab.id, {
      type: 'DETECT_PAGINATION'
    });

    if (paginationData && paginationData.lastPage) {
      return paginationData.lastPage;
    }

    // Fallback: binary search for last page
    let low = 1;
    let high = 100; // Start with reasonable upper bound
    let lastValidPage = 1;

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      const testUrl = `${baseUrl}/page/${mid}/`;

      try {
        const response = await fetch(testUrl, { method: 'HEAD' });
        if (response.ok) {
          lastValidPage = mid;
          low = mid + 1;
        } else {
          high = mid - 1;
        }
      } catch (error) {
        high = mid - 1;
      }
    }

    return lastValidPage;
  } catch (error) {
    console.error('[MRM Bulk] Error detecting latest page:', error);
    return 1;
  }
}

// Initialize page
document.addEventListener('DOMContentLoaded', async function () {
  await initDB();
  await loadSettings();
  await loadCurrentPageInfo();
  await checkForIncompleteDownloads();
  setupEventListeners();
});

// Load current page info
async function loadCurrentPageInfo() {
  try {
    const data = await getMRMData();
    const tab = await getActiveTab();

    updateStatusText('currentPageInfo', data.page || '1');
    updateStatusText('currentTitleInfo', data.title || 'Unknown');

    // Set initial values
    setElementValue('startPage', '1');
    setElementValue('endPage', data.page || '1');

    // Auto-detect latest page
    updateStatusText('latestPageInfo', 'Detecting...');
    const latestPage = await detectLatestPage();
    updateStatusText('latestPageInfo', latestPage);
    setElementValue('endPage', latestPage);

  } catch (error) {
    console.error('[MRM Bulk] Error loading page info:', error);
    updateStatusText('currentPageInfo', 'Error');
    updateStatusText('currentTitleInfo', 'Error loading page info');
  }
}

// Check for incomplete downloads
async function checkForIncompleteDownloads() {
  try {
    const incompleteDownloads = await getIncompleteBulkDownloads();

    if (incompleteDownloads.length > 0) {
      const latest = incompleteDownloads[0];
      const completedPages = latest.pages.filter(p => p.status === 'completed').length;
      const totalPages = latest.pages.length;

      setElementDisplay('resumeSection', 'block');
      updateStatusText('resumeInfo', `${completedPages} of ${totalPages} pages completed. Title: ${latest.title}`);

      // Store for resume
      currentBulkDownload = latest;
    }
  } catch (error) {
    console.error('[MRM Bulk] Error checking incomplete downloads:', error);
  }
}

// Setup event listeners
function setupEventListeners() {
  document.getElementById('backBtn').addEventListener('click', () => {
    window.location.href = 'popup.html';
  });

  document.getElementById('detectPagesBtn').addEventListener('click', async () => {
    updateStatusText('latestPageInfo', 'Detecting...');
    const latestPage = await detectLatestPage();
    updateStatusText('latestPageInfo', latestPage);
    setElementValue('endPage', latestPage);
  });

  document.getElementById('startDownloadBtn').addEventListener('click', startBulkDownload);
  document.getElementById('resumeBtn').addEventListener('click', resumeBulkDownload);
  document.getElementById('clearResumeBtn').addEventListener('click', clearAndStartNew);
  document.getElementById('pauseBtn').addEventListener('click', pauseDownload);
  document.getElementById('cancelBtn').addEventListener('click', cancelDownload);
}

// Start bulk download
async function startBulkDownload() {
  const startPage = parseInt(document.getElementById('startPage').value);
  const endPage = parseInt(document.getElementById('endPage').value);
  const downloadType = document.getElementById('downloadType').value;

  if (startPage < 1 || endPage < startPage) {
    alert('Invalid page range');
    return;
  }

  const tab = await getActiveTab();
  processingTabId = tab.id;
  const baseUrl = getBaseUrl(tab.url);
  const data = await getMRMData(processingTabId);

  // Create bulk download state
  const bulkDownload = {
    id: Date.now(),
    title: data.title,
    baseUrl: baseUrl,
    startPage: startPage,
    endPage: endPage,
    downloadType: downloadType,
    status: 'in-progress',
    timestamp: new Date().toISOString(),
    pages: []
  };

  // Initialize page states
  for (let i = startPage; i <= endPage; i++) {
    bulkDownload.pages.push({
      pageNumber: i,
      status: 'pending',
      progress: 0,
      url: i === 1 ? baseUrl + '/' : `${baseUrl}/${i}/`,
      error: null
    });
  }

  currentBulkDownload = bulkDownload;
  await saveBulkDownloadState(bulkDownload);

  // Show progress UI
  setElementDisplay('configCard', 'none');
  setElementDisplay('progressCard', 'block');

  // Start downloading
  await processBulkDownload();
}

// Resume bulk download
async function resumeBulkDownload() {
  if (!currentBulkDownload) {
    alert('No download to resume');
    return;
  }

  // Restore processing tab mechanism
  try {
    const tabs = await browser.tabs.query({});
    // Try to find a tab that matches the base URL
    const match = tabs.find(t => t.url.includes(currentBulkDownload.baseUrl));
    if (match) {
      processingTabId = match.id;
    } else {
      // Create new tab if not found (in background)
      const newTab = await browser.tabs.create({ url: currentBulkDownload.baseUrl, active: false });
      processingTabId = newTab.id;
      // Wait for it to load
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  } catch (err) {
    console.error("Error restoring tab for resume:", err);
    // Fallback to active if creation failed
    const active = await getActiveTab();
    processingTabId = active.id;
  }

  setElementDisplay('configCard', 'none');
  setElementDisplay('progressCard', 'block');

  isPaused = false;
  isCancelled = false;

  await processBulkDownload();
}

// Clear and start new
async function clearAndStartNew() {
  if (currentBulkDownload) {
    await deleteBulkDownloadState(currentBulkDownload.id);
    currentBulkDownload = null;
  }

  setElementDisplay('resumeSection', 'none');
  setElementDisplay('configCard', 'block');
  setElementDisplay('progressCard', 'none');
}

// Pause download
function pauseDownload() {
  isPaused = true;
  document.getElementById('pauseBtn').textContent = 'Resume';
  document.getElementById('pauseBtn').onclick = () => {
    isPaused = false;
    document.getElementById('pauseBtn').textContent = 'Pause';
    processBulkDownload();
  };
  updateStatusText('overallStatus', 'Paused');
}

// Cancel download
async function cancelDownload() {
  if (confirm('Are you sure you want to cancel this bulk download?')) {
    isCancelled = true;
    isPaused = false;

    if (currentBulkDownload) {
      currentBulkDownload.status = 'cancelled';
      await saveBulkDownloadState(currentBulkDownload);
    }

    updateStatusText('overallStatus', 'Cancelled');

    setTimeout(() => {
      window.location.href = 'popup.html';
    }, 1500);
  }
}

// Process bulk download
async function processBulkDownload() {
  if (!currentBulkDownload) return;

  renderPageList();

  const pendingPages = currentBulkDownload.pages.filter(p =>
    p.status === 'pending' || p.status === 'failed'
  );

  for (const page of pendingPages) {
    if (isPaused || isCancelled) {
      await saveBulkDownloadState(currentBulkDownload);
      return;
    }

    await downloadPage(page);
    updateOverallProgress();
    renderPageList();
    await saveBulkDownloadState(currentBulkDownload);
  }

  // All pages completed
  currentBulkDownload.status = 'completed';
  await saveBulkDownloadState(currentBulkDownload);

  updateStatusText('overallStatus', 'All downloads completed!');

  setTimeout(() => {
    if (confirm('All downloads completed! Return to main page?')) {
      window.location.href = 'popup.html';
    }
  }, 1500);
}

// Download single page
async function downloadPage(page) {
  page.status = 'downloading';
  renderPageList();

  try {
    // Ensure we have a tab ID
    if (!processingTabId) {
      const tab = await getActiveTab();
      processingTabId = tab.id;
    }

    // Navigate to the page URL
    console.log(`[MRM Bulk] Navigating to ${page.url}`);

    // Ensure tab is active so content scripts run reliably
    await browser.tabs.update(processingTabId, { url: page.url, active: true });

    // Setup listener BEFORE updating to catch immediate events
    const loadPromise = waitForPageLoad(processingTabId, page.url);

    // Wait for actual load completion
    await loadPromise;

    // Small buffer for content script initialization (increased for safety)
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Get page data using specific tab
    const data = await getMRMData(processingTabId);
    console.log('[MRM Bulk] Scraped data:', data);

    if (!data || (!data.images?.length && !data.video)) {
      console.error('[MRM Bulk] Content check failed. Data:', data);
      throw new Error('No content found on page (scrolling might be required or content script failed)');
    }

    // Download based on type
    switch (currentBulkDownload.downloadType) {
      case 'images':
        await downloadPageImages(data, page, processingTabId);
        break;
      case 'pdf':
        await downloadPagePdf(data, page, processingTabId);
        break;
      case 'all':
        await downloadPageAll(data, page, processingTabId);
        break;
    }

    page.status = 'completed';
    page.progress = 100;

  } catch (error) {
    console.error(`[MRM Bulk] Error downloading page ${page.pageNumber}:`, error);
    page.status = 'failed';
    page.error = error.message;
  }

  renderPageList();
}

// Download page images
async function downloadPageImages(data, page, tabId) {
  const { images, title } = data;
  if (!images || images.length === 0) throw new Error('No images to ZIP');

  const zip = new JSZip();
  const tab = await browser.tabs.get(tabId);

  for (let i = 0; i < images.length; i++) {
    page.progress = Math.floor((i / images.length) * 100);
    renderPageList();

    try {
      const response = await fetchWithSettings(images[i], {
        headers: { Referer: tab.url }
      }, tabId);

      const blob = await response.blob();
      const ext = getFileExtension(blob);
      zip.file(`image_${i + 1}.${ext}`, blob, { binary: true });
    } catch (error) {
      console.error(`[MRM Bulk] Error downloading image ${i + 1}:`, error);
    }
  }

  const content = await zip.generateAsync({ type: 'blob' });
  const filename = `${sanitizeFilename(title)} - Page ${page.pageNumber}.zip`;

  await triggerDownload(content, filename);
}

// Download page PDF
async function downloadPagePdf(data, page, tabId) {
  const { images, title } = data;
  const tab = await browser.tabs.get(tabId);

  const jsPDF = window.jspdf?.jsPDF || window.jsPDF;
  if (!jsPDF) throw new Error('jsPDF not loaded');

  let pdf = null;

  for (let i = 0; i < images.length; i++) {
    page.progress = Math.floor((i / images.length) * 100);
    renderPageList();

    try {
      const response = await fetchWithSettings(images[i], {
        headers: { Referer: tab.url }
      }, tabId);

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const blob = await response.blob();
      const base64 = await blobToBase64(blob);
      const img = await loadImage(base64);

      const orientation = img.width > img.height ? 'l' : 'p';
      if (!pdf) {
        pdf = new jsPDF(orientation, 'px', [img.width, img.height]);
      } else {
        pdf.addPage([img.width, img.height], orientation);
      }

      const imgFormat = base64.toLowerCase().includes('png') ? 'PNG' : 'JPEG';
      pdf.addImage(base64, imgFormat, 0, 0, img.width, img.height);

    } catch (error) {
      console.error(`[MRM Bulk] Error processing image ${i + 1}:`, error);
    }
  }

  const filename = `${sanitizeFilename(title).toLowerCase()}_p${page.pageNumber}_manga.pdf`;

  const pdfBlob = pdf.output('blob');
  await triggerDownload(pdfBlob, filename);
}

// Download page all media
async function downloadPageAll(data, page, tabId) {
  const { images, video, title } = data;
  const zip = new JSZip();
  const tab = await browser.tabs.get(tabId);

  // Download images
  if (images && images.length > 0) {
    for (let i = 0; i < images.length; i++) {
      page.progress = Math.floor((i / (images.length + (video ? 1 : 0))) * 100);
      renderPageList();

      try {
        const response = await fetchWithSettings(images[i], {
          headers: { Referer: tab.url }
        }, tabId);

        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const blob = await response.blob();
        const ext = getFileExtension(blob);
        zip.file(`images/image_${i + 1}.${ext}`, blob, { binary: true });
      } catch (error) {
        console.error(`[MRM Bulk] Error downloading image ${i + 1}:`, error);
      }
    }
  }

  // Download video
  if (video) {
    try {
      const response = await fetchWithSettings(video, {
        headers: { Referer: tab.url }
      }, tabId);

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const blob = await response.blob();
      const ext = video.split('.').pop() || 'mp4';
      zip.file(`video/video.${ext}`, blob, { binary: true });
    } catch (error) {
      console.error(`[MRM Bulk] Error downloading video:`, error);
    }
  }

  page.progress = 95;
  renderPageList();

  const content = await zip.generateAsync({ type: 'blob' });
  const filename = `${sanitizeFilename(title).toLowerCase()}_p${page.pageNumber}_all.zip`;

  await triggerDownload(content, filename);
}

async function triggerDownload(content, filename) {
  const sanitized = sanitizeFilename(filename);
  const blobUrl = URL.createObjectURL(content);

  try {
    await browser.downloads.download({
      url: blobUrl,
      filename: sanitized,
      saveAs: false,
      conflictAction: 'uniquify'
    });
    console.log(`[MRM Bulk] Successfully triggered download: ${sanitized}`);
  } catch (err) {
    console.error("[MRM Bulk] Native download failed, falling back to saveAs:", err);
    if (typeof saveAs !== 'undefined') {
      saveAs(content, sanitized);
    } else {
      console.error("saveAs is not defined.");
    }
  } finally {
    setTimeout(() => URL.revokeObjectURL(blobUrl), 30000);
  }
}

// Helper: Blob to Base64
function blobToBase64(blob) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(blob);
  });
}

// Helper: Load image
function loadImage(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.src = src;
  });
}

// Set cookies in browser (consolidated)
async function setCookiesInBrowser(url) {
  if (!mrmSettings.useCookies) {
    if (mrmSettings.debugMode) console.log(`[MRM Bulk] Cookie usage disabled, skipping`);
    return;
  }

  const cookiesToUse = getCookiesToUse();
  if (cookiesToUse.length === 0) {
    if (mrmSettings.debugMode) console.log(`[MRM Bulk] No cookies to set`);
    return;
  }

  const urlObj = new URL(url);
  if (mrmSettings.debugMode) {
    console.log(`[MRM Bulk] Setting ${cookiesToUse.length} cookies for ${urlObj.origin}`);
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
          if (mrmSettings.debugMode) {
            console.log(
              `[MRM Bulk] Successfully set cookie: ${cookie.name} for domain: ${domain}`
            );
          }
          cookieSet = true;
          break;
        } catch (domainError) {
          if (mrmSettings.debugMode) {
            console.log(
              `[MRM Bulk] Failed to set cookie ${cookie.name} for domain ${domain}:`,
              domainError.message
            );
          }
        }
      }

      if (!cookieSet && mrmSettings.debugMode) {
        console.error(
          `[MRM Bulk] Failed to set cookie ${cookie.name} for any domain`
        );
      }
    } catch (error) {
      console.error(`[MRM Bulk] Failed to set cookie ${cookie.name}:`, error);
    }
  }
}

// Fetch with settings (copied from popup.js - synchronized)
async function fetchWithSettings(url, options = {}, tabId = null) {
  // Use specific tab or active tab
  const tab = await getTab(tabId);

  await setCookiesInBrowser(url);

  const pageFetchOptions = {
    method: (options && options.method) || "GET",
  };
  if (options && options.headers && options.headers.Referer) {
    pageFetchOptions.referrer = options.headers.Referer;
  }

  if (mrmSettings.debugMode) console.log(`[MRM Bulk] (Page) Fetching ${url}`);

  let lastError;

  // PAGE CONTEXT FETCH ATTEMPTS
  const retryCount = getRetryCount();
  for (let attempt = 1; attempt <= retryCount; attempt++) {
    try {
      if (mrmSettings.debugMode) console.log(`[MRM Bulk] (Page) Fetch attempt ${attempt} for ${url}`);

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
      console.error(`[MRM Bulk] (Page) Fetch attempt ${attempt} failed:`, error.message);
      if (attempt < retryCount) {
        const waitTime = Math.pow(2, attempt - 1) * 1000;
        await new Promise((resolve) => setTimeout(resolve, waitTime));
      }
    }
  }

  if (mrmSettings.debugMode) console.log(`[MRM Bulk] Falling back to extension-context fetch for ${url}`);

  // FALLBACK: EXTENSION CONTEXT FETCH
  const defaultHeaders = {
    "User-Agent": navigator.userAgent,
    Accept: "image/webp,image/avif,image/*,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5",
    "Accept-Encoding": "gzip, deflate, br",
    DNT: "1",
    Connection: "keep-alive",
    "Sec-Fetch-Dest": "image",
    "Sec-Fetch-Mode": "no-cors",
    "Sec-Fetch-Site": "same-site",
  };

  const fallbackHeaders = {
    ...defaultHeaders,
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
      if (mrmSettings.debugMode) console.log(`[MRM Bulk] (Ext) Fetch attempt ${attempt} for ${url}`);

      const res = await fetch(url, fallbackOptions);
      if (!res.ok) {
        console.error(`[MRM Bulk] (Ext) Response status: ${res.status}`);
      }
      return res;
    } catch (err) {
      lastFallbackError = err;
      console.error(`[MRM Bulk] (Ext) Fetch attempt ${attempt} failed:`, err.message);
      if (attempt < retryCount) {
        const waitTime = Math.pow(2, attempt - 1) * 1000;
        await new Promise((resolve) => setTimeout(resolve, waitTime));
      }
    }
  }

  throw lastError || lastFallbackError || new Error("Fetch failed");
}

// Update overall progress (consolidated)
function updateOverallProgress() {
  const totalPages = currentBulkDownload.pages.length;
  const completedPages = currentBulkDownload.pages.filter(p => p.status === 'completed').length;
  const failedPages = currentBulkDownload.pages.filter(p => p.status === 'failed').length;

  const progressPercent = Math.floor((completedPages / totalPages) * 100);

  setElementWidth('overallProgressBar', `${progressPercent}%`);
  updateStatusText('overallProgressText', `${progressPercent}%`);
  updateStatusText('overallProgressStatus', `${completedPages} / ${totalPages} pages (${failedPages} failed)`);

  const statusMsg = failedPages > 0 ? `Downloading... (${failedPages} pages failed)` : 'Downloading...';
  updateStatusText('overallStatus', statusMsg);
}

function renderPageList() {
  const pageList = document.getElementById('pageList');

  if (!currentBulkDownload) {
    pageList.innerHTML = '<p class="text-gray-500 text-sm">No active download</p>';
    return;
  }

  pageList.innerHTML = currentBulkDownload.pages.map(page => {
    const statusClass = `status-${page.status}`;
    const statusText = page.status.charAt(0).toUpperCase() + page.status.slice(1);
    const progressBar = page.status === 'downloading'
      ? `<div class="w-full bg-gray-200 rounded-full h-1 mt-1">
           <div class="bg-blue-500 h-1 rounded-full" style="width: ${page.progress}%"></div>
         </div>`
      : '';

    return `
      <div class="page-item p-3 border border-gray-200 rounded-lg ${statusClass}">
        <div class="flex justify-between items-center">
          <div class="flex-1">
            <p class="text-sm font-medium">Page ${page.pageNumber}</p>
            ${page.error ? `<p class="text-xs text-red-600 mt-1">${page.error}</p>` : ''}
          </div>
          <span class="text-xs font-medium px-2 py-1 rounded">${statusText}</span>
        </div>
        ${progressBar}
      </div>
    `;
  }).join('');
}

// Helper: Get base URL without pagination
function getBaseUrl(url) {
  // Remove trailing slashes
  let cleanUrl = url.replace(/\/+$/, '');
  // Remove /page/N or /N if it's at the end
  // This matches MRM post pagination (/2/) and archive pagination (/page/2/)
  cleanUrl = cleanUrl.replace(/\/(page\/)?\d+$/, '');
  return cleanUrl;
}

// Wait for tab update to complete
function waitForPageLoad(tabId, targetUrl) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      browser.tabs.onUpdated.removeListener(listener);
      console.warn('[MRM Bulk] Navigation timeout');
      // Resolve anyway to try scraping, might just be a lingering request
      resolve();
    }, 30000); // 30s timeout

    const listener = (tid, changeInfo, tab) => {
      if (tid === tabId && changeInfo.status === 'complete') {
        // Optional: check if URL matches targetUrl (ignoring trailing slashes)
        // const currentUrl = tab.url.replace(/\/$/, '');
        // const target = targetUrl.replace(/\/$/, '');

        // accepting if it's complete, as redirects might happen
        clearTimeout(timeout);
        browser.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    };

    browser.tabs.onUpdated.addListener(listener);
  });
}
