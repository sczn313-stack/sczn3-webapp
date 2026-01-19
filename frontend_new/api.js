// frontend_new/api.js  (FULL REPLACEMENT)
// Guarantees window.tapscore exists and calls the backend reliably.
// Also provides window.tapscorePing() and window.tapscoreBase().

(() => {
  const BACKEND_BASE = "https://sczn3-backend-new1.onrender.com";

  async function readTextSafe(res) {
    try { return await res.text(); } catch { return ""; }
  }

  async function tapscore(payload) {
    const url = `${BACKEND_BASE}/tapscore`;

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload || {}),
    });

    if (!res.ok) {
      const txt = await readTextSafe(res);
      throw new Error(`tapscore HTTP ${res.status} ${txt}`.trim());
    }

    // Force JSON parse errors to surface clearly
    try {
      return await res.json();
    } catch (e) {
      const txt = await readTextSafe(res);
      throw new Error(`tapscore JSON parse failed. ${String(e?.message || e)} ${txt}`.trim());
    }
  }

  async function ping() {
    // Prefer /health, fall back to /ping, then /
    const tries = ["/health", "/ping", "/"];
    let lastErr = null;

    for (const path of tries) {
      try {
        const res = await fetch(`${BACKEND_BASE}${path}`, { method: "GET" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        return { ok: true, path, data };
      } catch (e) {
        lastErr = e;
      }
    }

    throw new Error(`Ping failed. ${String(lastErr?.message || lastErr)}`);
  }

  window.tapscore = tapscore;
  window.tapscorePing = ping;
  window.tapscoreBase = () => BACKEND_BASE;
})();
