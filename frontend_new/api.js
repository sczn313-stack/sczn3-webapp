// sczn3-webapp/frontend_new/api.js (FULL FILE REPLACEMENT)
// Hardened API helper with timeout + clean errors.
// Works when frontend is static and backend is on Render.

(() => {
  const DEFAULT_TIMEOUT_MS = 15000;

  // If you want to hard-set the backend URL, put it here:
  // Example: "https://YOUR-BACKEND.onrender.com"
  const HARDCODED_API_BASE = ""; // leave "" to auto-detect

  function getApiBase() {
    // 1) session override (optional)
    const ss = safeGetSession("sczn3_api_base");
    if (ss) return stripTrailingSlash(ss);

    // 2) hardcoded override (optional)
    if (HARDCODED_API_BASE) return stripTrailingSlash(HARDCODED_API_BASE);

    // 3) auto: if your frontend and backend are same origin, use ""
    // (meaning we'll call relative paths like "/api/analyze")
    // Most Render setups are separate origins, so we *guess* nothing here.
    // We'll default to a SAME-ORIGIN relative call, which is safest.
    return "";
  }

  function stripTrailingSlash(s) {
    return String(s || "").replace(/\/+$/, "");
  }

  function safeGetSession(k) {
    try { return sessionStorage.getItem(k) || ""; } catch { return ""; }
  }

  function timeoutFetch(url, opts = {}, timeoutMs = DEFAULT_TIMEOUT_MS) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);

    return fetch(url, { ...opts, signal: ctrl.signal })
      .finally(() => clearTimeout(t));
  }

  async function postJson(path, bodyObj, timeoutMs) {
    const base = getApiBase();
    const url = base ? `${base}${path}` : path; // if base=="" use relative

    try {
      const res = await timeoutFetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bodyObj || {}),
      }, timeoutMs || DEFAULT_TIMEOUT_MS);

      const text = await res.text().catch(() => "");
      let data = null;
      try { data = text ? JSON.parse(text) : null; } catch { data = null; }

      if (!res.ok) {
        return {
          ok: false,
          status: res.status,
          error: data || { message: text || "Request failed." },
          url
        };
      }

      return { ok: true, status: res.status, data, url };
    } catch (e) {
      const msg =
        (e && e.name === "AbortError")
          ? "Request timed out. Try again."
          : "Network/server error. Try again.";
      return { ok: false, status: 0, error: { message: msg }, url };
    }
  }

  // Public API
  window.Sczn3Api = {
    getApiBase,
    setApiBase: (u) => { try { sessionStorage.setItem("sczn3_api_base", String(u || "")); } catch {} },
    analyzeTapNScore: async (payload) => postJson("/api/analyze", payload, DEFAULT_TIMEOUT_MS),
  };
})();
