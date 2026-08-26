const VIEWS = { main: "mainView", history: "historyView", settings: "settingsView", bulk: "bulkView" };
let currentView = "main";

document.addEventListener("DOMContentLoaded", async function () {
  await MRM.settings.load();
  await MRM.download.loadHistory();

  MRM.download.onProgress((percent, text) => MRM.ui.setProgress(percent, text));
  MRM.download.onStatus((text) => MRM.ui.setStatus(text));

  await checkPageContent();
  setupMainListeners();
  setupHistoryListeners();
  setupSettingsListeners();
  setupBulkListeners();

  const manifest = MRM.api.getManifest();
  MRM.ui.updateText("version", `v${manifest.version}`);
});

function showView(view) {
  currentView = view;
  Object.entries(VIEWS).forEach(([key, id]) => {
    MRM.ui.setDisplay(id, key === view ? "block" : "none");
  });
  if (view === "history") MRM.ui.renderHistory();
  if (view === "settings") refreshSettingsUI();
  if (view === "bulk") loadBulkPageInfo();
}

async function checkPageContent() {
  try {
    const tabs = await MRM.api.queryTabs({ url: "*://*.myreadingmanga.info/*" });
    const isMrm = tabs.length > 0 && (await MRM.api.getActiveTab()).url.includes("myreadingmanga.info");

    if (!isMrm) {
      hideAllDownloadButtons();
      MRM.ui.updateText("pageTitle", "No content selected");
      MRM.ui.setStatus("Navigate to a MyReadingManga page");
      return;
    }

    const data = await MRM.api.getMRMData();
    if (!data) {
      hideAllDownloadButtons();
      MRM.ui.updateText("pageTitle", "No content selected");
      MRM.ui.setStatus("No content found");
      return;
    }

    if (data.page) MRM.ui.updateText("pageNumber", data.page);

    if (!data.contentType) {
      hideAllDownloadButtons();
      MRM.ui.updateText("pageTitle", data.title || "No content selected");
      MRM.ui.setStatus(data.reason === "excluded_page" ? "Page not supported" : "No content found");
      return;
    }

    const hasImages = data.images && data.images.length > 0;
    const hasVideo = !!data.video;
    const isVideo = data.contentType === "video";
    const isImages = data.contentType === "images";

    MRM.ui.setDisplay("downloadVideoBtn", (isVideo || hasVideo) ? "block" : "none");
    MRM.ui.setDisplay("downloadImagesBtn", (isImages || hasImages) ? "block" : "none");
    MRM.ui.setDisplay("downloadPdfBtn", (isImages && hasImages && !hasVideo) ? "block" : "none");
    MRM.ui.setDisplay("downloadAllBtn", (hasImages && hasVideo) ? "block" : "none");

    if (isImages || hasImages) {
      MRM.ui.updateText("imagesButtonText", "Download Images (ZIP)");
      MRM.ui.updateText("pdfImageCount", data.images.length);
      MRM.ui.updateText("imageCount", data.images.length);
    }

    MRM.ui.updateText("pageTitle", data.title || "Manga Content");
    MRM.ui.setStatus((hasImages || hasVideo) ? "Ready" : "No content found");
  } catch (error) {
    console.error("[MRM] Error checking page content:", error);
    MRM.ui.setStatus("Error or not on MyReadingManga page");
  }
}

function hideAllDownloadButtons() {
  ["downloadImagesBtn", "downloadPdfBtn", "downloadVideoBtn", "downloadAllBtn"].forEach(id =>
    MRM.ui.setDisplay(id, "none")
  );
}

function setupMainListeners() {
  document.getElementById("downloadImagesBtn").addEventListener("click", handleDownloadImagesClick);
  document.getElementById("downloadPdfBtn").addEventListener("click", handlePdfDownloadClick);
  document.getElementById("downloadVideoBtn").addEventListener("click", handleVideoDownloadClick);
  document.getElementById("downloadAllBtn").addEventListener("click", handleDownloadAllClick);
  document.getElementById("cancelBtn").addEventListener("click", handleCancelClick);
  document.getElementById("historyBtn").addEventListener("click", () => showView("history"));
  document.getElementById("settingsBtn").addEventListener("click", () => showView("settings"));
  document.getElementById("bulkDownloadBtn").addEventListener("click", () => showView("bulk"));
  document.getElementById("aboutBtn").addEventListener("click", () => {
    alert("Download bulk images/videos from MRM. This tool is only intended to use for downloading & archiving media from MyReadingManga, please support the real artists and other works.");
  });
}

async function handleDownloadImagesClick() {
  const data = await MRM.api.getMRMData();
  if (!data || !data.images || data.images.length === 0) { alert("No images found on this page."); return; }
  MRM.ui.setDownloadButtonsState(true, "Downloading...");
  await MRM.download.downloadImages(data.images, data.title, data.page);
  MRM.ui.setDownloadButtonsState(false);
}

async function handleVideoDownloadClick() {
  const data = await MRM.api.getMRMData();
  if (!data || !data.video) { alert("No video found on this page."); return; }
  MRM.ui.setDownloadButtonsState(true, "Downloading...");
  await MRM.download.downloadVideo(data.video, data.title);
  MRM.ui.setDownloadButtonsState(false);
}

