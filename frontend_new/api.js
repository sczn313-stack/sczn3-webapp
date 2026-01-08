(function () {
  const BACKEND_BASE = "https://sczn3-backend-new.onrender.com";

  function inchesPerMOAAtYards(yards) {
    const y = Number(yards) || 100;
    return (1.047 * y) / 100; // True MOA
  }

  const MOA_PER_CLICK = 0.25;

  // inches -> clicks (2-dec)
  window.clicksFromInches = function clicksFromInches(inches, yards) {
    const imp = inchesPerMOAAtYards(yards);
    const moa = (Number(inches) || 0) / imp;
    const clicks = moa / MOA_PER_CLICK;
    return Math.round(clicks * 100) / 100;
  };

  // POST /api/analyze (multipart form-data "image")
  window.postAnalyze = async function postAnalyze(file) {
    const fd = new FormData();
    fd.append("image", file);

    const url = `${BACKEND_BASE}/api/analyze`;
    const r = await fetch(url, { method: "POST", body: fd });

    const text = await r.text();

    let data;
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error(
        `Analyze failed (non-JSON). HTTP ${r.status}\nURL: ${url}\nRAW: ${text.slice(0, 300)}`
      );
    }

    if (!r.ok || !data.ok) {
      const msg = (data && (data.error || data.message)) || `HTTP ${r.status}`;
      throw new Error(`Analyze failed: ${msg}`);
    }

    return data;
  };
})();
