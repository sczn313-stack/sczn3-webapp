// frontend_new/api.js
// Shared API + math

(function () {
  // ✅ Your backend base URL:
  const BACKEND_BASE = "https://sczn3-backend-new.onrender.com";

  const num = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };

  // True MOA: 1.047" at 100 yards
  function inchesPerMOAAtYards(yards) {
    const y = Number(yards) || 100;
    return (1.047 * y) / 100;
  }

  // Default: 0.25 MOA per click
  const MOA_PER_CLICK_DEFAULT = 0.25;

  function clicksFromInches(inches, yards) {
    const imp = inchesPerMOAAtYards(yards);
    const moa = num(inches) / imp;
    const clicks = moa / MOA_PER_CLICK_DEFAULT;
    return Math.round(clicks * 100) / 100; // 2 decimals
  }

  // POST /api/analyze
  async function postAnalyze(file, yards) {
    const fd = new FormData();
    // backend expects "image"
    fd.append("image", file);

    // yards optional; include it if your backend reads it
    fd.append("yards", String(Number(yards) || 100));

    const url = `${BACKEND_BASE}/api/analyze`;
    const r = await fetch(url, { method: "POST", body: fd });

    const text = await r.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = { ok: false, error: "Non-JSON response", raw: text };
    }

    if (!r.ok || data?.ok === false) {
      const err = data?.error || data?.message || `HTTP ${r.status}`;
      throw new Error(`Analyze failed: ${err}`);
    }

    return data;
  }

  window.SEC_API = {
    postAnalyze,
    clicksFromInches,
  };
})();
