// sczn3-webapp/frontend_new/output.js
// Tap N Score -> deterministic clicks (NO BACKEND REQUIRED)

(() => {
  const $ = (id) => document.getElementById(id);

  // ===== STORAGE KEYS (must match index.js) =====
  const PHOTO_KEY = "sczn3_targetPhoto_dataUrl";
  const DIST_KEY  = "sczn3_distance_yards";
  const TAPS_KEY  = "sczn3_tap_points_json";

  // ===== LOCKED TARGET ASSUMPTIONS (Tap N Score pilot) =====
  const TARGET_W_IN = 8.5;
  const TARGET_H_IN = 11.0;

  // Bull position in inches (8.5x11 Grid v1)
  const BULL_X_IN = 4.25;
  const BULL_Y_IN = 5.50;

  // Optic click size
  const MOA_PER_CLICK = 0.25;

  // ===== DOM =====
  const secIdText     = $("secIdText");
  const thumb         = $("targetThumb");
  const distanceText  = $("distanceText");
  const adjText       = $("adjText");
  const tapCount      = $("tapCount");

  const noData   = $("noData");
  const results  = $("results");

  const scoreText   = $("scoreText");
  const elevClicks  = $("elevClicks");
  const windClicks  = $("windClicks");
  const elevDir     = $("elevDir");
  const windDir     = $("windDir");
  const tipText     = $("tipText");

  const debugBox = $("debugBox");

  function round2(n){
    const x = Number(n);
    if (!Number.isFinite(x)) return 0;
    return Math.round(x * 100) / 100;
  }
  function fmt2(n){ return round2(n).toFixed(2); }

  function debug(msg, obj) {
    console.log(msg, obj || "");
    if (!debugBox) return;
    debugBox.classList.remove("hidden");
    debugBox.textContent = msg + (obj ? "\n\n" + JSON.stringify(obj, null, 2) : "");
  }

  // ===== SEC ID =====
  let sid = sessionStorage.getItem("sczn3_sec_id");
  if (!sid) {
    sid = Math.random().toString(16).slice(2, 8).toUpperCase();
    sessionStorage.setItem("sczn3_sec_id", sid);
  }
  if (secIdText) secIdText.textContent = `SEC-ID — ${sid}`;

  // ===== LOAD STORED DATA =====
  const imgData = sessionStorage.getItem(PHOTO_KEY);
  const yards = Number(sessionStorage.getItem(DIST_KEY) || 100);

  if (distanceText) distanceText.textContent = String(yards);
  if (adjText) adjText.textContent = "0.25 MOA per click (True MOA)";

  if (!imgData) {
    debug("NO PHOTO FOUND IN sessionStorage.\nUpload on the FRONT page, then PRESS TO SEE.");
    return;
  }

  if (thumb) thumb.src = imgData;

  // ===== TAPS =====
  const taps = safeLoadTaps();
  if (tapCount) tapCount.textContent = String(taps.length);

  if (!taps.length) {
    // show noData, keep results hidden
    if (noData) noData.classList.remove("hidden");
    if (results) results.classList.add("hidden");
    tipText && (tipText.textContent = "Go back and tap holes (Tap N Score), then press again.");
    return;
  }

  // Compute group center in NATURAL pixels
  const gcPx = averagePoint(taps);

  // Need natural image size (saved taps are in natural px already)
  // We can derive it from max tap values OR from thumb.naturalWidth once loaded.
  const runCompute = () => {
    const nw = thumb && thumb.naturalWidth ? thumb.naturalWidth : estimateNwFromTaps(taps);
    const nh = thumb && thumb.naturalHeight ? thumb.naturalHeight : estimateNhFromTaps(taps);

    if (!nw || !nh) {
      debug("Could not determine natural image size.", { nw, nh, tapsLen: taps.length });
      return;
    }

    // Map px -> inches (simple linear mapping across full image)
    // xIn: 0..TARGET_W_IN, yIn: 0..TARGET_H_IN (image down is positive)
    const xIn = (gcPx.x / nw) * TARGET_W_IN;
    const yIn = (gcPx.y / nh) * TARGET_H_IN;

    // POIB inches: Right +, Up +  (flip Y exactly once)
    const poibX = xIn - BULL_X_IN;
    const poibY = -(yIn - BULL_Y_IN);

    // Correction inches = bull - POIB point = -POIB
    const corrX = -poibX;
    const corrY = -poibY;

    // True MOA inches at distance
    const inchesPerMoa = 1.047 * (yards / 100);
    const inchesPerClick = inchesPerMoa * MOA_PER_CLICK;

    const windClicksSigned = corrX / inchesPerClick;
    const elevClicksSigned = corrY / inchesPerClick;

    const windDirText = windClicksSigned > 0 ? "RIGHT" : windClicksSigned < 0 ? "LEFT" : "CENTER";
    const elevDirText = elevClicksSigned > 0 ? "UP" : elevClicksSigned < 0 ? "DOWN" : "LEVEL";

    // Display absolute clicks (two decimals)
    windClicks && (windClicks.textContent = fmt2(Math.abs(windClicksSigned)));
    elevClicks && (elevClicks.textContent = fmt2(Math.abs(elevClicksSigned)));
    windDir && (windDir.textContent = windDirText === "CENTER" ? "CENTER" : windDirText);
    elevDir && (elevDir.textContent = elevDirText === "LEVEL" ? "LEVEL" : elevDirText);

    // Simple score placeholder (you can swap later)
    scoreText && (scoreText.textContent = "—");

    // Tip (deterministic)
    tipText && (tipText.textContent =
      `Dial ${elevDirText} ${fmt2(Math.abs(elevClicksSigned))} and ${windDirText} ${fmt2(Math.abs(windClicksSigned))}. Then shoot a fresh 3–5 shot group to confirm.`);

    if (noData) noData.classList.add("hidden");
    if (results) results.classList.remove("hidden");

    // Debug payload (helpful while stabilizing)
    debug("Tap N Score compute OK", {
      yards,
      target: { wIn: TARGET_W_IN, hIn: TARGET_H_IN, bullIn: { x: BULL_X_IN, y: BULL_Y_IN } },
      image: { nw, nh },
      taps: taps.length,
      groupCenterPx: { x: round2(gcPx.x), y: round2(gcPx.y) },
      groupCenterIn: { x: round2(xIn), y: round2(yIn) },
      poibIn: { x: round2(poibX), y: round2(poibY) },
      correctionIn: { x: round2(corrX), y: round2(corrY) },
      clicksSigned: { windage: round2(windClicksSigned), elevation: round2(elevClicksSigned) }
    });
  };

  if (thumb) {
    // iOS is more stable if we wait for thumb naturalWidth/Height
    if (thumb.complete && thumb.naturalWidth) runCompute();
    else thumb.onload = runCompute;
  } else {
    runCompute();
  }

  // ===== helpers =====
  function safeLoadTaps(){
    const raw = sessionStorage.getItem(TAPS_KEY) || "";
    try {
      const arr = JSON.parse(raw);
      if (!Array.isArray(arr)) return [];
      return arr
        .map(p => ({ x: Number(p.x), y: Number(p.y) }))
        .filter(p => Number.isFinite(p.x) && Number.isFinite(p.y));
    } catch {
      return [];
    }
  }

  function averagePoint(arr){
    let sx = 0, sy = 0;
    for (const p of arr){ sx += p.x; sy += p.y; }
    return { x: sx / arr.length, y: sy / arr.length };
  }

  function estimateNwFromTaps(arr){
    // conservative fallback: assume taps are within image; use max*1.25
    let mx = 0;
    for (const p of arr) mx = Math.max(mx, p.x);
    return mx ? Math.round(mx * 1.25) : 0;
  }
  function estimateNhFromTaps(arr){
    let my = 0;
    for (const p of arr) my = Math.max(my, p.y);
    return my ? Math.round(my * 1.25) : 0;
  }
})();