async function handlePdfDownloadClick() {
  const data = await MRM.api.getMRMData();
  if (!data || !data.images || data.images.length === 0) { alert("No images found to generate PDF."); return; }
  MRM.ui.setDownloadButtonsState(true, "Generating...");
  await MRM.download.downloadPdf(data.images, data.title, data.page);
  MRM.ui.setDownloadButtonsState(false);
}

async function handleDownloadAllClick() {
  const data = await MRM.api.getMRMData();
  if (!data) { alert("No content found."); return; }
  const hasImages = data.images && data.images.length > 0;
  const hasVideo = !!data.video;
  if (!hasImages && !hasVideo) { alert("No downloadable content."); return; }
  MRM.ui.setDownloadButtonsState(true, "Downloading...");
  await MRM.download.downloadAllMedia({
    images: hasImages ? data.images : [],
    videoUrl: hasVideo ? data.video : null,
    title: data.title,
    page: data.page || "1",
  });
  MRM.ui.setDownloadButtonsState(false);
}

function handleCancelClick() {
  if (MRM.download.currentDownload) {
    if (confirm("Are you sure you want to cancel this download?")) {
      MRM.download.currentDownload = null;
      MRM.ui.setProgress(0, "Cancelled");
      MRM.ui.setStatus("Cancelled");
      MRM.ui.setDownloadButtonsState(false);
    }
  }
}

function setupHistoryListeners() {
  document.getElementById("backFromHistoryBtn").addEventListener("click", () => showView("main"));
  document.getElementById("clearHistoryBtn").addEventListener("click", MRM.ui.clearHistory);
}

let editingCookieIndex = -1;

function refreshSettingsUI() {
  const s = MRM.settings.get();
  document.getElementById("useCookiesToggle").checked = s.useCookies;
  document.getElementById("debugModeToggle").checked = s.debugMode;
  document.getElementById("hideAIListingToggle").checked = s.hideAIListing;
  document.getElementById("retryCountSlider").value = s.retryCount;
  document.getElementById("retryCountDisplay").textContent = s.retryCount;
  document.getElementById("timeoutSlider").value = s.timeout;
  document.getElementById("timeoutDisplay").textContent = s.timeout;
  document.getElementById("cookieSourceAuto").checked = s.cookieSource === "auto";
  document.getElementById("cookieSourceCustom").checked = s.cookieSource === "custom";
  handleCookieSourceChange();
  renderCookieList();
}

function setupSettingsListeners() {
  document.getElementById("backFromSettingsBtn").addEventListener("click", () => showView("main"));
  document.getElementById("saveSettingsBtn").addEventListener("click", handleSaveSettings);
  document.getElementById("addCookieBtn").addEventListener("click", showAddCookieModal);
  document.getElementById("autoRetrieveCookiesBtn").addEventListener("click", autoRetrieveCookies);
  document.getElementById("refreshCookiesBtn").addEventListener("click", autoRetrieveCookies);
  document.getElementById("parseCookieStringBtn").addEventListener("click", parseCookieString);
  document.getElementById("closeModalBtn").addEventListener("click", hideCookieModal);
  document.getElementById("cancelCookieBtn").addEventListener("click", hideCookieModal);
  document.getElementById("saveCookieBtn").addEventListener("click", saveCookie);
  document.getElementById("cookieSourceAuto").addEventListener("change", handleCookieSourceChange);
  document.getElementById("cookieSourceCustom").addEventListener("change", handleCookieSourceChange);
  document.getElementById("cookieName").addEventListener("input", validateCookieForm);
  document.getElementById("cookieValue").addEventListener("input", validateCookieForm);

  document.getElementById("useCookiesToggle").addEventListener("change", function () {
    MRM.settings.get().useCookies = this.checked;
  });
  document.getElementById("debugModeToggle").addEventListener("change", function () {
    MRM.settings.get().debugMode = this.checked;
  });
  document.getElementById("hideAIListingToggle").addEventListener("change", function () {
    MRM.settings.get().hideAIListing = this.checked;
  });
  document.getElementById("retryCountSlider").addEventListener("input", function () {
    MRM.settings.get().retryCount = parseInt(this.value);
    MRM.ui.updateText("retryCountDisplay", this.value);
  });
  document.getElementById("timeoutSlider").addEventListener("input", function () {
    MRM.settings.get().timeout = parseInt(this.value);
    MRM.ui.updateText("timeoutDisplay", this.value);
  });

  document.getElementById("testCookiesBtn").addEventListener("click", testCookies);
  document.getElementById("clearTestCookiesBtn").addEventListener("click", clearTestCookies);
  document.getElementById("resetBtn").addEventListener("click", handleResetSettings);

  document.getElementById("cookieModal").addEventListener("click", function (e) {
    if (e.target === this) hideCookieModal();
  });
}

async function handleSaveSettings() {
  const btn = document.getElementById("saveSettingsBtn");
  btn.textContent = "Saving...";
  btn.disabled = true;
  try {
    await MRM.settings.save();
    btn.textContent = "Saved!";
  } catch (error) {
    console.error("[MRM Settings] Save error:", error);
    btn.textContent = "Error";
  }
  setTimeout(() => { btn.textContent = "Save"; btn.disabled = false; }, 1500);
}

