// frontend_new/api.js
// Backend + math helpers (True MOA)

(function () {
  // ✅ IMPORTANT: set this to your LIVE backend_new service
  // Example from your earlier screen:
  // https://sczn3-backend-new.onrender.com
  const BACKEND_BASE = "https://sczn3-backend-new.onrender.com";

  function inchesPerMOAAtYards(yards) {
    const y = Number(yards) || 100;
    return (1.047 * y) / 100;
  }

  // Default 1/4 MOA per click
  const MOA_PER_CLICK_DEFAULT = 0.25;

  function clicksFromInches(inches, yards) {
    const imp = inchesPerMOAAtYards(yards);
    const moa = (Number(inches) || 0) / imp;
    const clicks = moa / MOA_PER_CLICK_DEFAULT;
    // ✅ Always 2 decimals
    return Math.round(clicks * 100) / 100;
  }

  async function postAnalyze(file, yards) {
    const fd = new FormData();
    // ✅ Backend expects multipart form-data key "image"
    fd.append("image", file);

    // yards is optional, but if your backend uses it, include it
    // If backend ignores it, no harm.
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
      const raw = (data?.raw || text || "").slice(0, 600);
      throw new Error(`Analyze failed: ${err}\nURL: ${url}\nRAW: ${raw}`);
    }

    return data;
  }

  // expose
  window.BACKEND_BASE = BACKEND_BASE;
  window.clicksFromInches = clicksFromInches;
  window.postAnalyze = postAnalyze;
})();
