/* ============================================================
   SCZN3 — Frontend New (clean app.js)
   Canonical rule:
     correction = bull - POIB  (move POIB to bull)
     dx > 0 => RIGHT, dx < 0 => LEFT
     dy > 0 => UP,    dy < 0 => DOWN
   ============================================================ */

(function () {
  "use strict";

  // ---------- Helpers ----------
  const $ = (id) => document.getElementById(id);

  function num(v, fallback = 0) {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  }

  function setText(id, txt) {
    const el = $(id);
    if (el) el.textContent = String(txt);
  }

  // ---------- Canonical correction ----------
  function sczn3ComputeCorrection(bullX, bullY, poibX, poibY) {
    const dx = num(bullX) - num(poibX);
    const dy = num(bullY) - num(poibY);

    const windageDirection = dx > 0 ? "RIGHT" : dx < 0 ? "LEFT" : "NONE";
    const elevationDirection = dy > 0 ? "UP" : dy < 0 ? "DOWN" : "NONE";

    return {
      dx_in: Math.abs(dx),
      dy_in: Math.abs(dy),
      windageDirection,
      elevationDirection,
    };
  }

  // ---------- True MOA math (display only) ----------
  // If your app already calculates MOA/clicks elsewhere, keep it.
  function inchesToMOA(inches, yards, moaModeLabel) {
    // True MOA: 1 MOA = 1.047" at 100y
    // Shooter MOA: 1 MOA = 1.000" at 100y
    const isTrue = String(moaModeLabel || "").toLowerCase().includes("true");
    const inchesPerMOAAt100 = isTrue ? 1.047 : 1.0;
    const inchesPerMOA = inchesPerMOAAt100 * (yards / 100);
    if (inchesPerMOA === 0) return 0;
    return inches / inchesPerMOA;
  }

  function moaToClicks(moa, moaPerClick) {
    const mpc = num(moaPerClick, 0.25);
    if (mpc === 0) return 0;
    return moa / mpc;
  }

  // ---------- Wire-up ----------
  // These IDs must exist in your index.html.
  // If any are different, just rename the IDs below to match your HTML.
  const ids = {
    distance: "distanceYards",
    moaPerClick: "moaPerClick",
    moaMode: "moaMode",

    bullX: "bullX",
    bullY: "bullY",
    poibX: "poibX",
    poibY: "poibY",

    file: "photoFile",
    analyzeBtn: "btnAnalyze",
    calcBtn: "btnCalculate",

    // results
    windDir: "outWindageDir",
    elevDir: "outElevationDir",
    dx: "outDx",
    dy: "outDy",
    windMOA: "outWindageMOA",
    elevMOA: "outElevationMOA",
    windClicks: "outWindageClicks",
    elevClicks: "outElevationClicks",

    // debug/status
    status: "statusText",
  };

  function readInputs() {
    const yards = num($(ids.distance)?.value, 100);
    const moaPerClick = num($(ids.moaPerClick)?.value, 0.25);
    const moaMode = $(ids.moaMode)?.value || "True MOA (1.047\" @ 100y)";

    const bullX = num($(ids.bullX)?.value, 0);
    const bullY = num($(ids.bullY)?.value, 0);
    const poibX = num($(ids.poibX)?.value, 0);
    const poibY = num($(ids.poibY)?.value, 0);

    return { yards, moaPerClick, moaMode, bullX, bullY, poibX, poibY };
  }

  function renderResults() {
    const { yards, moaPerClick, moaMode, bullX, bullY, poibX, poibY } = readInputs();

    const corr = sczn3ComputeCorrection(bullX, bullY, poibX, poibY);

    setText(ids.windDir, corr.windageDirection);
    setText(ids.elevDir, corr.elevationDirection);
    setText(ids.dx, corr.dx_in.toFixed(2));
    setText(ids.dy, corr.dy_in.toFixed(2));

    const windMOA = inchesToMOA(corr.dx_in, yards, moaMode);
    const elevMOA = inchesToMOA(corr.dy_in, yards, moaMode);

    setText(ids.windMOA, windMOA.toFixed(2));
    setText(ids.elevMOA, elevMOA.toFixed(2));

    const windClicks = moaToClicks(windMOA, moaPerClick);
    const elevClicks = moaToClicks(elevMOA, moaPerClick);

    setText(ids.windClicks, windClicks.toFixed(2));
    setText(ids.elevClicks, elevClicks.toFixed(2));
  }

  // Placeholder “Analyze (Auto POIB)” hook
  // Keep your existing image/POIB logic if you already have it.
  async function analyzeAutoPOIB() {
    // If your app already has auto-detection, this button should call it.
    // For now, we just recompute directions from whatever POIB is currently set to.
    setText(ids.status, "Analyzing…");
    try {
      // TODO: plug in your actual auto-POIB detection here.
      renderResults();
      setText(ids.status, "Ready.");
    } catch (e) {
      console.error(e);
      setText(ids.status, "Analyze failed.");
    }
  }

  function init() {
    // live-calc when fields change
    [ids.distance, ids.moaPerClick, ids.moaMode, ids.bullX, ids.bullY, ids.poibX, ids.poibY]
      .map($)
      .filter(Boolean)
      .forEach((el) => el.addEventListener("input", renderResults));

    // buttons
    const analyzeBtn = $(ids.analyzeBtn);
    if (analyzeBtn) analyzeBtn.addEventListener("click", analyzeAutoPOIB);

    const calcBtn = $(ids.calcBtn);
    if (calcBtn) calcBtn.addEventListener("click", renderResults);

    setText(ids.status, "Ready.");
    renderResults();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