async function handleResetSettings() {
  if (confirm("Are you sure you want to reset all settings to default?")) {
    MRM.settings._cache = { ...MRM.settings.defaults };
    refreshSettingsUI();
    await MRM.settings.save();
    alert("Settings have been reset to default values.");
  }
}

function handleCookieSourceChange() {
  const s = MRM.settings.get();
  const isAuto = document.getElementById("cookieSourceAuto").checked;
  if (isAuto) {
    s.cookieSource = "auto";
    MRM.ui.setDisplay("simpleCookieInput", "none");
    MRM.ui.setDisplay("autoRetrievedCookies", "block");
    MRM.ui.setDisplay("addCookieBtn", "none");
    autoRetrieveCookies();
  } else {
    s.cookieSource = "custom";
    MRM.ui.setDisplay("simpleCookieInput", "block");
    MRM.ui.setDisplay("autoRetrievedCookies", "none");
    document.getElementById("addCookieBtn").style.display = "inline-block";
  }
  renderCookieList();
}

async function autoRetrieveCookies() {
  const refreshBtn = document.getElementById("refreshCookiesBtn");
  const autoRetrieveBtn = document.getElementById("autoRetrieveCookiesBtn");
  if (refreshBtn) refreshBtn.textContent = "Loading...";
  if (autoRetrieveBtn) autoRetrieveBtn.textContent = "Loading...";

  try {
    const tabs = await MRM.api.queryTabs({ active: true, currentWindow: true });
    const activeTab = tabs[0];

    const cookies = await MRM.api.getCookies({ url: activeTab.url });

    MRM.settings.get().autoRetrievedCookies = cookies.map((c) => ({
      name: c.name, value: c.value, domain: c.domain, path: c.path,
      secure: c.secure, httpOnly: c.httpOnly,
    }));

    renderAutoRetrievedCookies();
  } catch (error) {
    console.error("[MRM Settings] Error auto-retrieving cookies:", error);
    alert("Failed to retrieve cookies. Make sure you're on the target website.");
  } finally {
    if (refreshBtn) refreshBtn.textContent = "Refresh";
    if (autoRetrieveBtn) autoRetrieveBtn.textContent = "Auto Retrieve";
  }
}

function renderAutoRetrievedCookies() {
  const list = document.getElementById("autoRetrievedList");
  const cookies = MRM.settings.get().autoRetrievedCookies;
  if (!cookies || cookies.length === 0) {
    list.innerHTML = '<p class="text-sm text-gray-500">No cookies found. Make sure you\'re on the target website.</p>';
    return;
  }

  list.innerHTML = cookies.map((cookie) => {
    const domain = cookie.domain || "Current domain";
    const isImportant = ["cf_clearance", "session", "auth"].some(k => cookie.name.includes(k));
    const bgColor = isImportant ? "bg-blue-50 border-blue-200" : "bg-white border-gray-200";
    return `
      <div class="flex items-center justify-between p-2 border ${bgColor} rounded text-sm">
        <div class="flex-1 min-w-0">
          <div class="flex items-center space-x-2">
            <span class="font-medium">${MRM.utils.escapeHtml(cookie.name)}</span>
            ${isImportant ? '<span class="text-xs bg-blue-100 text-blue-600 px-1 rounded">Important</span>' : ""}
          </div>
          <p class="text-xs text-gray-500 truncate">
            ${MRM.utils.escapeHtml(cookie.value.substring(0, 30))}${cookie.value.length > 30 ? "..." : ""} (${domain})
          </p>
        </div>
      </div>`;
  }).join("");
}

function renderCookieList() {
  const cookieList = document.getElementById("cookieList");
  const emptyCookies = document.getElementById("emptyCookies");
  const s = MRM.settings.get();

  if (s.cookieSource === "auto") {
    cookieList.innerHTML = "";
    emptyCookies.style.display = "none";
    return;
  }

  if (s.cookies.length === 0) {
    cookieList.innerHTML = "";
    emptyCookies.style.display = "block";
    return;
  }

  emptyCookies.style.display = "none";
  cookieList.innerHTML = s.cookies.map((cookie, index) => {
    const domain = cookie.domain || "Current domain";
    const path = cookie.path || "/";
    const flags = [];
    if (cookie.secure) flags.push("Secure");
    if (cookie.httpOnly) flags.push("HttpOnly");
    const flagsText = flags.length > 0 ? ` (${flags.join(", ")})` : "";

    return `
      <div class="cookie-item flex items-center justify-between p-3 border border-gray-200 rounded-lg">
        <div class="flex-1 min-w-0">
          <div class="flex items-center space-x-2">
            <h4 class="font-medium text-gray-800 truncate">${MRM.utils.escapeHtml(cookie.name)}</h4>
            <span class="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">${MRM.utils.escapeHtml(domain)}</span>
          </div>
          <p class="text-sm text-gray-600 truncate">Value: ${MRM.utils.escapeHtml(cookie.value.substring(0, 50))}${cookie.value.length > 50 ? "..." : ""}</p>
          <p class="text-xs text-gray-500">Path: ${MRM.utils.escapeHtml(path)}${flagsText}</p>
        </div>
        <div class="flex space-x-2 ml-3">
          <button class="edit-cookie-btn text-blue-600 hover:text-blue-800 p-1" data-index="${index}">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
            </svg>
          </button>
          <button class="delete-cookie-btn text-red-600 hover:text-red-800 p-1" data-index="${index}">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
            </svg>
          </button>
        </div>
      </div>`;
  }).join("");

  cookieList.querySelectorAll(".edit-cookie-btn").forEach((btn) => {
    btn.addEventListener("click", function () { editCookie(parseInt(this.dataset.index)); });
  });
  cookieList.querySelectorAll(".delete-cookie-btn").forEach((btn) => {
    btn.addEventListener("click", function () { deleteCookie(parseInt(this.dataset.index)); });
  });
}

