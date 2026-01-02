// frontend_new/api.js
(() => {
  const DEFAULT_BACKEND = "https://sczn3-webapp-213.onrender.com";

  function normalizeBaseUrl(u) {
    if (!u) return DEFAULT_BACKEND;
    u = String(u).trim();
    if (!u) return DEFAULT_BACKEND;
    return u.replace(/\/+$/, ""); // strip trailing slashes
  }

  // You can override this later by setting:
  // window.SCZN3_API_BASE = "https://YOUR-BACKEND.onrender.com";
  const API_BASE = normalizeBaseUrl(window.SCZN3_API_BASE || window.API_BASE || DEFAULT_BACKEND);

  async function getHealth() {
    const r = await fetch(`${API_BASE}/health`, { method: "GET" });
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  }

  async function postCalc(payload) {
    const r = await fetch(`${API_BASE}/api/calc`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  }

  // Expose globally (this fixes "Can't find variable: postCalc")
  window.SCZN3_API_BASE = API_BASE;
  window.getHealth = getHealth;
  window.postCalc = postCalc;
  window.sczn3Api = { API_BASE, getHealth, postCalc };
})();
