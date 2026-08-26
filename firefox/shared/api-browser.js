window.MRM = window.MRM || {};

MRM.api = {
  async getActiveTab() {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    return tab;
  },

  async getTab(tabId) {
    return tabId ? await browser.tabs.get(tabId) : await MRM.api.getActiveTab();
  },

  async getMRMData(tabId) {
    const tab = await MRM.api.getTab(tabId);
    return browser.tabs.sendMessage(tab.id, { type: "GET_MRM_DATA" });
  },

  async pageFetch(tabId, url, options) {
    return browser.tabs.sendMessage(tabId, {
      type: "PAGE_FETCH",
      url,
      options,
      wantBody: true,
      responseType: "arraybuffer",
    });
  },

  async storageGet(keys) {
    return browser.storage.local.get(keys);
  },

  async storageSet(data) {
    return browser.storage.local.set(data);
  },

  async setCookie(details) {
    return browser.cookies.set(details);
  },

  async getCookies(details) {
    return browser.cookies.getAll(details);
  },

  async removeCookie(details) {
    return browser.cookies.remove(details);
  },

  async getAllCookiesForUrl(url) {
    return browser.cookies.getAll({ url });
  },

  async createTab(createProperties) {
    return browser.tabs.create(createProperties);
  },

  async updateTab(tabId, updateProperties) {
    return browser.tabs.update(tabId, updateProperties);
  },

  async queryTabs(queryInfo) {
    return browser.tabs.query(queryInfo);
  },

  tabsOnUpdated: {
    addListener(fn) {
      browser.tabs.onUpdated.addListener(fn);
    },
    removeListener(fn) {
      browser.tabs.onUpdated.removeListener(fn);
    },
  },

  async triggerDownload(url, filename) {
    return browser.downloads.download({
      url,
      filename,
      saveAs: false,
      conflictAction: "uniquify",
    });
  },

  getManifest() {
    return browser.runtime.getManifest();
  },
};
