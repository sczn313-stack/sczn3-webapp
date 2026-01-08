// frontend_new/api.js
(function () {
  const BACKEND_BASE = "https://sczn3-backend-new.onrender.com";

  function inchesPerMOAAtYards(yards) {
    const y = Number(yards) || 100;
    return (1.047 * y) / 100;
  }

  const MOA_PER_CLICK = 0.25;

  window.clicksFromInches = function clicksFromInches(inches, yards) {
    const imp = inchesPerMOAAtYards(yards);
    const moa = (Number(inches) || 0) / imp;
    const clicks = moa / MOA_PER_CLICK;
    return Math.round(clicks * 100) / 100;
  };

  window.postAnalyze = async function postAnalyze(file, yards) {
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
        `Analyze failed (non-JSON). URL: ${url} HTTP ${r.status}\nRAW: ${text.slice(0, 200)}`
      );
    }

    if (!r.ok || !data.ok) {
      throw new Error(
        `Analyze failed. URL: ${url} HTTP ${r.status}\nERR: ${(data && (data.error || data.message)) || "Unknown"}`
      );
    }

    return data;
  };
})();
