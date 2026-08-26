window.MRM = window.MRM || {};

MRM.api = {
  async getActiveTab() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return tab;
  },

  async getTab(tabId) {
    return tabId ? await chrome.tabs.get(tabId) : await MRM.api.getActiveTab();
  },

  async getMRMData(tabId) {
    const tab = await MRM.api.getTab(tabId);
    return chrome.tabs.sendMessage(tab.id, { type: "GET_MRM_DATA" });
  },

  async pageFetch(tabId, url, options) {
    return chrome.tabs.sendMessage(tabId, {
      type: "PAGE_FETCH",
      url,
      options,
      wantBody: true,
      responseType: "bytes",
    });
  },

  async storageGet(keys) {
    return chrome.storage.local.get(keys);
  },

  async storageSet(data) {
    return chrome.storage.local.set(data);
  },

  async setCookie(details) {
    return chrome.cookies.set(details);
  },

  async getCookies(details) {
    return chrome.cookies.getAll(details);
  },

  async removeCookie(details) {
    return chrome.cookies.remove(details);
  },

  async getAllCookiesForUrl(url) {
    return chrome.cookies.getAll({ url });
  },

  async createTab(createProperties) {
    return chrome.tabs.create(createProperties);
  },

  async updateTab(tabId, updateProperties) {
    return chrome.tabs.update(tabId, updateProperties);
  },

  async queryTabs(queryInfo) {
    return chrome.tabs.query(queryInfo);
  },

  tabsOnUpdated: {
    addListener(fn) {
      chrome.tabs.onUpdated.addListener(fn);
    },
    removeListener(fn) {
      chrome.tabs.onUpdated.removeListener(fn);
    },
  },

  async triggerDownload(url, filename) {
    return chrome.downloads.download({
      url,
      filename,
      saveAs: false,
      conflictAction: "uniquify",
    });
  },

  getManifest() {
    return chrome.runtime.getManifest();
  },
};
