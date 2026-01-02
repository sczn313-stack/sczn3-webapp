// frontend_new/api.js
(() => {
  const DEFAULT_BACKEND = "https://sczn3-webapp-213.onrender.com";

  function normalizeBaseUrl(u) {
    if (!u) return DEFAULT_BACKEND;
    u = String(u).trim();
    if (!u) return DEFAULT_BACKEND;
    return u.replace(/\/+$/, "");
  }

  // Optional override:
  // window.SCZN3_API_BASE = "https://YOUR-BACKEND.onrender.com";
  const API_BASE = normalizeBaseUrl(window.SCZN3_API_BASE || window.API_BASE || DEFAULT_BACKEND);

  async function getHealth(timeoutMs = 6000) {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), timeoutMs);
    try {
      const r = await fetch(`${API_BASE}/health`, { method: "GET", signal: ac.signal });
      if (!r.ok) throw new Error(await r.text());
      return await r.json();
    } finally {
      clearTimeout(t);
    }
  }

  async function postCalc(payload, timeoutMs = 12000) {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), timeoutMs);
    try {
      const r = await fetch(`${API_BASE}/api/calc`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: ac.signal,
      });
      if (!r.ok) throw new Error(await r.text());
      return await r.json();
    } finally {
      clearTimeout(t);
    }
  }

  // Expose globally
  window.SCZN3_API_BASE = API_BASE;
  window.getHealth = getHealth;
  window.postCalc = postCalc;
  window.sczn3Api = { API_BASE, getHealth, postCalc };
})();
