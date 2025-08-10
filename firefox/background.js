// Intercept and adjust CORS/Referer for image and media requests to myreadingmanga

const IMAGE_HOSTS = [
  "i1.myreadingmanga.info",
  "i2.myreadingmanga.info",
  "i3.myreadingmanga.info",
  "i4.myreadingmanga.info",
  "i5.myreadingmanga.info",
  "i6.myreadingmanga.info",
];

const PAGE_ORIGIN = "https://myreadingmanga.info";

function isImageHost(urlString) {
  try {
    const u = new URL(urlString);
    return IMAGE_HOSTS.includes(u.hostname);
  } catch {
    return false;
  }
}

const requestIdToOrigin = new Map();

browser.webRequest.onBeforeSendHeaders.addListener(
  (details) => {
    if (!isImageHost(details.url)) return {};

    const headers = details.requestHeaders || [];
    let originValue = undefined;

    const lower = headers.map((h) => ({ name: h.name.toLowerCase(), value: h.value }));
    const hasReferer = lower.some((h) => h.name === "referer");
    const originHeader = lower.find((h) => h.name === "origin");
    if (originHeader && originHeader.value) {
      originValue = originHeader.value;
    }

    // Best-effort derive a contextual page URL for Referer
    const pageUrl = details.originUrl || details.documentUrl || (PAGE_ORIGIN + "/");
    if (!hasReferer) {
      headers.push({ name: "Referer", value: pageUrl });
    }

    // If Origin header is absent (common for extension-initiated fetches), set it to page origin
    if (!originValue) {
      try {
        const o = new URL(pageUrl);
        originValue = o.origin;
        headers.push({ name: "Origin", value: originValue });
      } catch {
        // ignore URL parse issues
      }
    }

    if (originValue) {
      requestIdToOrigin.set(details.requestId, originValue);
    }

    return { requestHeaders: headers };
  },
  {
    urls: [
      "https://i1.myreadingmanga.info/*",
      "https://i2.myreadingmanga.info/*",
      "https://i3.myreadingmanga.info/*",
      "https://i4.myreadingmanga.info/*",
      "https://i5.myreadingmanga.info/*",
      "https://i6.myreadingmanga.info/*",
    ],
  },
  ["requestHeaders", "blocking"]
);

browser.webRequest.onHeadersReceived.addListener(
  (details) => {
    if (!isImageHost(details.url)) return {};

    const responseHeaders = details.responseHeaders || [];

    const filtered = responseHeaders.filter((h) => {
      const n = h.name.toLowerCase();
      return (
        n !== "access-control-allow-origin" &&
        n !== "access-control-allow-headers" &&
        n !== "access-control-allow-credentials" &&
        n !== "cross-origin-resource-policy"
      );
    });

    const originValue = requestIdToOrigin.get(details.requestId) || PAGE_ORIGIN;

    filtered.push({ name: "Access-Control-Allow-Origin", value: originValue });
    filtered.push({ name: "Access-Control-Allow-Credentials", value: "true" });
    filtered.push({ name: "Access-Control-Allow-Headers", value: "*" });

    // Cleanup stored origin for this requestId
    requestIdToOrigin.delete(details.requestId);

    return { responseHeaders: filtered };
  },
  {
    urls: [
      "https://i1.myreadingmanga.info/*",
      "https://i2.myreadingmanga.info/*",
      "https://i3.myreadingmanga.info/*",
      "https://i4.myreadingmanga.info/*",
      "https://i5.myreadingmanga.info/*",
      "https://i6.myreadingmanga.info/*",
    ],
  },
  ["responseHeaders", "blocking"]
);

// Cleanup in case of request errors/completion
const cleanup = (details) => {
  requestIdToOrigin.delete(details.requestId);
};
browser.webRequest.onCompleted.addListener(
  cleanup,
  { urls: [
      "https://i1.myreadingmanga.info/*",
      "https://i2.myreadingmanga.info/*",
      "https://i3.myreadingmanga.info/*",
      "https://i4.myreadingmanga.info/*",
      "https://i5.myreadingmanga.info/*",
      "https://i6.myreadingmanga.info/*",
    ] }
);
browser.webRequest.onErrorOccurred.addListener(
  cleanup,
  { urls: [
      "https://i1.myreadingmanga.info/*",
      "https://i2.myreadingmanga.info/*",
      "https://i3.myreadingmanga.info/*",
      "https://i4.myreadingmanga.info/*",
      "https://i5.myreadingmanga.info/*",
      "https://i6.myreadingmanga.info/*",
    ] }
);


