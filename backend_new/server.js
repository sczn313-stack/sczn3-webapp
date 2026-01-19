/**
 * backend_new/server.js  (FULL FILE REPLACEMENT)
 * Tap-n-Score backend — LOCKED direction truth (Up/Down/Left/Right)
 *
 * INPUT (JSON):
 *  POST /tapscore
 *  {
 *    distanceYds: number,
 *    moaPerClick?: number,        // default 0.25
 *    targetWIn?: number,          // default 8.5
 *    targetHIn?: number,          // default 11
 *    bullTap: {x:number,y:number},// normalized 0..1 (relative to displayed image)
 *    taps:   [{x:number,y:number},...] // normalized 0..1 (bullet holes)
 *  }
 *
 * DIRECTION LOCK:
 *  - We compute POIB from hole taps.
 *  - Correction inches = bull - POIB (dx = bullX - poibX)
 *  - Y-axis is LOCKED to "UP positive" even though screen Y grows down:
 *      dyUpNorm = poibY - bullY
 *    (so dy>0 => UP, dy<0 => DOWN)
 *
 * OUTPUT (JSON):
 *  {
 *    ok:true,
 *    poib_norm:{x,y},
 *    correction_in:{dx,dy},         // inches (dx right+, dy up+)
 *    directions:{windage,elevation},// RIGHT/LEFT, UP/DOWN
 *    clicks:{windage,elevation},    // strings "12.34"
 *    score:number
 *  }
 */

const express = require("express");
const cors = require("cors");

const SERVICE = "sczn3-backend-new1";
const BUILD = "TAPNSCORE_LOCKDIR_V1";

const app = express();

app.use(cors({ origin: true, credentials: false }));
app.use(express.json({ limit: "2mb" }));

// Always JSON (avoid HTML error pages)
app.use((req, res, next) => {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  next();
});

app.get("/", (req, res) => {
  res.status(200).send(JSON.stringify({ ok: true, service: SERVICE, build: BUILD }));
});

app.get("/ping", (req, res) => {
  res.status(200).send(JSON.stringify({ ok: true, route: "/ping", service: SERVICE, build: BUILD }));
});

function isNum(n) {
  return typeof n === "number" && Number.isFinite(n);
}
function clamp01(v) {
  const x = Number(v);
  if (!Number.isFinite(x)) return 0;
  return Math.max(0, Math.min(1, x));
}
function round2(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return 0;
  return Math.round(x * 100) / 100;
}
function fmt2(n) {
  return round2(n).toFixed(2);
}
function inchesPerMOA(yards) {
  // True MOA
  return 1.047 * (yards / 100);
}
function dirFromSign(val, posLabel, negLabel) {
  if (val > 0) return posLabel;
  if (val < 0) return negLabel;
  return "";
}

function scoreFromBullAndGroup(dxIn, dyIn) {
  // Simple, stable placeholder (smaller miss => higher score)
  const r = Math.sqrt(dxIn * dxIn + dyIn * dyIn);
  const base = 650;
  const penalty = r * 60;
  return Math.max(0, Math.round(base - penalty));
}

app.post("/tapscore", (req, res) => {
  try {
    const body = req.body || {};

    const distanceYds = Number(body.distanceYds || 100);
    const moaPerClick = Number.isFinite(Number(body.moaPerClick)) ? Number(body.moaPerClick) : 0.25;

    const targetWIn = Number.isFinite(Number(body.targetWIn)) ? Number(body.targetWIn) : 8.5;
    const targetHIn = Number.isFinite(Number(body.targetHIn)) ? Number(body.targetHIn) : 11;

    if (!Number.isFinite(distanceYds) || distanceYds <= 0) {
      res.status(400).send(JSON.stringify({ ok: false, error: "distanceYds must be > 0" }));
      return;
    }

    const bullTap = body.bullTap;
    const tapsRaw = Array.isArray(body.taps) ? body.taps : [];

    if (!bullTap || !isNum(bullTap.x) || !isNum(bullTap.y)) {
      res.status(400).send(JSON.stringify({ ok: false, error: "Missing bullTap {x,y}." }));
      return;
    }
    if (tapsRaw.length < 1) {
      res.status(400).send(JSON.stringify({ ok: false, error: "Need at least 1 bullet-hole tap." }));
      return;
    }

    const bull = { x: clamp01(bullTap.x), y: clamp01(bullTap.y) };

    const holes = tapsRaw
      .filter((p) => p && isNum(p.x) && isNum(p.y))
      .map((p) => ({ x: clamp01(p.x), y: clamp01(p.y) }));

    if (holes.length < 1) {
      res.status(400).send(JSON.stringify({ ok: false, error: "No valid bullet-hole taps." }));
      return;
    }

    // POIB (normalized) = average hole taps
    let sx = 0, sy = 0;
    for (const p of holes) { sx += p.x; sy += p.y; }
    const poib = { x: sx / holes.length, y: sy / holes.length };

    // ===== LOCKED DIRECTION TRUTH =====
    // dxNorm: bull - poib (right positive)
    const dxNorm = bull.x - poib.x;

    // dyUpNorm: UP positive (screen y increases down)
    // Use dyUpNorm = poibY - bullY  (if POIB is below bull, dyUpNorm > 0 => UP)
    const dyUpNorm = poib.y - bull.y;

    // Convert normalized to inches using physical target dims
    const dxIn = dxNorm * targetWIn;     // right+
    const dyIn = dyUpNorm * targetHIn;   // up+

    // Directions
    const windDir = dirFromSign(dxIn, "RIGHT", "LEFT");
    const elevDir = dirFromSign(dyIn, "UP", "DOWN");

    // Clicks (True MOA + moaPerClick)
    const inchPerMOA = inchesPerMOA(distanceYds);
    const clicksFromIn = (inches) => {
      const denom = inchPerMOA * moaPerClick;
      if (!Number.isFinite(denom) || denom <= 0) return 0;
      return Math.abs(inches) / denom;
    };

    const windClicks = clicksFromIn(dxIn);
    const elevClicks = clicksFromIn(dyIn);

    const score = scoreFromBullAndGroup(dxIn, dyIn);

    res.status(200).send(JSON.stringify({
      ok: true,
      service: SERVICE,
      build: BUILD,
      distanceYds,
      moaPerClick,
      targetWIn,
      targetHIn,
      tapsCount: holes.length,

      bullTap_norm: bull,
      poib_norm: { x: round2(poib.x), y: round2(poib.y) },

      // Primary outputs the frontend should trust:
      correction_in: { dx: round2(dxIn), dy: round2(dyIn) }, // dx right+, dy up+
      directions: { windage: windDir, elevation: elevDir },
      clicks: { windage: fmt2(windClicks), elevation: fmt2(elevClicks) },

      score,

      tip: "Direction locked: dx=RIGHT+, dy=UP+. (dy uses poibY - bullY to correct screen Y.)"
    }));
  } catch (e) {
    res.status(500).send(JSON.stringify({
      ok: false,
      error: "SERVER_ERROR",
      detail: String(e && e.message ? e.message : e)
    }));
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`${SERVICE} listening on ${PORT} build=${BUILD}`));
