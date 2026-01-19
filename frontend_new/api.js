// frontend_new/api.js
// Guarantees window.tapscore exists and calls the backend (with strong errors + health check).

(() => {
  const BACKEND_BASE = "https://sczn3-backend-new1.onrender.com";
  const HEALTH_PATHS = ["/ping", "/health", "/"]; // tries in this order

  function withTimeout(ms, promiseFactory) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), ms);
    return promiseFactory(ctrl).finally(() => clearTimeout(t));
  }

  async function fetchJson(url, opts = {}) {
    const res = await withTimeout(15000, (controller) =>
      fetch(url, { ...opts, signal: controller.signal, cache: "no-store" })
    );

    const contentType = res.headers.get("content-type") || "";
    const isJson = contentType.includes("application/json");

    if (!res.ok) {
      const body = isJson
        ? JSON.stringify(await res.json()).slice(0, 400)
        : (await res.text()).slice(0, 400);
      throw new Error(`HTTP ${res.status} ${body}`.trim());
    }

    if (!isJson) {
      const text = await res.text();
      throw new Error(`Expected JSON but got: ${text.slice(0, 120)}`);
    }

    return res.json();
  }

  async function tapscore(payload) {
    return fetchJson(`${BACKEND_BASE}/tapscore`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  }

  async function ping() {
    let lastErr = null;
    for (const path of HEALTH_PATHS) {
      try {
        return await fetchJson(`${BACKEND_BASE}${path}`);
      } catch (e) {
        lastErr = e;
      }
    }
    throw new Error(`Backend not reachable. Last error: ${lastErr?.message || lastErr}`);
  }

  window.tapscore = tapscore;
  window.tapscorePing = ping;
  window.BACKEND_BASE = BACKEND_BASE;
})();
