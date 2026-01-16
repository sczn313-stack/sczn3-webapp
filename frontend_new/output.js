// sczn3-webapp/frontend_new/output.js
// SEC Output page logic (output.html)
//
// Fixes:
// - Uses correct element IDs from output.html (noDataBanner / resultsGrid / etc.)
// - Calls backend using a FULL URL (because frontend is a Render Static Site)
// - Keeps Tap N Score result visible even if backend is unreachable
//
// Storage keys:
//   sczn3_targetPhoto_dataUrl
//   sczn3_distance_yards
//   sczn3_tap_points_json
// Optional override:
//   sczn3_backend_base   (ex: https://sczn3-backend-new1.onrender.com)

(() => {
  const $ = (id) => document.getElementById(id);

  const PHOTO = "sczn3_targetPhoto_dataUrl";
  const DIST  = "sczn3_distance_yards";
  const TAPS  = "sczn3_tap_points_json";

  // ---- output.html IDs (MUST MATCH YOUR output.html) ----
  const secIdText       = $("secIdText");
  const targetThumb     = $("targetThumb");
  const distanceText    = $("distanceText");
  const adjText         = $("adjText");

  const noDataBanner    = $("noDataBanner");
  const resultsGrid     = $("resultsGrid");

  const scoreText       = $("scoreText");
  const elevClicksText  = $("elevClicksText");
  const windClicksText  = $("windClicksText");
  const elevDirText     = $("elevDirText");
  const windDirText     = $("windDirText");
  const tipText         = $("tipText");

  // ---------- SEC ID ----------
  let sid = sessionStorage.getItem("sczn3_sec_id");
  if (!sid) {
    sid = Math.random().toString(16).slice(2, 8).toUpperCase();
    sessionStorage.setItem("sczn3_sec_id", sid);
  }
  if (secIdText) secIdText.textContent = `SEC-ID — ${sid}`;

  // ---------- BASE DATA ----------
  const imgData = sessionStorage.getItem(PHOTO);
  const yards = Number(sessionStorage.getItem(DIST) || 100);

  if (distanceText) distanceText.textContent = String(yards);
  if (adjText) adjText.textContent = "1/4 MOA per click";

  if (!imgData || !targetThumb) {
    // nothing to render
    return;
  }

  targetThumb.src = imgData;

  function showResults() {
    if (noDataBanner) noDataBanner.classList.add("hidden");
    if (resultsGrid) resultsGrid.classList.remove("hidden");
  }

  function showNoData() {
    if (noDataBanner) noDataBanner.classList.remove("hidden");
    if (resultsGrid) resultsGrid.classList.add("hidden");
  }

  // default state
  showNoData();

  // ---------- TAP N SCORE (always works) ----------
  targetThumb.onload = () => {
    try {
      const taps = JSON.parse(sessionStorage.getItem(TAPS) || "[]");
      if (!Array.isArray(taps) || taps.length === 0) return;

      const w = targetThumb.naturalWidth || 1;
      const h = targetThumb.naturalHeight || 1;

      // average tap point
      let sx = 0, sy = 0;
      for (const p of taps) { sx += Number(p.x || 0); sy += Number(p.y || 0); }
      const px = sx / taps.length;
      const py = sy / taps.length;

      // center of image
      const cx = w / 2;
      const cy = h / 2;

      const dist = Math.hypot(px - cx, py - cy);
      const score = Math.max(0, Math.round(1000 - dist));

      if (scoreText) scoreText.textContent = String(score);
      if (tipText) tipText.textContent = `Tap N Score pilot — ${taps.length} shot(s) recorded.`;

      // show results even if clicks are not available yet
      showResults();
    } catch {
      // ignore
    }
  };

  // ---------- BACKEND ANALYZE (for clicks + directions) ----------
  async function analyzeBackend() {
    // IMPORTANT: must be FULL URL since frontend and backend are separate services
    const backendBase =
      sessionStorage.getItem("sczn3_backend_base") ||
      "https://sczn3-backend-new1.onrender.com";

    try {
      const blob = await (await fetch(imgData)).blob();
      const fd = new FormData();
      fd.append("image", blob, "target.jpg");

      const res = await fetch(`${backendBase}/api/analyze`, {
        method: "POST",
        body: fd
      });

      if (!res.ok) return;

      const data = await res.json();

      // expected shape:
      // data.correction_in.dx, data.correction_in.dy  (inches)
      // data.directions.elevation, data.directions.windage (strings)
      if (!data || !data.correction_in) return;

      const inchPerMOA = 1.047 * (yards / 100);
      const clicksFromInches = (inches) => {
        const moa = Math.abs(Number(inches || 0)) / inchPerMOA;
        const clicks = moa / 0.25; // 1/4 MOA per click
        return clicks.toFixed(2);
      };

      if (elevClicksText) elevClicksText.textContent = clicksFromInches(data.correction_in.dy);
      if (windClicksText) windClicksText.textContent = clicksFromInches(data.correction_in.dx);

      if (elevDirText) elevDirText.textContent = (data.directions && data.directions.elevation) ? data.directions.elevation : "";
      if (windDirText) windDirText.textContent = (data.directions && data.directions.windage) ? data.directions.windage : "";

      showResults();
    } catch {
      // if backend fails, we still keep Tap N Score showing
    }
  }

  analyzeBackend();
})();
