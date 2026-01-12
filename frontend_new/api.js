// frontend_new/api.js
// Backend connector (no on-page debug text). Errors will show only in the status area.

(function () {
  // ✅ Set this to your LIVE backend base:
  // Example: "https://sczn3-backend-new.onrender.com"
  window.BACKEND_BASE = window.BACKEND_BASE || "https://sczn3-backend-new.onrender.com";

  async function postAnalyze(file, yards) {
    const fd = new FormData();

    // Be tolerant: different backends expect different field names
    fd.append("image", file);
    fd.append("file", file);

    // Optional: send yards if your backend uses it
    fd.append("yards", String(yards || 100));

    const url = `${window.BACKEND_BASE}/api/analyze`;

    const r = await fetch(url, { method: "POST", body: fd });

    const text = await r.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      data = { ok: false, error: "Non-JSON response", raw: text };
    }

    if (!r.ok || data?.ok === false) {
      const err = data?.error || data?.message || `HTTP ${r.status}`;
      throw new Error(`Analyze failed: ${err}`);
    }

    return data;
  }

  // True MOA: 1 MOA = 1.047" at 100y
  function inchesPerMOAAtYards(yards) {
    const y = Number(yards) || 100;
    return (1.047 * y) / 100;
  }

  // Default 1/4 MOA per click (0.25)
  const MOA_PER_CLICK_DEFAULT = 0.25;

  function clicksFromInches(inches, yards, moaPerClick) {
    const imp = inchesPerMOAAtYards(yards);
    const moa = (Number(inches) || 0) / imp;
    const mpc = Number(moaPerClick) || MOA_PER_CLICK_DEFAULT;
    const clicks = moa / mpc;
    // Two decimals ALWAYS
    return Math.round(clicks * 100) / 100;
  }

  window.postAnalyze = postAnalyze;
  window.clicksFromInches = clicksFromInches;
})();
