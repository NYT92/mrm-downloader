let settings = {
  useCookies: true,
  retryCount: 3,
  timeout: 30,
  debugMode: false,
  cookieSource: "auto", // "auto" or "custom"
  cookies: [],
  autoRetrievedCookies: [],
  hideAIListing: true,
};

let editingCookieIndex = -1;

document.addEventListener("DOMContentLoaded", async function () {
  await loadSettings();
  setupEventListeners();
  updateUI();
});

async function loadSettings() {
  try {
    const result = await browser.storage.local.get(["mrmSettings"]);
    if (result.mrmSettings) {
      settings = { ...settings, ...result.mrmSettings };
    }
  } catch (error) {
    console.error("[MRM Settings] Error loading settings:", error);
  }
}

async function saveSettings() {
  try {
    await browser.storage.local.set({ mrmSettings: settings });
    console.log("[MRM Settings] Settings saved:", settings);
  } catch (error) {
    console.error("[MRM Settings] Error saving settings:", error);
    alert("Failed to save settings. Please try again.");
  }
}

function setupEventListeners() {
  // Navigation
  document.getElementById("backBtn").addEventListener("click", goBack);
  document.getElementById("saveBtn").addEventListener("click", handleSave);

  // Cookie management
  document
    .getElementById("addCookieBtn")
    .addEventListener("click", showAddCookieModal);
  document
    .getElementById("autoRetrieveCookiesBtn")
    .addEventListener("click", autoRetrieveCookies);
  document
    .getElementById("refreshCookiesBtn")
    .addEventListener("click", autoRetrieveCookies);
  document
    .getElementById("parseCookieStringBtn")
    .addEventListener("click", parseCookieString);
  document
    .getElementById("closeModalBtn")
    .addEventListener("click", hideCookieModal);
  document
    .getElementById("cancelCookieBtn")
    .addEventListener("click", hideCookieModal);
  document
    .getElementById("saveCookieBtn")
    .addEventListener("click", saveCookie);

  // Cookie source radio buttons
  document
    .getElementById("cookieSourceAuto")
    .addEventListener("change", handleCookieSourceChange);
  document
    .getElementById("cookieSourceCustom")
    .addEventListener("change", handleCookieSourceChange);

  // Settings toggles and sliders
  document
    .getElementById("useCookiesToggle")
    .addEventListener("change", function () {
      settings.useCookies = this.checked;
    });

  document
    .getElementById("debugModeToggle")
    .addEventListener("change", function () {
      settings.debugMode = this.checked;
    });

  document
    .getElementById("hideAIListingToggle")
    .addEventListener("change", function () {
      settings.hideAIListing = this.checked;
    });

  document
    .getElementById("retryCountSlider")
    .addEventListener("input", function () {
      settings.retryCount = parseInt(this.value);
      document.getElementById("retryCountDisplay").textContent = this.value;
    });

  document
    .getElementById("timeoutSlider")
    .addEventListener("input", function () {
      settings.timeout = parseInt(this.value);
      document.getElementById("timeoutDisplay").textContent = this.value;
    });

  // Reset settings
  document.getElementById("resetBtn").addEventListener("click", resetSettings);

  // Debug tools
  document
    .getElementById("testCookiesBtn")
    .addEventListener("click", testCookies);
  document
    .getElementById("clearTestCookiesBtn")
    .addEventListener("click", clearTestCookies);

  // Modal backdrop click
  document
    .getElementById("cookieModal")
    .addEventListener("click", function (e) {
      if (e.target === this) {
        hideCookieModal();
      }
    });

  // Form validation
  document
    .getElementById("cookieName")
    .addEventListener("input", validateCookieForm);
  document
    .getElementById("cookieValue")
    .addEventListener("input", validateCookieForm);
}

