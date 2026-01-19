/* frontend_new/api.js */

(() => {
  const API_BASE =
    (window.API_BASE && String(window.API_BASE)) ||
    (window.location.hostname.includes("onrender.com")
      ? "https://YOUR-BACKEND-ONRENDER-URL"   // <-- put your backend URL here
      : "http://localhost:10000");

  async function analyzeTapScore(formData) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 15000);

    try {
      const r = await fetch(`${API_BASE}/tapscore`, {
        method: "POST",
        body: formData,
        signal: ctrl.signal
      });

      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return await r.json();
    } finally {
      clearTimeout(t);
    }
  }

  window.TAP_API = { analyzeTapScore };
})();
