// sczn3-webapp/frontend_new/api.js (FULL FILE REPLACEMENT)

(() => {
  // HARD PIN to the backend service (prevents /api hitting the static frontend)
  const API_BASE = "https://sczn3-backend-new1.onrender.com";

  // Small helper so other files can call window.SCNZ3_API.postJson(...)
  function withTimeout(ms) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), ms);
    return { ctrl, cancel: () => clearTimeout(t) };
  }

  async function postJson(path, bodyObj, timeoutMs = 20000) {
    const url = API_BASE + path;

    const { ctrl, cancel } = withTimeout(timeoutMs);

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bodyObj),
        signal: ctrl.signal,
        mode: "cors",
        cache: "no-store",
      });

      const text = await res.text();
      let data = null;

      try { data = text ? JSON.parse(text) : null; } catch { data = { raw: text }; }

      if (!res.ok) {
        return {
          ok: false,
          status: res.status,
          error: data || { message: "Request failed" },
        };
      }

      return { ok: true, status: res.status, data };
    } catch (err) {
      const msg = (err && err.name === "AbortError")
        ? "Request timed out. Try again."
        : "Network/server error. Try again.";

      return { ok: false, status: 0, error: { message: msg, detail: String(err || "") } };
    } finally {
      cancel();
    }
  }

  // expose
  window.SCNZ3_API = { postJson, API_BASE };
})();