function showAddCookieModal() {
  editingCookieIndex = -1;
  MRM.ui.updateText("modalTitle", "Add Cookie");
  clearCookieForm();
  document.getElementById("cookieModal").style.display = "flex";
  document.getElementById("cookieName").focus();
}

function editCookie(index) {
  editingCookieIndex = index;
  const cookie = MRM.settings.get().cookies[index];
  MRM.ui.updateText("modalTitle", "Edit Cookie");
  document.getElementById("cookieName").value = cookie.name;
  document.getElementById("cookieValue").value = cookie.value;
  document.getElementById("cookieDomain").value = cookie.domain || "";
  document.getElementById("cookiePath").value = cookie.path || "/";
  document.getElementById("cookieSecure").checked = cookie.secure || false;
  document.getElementById("cookieHttpOnly").checked = cookie.httpOnly || false;
  document.getElementById("cookieModal").style.display = "flex";
  document.getElementById("cookieName").focus();
  validateCookieForm();
}

function deleteCookie(index) {
  if (confirm("Are you sure you want to delete this cookie?")) {
    MRM.settings.get().cookies.splice(index, 1);
    renderCookieList();
  }
}

function hideCookieModal() {
  document.getElementById("cookieModal").style.display = "none";
  clearCookieForm();
  editingCookieIndex = -1;
}

function clearCookieForm() {
  document.getElementById("cookieName").value = "";
  document.getElementById("cookieValue").value = "";
  document.getElementById("cookieDomain").value = "";
  document.getElementById("cookiePath").value = "/";
  document.getElementById("cookieSecure").checked = false;
  document.getElementById("cookieHttpOnly").checked = false;
  validateCookieForm();
}

function validateCookieForm() {
  const name = document.getElementById("cookieName").value.trim();
  const value = document.getElementById("cookieValue").value.trim();
  const saveBtn = document.getElementById("saveCookieBtn");
  const isValid = name.length > 0 && value.length > 0;
  saveBtn.disabled = !isValid;
  saveBtn.classList.toggle("opacity-50", !isValid);
  saveBtn.classList.toggle("cursor-not-allowed", !isValid);
}

function saveCookie() {
  const name = document.getElementById("cookieName").value.trim();
  const value = document.getElementById("cookieValue").value.trim();
  const domain = document.getElementById("cookieDomain").value.trim();
  const path = document.getElementById("cookiePath").value.trim() || "/";

  if (!name || !value) { alert("Cookie name and value are required."); return; }
  if (!/^[a-zA-Z0-9_-]+$/.test(name)) { alert("Cookie name can only contain letters, numbers, underscore, and hyphen."); return; }

  const existingIndex = MRM.settings.get().cookies.findIndex(c => c.name === name);
  if (existingIndex !== -1 && existingIndex !== editingCookieIndex) {
    alert("A cookie with this name already exists.");
    return;
  }

  const cookie = {
    name, value,
    domain: domain || null, path,
    secure: document.getElementById("cookieSecure").checked,
    httpOnly: document.getElementById("cookieHttpOnly").checked,
  };

  if (editingCookieIndex >= 0) {
    MRM.settings.get().cookies[editingCookieIndex] = cookie;
  } else {
    MRM.settings.get().cookies.push(cookie);
  }

  renderCookieList();
  hideCookieModal();
}

function parseCookieString() {
  const cookieString = document.getElementById("cookieStringTextarea").value.trim();
  if (!cookieString) { alert("Please enter a cookie string."); return; }

  const pairs = cookieString.split(";").map(p => p.trim()).filter(Boolean);
  const parsed = [];
  for (const pair of pairs) {
    const [name, ...valueParts] = pair.split("=");
    if (name && valueParts.length > 0) {
      parsed.push({ name: name.trim(), value: valueParts.join("=").trim(), domain: null, path: "/", secure: false, httpOnly: false });
    }
  }

  if (parsed.length === 0) { alert("No valid cookies found. Check the format."); return; }

  MRM.settings.get().cookies = parsed;
  document.getElementById("cookieStringTextarea").value = "";
  renderCookieList();
  alert(`Successfully parsed ${parsed.length} cookies.`);
}

