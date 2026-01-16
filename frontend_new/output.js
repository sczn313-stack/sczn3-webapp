// sczn3-webapp/frontend_new/output.js
(() => {
  const $ = (id) => document.getElementById(id);

  // ===== STORAGE KEYS (must match index.js) =====
  const PHOTO_KEY = "sczn3_targetPhoto_dataUrl";
  const DIST_KEY  = "sczn3_distance_yards";
  const TAPS_KEY  = "sczn3_tap_points_json";

  // ===== TARGET MODEL (PILOT SIMPLE) =====
  // Assumption: the photo is an 8.5x11 target image (not heavily skewed)
  // We map NATURAL pixels -> inches by simple linear scaling.
  const TARGET_W_IN = 8.5;
  const TARGET_H_IN = 11.0;

  // ===== DOM =====
  const secIdText     = $("secIdText");
  const thumb         = $("targetThumb");
  const distanceText  = $("distanceText");
  const adjText       = $("adjText");

  const noData   = $("noData");
  const results  = $("results");

  const scoreText   = $("scoreText");
  const elevClicks  = $("elevClicks");
  const windClicks  = $("windClicks");
  const elevDir     = $("elevDir");
  const windDir     = $("windDir");
  const tipText     = $("tipText");

  const debugBox = $("debugBox");

  function debug(msg, obj) {
    console.log(msg, obj || "");
    if (debugBox) {
      debugBox.classList.remove("hidden");
      debugBox.style.whiteSpace = "pre-wrap";
      debugBox.textContent = msg + (obj ? "\n\n" + JSON.stringify(obj, null, 2) : "");
    }
  }

  function round2(n) {
    const x = Number(n);
    if (!Number.isFinite(x)) return 0;
    return Math.round(x * 100) / 100;
  }

  // True MOA inches per MOA at distance
  function inchPerMOA(yards) {
    return 1.047 * (yards / 100);
  }

  function clicksFromInches(inches, yards, moaPerClick) {
    const ipm = inchPerMOA(yards);
    return (Math.abs(inches) / (ipm * moaPerClick)).toFixed(2);
  }

  // Directions from correction sign
  function dirX(dx) {
    if (dx === 0) return "";
    return dx > 0 ? "RIGHT" : "LEFT";
  }
  function dirY(dy) {
    if (dy === 0) return "";
    return dy > 0 ? "UP" : "DOWN";
  }

  function safeJsonParse(str){
    try { return JSON.parse(str); } catch { return null; }
