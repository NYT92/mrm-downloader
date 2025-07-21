let currentDownload = null;
let downloadHistory = [];
let currentView = "main";

document.addEventListener("DOMContentLoaded", async function () {
  await loadDownloadHistory();
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
    const downloadImagesBtn = document.getElementById("downloadImagesBtn");
    const downloadPdfBtn = document.getElementById("downloadPdfBtn");
    const downloadVideoBtn = document.getElementById("downloadVideoBtn");

    if (tabsUrl.includes("myreadingmanga.info")) {
      // Update page number display
      if (data && data.page) {
        document.getElementById("pageNumber").textContent = data.page;
      }

      if (data && data.contentType) {
        switch (data.contentType) {
          case "video":
            downloadVideoBtn.style.display = "block";
            downloadImagesBtn.style.display = "none";
            downloadPdfBtn.style.display = "none";
            document.querySelector("h2").textContent =
              data.title || "Video Content";
            document.getElementById("statusText").textContent = "Ready";
            break;

          case "images":
            downloadImagesBtn.style.display = "block";
            downloadImagesBtn.textContent = "Download Images (ZIP)";

            // Show PDF button if images support PDF generation
            if (data.supportsPdf && data.images && data.images.length > 0) {
              downloadPdfBtn.style.display = "block";
              const pdfImageCount = document.getElementById("pdfImageCount");
              if (pdfImageCount) {
                pdfImageCount.textContent = data.images.length;
              }
            }

            // Update image count display
            const imageCount = document.getElementById("imageCount");
            if (imageCount && data.images) {
              imageCount.textContent = data.images.length;
            }

            document.querySelector("h2").textContent =
              data.title || "Image Content";
            document.getElementById("statusText").textContent = "Ready";
            break;

          case "none":
          default:
            downloadImagesBtn.style.display = "none";
            downloadPdfBtn.style.display = "none";
            downloadVideoBtn.style.display = "none";
            document.querySelector("h2").textContent =
              data.title || "No content selected";
            if (data.reason === "excluded_page") {
              document.getElementById("statusText").textContent =
                "Page not supported";
            } else {
              document.getElementById("statusText").textContent =
                "No content found";
            }
            break;
        }
      } else {
        // Fallback to old logic if contentType is not available
        const hasImages = data && data.images && data.images.length > 0;
        const hasVideo = data && data.video;

        if (hasImages) {
          downloadImagesBtn.style.display = "block";
          downloadImagesBtn.textContent = "Download Images (ZIP)";

          // Show PDF button for images
          downloadPdfBtn.style.display = "block";
          const pdfImageCount = document.getElementById("pdfImageCount");
          const imageCount = document.getElementById("imageCount");
          if (pdfImageCount && data.images) {
            pdfImageCount.textContent = data.images.length;
          }
          if (imageCount && data.images) {
            imageCount.textContent = data.images.length;
          }

          downloadVideoBtn.style.display = "none";
        } else if (hasVideo) {
          downloadVideoBtn.style.display = "block";
          downloadImagesBtn.style.display = "none";
          downloadPdfBtn.style.display = "none";
        } else {
          downloadImagesBtn.style.display = "none";
          downloadPdfBtn.style.display = "none";
          downloadVideoBtn.style.display = "none";
        }

        // Update title and status
        if (data && data.title) {
          document.querySelector("h2").textContent = data.title;
          document.getElementById("statusText").textContent =
            hasImages || hasVideo ? "Ready" : "No content found";
        } else {
          document.querySelector("h2").textContent = "No content selected";
          document.getElementById("statusText").textContent =
            "Navigate to a MyReadingManga page";
        }

        // Update page number display in fallback
        if (data && data.page) {
          document.getElementById("pageNumber").textContent = data.page;
        }
      }
    } else {
      console.log("not mrm");
      // Hide all download buttons when not on MyReadingManga
      downloadImagesBtn.style.display = "none";
      downloadPdfBtn.style.display = "none";
      downloadVideoBtn.style.display = "none";
      document.querySelector("h2").textContent = "MRM Downloader";
      document.getElementById("statusText").textContent =
        "Navigate to MyReadingManga to download content";
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
    .getElementById("downloadBtn")
    .addEventListener("click", handleDownloadClick);

  document
    .getElementById("cancelBtn")
    .addEventListener("click", handleDeleteClick);

  document
    .getElementById("settingsBtn")
    .addEventListener("click", handleSettingsClick);

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
  document.getElementById("mainContent").style.display = "none";
  document.getElementById("historyContent").style.display = "block";
  renderHistory();
}

function showMain() {
  currentView = "main";
  document.getElementById("mainContent").style.display = "block";
  document.getElementById("historyContent").style.display = "none";
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
            <p class="text-sm font-medium text-gray-900 break-words overflow-hidden line-clamp-2 max-w-full">${
              item.title
            }</p>
            <p class="text-xs text-gray-500">${date} at ${time}</p>
            <span class="text-xs ${statusColor} font-medium">${
        item.status === "completed"
          ? "✅"
          : item.status === "failed"
          ? "❌"
          : "⬇️"
      }</span>
            <button class="open-url-btn text-blue-600 hover:text-blue-800 text-sm" data-url="${
              item.url
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
  const downloadImagesBtn = document.getElementById("downloadImagesBtn");
  const downloadBtn = document.getElementById("downloadBtn");

  if (downloadImagesBtn) {
    downloadImagesBtn.disabled = isDisabled;
    if (text) downloadImagesBtn.textContent = text;
  }

  if (downloadBtn) {
    downloadBtn.disabled = isDisabled;
    if (text) downloadBtn.textContent = text;
  }
}

async function handlePdfDownloadClick() {
  try {
    const data = await getMRMData();
    if (!data) {
      alert("No content found on this page.");
      setPdfButtonState(false);
      return;
    }

    if (data.images && data.images.length > 0) {
      await downloadPdf(data.images, data.title, data.page);
    } else {
      alert("No images found to generate PDF.");
      setPdfButtonState(false, "Generate PDF");
    }
  } catch (error) {
    console.error("[MRM] PDF download error:", error);
    setPdfButtonState(false, "Generate PDF");
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

function handleSettingsClick() {
  // Later
}

function setProgress(percent, text) {
  const progressBar = document.getElementById("progressBar");
  const downloadCard = document.getElementById("downloadCard");
  const downloadStatus = document.getElementById("downloadStatus");
  const downloadTitle = document.getElementById("downloadTitle");

  if (percent > 0 && percent < 100) {
    downloadCard.style.display = "block";
  } else if (percent === 100) {
    setTimeout(() => {
      downloadCard.style.display = "none";
    }, 1500);
  } else {
    downloadCard.style.display = "none";
  }

  progressBar.style.width = percent + "%";
  if (text) {
    downloadStatus.textContent = text;
    if (currentDownload) {
      downloadTitle.textContent = `Downloading ${currentDownload.type}...`;
    }
  }

  console.log(`[MRM] Progress: ${percent}% - ${text}`);
}

function updateStatus(status) {
  document.getElementById("statusText").textContent = status;
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
        const response = await fetch(images[i]);
        const blob = await response.blob();
        const ext = blob.type.split("/")[1] || "jpg";
        zip.file(`image_${i + 1}.${ext}`, blob, { binary: true });
        console.log(
          `[MRM] Downloaded image ${i + 1}/${images.length}: ${images[i]}`
        );
      } catch (e) {
        console.error("[MRM] Error downloading image", images[i], e);
      }
    }

    setProgress(95, "Creating ZIP file...");
    console.log("[MRM] Zipping images...");

    const content = await zip.generateAsync({ type: "blob" });
    console.log("[MRM] ZIP file created");

    setProgress(100, "Saving file...");

    const safeTitle = title.replace(/[^a-z0-9]/gi, "_").toLowerCase();
    const filename = `${safeTitle}_p${page}_images.zip`;

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
  setProgress(10, "Fetching video...");
  setDownloadButtonState(true, "Downloading...");

  try {
    const response = await fetch(videoUrl);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    setProgress(50, "Processing video...");
    const blob = await response.blob();

    setProgress(90, "Saving video...");

    const safeTitle = title.replace(/[^a-z0-9]/gi, "_").toLowerCase();
    const ext = videoUrl.split(".").pop() || "mp4";
    const filename = `${safeTitle}_video.${ext}`;

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

    const pdf = new jsPDF("p", "mm", "a4");

    pdf.deletePage(1);

    for (let i = 0; i < images.length; i++) {
      const percent = ((i + 1) / images.length) * 90;
      setProgress(percent, `Processing image ${i + 1} of ${images.length}...`);

      try {
        const response = await fetch(images[i]);
        const blob = await response.blob();

        const base64 = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.readAsDataURL(blob);
        });

        pdf.addPage();

        const img = new Image();
        img.src = base64;

        await new Promise((resolve) => {
          img.onload = resolve;
        });

        const pageWidth = 210;
        const pageHeight = 297;
        const margin = 2;
        const maxWidth = pageWidth - 2 * margin;
        const maxHeight = pageHeight - 2 * margin;

        const imgRatio = img.width / img.height;
        const pageRatio = maxWidth / maxHeight;

        let finalWidth, finalHeight;

        if (imgRatio > pageRatio) {
          finalWidth = maxWidth;
          finalHeight = maxWidth / imgRatio;
        } else {
          finalHeight = maxHeight;
          finalWidth = maxHeight * imgRatio;
        }

        const x = (pageWidth - finalWidth) / 2;
        const y = (pageHeight - finalHeight) / 2;

        pdf.addImage(base64, "JPEG", x, y, finalWidth, finalHeight);

        console.log(`[MRM] Added image ${i + 1}/${images.length} to PDF`);
      } catch (e) {
        console.error("[MRM] Error processing image for PDF", images[i], e);
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

function setPdfButtonState(isDisabled, text) {
  const downloadPdfBtn = document.getElementById("downloadPdfBtn");

  if (downloadPdfBtn) {
    downloadPdfBtn.disabled = isDisabled;
    if (text) {
      const buttonText = document.getElementById("pdfButtonText");
      if (buttonText) buttonText.textContent = text;
    }
  }
}
