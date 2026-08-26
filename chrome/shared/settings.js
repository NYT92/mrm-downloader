window.MRM = window.MRM || {};

MRM.settings = {
  defaults: {
    useCookies: true,
    retryCount: 3,
    timeout: 30,
    debugMode: false,
    cookieSource: "auto",
    cookies: [],
    autoRetrievedCookies: [],
    hideAIListing: true,
  },

  _cache: null,

  async load() {
    const result = await MRM.api.storageGet(["mrmSettings"]);
    MRM.settings._cache = { ...MRM.settings.defaults, ...(result.mrmSettings || {}) };
    if (MRM.settings._cache.debugMode) {
      console.log("[MRM] Settings loaded:", MRM.settings._cache);
    }
    return MRM.settings._cache;
  },

  async save() {
    await MRM.api.storageSet({ mrmSettings: MRM.settings._cache });
  },

  get() {
    return MRM.settings._cache;
  },

  getCookiesToUse() {
    const s = MRM.settings._cache;
    if (s.cookieSource === "auto") {
      return s.autoRetrievedCookies?.length > 0 ? s.autoRetrievedCookies : [];
    }
    return s.cookies?.length > 0 ? s.cookies : [];
  },

  getRetryCount() {
    return MRM.settings._cache?.retryCount || 3;
  },

  getTimeout() {
    return (MRM.settings._cache?.timeout || 30) * 1000;
  },
};
