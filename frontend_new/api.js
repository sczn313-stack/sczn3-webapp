// frontend_new/api.js
(function () {
  // ✅ Put your LIVE backend here:
  // Example: "https://sczn3-backend-new.onrender.com"
  window.BACKEND_BASE = "https://sczn3-backend-new.onrender.com";

  // ✅ Default click value (0.25 MOA/click)
  window.MOA_PER_CLICK_DEFAULT = 0.25;

  // True MOA inches per MOA at given yards (1.047" @ 100y)
  window.inchesPerMOAAtYards = function (yards) {
    const y = Number(yards) || 100;
    return (1.047 * y) / 100;
  };

  window.clicksFromInches = function (inches, yards) {
    const ipm = window.inchesPerMOAAtYards(yards);
    const moa = (Number(inches) || 0) / ipm;
    const clicks = moa / window.MOA_PER_CLICK_DEFAULT;
    return Math.round(clicks * 100) / 100; // ✅ 2 decimals
  };

  // POST /api/analyze (multipart form-data: image)
  window.postAnalyze = async function (file /*, yards */) {
    const fd = new FormData();
    fd.append("image", file);

    const url = `${window.BACKEND_BASE}/api/analyze`;
    const r = await fetch(url, { method: "POST", body: fd });

    const text = await r.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = { ok: false, error: "Non-JSON response", raw: text };
    }

    if (!r.ok || !data || data.ok === false) {
      const err = data?.error || data?.message || `HTTP ${r.status}`;
      throw new Error(`Analyze failed: ${err}`);
    }
    return data;
  };
})();
