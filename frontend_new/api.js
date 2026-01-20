/* ============================================================
   sczn3-webapp/frontend_new/api.js  (FULL REPLACEMENT)

   Goal:
   - ALWAYS define window.SCZN3_API (so your app never shows
     "API not loaded (SCZN3_API missing)")
   - Keep it static-site friendly (no modules, no imports)
   - Safe defaults + easy to change URLs in ONE place

   After you paste this file:
   1) Make sure frontend_new/index.html loads api.js BEFORE index.js:
        <script src="./api.js"></script>
        <script src="./index.js"></script>

   2) Deploy latest commit on Render (Manual Deploy → Deploy latest commit)
============================================================ */

(() => {
  // ---------- EDIT THESE ----------
  // Put your backend base URL here (NO trailing slash)
  // Example: "https://sczn3-sec-backend.onrender.com"
  const BACKEND_BASE_URL = ""; // <-- SET THIS

  // If you have a specific analyze endpoint path, set it here.
  // If your index.js already builds endpoints itself, this can stay as-is.
  const DEFAULT_ANALYZE_PATH = "/analyze";

  // Optional: if you have a health endpoint
  const DEFAULT_HEALTH_PATH = "/health";

  // ---------- HELPERS ----------
  const stripTrailingSlash = (s) => (typeof s === "string" ? s.replace(/\/+$/, "") : "");
  const join = (base, path) => {
    base = stripTrailingSlash(base || "");
    path = (path || "").trim();
    if (!path) return base;
    if (!path.startsWith("/")) path = "/" + path;
    return base + path;
  };

  const base = stripTrailingSlash(BACKEND_BASE_URL);

  // ---------- DEFINE GLOBAL ----------
  // This MUST exist before index.js runs.
  window.SCZN3_API = {
    // Base backend URL (NO trailing slash)
    BASE_URL: base,

    // Prebuilt URLs (optional convenience)
    URLS: {
      ANALYZE: join(base, DEFAULT_ANALYZE_PATH),
      HEALTH: join(base, DEFAULT_HEALTH_PATH),
    },

    // Fetch wrapper (optional convenience)
    async fetchJSON(url, opts = {}) {
      const res = await fetch(url, opts);
      const text = await res.text();
      let data = null;
      try {
        data = text ? JSON.parse(text) : null;
      } catch (_) {
        // non-json response; return as text
        data = { ok: res.ok, status: res.status, text };
        return data;
      }
      if (!res.ok) {
        // normalize error
        return { ok: false, status: res.status, data };
      }
      return { ok: true, status: res.status, data };
    },
  };

  // ---------- HARD FAIL GUARD ----------
  // If you forgot to set BACKEND_BASE_URL, don't break the app — just warn.
  if (!window.SCZN3_API.BASE_URL) {
    // Still defined (so your banner should disappear), but not configured.
    console.warn(
      "SCZN3_API loaded, but BACKEND_BASE_URL is empty. Set it in frontend_new/api.js."
    );
  }

  // Optional debug marker (handy for troubleshooting)
  window.__SCZN3_API_LOADED__ = true;
})();
