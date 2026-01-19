// frontend_new/api.js
// Guarantees window.tapscore exists and calls the backend (with strong errors + health check).

(() => {
  // ✅ Render backend
  const BACKEND_BASE = "https://sczn3-backend-new1.onrender.com";

  // Prefer a route you KNOW exists. Use /health if you have it, else fallback to "/"
  const HEALTH_PATHS = ["/ping", "/health", "/"]; // tries in this order

  function withTimeout(ms, promise) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), ms);
    return { ctrl, wrapped: promise(ctrl).finally(() => clearTimeout(t)) };
  }

  async function fetchJson(url, opts = {}) {
    const { ctrl, wrapped } = withTimeout(15000, (controller) =>
      fetch(url, {
        ...opts,
        signal: controller.signal,
        // cache bust so Safari/Render CDN doesn't hand you something stale
        cache: "no-store",
      })
    );

    try {
      const res = await wrapped;

      const contentType = res.headers.get("content-type") || "";
      const isJson = contentType.includes("application/json");

      if (!res.ok) {
        const body = isJson ? JSON.stringify(await res.json()).slice(0, 400) : (await res.text()).slice(0, 400);
        throw new Error(`HTTP ${res.status} ${body}`.trim());
      }

      if (!isJson) {
        const text = await res.text();
        throw new Error(`Expected JSON but got: ${text.slice(0, 120)}`);
      }

      return res.json();
    } catch (err) {
      if (err?.name === "AbortError") throw new Error("Request timed out");
      throw err;
    }
  }

  async function tapscore(payload) {
    const url = `${BACKEND_BASE}/tapscore`;
    return fetchJson(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  }

  async function ping() {
    // Try multiple health routes so we don’t depend on /ping existing
    let lastErr = null;

    for (const path of HEALTH_PATHS) {
      try {
        return await fetchJson(`${BACKEND_BASE}${path}`);
      } catch (e) {
        lastErr = e;
      }
    }

    throw new Error(`Backend not reachable (${BACKEND_BASE}). Last error: ${lastErr?.message || lastErr}`);
  }

  // expose
  window.tapscore = tapscore;
  window.tapscorePing = ping;
  window.BACKEND_BASE = BACKEND_BASE;
})();
