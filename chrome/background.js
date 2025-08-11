// MV3 service worker to inject a page-level fetch bridge without inline scripts

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message && message.type === 'INSTALL_PAGE_FETCH_BRIDGE') {
    try {
      chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
        const tab = tabs && tabs[0];
        if (!tab || !tab.id) return sendResponse();
        await chrome.scripting.executeScript({
          target: { tabId: tab.id, allFrames: false },
          world: 'MAIN',
          func: () => {
            if (window.__mrmPageFetchBridgeInstalled) return;
            window.__mrmPageFetchBridgeInstalled = true;
            window.addEventListener(
              'message',
              async (e) => {
                try {
                  const data = e.data;
                  if (
                    !data ||
                    data.source !== 'mrm-extension' ||
                    data.type !== 'MRM_PAGE_FETCH_REQUEST'
                  )
                    return;
                  const { requestId, url, options, wantBody, responseType } = data;
                  const opts = Object.assign(
                    { credentials: 'include', cache: 'no-store', mode: 'cors' },
                    options || {}
                  );
                  const res = await fetch(url, opts);
                  const headers = Array.from(res.headers.entries());
                  if (wantBody) {
            try {
              if (responseType === 'text') {
                const text = await res.text();
                window.postMessage({
                  source: 'mrm-page',
                  type: 'MRM_PAGE_FETCH_RESPONSE',
                  requestId,
                  ok: res.ok,
                  status: res.status,
                  statusText: res.statusText,
                  headers,
                  body: text,
                  responseType: 'text',
                }, '*');
              } else if (responseType === 'json') {
                const json = await res.json();
                window.postMessage({
                  source: 'mrm-page',
                  type: 'MRM_PAGE_FETCH_RESPONSE',
                  requestId,
                  ok: res.ok,
                  status: res.status,
                  statusText: res.statusText,
                  headers,
                  body: json,
                  responseType: 'json',
                }, '*');
              } else {
                const buffer = await res.arrayBuffer();
                const bytes = Array.from(new Uint8Array(buffer));
                window.postMessage({
                  source: 'mrm-page',
                  type: 'MRM_PAGE_FETCH_RESPONSE',
                  requestId,
                  ok: res.ok,
                  status: res.status,
                  statusText: res.statusText,
                  headers,
                  body: bytes,
                  responseType: 'bytes',
                }, '*');
              }
            } catch (e) {
              window.postMessage({
                source: 'mrm-page',
                type: 'MRM_PAGE_FETCH_RESPONSE',
                requestId,
                ok: false,
                error: e && e.message ? e.message : String(e),
              }, '*');
            }
                  } else {
                    window.postMessage(
                      {
                        source: 'mrm-page',
                        type: 'MRM_PAGE_FETCH_RESPONSE',
                        requestId,
                        ok: res.ok,
                        status: res.status,
                        statusText: res.statusText,
                        headers,
                      },
                      '*'
                    );
                  }
                } catch (err) {
                  window.postMessage(
                    {
                      source: 'mrm-page',
                      type: 'MRM_PAGE_FETCH_RESPONSE',
                      requestId: e.data && e.data.requestId,
                      ok: false,
                      error: err && err.message ? err.message : String(err),
                    },
                    '*'
                  );
                }
              },
              false
            );
          },
        });
        sendResponse();
      });
    } catch (e) {
      sendResponse();
    }
    return true;
  }
});


