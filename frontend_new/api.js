// frontend_new/api.js (FULL REPLACEMENT)

(() => {
  const BACKEND_BASE = "https://sczn3-backend-new.onrender.com";

  async function tapscore(payload) {
    const url = `${BACKEND_BASE}/tapscore`;

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const text = await res.text().catch(() => "");
    if (!res.ok) throw new Error(`tapscore HTTP ${res.status}: ${text || "(no body)"}`);
    return text ? JSON.parse(text) : {};
  }

  async function ping() {
    const url = `${BACKEND_BASE}/ping`;
    const res = await fetch(url);

    const text = await res.text().catch(() => "");
    if (!res.ok) throw new Error(`ping HTTP ${res.status}: ${text || "(no body)"}`);
    return text ? JSON.parse(text) : {};
  }

  window.BACKEND_BASE = BACKEND_BASE;
  window.tapscore = tapscore;
  window.tapscorePing = ping;
})();
