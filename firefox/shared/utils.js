window.MRM = window.MRM || {};

MRM.utils = {
  escapeHtml(text) {
    const map = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" };
    return text.replace(/[&<>"']/g, (m) => map[m]);
  },

  getFileExtension(blob, fallback = "jpg") {
    if (!blob.type) return fallback;
    const parts = blob.type.split("/");
    return parts[1] || fallback;
  },

  sanitizeFilename(filename) {
    return filename.replace(/[/*?:"<>|]/g, "_");
  },

  blobToBase64(blob) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.readAsDataURL(blob);
    });
  },

  loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  },
};
