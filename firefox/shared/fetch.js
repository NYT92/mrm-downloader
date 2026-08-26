window.MRM = window.MRM || {};

MRM.fetch = {
  async setCookiesInBrowser(url) {
    const s = MRM.settings.get();
    if (!s.useCookies) {
      if (s.debugMode) console.log("[MRM Debug] Cookie usage disabled");
      return;
    }

    const cookiesToUse = MRM.settings.getCookiesToUse();
    if (cookiesToUse.length === 0) {
      if (s.debugMode) console.log("[MRM Debug] No cookies to set");
      return;
    }

    const urlObj = new URL(url);
    if (s.debugMode) {
      console.log(`[MRM Debug] Setting ${cookiesToUse.length} cookies for ${urlObj.origin}`);
    }

    for (const cookie of cookiesToUse) {
      try {
        const domains = [
          cookie.domain,
          urlObj.hostname,
          `.${urlObj.hostname}`,
          `.${urlObj.hostname.split(".").slice(-2).join(".")}`,
        ].filter(Boolean);

        let cookieSet = false;
        for (const domain of domains) {
          try {
            const cookieDetails = {
              url: url,
              name: cookie.name,
              value: cookie.value,
              domain: domain,
              path: cookie.path || "/",
              secure: cookie.secure || urlObj.protocol === "https:",
              httpOnly: cookie.httpOnly || false,
            };

            if (cookie.partitionKey) {
              cookieDetails.partitionKey = cookie.partitionKey;
            }

            await MRM.api.setCookie(cookieDetails);
            cookieSet = true;
            if (s.debugMode) {
              console.log(`[MRM Debug] Set cookie: ${cookie.name} for domain: ${domain}`);
            }
            break;
          } catch (domainError) {
            if (s.debugMode) {
              console.log(`[MRM Debug] Failed to set cookie ${cookie.name} for domain ${domain}:`, domainError.message);
            }
          }
        }

        if (!cookieSet && s.debugMode) {
          console.error(`[MRM Debug] Failed to set cookie ${cookie.name} for any domain`);
        }
      } catch (error) {
        console.error(`[MRM Debug] Failed to set cookie ${cookie.name}:`, error);
      }
    }
  },

  async fetchWithSettings(url, options = {}, tabId = null) {
    await MRM.fetch.setCookiesInBrowser(url);

    const tab = await MRM.api.getTab(tabId);
    const s = MRM.settings.get();
    const retryCount = MRM.settings.getRetryCount();

    const pageFetchOptions = { method: (options && options.method) || "GET" };
    if (options && options.headers && options.headers.Referer) {
      pageFetchOptions.referrer = options.headers.Referer;
    }

    if (s.debugMode) console.log(`[MRM Debug] (Page) Fetching ${url}`);

    let lastError;
    for (let attempt = 1; attempt <= retryCount; attempt++) {
      try {
        if (s.debugMode) console.log(`[MRM Debug] (Page) Fetch attempt ${attempt} for ${url}`);
        const pageResponse = await MRM.api.pageFetch(tab.id, url, pageFetchOptions);

        if (!pageResponse) throw new Error("No response from page context");
        if (!pageResponse.ok) {
          throw new Error(`HTTP error: ${pageResponse.status || "Request failed"}`);
        }

        const headers = new Headers(pageResponse.headers || []);
        const contentType = headers.get("content-type") || "application/octet-stream";
        const blob = new Blob([pageResponse.body], { type: contentType });

        return {
          ok: true,
          status: pageResponse.status,
          headers,
          blob: async () => blob,
        };
      } catch (error) {
        lastError = error;
        console.error(`[MRM Debug] (Page) Fetch attempt ${attempt} failed:`, error.message);
        if (attempt < retryCount) {
          const waitTime = Math.pow(2, attempt - 1) * 1000;
          await new Promise((resolve) => setTimeout(resolve, waitTime));
        }
      }
    }

    if (s.debugMode) console.log(`[MRM Debug] Falling back to extension-context fetch for ${url}`);

    const fallbackHeaders = {
      "User-Agent": navigator.userAgent,
      Accept: "image/webp,image/avif,image/*,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.5",
      "Accept-Encoding": "gzip, deflate, br",
      DNT: "1",
      Connection: "keep-alive",
      "Sec-Fetch-Dest": "image",
      "Sec-Fetch-Mode": "no-cors",
      "Sec-Fetch-Site": "same-site",
      ...(options.headers || {}),
    };

    const fallbackOptions = {
      ...options,
      headers: fallbackHeaders,
      timeout: MRM.settings.getTimeout(),
      credentials: "include",
      mode: "cors",
    };

    let lastFallbackError;
    for (let attempt = 1; attempt <= retryCount; attempt++) {
      try {
        if (s.debugMode) console.log(`[MRM Debug] (Ext) Fetch attempt ${attempt} for ${url}`);
        const res = await fetch(url, fallbackOptions);
        if (!res.ok && s.debugMode) {
          console.error(`[MRM Debug] (Ext) Response status: ${res.status}`);
        }
        return res;
      } catch (err) {
        lastFallbackError = err;
        console.error(`[MRM Debug] (Ext) Fetch attempt ${attempt} failed:`, err.message);
        if (attempt < retryCount) {
          const waitTime = Math.pow(2, attempt - 1) * 1000;
          await new Promise((resolve) => setTimeout(resolve, waitTime));
        }
      }
    }

    throw lastError || lastFallbackError || new Error("Fetch failed");
  },
};