async function testCookies() {
  const testBtn = document.getElementById("testCookiesBtn");
  const testResult = document.getElementById("cookieTestResult");
  const s = MRM.settings.get();

  try {
    testBtn.textContent = "Testing...";
    testBtn.disabled = true;
    testResult.style.display = "block";
    testResult.innerHTML = "Testing cookie configuration...";

    let cookiesToUse = [];
    let sourceInfo = "";
    if (s.cookieSource === "auto" && s.autoRetrievedCookies?.length > 0) {
      cookiesToUse = s.autoRetrievedCookies;
      sourceInfo = `Auto-retrieved (${cookiesToUse.length} cookies)`;
    } else if (s.cookieSource === "custom" && s.cookies?.length > 0) {
      cookiesToUse = s.cookies;
      sourceInfo = `Custom (${cookiesToUse.length} cookies)`;
    }

    let h = `<div class="space-y-2">`;
    h += `<p><strong>Cookie Source:</strong> ${sourceInfo}</p>`;
    h += `<p><strong>Use Cookies Enabled:</strong> ${s.useCookies ? "Yes" : "No"}</p>`;

    if (!s.useCookies) {
      h += `<p class="text-orange-600"><strong>Warning:</strong> Cookie usage is disabled!</p>`;
    } else if (cookiesToUse.length === 0) {
      h += `<p class="text-red-600"><strong>Error:</strong> No cookies configured!</p>`;
    } else {
      const cookieString = cookiesToUse.map(c => `${c.name}=${c.value}`).join("; ");
      h += `<p><strong>Cookie Header:</strong></p>`;
      h += `<div class="bg-gray-100 p-2 rounded text-xs font-mono break-all">${MRM.utils.escapeHtml(cookieString.substring(0, 200))}${cookieString.length > 200 ? "..." : ""}</div>`;

      const importantCookies = cookiesToUse.filter(c => ["cf_clearance", "session", "auth", "PHPSESSID"].some(k => c.name.includes(k)));
      if (importantCookies.length > 0) {
        h += `<p><strong>Important Cookies Found:</strong></p><ul class="text-sm">`;
        importantCookies.forEach(c => { h += `<li class="text-green-600">&#10003; ${MRM.utils.escapeHtml(c.name)} (${MRM.utils.escapeHtml(c.value.substring(0, 20))}...)</li>`; });
        h += `</ul>`;
      } else {
        h += `<p class="text-orange-600">No common authentication cookies found</p>`;
      }
    }

    try {
      const tabs = await MRM.api.queryTabs({ active: true, currentWindow: true });
      const activeTab = tabs[0];
      const tabUrl = new URL(activeTab.url);
      const testUrl = `${tabUrl.origin}/favicon.ico`;

      h += `<p><strong>Test Request:</strong> ${testUrl}</p>`;

      if (cookiesToUse.length > 0) {
        for (const cookie of cookiesToUse) {
          try {
            await MRM.api.setCookie({ url: testUrl, name: cookie.name, value: cookie.value, domain: cookie.domain || tabUrl.hostname, path: cookie.path || "/", secure: cookie.secure || tabUrl.protocol === "https:", httpOnly: cookie.httpOnly || false });
            h += `<p class="text-sm text-green-600">&#10003; Set cookie: ${MRM.utils.escapeHtml(cookie.name)}</p>`;
          } catch (cookieError) {
            h += `<p class="text-sm text-red-600">&#10007; Failed: ${MRM.utils.escapeHtml(cookie.name)}: ${cookieError.message}</p>`;
          }
        }
      }

      const pageResponse = await MRM.api.pageFetch(activeTab.id, testUrl, { method: "GET" });
      if (pageResponse?.ok) {
        h += `<p><strong>Test Result:</strong> <span class="text-green-600">HTTP ${pageResponse.status} ${pageResponse.statusText}</span></p>`;
      } else {
        h += `<p><strong>Test Result:</strong> <span class="text-red-600">${pageResponse ? `HTTP ${pageResponse.status}` : "No response"}</span></p>`;
      }
    } catch (testError) {
      h += `<p><strong>Test Request Failed:</strong> <span class="text-red-600">${testError.message}</span></p>`;
    }

    h += `</div>`;
    testResult.innerHTML = h;
  } catch (error) {
    testResult.innerHTML = `<p class="text-red-600">Test failed: ${error.message}</p>`;
  } finally {
    testBtn.textContent = "Test Cookies";
    testBtn.disabled = false;
  }
}

async function clearTestCookies() {
  try {
    const tabs = await MRM.api.queryTabs({ active: true, currentWindow: true });
    const cookies = await MRM.api.getAllCookiesForUrl(tabs[0].url);
    if (cookies.length === 0) { alert("No cookies found to clear."); return; }
    if (confirm(`Clear ${cookies.length} cookies?`)) {
      let cleared = 0;
      for (const cookie of cookies) {
        try { await MRM.api.removeCookie({ url: tabs[0].url, name: cookie.name }); cleared++; } catch (e) {}
      }
      alert(`Cleared ${cleared} cookies.`);
    }
  } catch (error) {
    alert("Failed to clear cookies: " + error.message);
  }
}

const DB_NAME = "MRMBulkDownloader";
const DB_VERSION = 1;
const STORE_NAME = "bulkDownloads";

