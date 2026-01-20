/* ============================================================================
  Tap-N-Score — index.js (FULL REPLACEMENT) — vCALLOCK-2

  Fixes calibration not sticking by:
  - STOPPING all “inject UI / find by text” behavior (no DOM replacement)
  - Binding ONLY to stable IDs from your index.html:
      #photoInput #targetWrap #targetCanvas #targetImg #dotsLayer
      #instructionLine #tapCount #clearTapsBtn #distanceYds
      #calibrateBtn #setBullBtn #analyzeBtn #calCount #modeLine #statusLine
  - Storing ALL tap points in NATURAL image pixels (stable across resize/orientation)
  - Rendering dots using % so they stay aligned visually
============================================================================ */

(() => {
  // ---------- helpers ----------
  const qs = (sel, root = document) => root.querySelector(sel);
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const fmt2 = (n) => Number(n).toFixed(2);

  // ---------- PROOF BANNER ----------
  function showBanner() {
    const b = document.createElement("div");
    b.textContent = "INDEX.JS LOADED — vCALLOCK-2";
    b.style.position = "fixed";
    b.style.left = "10px";
    b.style.right = "10px";
    b.style.bottom = "10px";
    b.style.zIndex = "999999";
    b.style.padding = "10px 12px";
    b.style.borderRadius = "10px";
    b.style.fontFamily = "system-ui, -apple-system, Segoe UI, Roboto, Arial";
    b.style.fontSize = "14px";
    b.style.background = "rgba(0,140,0,0.85)";
    b.style.color = "white";
    b.style.boxShadow = "0 10px 30px rgba(0,0,0,0.35)";
    document.addEventListener("DOMContentLoaded", () => document.body.appendChild(b));
  }

  // ---------- DOM refs (by ID, no guessing) ----------
  const el = {
    photoInput: null,
    distanceYds: null,
    tapCount: null,
    clearTapsBtn: null,

    instructionLine: null,
    targetWrap: null,
    targetCanvas: null,
    targetImg: null,
    dotsLayer: null,

    calibrateBtn: null,
    setBullBtn: null,
    analyzeBtn: null,
    calCount: null,
    modeLine: null,
    statusLine: null,

    resultsCard: null,
    rDistance: null,
    rTapsUsed: null,
    rWindage: null,
    rElevation: null,
    rScore: null,
    rNote: null,
  };

  function bindDom() {
    el.photoInput = qs("#photoInput");
    el.distanceYds = qs("#distanceYds");
    el.tapCount = qs("#tapCount");
    el.clearTapsBtn = qs("#clearTapsBtn");

    el.instructionLine = qs("#instructionLine");
    el.targetWrap = qs("#targetWrap");
    el.targetCanvas = qs("#targetCanvas");
    el.targetImg = qs("#targetImg");
    el.dotsLayer = qs("#dotsLayer");

    el.calibrateBtn = qs("#calibrateBtn");
    el.setBullBtn = qs("#setBullBtn");
    el.analyzeBtn = qs("#analyzeBtn");
    el.calCount = qs("#calCount");
    el.modeLine = qs("#modeLine");
    el.statusLine = qs("#statusLine");

    el.resultsCard = qs("#resultsCard");
    el.rDistance = qs("#rDistance");
    el.rTapsUsed = qs("#rTapsUsed");
    el.rWindage = qs("#rWindage");
    el.rElevation = qs("#rElevation");
    el.rScore = qs("#rScore");
    el.rNote = qs("#rNote");
  }

  // ---------- state (ALL in natural image pixels) ----------
  const MODE = {
    SHOTS: "shots",
    CAL_1IN: "cal_1in",
    SET_BULL: "set_bull",
  };

  let mode = MODE.SHOTS;

  let selectedFile = null;
  let objectUrl = null;

  let calPts = [];          // [{x,y}] in natural px
  let pixelsPerInch = null; // natural px per inch

  let bull = null;          // {x,y} natural px
  let shots = [];           // [{x,y}] natural px

  // ---------- UI setters ----------
  function setInstruction(msg) {
    if (el.instructionLine) el.instructionLine.textContent = msg;
  }

  function setStatus(msg) {
    if (el.statusLine) el.statusLine.textContent = msg || "";
  }

  function setTapCount(n) {
    if (el.tapCount) el.tapCount.textContent = String(n);
  }

  function setModeLine() {
    if (!el.modeLine) return;

    let modeText =
      mode === MODE.CAL_1IN ? "MODE: CALIBRATE (tap 2 points 1.00\" apart)" :
      mode === MODE.SET_BULL ? "MODE: SET BULL (tap center)" :
      "MODE: SHOTS (tap holes)";

    const calText = pixelsPerInch ? `Cal: OK` : `Cal: ${calPts.length}/2`;

    el.modeLine.textContent = `${modeText} | ${calText}`;
    if (el.calCount) el.calCount.textContent = pixelsPerInch ? "OK" : String(calPts.length);
  }

  function showTarget(show) {
    if (!el.targetWrap) return;
    el.targetWrap.style.display = show ? "block" : "none";
  }

  // ---------- dot rendering (percent so it survives resize) ----------
  function clearDots() {
    if (el.dotsLayer) el.dotsLayer.innerHTML = "";
  }

  function addDotPercent(xPct, yPct, kind) {
    if (!el.dotsLayer) return;

    const dot = document.createElement("div");
    dot.style.position = "absolute";
    dot.style.left = `${xPct}%`;
    dot.style.top = `${yPct}%`;
    dot.style.transform = "translate(-50%, -50%)";
    dot.style.borderRadius = "999px";
    dot.style.pointerEvents = "none";

    if (kind === "bull") {
      dot.style.width = "14px";
      dot.style.height = "14px";
      dot.style.background = "rgba(0,255,120,0.95)";
      dot.style.border = "2px solid rgba(0,0,0,0.65)";
    } else if (kind === "cal") {
      dot.style.width = "12px";
      dot.style.height = "12px";
      dot.style.background = "rgba(80,160,255,0.95)";
      dot.style.border = "2px solid rgba(0,0,0,0.65)";
    } else {
      dot.style.width = "12px";
      dot.style.height = "12px";
      dot.style.background = "rgba(255,255,255,0.95)";
      dot.style.border = "2px solid rgba(0,0,0,0.65)";
    }

    el.dotsLayer.appendChild(dot);
  }

  function redrawDots() {
    if (!el.targetImg) return;
    const nw = el.targetImg.naturalWidth || 0;
    const nh = el.targetImg.naturalHeight || 0;
    if (nw <= 0 || nh <= 0) return;

    clearDots();

    for (const p of calPts) {
      addDotPercent((p.x / nw) * 100, (p.y / nh) * 100, "cal");
    }
    if (bull) {
      addDotPercent((bull.x / nw) * 100, (bull.y / nh) * 100, "bull");
    }
    for (const p of shots) {
      addDotPercent((p.x / nw) * 100, (p.y / nh) * 100, "shot");
    }
  }

  // ---------- convert tap position to natural px ----------
  function clientToNatural(clientX, clientY) {
    if (!el.targetImg) return null;

    const rect = el.targetImg.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;

    const nx = el.targetImg.naturalWidth || 0;
    const ny = el.targetImg.naturalHeight || 0;
    if (nx <= 0 || ny <= 0) return null;

    const x = clamp((clientX - rect.left) / rect.width, 0, 1);
    const y = clamp((clientY - rect.top) / rect.height, 0, 1);

    return {
      x: x * nx,
      y: y * ny,
    };
  }

  // ---------- analysis ----------
  function centroid(points) {
    let sx = 0, sy = 0;
    for (const p of points) { sx += p.x; sy += p.y; }
    return { x: sx / points.length, y: sy / points.length };
  }

  function analyze() {
    // Distance (yd)
    const ydRaw = Number(el.distanceYds?.value || 100);
    const yards = Number.isFinite(ydRaw) && ydRaw > 0 ? ydRaw : 100;

    if (!selectedFile) return { ok: false, msg: "No photo loaded." };
    if (!pixelsPerInch) return { ok: false, msg: 'Missing calibration. Tap "Calibrate 1 inch" then tap TWO points 1.00" apart.' };
    if (!bull) return { ok: false, msg: 'Missing bull. Tap "Set Bull" then tap the bull center.' };
    if (shots.length < 3) return { ok: false, msg: "Need at least 3 shot taps." };

    // Keep tightest cluster up to 7
    const initial = centroid(shots);
    const ranked = shots
      .map((p) => ({
