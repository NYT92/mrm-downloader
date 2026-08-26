window.MRM = window.MRM || {};

MRM.ui = {
  updateText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  },

  setDisplay(id, display) {
    const el = document.getElementById(id);
    if (el) el.style.display = display;
  },

  setWidth(id, width) {
    const el = document.getElementById(id);
    if (el) el.style.width = width;
  },

  setValue(id, value) {
    const el = document.getElementById(id);
    if (el) el.value = value;
  },

  setProgress(percent, text) {
    const s = MRM.settings.get();

    if (percent > 0 && percent < 100) {
      MRM.ui.setDisplay("downloadCard", "block");
    } else if (percent === 100) {
      MRM.ui.setWidth("progressBar", "100%");
      MRM.ui.updateText("progressText", "100%");
      if (text) {
        MRM.ui.updateText("downloadStatus", text);
        MRM.ui.updateText("progressStatus", text);
      }
      setTimeout(() => MRM.ui.setDisplay("downloadCard", "none"), 1500);
      if (s?.debugMode) console.log(`[MRM] Progress: 100% - ${text}`);
      return;
    }

    MRM.ui.setWidth("progressBar", Math.max(0, Math.min(100, percent)) + "%");
    MRM.ui.updateText("progressText", Math.round(percent) + "%");

    if (text) {
      MRM.ui.updateText("downloadStatus", text);
      MRM.ui.updateText("progressStatus", text);
      const cd = MRM.download.currentDownload;
      if (cd) {
        MRM.ui.updateText("downloadTitle", `Downloading ${cd.type}...`);
      }
    }

    if (s?.debugMode) {
      console.log(`[MRM] Progress: ${percent}% - ${text}`);
    }
  },

  setStatus(text) {
    MRM.ui.updateText("statusText", text);
  },

  setDownloadButtonsState(isDisabled, text) {
    ["downloadImagesBtn", "downloadAllBtn", "downloadPdfBtn", "downloadVideoBtn"].forEach((id) => {
      const btn = document.getElementById(id);
      if (!btn) return;
      btn.disabled = isDisabled;
    });

    if (text) {
      const allBtn = document.getElementById("downloadAllBtn");
      if (allBtn) MRM.ui.updateText("allButtonText", text);

      const pdfBtn = document.getElementById("downloadPdfBtn");
      if (pdfBtn) MRM.ui.updateText("pdfButtonText", text);

      const imgBtn = document.getElementById("downloadImagesBtn");
      if (imgBtn) MRM.ui.updateText("imagesButtonText", text);
    }
  },

  renderHistory() {
    const historyList = document.getElementById("historyList");
    const emptyHistory = document.getElementById("emptyHistory");
    const history = MRM.download.getHistory();

    if (!historyList) return;

    if (history.length === 0) {
      historyList.innerHTML = "";
      if (emptyHistory) emptyHistory.style.display = "block";
      return;
    }

    if (emptyHistory) emptyHistory.style.display = "none";

    historyList.innerHTML = history
      .map((item) => {
        const date = new Date(item.timestamp).toLocaleDateString();
        const time = new Date(item.timestamp).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        });
        const typeIcon =
          item.type === "video"
            ? "📹"
            : item.type === "pdf"
              ? "📄"
              : item.type === "all"
                ? "📦"
                : "🖼️";
        const statusColor =
          item.status === "completed"
            ? "text-green-600"
            : item.status === "failed"
              ? "text-red-600"
              : "text-yellow-600";
        const statusIcon =
          item.status === "completed"
            ? "✅"
            : item.status === "failed"
              ? "❌"
              : "⬇️";

        return `
        <div class="history-item flex items-center justify-between p-3 border border-gray-200 rounded-lg">
          <div class="flex items-center space-x-3 flex-1">
            <span class="text-xl">${typeIcon}</span>
            <div class="flex-1 min-w-0">
              <p class="text-sm font-medium text-gray-900 break-words overflow-hidden line-clamp-2 max-w-full">${MRM.utils.escapeHtml(item.title)}</p>
              <p class="text-xs text-gray-500">${date} at ${time}</p>
              <span class="text-xs ${statusColor} font-medium">${statusIcon}</span>
              <button class="open-url-btn text-blue-600 hover:text-blue-800 text-sm" data-url="${MRM.utils.escapeHtml(item.url)}">Open</button>
            </div>
          </div>
        </div>
      `;
      })
      .join("");

    historyList.querySelectorAll(".open-url-btn").forEach((button) => {
      button.addEventListener("click", function () {
        const url = this.getAttribute("data-url");
        if (url) MRM.ui.openUrl(url);
      });
    });
  },

  async openUrl(url) {
    try {
      const validUrl = new URL(url);
      await MRM.api.createTab({ url: validUrl.href, active: true });
      window.close();
    } catch (error) {
      console.error("[MRM] Error opening URL:", error);
      alert("Invalid URL or unable to open the link");
    }
  },

  async clearHistory() {
    if (confirm("Are you sure you want to clear all download history?")) {
      MRM.download._history = [];
      await MRM.download.saveHistory();
      MRM.ui.renderHistory();
    }
  },
};
