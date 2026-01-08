// frontend_new/api.js
// HARD-LOCK the backend base URL (do NOT use relative paths)
(function () {
  const BACKEND_BASE = "https://sczn3-backend-new.onrender.com";

  // True MOA inches-per-MOA at distance
  function inchesPerMOAAtYards(yards) {
    const y = Number(yards) || 100;
    return (1.047 * y) / 100;
  }

  // 0.25 MOA/click default (2 decimals output handled in app.js)
  const MOA_PER_CLICK = 0.25;

  window.clicksFromInches = function clicksFromInches(inches, yards) {
    const imp = inchesPerMOAAtYards(yards);
    const moa = (Number(inches) || 0) / imp;
    const clicks = moa / MOA_PER_CLICK;
    return Math.round(clicks * 100) / 100;
  };

  // POST /api/analyze (multipart) — backend expects field name "image"
  window.postAnalyze = async function postAnalyze(file, yards) {
    const fd = new FormData();
    fd.append("image", file);

    const url = `${BACKEND_BASE}/api/analyze`;
    const r = await fetch(url, { method: "POST", body: fd });

    const text = await r.text();

    // Hard fail on non-JSON responses (prevents silent “0.00”)
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error(
        `Analyze failed (non-JSON). URL: ${url} HTTP ${r.status}\n` +
        `RAW: ${text.slice(0, 200)}`
      );
    }

    if (!r.ok || !data.ok) {
      throw new Error(
        `Analyze failed. URL: ${url} HTTP ${r.status}\n` +
        `ERR: ${(data && (data.error || data.message)) || "Unknown"}`
      );
    }

    return data;
  };
})();
