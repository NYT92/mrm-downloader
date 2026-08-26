window.MRM = window.MRM || {};

MRM.download = {
  _history: [],
  _currentDownload: null,
  _onProgress: null,
  _onStatus: null,
  _lastPercent: 0,

  get currentDownload() {
    return MRM.download._currentDownload;
  },
  set currentDownload(val) {
    MRM.download._currentDownload = val;
  },

  onProgress(fn) { MRM.download._onProgress = fn; },
  onStatus(fn) { MRM.download._onStatus = fn; },

  _progress(percent, text) {
    MRM.download._lastPercent = percent;
    if (MRM.download._onProgress) MRM.download._onProgress(percent, text);
  },

  _status(text) {
    if (MRM.download._onStatus) MRM.download._onStatus(text);
  },

  async loadHistory() {
    try {
      const result = await MRM.api.storageGet(["downloadHistory"]);
      MRM.download._history = result.downloadHistory || [];
    } catch (error) {
      console.error("[MRM] Error loading download history:", error);
      MRM.download._history = [];
    }
  },

  async saveHistory() {
    try {
      await MRM.api.storageSet({ downloadHistory: MRM.download._history });
    } catch (error) {
      console.error("[MRM] Error saving download history:", error);
    }
  },

  getHistory() {
    return MRM.download._history;
  },

  addToHistory(item) {
    const historyItem = {
      id: Date.now(),
      title: item.title,
      url: item.url,
      type: item.type,
      timestamp: new Date().toISOString(),
      status: item.status || "completed",
      progress: item.progress || 100,
    };

    MRM.download._history.unshift(historyItem);
    if (MRM.download._history.length > 50) {
      MRM.download._history = MRM.download._history.slice(0, 50);
    }
    MRM.download.saveHistory();
  },

  async downloadImages(images, title, page = "1") {
    if (!images.length) {
      alert("No images found on this page.");
      return;
    }

    const tab = await MRM.api.getActiveTab();
    MRM.download._currentDownload = { type: "images", title, url: tab.url };
    MRM.download._status("Downloading images...");

    const zip = new JSZip();

    try {
      for (let i = 0; i < images.length; i++) {
        const percent = ((i + 1) / images.length) * 90;
        MRM.download._progress(percent, `Downloading image ${i + 1} of ${images.length}...`);

        try {
          const response = await MRM.fetch.fetchWithSettings(images[i], {
            headers: { Referer: tab.url },
          });
          if (!response.ok) throw new Error(`HTTP error: ${response.status}`);

          const blob = await response.blob();
          const ext = MRM.utils.getFileExtension(blob);
          zip.file(`image_${i + 1}.${ext}`, blob, { binary: true });
        } catch (e) {
          console.error("[MRM] Error downloading image", images[i], e);
        }
      }

      MRM.download._progress(95, "Creating ZIP file...");
      const content = await zip.generateAsync({ type: "blob" });

      MRM.download._progress(100, "Saving file...");
      const filename = `${title} - Page ${page}.zip`;
      saveAs(content, filename);

      MRM.download.addToHistory({
        title: `${title} - Page ${page}`,
        url: tab.url,
        type: "images",
        status: "completed",
        progress: 100,
      });

      MRM.download._status("Download completed");
      MRM.download._currentDownload = null;
    } catch (error) {
      console.error("[MRM] Images download error:", error);
      MRM.download._status("Download failed");
      MRM.download._progress(0, "Download failed");
      MRM.download.addToHistory({
        title,
        url: tab.url,
        type: "images",
        status: "failed",
        progress: 0,
      });
      MRM.download._currentDownload = null;
      alert("Images download failed. Check console for details.");
    }
  },

  async downloadVideo(videoUrl, title) {
    if (!videoUrl) {
      alert("No video found on this page.");
      return;
    }

    const tab = await MRM.api.getActiveTab();
    MRM.download._currentDownload = { type: "video", title, url: tab.url };
    MRM.download._status("Downloading video...");
    MRM.download._progress(5, "Initializing download...");

    try {
      let progressInterval = setInterval(() => {
        const currentProgress = MRM.download._lastPercent || 5;
        if (currentProgress < 45) {
          MRM.download._progress(currentProgress + 2, "Fetching video...");
        }
      }, 300);

      const response = await MRM.fetch.fetchWithSettings(videoUrl, {
        headers: { Referer: tab.url },
      });

      clearInterval(progressInterval);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      MRM.download._progress(50, "Processing video...");

      const contentLength = response.headers?.get?.("content-length");
      let blob;

      if (contentLength && response.body && typeof response.body.getReader === "function") {
        const total = parseInt(contentLength, 10);
        let loaded = 0;
        const reader = response.body.getReader();
        const chunks = [];

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
          loaded += value.length;

          const downloadProgress = 50 + Math.floor((loaded / total) * 35);
          MRM.download._progress(downloadProgress, `Downloading video... ${Math.floor((loaded / total) * 100)}%`);
        }

        const contentType = response.headers?.get?.("content-type") || "video/mp4";
        blob = new Blob(chunks, { type: contentType });
      } else {
        MRM.download._progress(60, "Processing video data...");
        await new Promise((resolve) => setTimeout(resolve, 100));
        MRM.download._progress(75, "Almost done...");
        blob = await response.blob();
      }

      MRM.download._progress(90, "Saving video...");

      const ext = MRM.utils.getFileExtension(blob, "mp4");
      const filename = `${title}.${ext}`;
      saveAs(blob, filename);

      MRM.download._progress(100, "Download completed");

      MRM.download.addToHistory({
        title,
        url: tab.url,
        type: "video",
        status: "completed",
        progress: 100,
      });

      MRM.download._status("Download completed");
      MRM.download._currentDownload = null;
    } catch (error) {
      console.error("[MRM] Video download error:", error);
      MRM.download._status("Download failed");
      MRM.download._progress(0, "Download failed");
      MRM.download.addToHistory({
        title,
        url: tab.url,
        type: "video",
        status: "failed",
        progress: 0,
      });
      MRM.download._currentDownload = null;
      alert("Video download failed. Check console for details.");
    }
  },

  async downloadAllMedia({ images, videoUrl, title, page = "1" }) {
    const hasImages = images && images.length > 0;
    const hasVideo = !!videoUrl;

    if (!hasImages && !hasVideo) {
      alert("No images or video to download.");
      return;
    }

    const tab = await MRM.api.getActiveTab();
    MRM.download._currentDownload = { type: "all", title, url: tab.url };
    MRM.download._status("Downloading media...");

    const zip = new JSZip();

    try {
      let progressBase = 0;
      let progressSpan = hasImages && hasVideo ? 45 : 90;

      if (hasImages) {
        for (let i = 0; i < images.length; i++) {
          const percent = progressBase + ((i + 1) / images.length) * progressSpan;
          MRM.download._progress(percent, `Downloading image ${i + 1} of ${images.length}...`);
          try {
            const response = await MRM.fetch.fetchWithSettings(images[i], {
              headers: { Referer: tab.url },
            });
            if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
            const blob = await response.blob();
            const ext = MRM.utils.getFileExtension(blob);
            zip.file(`images/image_${i + 1}.${ext}`, blob, { binary: true });
          } catch (e) {
            console.error("[MRM] Error downloading image", images[i], e);
          }
        }
        progressBase += progressSpan;
      }

      if (hasVideo) {
        MRM.download._progress(progressBase + 5, "Fetching video...");
        const response = await MRM.fetch.fetchWithSettings(videoUrl, {
          headers: { Referer: tab.url },
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const blob = await response.blob();
        const guessedExt = (() => {
          const byMime = blob.type && blob.type.includes("/") ? blob.type.split("/")[1] : null;
          const byUrl = videoUrl.split(".").pop();
          const candidate = (byMime || byUrl || "mp4").split(/[?#]/)[0];
          return candidate.length > 5 ? "mp4" : candidate;
        })();
        zip.file(`video/video.${guessedExt}`, blob, { binary: true });
        MRM.download._progress(progressBase + 45, "Added video to ZIP...");
      }

      MRM.download._progress(95, "Creating ZIP file...");
      const content = await zip.generateAsync({ type: "blob" });

      const safeTitle = MRM.utils.sanitizeFilename(title);
      const filename = `${safeTitle}_p${page}_all.zip`;
      saveAs(content, filename);

      MRM.download._progress(100, "Saved ZIP file");

      MRM.download.addToHistory({
        title: `${title} - Page ${page}`,
        url: tab.url,
        type: "all",
        status: "completed",
        progress: 100,
      });

      MRM.download._status("Download completed");
      MRM.download._currentDownload = null;
    } catch (error) {
      console.error("[MRM] All media download error:", error);
      MRM.download._status("Download failed");
      MRM.download._progress(0, "Download failed");
      MRM.download.addToHistory({
        title,
        url: tab.url,
        type: "all",
        status: "failed",
        progress: 0,
      });
      MRM.download._currentDownload = null;
      alert("All media download failed. Check console for details.");
    }
  },

  async downloadPdf(images, title, page = "1") {
    if (!images.length) {
      alert("No images found on this page.");
      return;
    }

    const tab = await MRM.api.getActiveTab();
    MRM.download._currentDownload = { type: "pdf", title, url: tab.url };
    MRM.download._status("Generating PDF...");

    try {
      let jsPDF;
      if (window.jspdf && window.jspdf.jsPDF) {
        jsPDF = window.jspdf.jsPDF;
      } else if (window.jsPDF) {
        jsPDF = window.jsPDF;
      } else {
        throw new Error("jsPDF library not found.");
      }

      let pdf = null;

      for (let i = 0; i < images.length; i++) {
        const percent = ((i + 1) / images.length) * 90;
        MRM.download._progress(percent, `Processing image ${i + 1} of ${images.length}...`);

        try {
          const response = await MRM.fetch.fetchWithSettings(images[i], {
            headers: { Referer: tab.url },
          });
          if (!response.ok) throw new Error(`HTTP error: ${response.status}`);

          const blob = await response.blob();
          const base64 = await MRM.utils.blobToBase64(blob);
          const img = await MRM.utils.loadImage(base64);

          const orientation = img.width > img.height ? "l" : "p";
          if (!pdf) {
            pdf = new jsPDF(orientation, "px", [img.width, img.height]);
          } else {
            pdf.addPage([img.width, img.height], orientation);
          }

          const imgFormat = base64.toLowerCase().includes("png") ? "PNG" : "JPEG";
          pdf.addImage(base64, imgFormat, 0, 0, img.width, img.height);
        } catch (e) {
          console.error("[MRM] Error processing image for PDF", images[i], e);
        }
      }

      MRM.download._progress(95, "Finalizing PDF...");
      const safeTitle = MRM.utils.sanitizeFilename(title);
      const filename = `${safeTitle}_p${page}_manga.pdf`;

      pdf.save(filename);

      MRM.download._progress(100, "PDF saved!");

      MRM.download.addToHistory({
        title: `${title} - Page ${page} (PDF)`,
        url: tab.url,
        type: "pdf",
        status: "completed",
        progress: 100,
      });

      MRM.download._status("PDF generation completed");
      MRM.download._currentDownload = null;
    } catch (error) {
      console.error("[MRM] PDF generation error:", error);
      MRM.download._status("PDF generation failed");
      MRM.download._progress(0, "PDF generation failed");
      MRM.download.addToHistory({
        title,
        url: tab.url,
        type: "pdf",
        status: "failed",
        progress: 0,
      });
      MRM.download._currentDownload = null;
      alert("PDF generation failed. Check console for details.");
    }
  },
};
