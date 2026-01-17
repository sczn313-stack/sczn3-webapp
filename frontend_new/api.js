// sczn3-webapp/frontend_new/api.js
// Frontend API helper for Tap-N-Score (backend_new)
//
// Optional override (recommended):
//   sessionStorage.setItem("sczn3_backend_base","https://sczn3-backend-new1.onrender.com")

(function () {
  const DEFAULT_BACKEND = "https://sczn3-backend-new1.onrender.com";

  function backendBase() {
    return sessionStorage.getItem("sczn3_backend_base") || DEFAULT_BACKEND;
  }

  async function safeText(res) {
    try { return await res.text(); } catch { return ""; }
  }

  // Keep your original analyzeTarget (image-only) in case you still use it elsewhere.
  async function analyzeTarget({ file, distanceYards }) {
    const base = backendBase();
    if (!file) throw new Error("No file provided.");

    const dy = Number(distanceYards);
    if (!Number.isFinite(dy) || dy <= 0) {
      throw new Error("distanceYards must be > 0 (required).");
    }

    const fd = new FormData();
    fd.append("image", file, file.name || "target.jpg");
    fd.append("distanceYards", String(dy)); // REQUIRED by backend_new

    const res = await fetch(`${base}/api/analyze`, { method: "POST", body: fd });
    const txt = await safeText(res);

    let data = null;
    try { data = txt ? JSON.parse(txt) : null; } catch { data = null; }

    if (!res.ok) {
      const msg = data?.error?.message || txt || `Backend analyze failed (${res.status}).`;
      throw new Error(msg);
    }
    if (!data || data.ok !== true) {
      const msg = data?.error?.message || "Backend returned ok:false.";
      throw new Error(msg);
    }
    return data;
  }

  // Tap-N-Score analyze: bull first, then holes, NATURAL pixels + nw/nh
  async function analyzeTapNScore({
    file,
    distanceYards,
    taps, // [{x,y}, ...] NATURAL pixels; bull first
    nw,
    nh,
    moaPerClick = 0.25,
    targetWIn = 8.5,
    targetHIn = 11
  }) {
    const base = backendBase();

    if (!file) throw new Error("No file provided.");

    const dy = Number(distanceYards);
    if (!Number.isFinite(dy) || dy <= 0) {
      throw new Error("distanceYards must be > 0 (required).");
    }

    if (!Array.isArray(taps) || taps.length < 2) {
      throw new Error("Need at least 2 taps: bull first, then one hole.");
    }

    const nW = Number(nw);
    const nH = Number(nh);
    if (!Number.isFinite(nW) || nW <= 0 || !Number.isFinite(nH) || nH <= 0) {
      throw new Error("Image natural size missing (nw/nh). Please re-load the photo.");
    }

    const fd = new FormData();
    fd.append("image", file, file.name || "target.jpg");
    fd.append("distanceYards", String(dy)); // REQUIRED
    fd.append("moaPerClick", String(moaPerClick));
    fd.append("targetWIn", String(targetWIn));
    fd.append("targetHIn", String(targetHIn));
    fd.append("tapsJson", JSON.stringify(taps));
    fd.append("nw", String(nW));
    fd.append("nh", String(nH));

    const res = await fetch(`${base}/api/analyze`, { method: "POST", body: fd });
    const txt = await safeText(res);

    let data = null;
    try { data = txt ? JSON.parse(txt) : null; } catch { data = null; }

    if (!res.ok) {
      const msg = data?.error?.message || txt || `Analyze failed (${res.status}).`;
      throw new Error(msg);
    }
    if (!data || data.ok !== true) {
      const msg = data?.error?.message || "Backend returned ok:false.";
      throw new Error(msg);
    }

    return data;
  }

  // Expose
  window.SEC_API = window.SEC_API || {};
  window.SEC_API.analyzeTarget = analyzeTarget;
  window.SEC_API.analyzeTapNScore = analyzeTapNScore;
})();