let db = null;
let currentBulkDownload = null;
let processingTabId = null;
let isPaused = false;
let isCancelled = false;

async function initDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => { db = request.result; resolve(db); };
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
        store.createIndex("timestamp", "timestamp", { unique: false });
        store.createIndex("status", "status", { unique: false });
      }
    };
  });
}

async function saveBulkState(state) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_NAME], "readwrite");
    const req = tx.objectStore(STORE_NAME).put(state);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function getIncompleteBulkDownloads() {
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_NAME], "readonly");
    const req = tx.objectStore(STORE_NAME).index("status").getAll("in-progress");
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function deleteBulkState(id) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_NAME], "readwrite");
    const req = tx.objectStore(STORE_NAME).delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

function getBaseUrl(url) {
  let cleanUrl = url.replace(/\/+$/, "");
  cleanUrl = cleanUrl.replace(/\/(page\/)?\d+$/, "");
  return cleanUrl;
}

async function detectLatestPage() {
  try {
    const tab = await MRM.api.getActiveTab();
    const baseUrl = getBaseUrl(tab.url);

    const paginationData = await chrome.tabs.sendMessage(tab.id, { type: "DETECT_PAGINATION" });
    if (paginationData?.lastPage) return paginationData.lastPage;

    let low = 1, high = 100, lastValidPage = 1;
    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      try {
        const response = await fetch(`${baseUrl}/page/${mid}/`, { method: "HEAD" });
        if (response.ok) { lastValidPage = mid; low = mid + 1; } else { high = mid - 1; }
      } catch { high = mid - 1; }
    }
    return lastValidPage;
  } catch (error) {
    console.error("[MRM Bulk] Error detecting latest page:", error);
    return 1;
  }
}

function waitForPageLoad(tabId) {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      MRM.api.tabsOnUpdated.removeListener(listener);
      resolve();
    }, 30000);

    const listener = (tid, changeInfo) => {
      if (tid === tabId && changeInfo.status === "complete") {
        clearTimeout(timeout);
        MRM.api.tabsOnUpdated.removeListener(listener);
        resolve();
      }
    };
    MRM.api.tabsOnUpdated.addListener(listener);
  });
}

async function loadBulkPageInfo() {
  try {
    const data = await MRM.api.getMRMData();
    MRM.ui.updateText("currentPageInfo", data?.page || "1");
    MRM.ui.updateText("currentTitleInfo", data?.title || "Unknown");
    MRM.ui.setValue("startPage", "1");
    MRM.ui.setValue("endPage", data?.page || "1");

    MRM.ui.updateText("latestPageInfo", "Detecting...");
    const latestPage = await detectLatestPage();
    MRM.ui.updateText("latestPageInfo", latestPage);
    MRM.ui.setValue("endPage", latestPage);
  } catch (error) {
    console.error("[MRM Bulk] Error loading page info:", error);
    MRM.ui.updateText("currentPageInfo", "Error");
    MRM.ui.updateText("currentTitleInfo", "Error loading page info");
  }

  try {
    const incomplete = await getIncompleteBulkDownloads();
    if (incomplete.length > 0) {
      currentBulkDownload = incomplete[0];
      const completedPages = currentBulkDownload.pages.filter(p => p.status === "completed").length;
      MRM.ui.setDisplay("resumeSection", "block");
      MRM.ui.updateText("resumeInfo", `${completedPages} of ${currentBulkDownload.pages.length} pages completed. Title: ${currentBulkDownload.title}`);
    }
  } catch (error) {
    console.error("[MRM Bulk] Error checking incomplete downloads:", error);
  }
}

function setupBulkListeners() {
  document.getElementById("backFromBulkBtn").addEventListener("click", () => showView("main"));
  document.getElementById("detectPagesBtn").addEventListener("click", async () => {
    MRM.ui.updateText("latestPageInfo", "Detecting...");
    const latestPage = await detectLatestPage();
    MRM.ui.updateText("latestPageInfo", latestPage);
    MRM.ui.setValue("endPage", latestPage);
  });
  document.getElementById("startBulkDownloadBtn").addEventListener("click", startBulkDownload);
  document.getElementById("resumeBtn").addEventListener("click", resumeBulkDownload);
  document.getElementById("clearResumeBtn").addEventListener("click", clearAndStartNew);
  document.getElementById("pauseBtn").addEventListener("click", pauseDownload);
  document.getElementById("bulkCancelBtn").addEventListener("click", cancelBulkDownload);
}

async function startBulkDownload() {
  const startPage = parseInt(document.getElementById("startPage").value);
  const endPage = parseInt(document.getElementById("endPage").value);
  const downloadType = document.getElementById("downloadType").value;

  if (startPage < 1 || endPage < startPage) { alert("Invalid page range"); return; }

  const tab = await MRM.api.getActiveTab();
  processingTabId = tab.id;
  const baseUrl = getBaseUrl(tab.url);
  const data = await MRM.api.getMRMData(processingTabId);

  currentBulkDownload = {
    id: Date.now(),
    title: data.title,
    baseUrl: baseUrl,
    startPage, endPage, downloadType,
    status: "in-progress",
    timestamp: new Date().toISOString(),
    pages: [],
  };

  for (let i = startPage; i <= endPage; i++) {
    currentBulkDownload.pages.push({
      pageNumber: i,
      status: "pending",
      progress: 0,
      url: i === 1 ? baseUrl + "/" : `${baseUrl}/${i}/`,
      error: null,
    });
  }

  await saveBulkState(currentBulkDownload);
  MRM.ui.setDisplay("bulkConfigCard", "none");
  MRM.ui.setDisplay("bulkProgressCard", "block");
  isPaused = false;
  isCancelled = false;
  await processBulkDownload();
}