function updateUI() {
  // Update toggles
  document.getElementById("useCookiesToggle").checked = settings.useCookies;
  document.getElementById("debugModeToggle").checked = settings.debugMode;
  document.getElementById("hideAIListingToggle").checked = settings.hideAIListing;

  // Update sliders
  document.getElementById("retryCountSlider").value = settings.retryCount;
  document.getElementById("retryCountDisplay").textContent =
    settings.retryCount;
  document.getElementById("timeoutSlider").value = settings.timeout;
  document.getElementById("timeoutDisplay").textContent = settings.timeout;

  // Update cookie source selection
  document.getElementById("cookieSourceAuto").checked =
    settings.cookieSource === "auto";
  document.getElementById("cookieSourceCustom").checked =
    settings.cookieSource === "custom";
  handleCookieSourceChange();

  // Update cookie list
  renderCookieList();
}

function renderCookieList() {
  const cookieList = document.getElementById("cookieList");
  const emptyCookies = document.getElementById("emptyCookies");

  // For auto-retrieved cookies, don't show the manual cookie list
  if (settings.cookieSource === "auto") {
    cookieList.innerHTML = "";
    emptyCookies.style.display = "none";
    return;
  }

  // For custom cookies, show the manual cookie list
  if (settings.cookies.length === 0) {
    cookieList.innerHTML = "";
    emptyCookies.style.display = "block";
    return;
  }

  emptyCookies.style.display = "none";

  cookieList.innerHTML = settings.cookies
    .map((cookie, index) => {
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
            <h4 class="font-medium text-gray-800 truncate">${escapeHtml(
              cookie.name
            )}</h4>
            <span class="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">${escapeHtml(
              domain
            )}</span>
          </div>
          <p class="text-sm text-gray-600 truncate">
            Value: ${escapeHtml(cookie.value.substring(0, 50))}${
        cookie.value.length > 50 ? "..." : ""
      }
          </p>
          <p class="text-xs text-gray-500">Path: ${escapeHtml(
            path
          )}${flagsText}</p>
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
      </div>
    `;
    })
    .join("");

  // Add event listeners for edit and delete buttons
  cookieList.querySelectorAll(".edit-cookie-btn").forEach((btn) => {
    btn.addEventListener("click", function () {
      const index = parseInt(this.getAttribute("data-index"));
      editCookie(index);
    });
  });

  cookieList.querySelectorAll(".delete-cookie-btn").forEach((btn) => {
    btn.addEventListener("click", function () {
      const index = parseInt(this.getAttribute("data-index"));
      deleteCookie(index);
    });
  });
}

function showAddCookieModal() {
  editingCookieIndex = -1;
  document.getElementById("modalTitle").textContent = "Add Cookie";
  clearCookieForm();
  document.getElementById("cookieModal").style.display = "flex";
  document.getElementById("cookieName").focus();
}

function editCookie(index) {
  editingCookieIndex = index;
  const cookie = settings.cookies[index];

  document.getElementById("modalTitle").textContent = "Edit Cookie";
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
    settings.cookies.splice(index, 1);
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
  const secure = document.getElementById("cookieSecure").checked;
  const httpOnly = document.getElementById("cookieHttpOnly").checked;

  if (!name || !value) {
    alert("Cookie name and value are required.");
    return;
  }

  // Validate cookie name (basic validation)
  if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
    alert(
      "Cookie name can only contain letters, numbers, underscore, and hyphen."
    );
    return;
  }

  // Check for duplicate names (except when editing)
  const existingIndex = settings.cookies.findIndex(
    (cookie) => cookie.name === name
  );
  if (existingIndex !== -1 && existingIndex !== editingCookieIndex) {
    alert(
      "A cookie with this name already exists. Please choose a different name."
    );
    return;
  }

  const cookie = {
    name,
    value,
    domain: domain || null,
    path,
    secure,
    httpOnly,
  };

  if (editingCookieIndex >= 0) {
    settings.cookies[editingCookieIndex] = cookie;
  } else {
    settings.cookies.push(cookie);
  }

  renderCookieList();
  hideCookieModal();
}

async function testCookies() {
  const testBtn = document.getElementById("testCookiesBtn");
  const testResult = document.getElementById("cookieTestResult");

  try {
    testBtn.textContent = "Testing...";
    testBtn.disabled = true;
    testResult.style.display = "block";
    testResult.innerHTML = "Testing cookie configuration...";

    let cookiesToUse = [];
    let sourceInfo = "";

    if (
      settings.cookieSource === "auto" &&
      settings.autoRetrievedCookies &&
      settings.autoRetrievedCookies.length > 0
    ) {
      cookiesToUse = settings.autoRetrievedCookies;
      sourceInfo = `Auto-retrieved (${cookiesToUse.length} cookies)`;
    } else if (
      settings.cookieSource === "custom" &&
      settings.cookies &&
      settings.cookies.length > 0
    ) {
      cookiesToUse = settings.cookies;
      sourceInfo = `Custom (${cookiesToUse.length} cookies)`;
    }

    let resultHtml = `<div class="space-y-2">`;
    resultHtml += `<p><strong>Cookie Source:</strong> ${sourceInfo}</p>`;
    resultHtml += `<p><strong>Use Cookies Enabled:</strong> ${
      settings.useCookies ? "Yes" : "No"
    }</p>`;

    if (!settings.useCookies) {
      resultHtml += `<p class="text-orange-600"><strong>Warning:</strong> Cookie usage is disabled!</p>`;
    } else if (cookiesToUse.length === 0) {
      resultHtml += `<p class="text-red-600"><strong>Error:</strong> No cookies configured!</p>`;
    } else {
      const cookieString = cookiesToUse
        .map((cookie) => `${cookie.name}=${cookie.value}`)
        .join("; ");
      resultHtml += `<p><strong>Cookie Header:</strong></p>`;
      resultHtml += `<div class="bg-gray-100 p-2 rounded text-xs font-mono break-all">${escapeHtml(
        cookieString.substring(0, 200)
      )}${cookieString.length > 200 ? "..." : ""}</div>`;

      resultHtml += `<p><strong>Important Cookies Found:</strong></p>`;
      const importantCookies = cookiesToUse.filter(
        (cookie) =>
          cookie.name.includes("cf_clearance") ||
          cookie.name.includes("session") ||
          cookie.name.includes("auth") ||
          cookie.name.includes("PHPSESSID")
      );

      if (importantCookies.length > 0) {
        resultHtml += `<ul class="text-sm">`;
        importantCookies.forEach((cookie) => {
          resultHtml += `<li class="text-green-600">✓ ${escapeHtml(
            cookie.name
          )} (${escapeHtml(cookie.value.substring(0, 20))}...)</li>`;
        });
        resultHtml += `</ul>`;
      } else {
        resultHtml += `<p class="text-orange-600">No common authentication cookies found (cf_clearance, session, auth, PHPSESSID)</p>`;
      }
    }

    // Test making a request to current tab's domain
    try {
      const tabs = await browser.tabs.query({
        active: true,
        currentWindow: true,
      });
      const activeTab = tabs[0];
      const tabUrl = new URL(activeTab.url);
      const testUrl = `${tabUrl.origin}/favicon.ico`; // Try to fetch favicon as a test

      resultHtml += `<p><strong>Test Request:</strong> ${testUrl}</p>`;

      // First, set cookies in the browser's cookie store
      if (cookiesToUse.length > 0) {
        resultHtml += `<p><strong>Setting cookies in browser...</strong></p>`;
        for (const cookie of cookiesToUse) {
          try {
            const cookieDetails = {
              url: testUrl,
              name: cookie.name,
              value: cookie.value,
              domain: cookie.domain || tabUrl.hostname,
              path: cookie.path || "/",
              secure: cookie.secure || tabUrl.protocol === "https:",
              httpOnly: cookie.httpOnly || false,
            };

            // Add partition key if available
            if (cookie.partitionKey) {
              cookieDetails.partitionKey = cookie.partitionKey;
            }

            await browser.cookies.set(cookieDetails);
            resultHtml += `<p class="text-sm text-green-600">✓ Set cookie: ${escapeHtml(
              cookie.name
            )}</p>`;
          } catch (cookieError) {
            resultHtml += `<p class="text-sm text-red-600">✗ Failed to set cookie ${escapeHtml(
              cookie.name
            )}: ${cookieError.message}</p>`;
          }
        }
      }

      console.log(
        cookiesToUse
          .map((cookie) => `${cookie.name}=${cookie.value}`)
          .join("; ")
      );
      // Now make the test request via page context to ensure first-party cookies & signals
      const pageResponse = await browser.tabs.sendMessage(activeTab.id, {
        type: "PAGE_FETCH",
        url: testUrl,
        options: {
          method: "GET",
          // Let the page supply natural headers/referrer. Credentials are set in the bridge.
        },
      });

      if (!pageResponse) {
        throw new Error("No response from page context");
      }

      if (pageResponse.ok) {
        resultHtml += `<p><strong>Test Result:</strong> <span class="text-green-600">HTTP ${pageResponse.status} ${pageResponse.statusText}</span></p>`;
      } else if (typeof pageResponse.status !== 'undefined') {
        resultHtml += `<p><strong>Test Result:</strong> <span class="text-red-600">HTTP ${pageResponse.status} ${pageResponse.statusText || ''}</span></p>`;
      } else {
        resultHtml += `<p><strong>Test Result:</strong> <span class="text-red-600">${escapeHtml(pageResponse.error || 'Request failed')}</span></p>`;
      }

      // Verify cookies were sent by checking what cookies are now in the browser for this domain
      const verificationCookies = await browser.cookies.getAll({
        url: testUrl,
      });

      if (verificationCookies.length > 0) {
        resultHtml += `<p><strong>Cookies in browser for ${tabUrl.hostname}:</strong></p>`;
        resultHtml += `<ul class="text-sm">`;
        verificationCookies.forEach((cookie) => {
          const isImportant =
            cookie.name.includes("cf_clearance") ||
            cookie.name.includes("session") ||
            cookie.name.includes("auth");
          const colorClass = isImportant ? "text-blue-600" : "text-gray-600";
          resultHtml += `<li class="${colorClass}">• ${escapeHtml(
            cookie.name
          )} = ${escapeHtml(cookie.value.substring(0, 20))}...</li>`;
        });
        resultHtml += `</ul>`;
      } else {
        resultHtml += `<p class="text-orange-600">No cookies found in browser for ${tabUrl.hostname}</p>`;
      }
    } catch (testError) {
      resultHtml += `<p><strong>Test Request Failed:</strong> <span class="text-red-600">${testError.message}</span></p>`;
    }

    resultHtml += `</div>`;
    testResult.innerHTML = resultHtml;
  } catch (error) {
    console.error("[MRM Settings] Cookie test error:", error);
    testResult.innerHTML = `<p class="text-red-600">Test failed: ${error.message}</p>`;
  } finally {
    testBtn.textContent = "Test Cookies";
    testBtn.disabled = false;
  }
}

async function clearTestCookies() {
  try {
    const tabs = await browser.tabs.query({
      active: true,
      currentWindow: true,
    });
    const activeTab = tabs[0];
    const tabUrl = new URL(activeTab.url);

    // Get all cookies for the current domain
    const cookies = await browser.cookies.getAll({
      url: activeTab.url,
    });

    if (cookies.length === 0) {
      alert("No cookies found to clear for this domain.");
      return;
    }

    if (confirm(`Clear ${cookies.length} cookies for ${tabUrl.hostname}?`)) {
      let cleared = 0;
      for (const cookie of cookies) {
        try {
          await browser.cookies.remove({
            url: activeTab.url,
            name: cookie.name,
            storeId: cookie.storeId,
          });
          cleared++;
        } catch (error) {
          console.error(`Failed to clear cookie ${cookie.name}:`, error);
        }
      }
      alert(`Cleared ${cleared} cookies for ${tabUrl.hostname}`);
    }
  } catch (error) {
    console.error("Error clearing cookies:", error);
    alert("Failed to clear cookies: " + error.message);
  }
}

async function resetSettings() {
  if (
    confirm(
      "Are you sure you want to reset all settings to default? This will delete all cookies and reset all preferences."
    )
  ) {
    settings = {
      useCookies: true,
      retryCount: 3,
      timeout: 30,
      debugMode: false,
      cookieSource: "auto",
      cookies: [],
      autoRetrievedCookies: [],
      hideAIListing: true,
    };

    updateUI();
    await saveSettings();
    alert("Settings have been reset to default values.");
  }
}

async function handleSave() {
  const saveBtn = document.getElementById("saveBtn");
  const originalText = saveBtn.textContent;

  try {
    saveBtn.textContent = "Saving...";
    saveBtn.disabled = true;

    await saveSettings();

    saveBtn.textContent = "Saved!";
    setTimeout(() => {
      saveBtn.textContent = originalText;
      saveBtn.disabled = false;
    }, 1500);
  } catch (error) {
    console.error("[MRM Settings] Save error:", error);
    saveBtn.textContent = "Error";
    setTimeout(() => {
      saveBtn.textContent = originalText;
      saveBtn.disabled = false;
    }, 2000);
  }
}

function goBack() {
  // Navigate back to popup
  window.location.href = "popup.html";
}

function handleCookieSourceChange() {
  const isAuto = document.getElementById("cookieSourceAuto").checked;
  const isCustom = document.getElementById("cookieSourceCustom").checked;

  if (isAuto) {
    settings.cookieSource = "auto";
    document.getElementById("simpleCookieInput").style.display = "none";
    document.getElementById("autoRetrievedCookies").style.display = "block";
    document.getElementById("addCookieBtn").style.display = "none";
    autoRetrieveCookies();
  } else if (isCustom) {
    settings.cookieSource = "custom";
    document.getElementById("simpleCookieInput").style.display = "block";
    document.getElementById("autoRetrievedCookies").style.display = "none";
    document.getElementById("addCookieBtn").style.display = "inline-block";
  }

  renderCookieList();
}

async function autoRetrieveCookies() {
  try {
    const refreshBtn = document.getElementById("refreshCookiesBtn");
    const autoRetrieveBtn = document.getElementById("autoRetrieveCookiesBtn");

    // Show loading state
    if (refreshBtn) refreshBtn.textContent = "Loading...";
    if (autoRetrieveBtn) autoRetrieveBtn.textContent = "Loading...";

    // Function to get the Partition Key from the URL
    function getPartitionKeyFromUrl(url) {
      const origin = new URL(url).origin;
      return { topLevelSite: origin };
    }

    // Get the active tab's URL and storeId
    const tabs = await browser.tabs.query({
      active: true,
      currentWindow: true,
    });
    const activeTab = tabs[0];
    const tabUrl = activeTab.url;
    const tabCookieStoreId = activeTab.cookieStoreId;
    const partitionKey = getPartitionKeyFromUrl(tabUrl);

    // Use the tab's URL and the extracted Partition Key to get cookies
    const cookies = await browser.cookies.getAll({
      url: tabUrl,
      storeId: tabCookieStoreId,
      partitionKey: partitionKey,
    });

    // Store the auto-retrieved cookies
    settings.autoRetrievedCookies = cookies.map((cookie) => ({
      name: cookie.name,
      value: cookie.value,
      domain: cookie.domain,
      path: cookie.path,
      secure: cookie.secure,
      httpOnly: cookie.httpOnly,
      partitionKey: cookie.partitionKey,
    }));

    renderAutoRetrievedCookies();

    console.log(
      `[MRM Settings] Auto-retrieved ${cookies.length} cookies from current tab`
    );
  } catch (error) {
    console.error("[MRM Settings] Error auto-retrieving cookies:", error);
    alert(
      "Failed to retrieve cookies from current tab. Make sure you're on the target website."
    );
  } finally {
    // Reset button text
    const refreshBtn = document.getElementById("refreshCookiesBtn");
    const autoRetrieveBtn = document.getElementById("autoRetrieveCookiesBtn");
    if (refreshBtn) refreshBtn.textContent = "Refresh";
    if (autoRetrieveBtn) autoRetrieveBtn.textContent = "Auto Retrieve";
  }
}

function renderAutoRetrievedCookies() {
  const autoRetrievedList = document.getElementById("autoRetrievedList");

  if (
    !settings.autoRetrievedCookies ||
    settings.autoRetrievedCookies.length === 0
  ) {
    autoRetrievedList.innerHTML =
      '<p class="text-sm text-gray-500">No cookies found. Make sure you\'re on the target website.</p>';
    return;
  }

  autoRetrievedList.innerHTML = settings.autoRetrievedCookies
    .map((cookie) => {
      const domain = cookie.domain || "Current domain";
      const isImportant =
        cookie.name.includes("cf_clearance") ||
        cookie.name.includes("session") ||
        cookie.name.includes("auth");
      const bgColor = isImportant
        ? "bg-blue-50 border-blue-200"
        : "bg-white border-gray-200";

      return `
      <div class="flex items-center justify-between p-2 border ${bgColor} rounded text-sm">
        <div class="flex-1 min-w-0">
          <div class="flex items-center space-x-2">
            <span class="font-medium">${escapeHtml(cookie.name)}</span>
            ${
              isImportant
                ? '<span class="text-xs bg-blue-100 text-blue-600 px-1 rounded">Important</span>'
                : ""
            }
          </div>
          <p class="text-xs text-gray-500 truncate">
            ${escapeHtml(cookie.value.substring(0, 30))}${
        cookie.value.length > 30 ? "..." : ""
      } (${domain})
          </p>
        </div>
      </div>
    `;
    })
    .join("");
}

function parseCookieString() {
  const cookieString = document
    .getElementById("cookieStringTextarea")
    .value.trim();

  if (!cookieString) {
    alert("Please enter a cookie string.");
    return;
  }

  try {
    // Parse the cookie string
    const cookiePairs = cookieString
      .split(";")
      .map((pair) => pair.trim())
      .filter((pair) => pair);
    const parsedCookies = [];

    for (const pair of cookiePairs) {
      const [name, ...valueParts] = pair.split("=");
      if (name && valueParts.length > 0) {
        const value = valueParts.join("="); // In case value contains '='
        parsedCookies.push({
          name: name.trim(),
          value: value.trim(),
          domain: null,
          path: "/",
          secure: false,
          httpOnly: false,
        });
      }
    }

    if (parsedCookies.length === 0) {
      alert("No valid cookies found in the string. Please check the format.");
      return;
    }

    // Replace existing custom cookies
    settings.cookies = parsedCookies;

    // Clear the textarea
    document.getElementById("cookieStringTextarea").value = "";

    // Update UI
    renderCookieList();

    alert(`Successfully parsed ${parsedCookies.length} cookies.`);
  } catch (error) {
    console.error("[MRM Settings] Error parsing cookie string:", error);
    alert("Failed to parse cookie string. Please check the format.");
  }
}

function escapeHtml(text) {
  const map = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  };
  return text.replace(/[&<>"']/g, function (m) {
    return map[m];
  });
}

// Export settings for use in other scripts
window.MRMSettings = {
  getSettings: async function () {
    await loadSettings();
    return settings;
  },

  getCookieHeader: function () {
    if (!settings.useCookies) {
      return null;
    }

    let cookiesToUse = [];

    if (
      settings.cookieSource === "auto" &&
      settings.autoRetrievedCookies.length > 0
    ) {
      cookiesToUse = settings.autoRetrievedCookies;
    } else if (
      settings.cookieSource === "custom" &&
      settings.cookies.length > 0
    ) {
      cookiesToUse = settings.cookies;
    }

    if (cookiesToUse.length === 0) {
      return null;
    }

    return cookiesToUse
      .map((cookie) => `${cookie.name}=${cookie.value}`)
      .join("; ");
  },
};
