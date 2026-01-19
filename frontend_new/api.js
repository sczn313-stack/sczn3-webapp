// frontend_new/api.js
// Guarantees window.tapscore exists and calls the backend.
// Also exposes window.tapscorePing for quick connectivity tests.

(() => {
  const BACKEND_BASE = "https://sczn3-backend-new1.onrender.com";

  async function fetchJson(url, opts = {}) {
    const res = await fetch(url, { ...opts, cache: "no-store" });
    const ct = (res.headers.get("content-type") || "").toLowerCase();

    let bodyText = "";
    let bodyJson = null;

    if (ct.includes("application/json")) {
      try { bodyJson = await res.json(); } catch {}
    } else {
      try { bodyText = await res.text(); } catch {}
    }

    if (!res.ok) {
      const detail = bodyJson ? JSON.stringify(bodyJson) : bodyText;
      throw new Error(`HTTP ${res.status} ${detail || ""}`.trim());
    }

    if (bodyJson) return bodyJson;
    throw new Error(`Expected JSON but got: ${bodyText.slice(0,120)}`);
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
    // Your backend has /ping for sure
    const url = `${BACKEND_BASE}/ping`;
    return fetchJson(url);
  }

  window.tapscore = tapscore;
  window.tapscorePing = ping;
  window.BACKEND_BASE = BACKEND_BASE;
})();
