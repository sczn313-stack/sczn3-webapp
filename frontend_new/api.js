// frontend_new/api.js
// Guarantees window.tapscore exists and calls the backend.

(() => {
  // ✅ Your Render backend:
  const BACKEND_BASE = "https://sczn3-backend-new1.onrender.com";

  async function tapscore(payload) {
    const url = `${BACKEND_BASE}/tapscore`;

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`HTTP ${res.status} ${txt}`.trim());
    }
    return res.json();
  }

  async function ping() {
    const url = `${BACKEND_BASE}/ping`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Ping failed: ${res.status}`);
    return res.json();
  }

  window.tapscore = tapscore;
  window.tapscorePing = ping;
})();
