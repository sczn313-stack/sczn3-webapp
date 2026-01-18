// frontend_new/api.js
// Defines window.tapscore(payload) + window.tapscorePing()
// iOS/Render safe: handles non-JSON errors cleanly + allows base override.

(() => {
  // Default backend base (Render)
  const DEFAULT_BACKEND_BASE = "https://sczn3-backend-new1.onrender.com";

  function backendBase() {
    // Optional override in console:
    // sessionStorage.setItem("sczn3_backend_base","https://YOURBACKEND.onrender.com")
    return (
      sessionStorage.getItem("sczn3_backend_base") ||
      DEFAULT_BACKEND_BASE
    ).replace(/\/+$/, "");
  }

  async function safeText(res) {
    try { return await res.text(); } catch { return ""; }
  }

  async function safeJson(res) {
    try { return await res.json(); } catch { return null; }
  }

  async function tapscore(payload) {
    const url = `${backendBase()}/tapscore`;

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload || {}),
      // keep CORS simple
      credentials: "omit",
      cache: "no-store",
    });

    if (!res.ok) {
      const j = await safeJson(res);
      const t = await safeText(res);
      const msg =
        (j && (j.error || j.message)) ||
        (t ? t.slice(0, 300) : "") ||
        "Request failed.";
      throw new Error(`Backend tapscore failed (${res.status}). ${msg}`);
    }

    const data = await safeJson(res);
    if (!data) throw new Error("Backend returned non-JSON response.");
    return data;
  }

  async function ping() {
    const url = `${backendBase()}/ping`;
    const res = await fetch(url, { method: "GET", cache: "no-store", credentials: "omit" });

    if (!res.ok) {
      const t = await safeText(res);
      throw new Error(`Ping failed (${res.status}). ${t.slice(0, 200)}`);
    }

    const data = await safeJson(res);
    return data || { ok: true };
  }

  window.tapscore = tapscore;
  window.tapscorePing = ping;
})();
