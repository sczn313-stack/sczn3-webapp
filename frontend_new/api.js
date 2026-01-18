(() => {
  // 🔥 SET THIS ONCE
  const API_BASE = "https://sczn3-backend-new1.onrender.com";

  function setStatus(msg) {
    try {
      const el = document.getElementById("statusLine");
      if (el) el.textContent = msg;
    } catch {}
  }

  async function tapscore(payload) {
    // payload: { distanceYds, taps:[{x,y}], vendorLink, imageDataUrl? }
    const res = await fetch(`${API_BASE}/tapscore`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const text = await res.text();
    if (!res.ok) {
      // include server message in the thrown error
      throw new Error(`HTTP ${res.status}: ${text || "Request failed"}`);
    }

    try {
      return JSON.parse(text);
    } catch {
      // backend returned non-json
      return { ok: true, raw: text };
    }
  }

  // Expose globally (non-module scripts)
  window.SCZN3_API_BASE = API_BASE;
  window.tapscore = tapscore;
  window.setStatus = setStatus;

  console.log("[api.js] loaded ok", API_BASE);
})();