async function resumeBulkDownload() {
  if (!currentBulkDownload) { alert("No download to resume"); return; }

  try {
    const tabs = await MRM.api.queryTabs({});
    const match = tabs.find(t => t.url.includes(currentBulkDownload.baseUrl));
    if (match) {
      processingTabId = match.id;
    } else {
      const newTab = await MRM.api.createTab({ url: currentBulkDownload.baseUrl, active: false });
      processingTabId = newTab.id;
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  } catch {
    processingTabId = (await MRM.api.getActiveTab()).id;
  }

  MRM.ui.setDisplay("bulkConfigCard", "none");
  MRM.ui.setDisplay("bulkProgressCard", "block");
  isPaused = false;
  isCancelled = false;
  await processBulkDownload();
}

async function clearAndStartNew() {
  if (currentBulkDownload) {
    await deleteBulkState(currentBulkDownload.id);
    currentBulkDownload = null;
  }
  MRM.ui.setDisplay("resumeSection", "none");
  MRM.ui.setDisplay("bulkConfigCard", "block");
  MRM.ui.setDisplay("bulkProgressCard", "none");
}

function pauseDownload() {
  isPaused = true;
  document.getElementById("pauseBtn").textContent = "Resume";
  MRM.ui.updateText("overallStatus", "Paused");

  const resumeHandler = () => {
    isPaused = false;
    document.getElementById("pauseBtn").textContent = "Pause";
    document.getElementById("pauseBtn").removeEventListener("click", resumeHandler);
    processBulkDownload();
  };
  document.getElementById("pauseBtn").addEventListener("click", resumeHandler);
}

async function cancelBulkDownload() {
  if (confirm("Are you sure you want to cancel this bulk download?")) {
    isCancelled = true;
    isPaused = false;
    if (currentBulkDownload) {
      currentBulkDownload.status = "cancelled";
      await saveBulkState(currentBulkDownload);
    }
    MRM.ui.updateText("overallStatus", "Cancelled");
    setTimeout(() => showView("main"), 1500);
  }
}

async function processBulkDownload() {
  if (!currentBulkDownload) return;
  renderPageList();

  const pendingPages = currentBulkDownload.pages.filter(p => p.status === "pending" || p.status === "failed");
  for (const page of pendingPages) {
    if (isPaused || isCancelled) {
      await saveBulkState(currentBulkDownload);
      return;
    }
    await downloadPage(page);
    updateOverallProgress();
    renderPageList();
    await saveBulkState(currentBulkDownload);
  }

  currentBulkDownload.status = "completed";
  await saveBulkState(currentBulkDownload);
  MRM.ui.updateText("overallStatus", "All downloads completed!");
  setTimeout(() => {
    if (confirm("All downloads completed! Return to main page?")) showView("main");
  }, 1500);
}

async function downloadPage(page) {
  page.status = "downloading";
  renderPageList();

  try {
    if (!processingTabId) processingTabId = (await MRM.api.getActiveTab()).id;

    await MRM.api.updateTab(processingTabId, { url: page.url, active: true });
    await waitForPageLoad(processingTabId);
    await new Promise(resolve => setTimeout(resolve, 3000));

    const data = await MRM.api.getMRMData(processingTabId);
    if (!data || (!data.images?.length && !data.video)) {
      throw new Error("No content found on page");
    }

    const tab = await MRM.api.getTab(processingTabId);

    switch (currentBulkDownload.downloadType) {
      case "images": await downloadPageImages(data, page, tab); break;
      case "pdf": await downloadPagePdf(data, page, tab); break;
      case "all": await downloadPageAll(data, page, tab); break;
    }

    page.status = "completed";
    page.progress = 100;
  } catch (error) {
    console.error(`[MRM Bulk] Error downloading page ${page.pageNumber}:`, error);
    page.status = "failed";
    page.error = error.message;
  }

  renderPageList();
}

async function downloadPageImages(data, page, tab) {
  const { images, title } = data;
  if (!images?.length) throw new Error("No images to ZIP");
  const zip = new JSZip();

  for (let i = 0; i < images.length; i++) {
    page.progress = Math.floor((i / images.length) * 100);
    renderPageList();
    try {
      const response = await MRM.fetch.fetchWithSettings(images[i], { headers: { Referer: tab.url } }, tab.id);
      const blob = await response.blob();
      zip.file(`image_${i + 1}.${MRM.utils.getFileExtension(blob)}`, blob, { binary: true });
    } catch (error) {
      console.error(`[MRM Bulk] Error downloading image ${i + 1}:`, error);
    }
  }

  const content = await zip.generateAsync({ type: "blob" });
  await triggerDownload(content, `${MRM.utils.sanitizeFilename(title)} - Page ${page.pageNumber}.zip`);
}

async function downloadPagePdf(data, page, tab) {
  const { images, title } = data;
  const jsPDF = window.jspdf?.jsPDF || window.jsPDF;
  if (!jsPDF) throw new Error("jsPDF not loaded");

  let pdf = null;
  for (let i = 0; i < images.length; i++) {
    page.progress = Math.floor((i / images.length) * 100);
    renderPageList();
    try {
      const response = await MRM.fetch.fetchWithSettings(images[i], { headers: { Referer: tab.url } }, tab.id);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const blob = await response.blob();
      const base64 = await MRM.utils.blobToBase64(blob);
      const img = await MRM.utils.loadImage(base64);
      const orientation = img.width > img.height ? "l" : "p";
      if (!pdf) pdf = new jsPDF(orientation, "px", [img.width, img.height]);
      else pdf.addPage([img.width, img.height], orientation);
      pdf.addImage(base64, base64.toLowerCase().includes("png") ? "PNG" : "JPEG", 0, 0, img.width, img.height);
    } catch (error) {
      console.error(`[MRM Bulk] Error processing image ${i + 1}:`, error);
    }
  }

  await triggerDownload(pdf.output("blob"), `${MRM.utils.sanitizeFilename(title).toLowerCase()}_p${page.pageNumber}_manga.pdf`);
}

async function downloadPageAll(data, page, tab) {
  const { images, video, title } = data;
  const zip = new JSZip();

  if (images?.length > 0) {
    for (let i = 0; i < images.length; i++) {
      page.progress = Math.floor((i / (images.length + (video ? 1 : 0))) * 100);
      renderPageList();
      try {
        const response = await MRM.fetch.fetchWithSettings(images[i], { headers: { Referer: tab.url } }, tab.id);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const blob = await response.blob();
        zip.file(`images/image_${i + 1}.${MRM.utils.getFileExtension(blob)}`, blob, { binary: true });
      } catch (error) {
        console.error(`[MRM Bulk] Error downloading image ${i + 1}:`, error);
      }
    }
  }

  if (video) {
    try {
      const response = await MRM.fetch.fetchWithSettings(video, { headers: { Referer: tab.url } }, tab.id);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const blob = await response.blob();
      zip.file(`video/video.${video.split(".").pop() || "mp4"}`, blob, { binary: true });
    } catch (error) {
      console.error("[MRM Bulk] Error downloading video:", error);
    }
  }

  page.progress = 95;
  renderPageList();
  const content = await zip.generateAsync({ type: "blob" });
  await triggerDownload(content, `${MRM.utils.sanitizeFilename(title).toLowerCase()}_p${page.pageNumber}_all.zip`);
}

async function triggerDownload(content, filename) {
  const sanitized = MRM.utils.sanitizeFilename(filename);
  const blobUrl = URL.createObjectURL(content);
  try {
    await MRM.api.triggerDownload(blobUrl, sanitized);
  } catch (err) {
    if (typeof saveAs !== "undefined") saveAs(content, sanitized);
  } finally {
    setTimeout(() => URL.revokeObjectURL(blobUrl), 30000);
  }
}

function updateOverallProgress() {
  const total = currentBulkDownload.pages.length;
  const completed = currentBulkDownload.pages.filter(p => p.status === "completed").length;
  const failed = currentBulkDownload.pages.filter(p => p.status === "failed").length;
  const percent = Math.floor((completed / total) * 100);

  MRM.ui.setWidth("overallProgressBar", `${percent}%`);
  MRM.ui.updateText("overallProgressText", `${percent}%`);
  MRM.ui.updateText("overallProgressStatus", `${completed} / ${total} pages (${failed} failed)`);
  MRM.ui.updateText("overallStatus", failed > 0 ? `Downloading... (${failed} pages failed)` : "Downloading...");
}

function renderPageList() {
  const pageList = document.getElementById("pageList");
  if (!currentBulkDownload) {
    pageList.innerHTML = '<p class="text-gray-500 text-sm">No active download</p>';
    return;
  }

  pageList.innerHTML = currentBulkDownload.pages.map(page => {
    const statusText = page.status.charAt(0).toUpperCase() + page.status.slice(1);
    const progressBar = page.status === "downloading"
      ? `<div class="w-full bg-gray-200 rounded-full h-1 mt-1"><div class="bg-blue-500 h-1 rounded-full" style="width: ${page.progress}%"></div></div>`
      : "";

    return `
      <div class="page-item p-3 border border-gray-200 rounded-lg status-${page.status}">
        <div class="flex justify-between items-center">
          <div class="flex-1">
            <p class="text-sm font-medium">Page ${page.pageNumber}</p>
            ${page.error ? `<p class="text-xs text-red-600 mt-1">${page.error}</p>` : ""}
          </div>
          <span class="text-xs font-medium px-2 py-1 rounded">${statusText}</span>
        </div>
        ${progressBar}
      </div>`;
  }).join("");
}

initDB().catch(console.error);
