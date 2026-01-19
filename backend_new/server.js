/**
 * backend_new/server.js — Tap-n-Score Backend (FULL REPLACEMENT)
 *
 * Routes:
 *  GET  /            -> service info
 *  GET  /ping        -> ok
 *  GET  /health      -> ok
 *  POST /tapscore    -> bull-first normalized taps -> inches + true MOA clicks
 *
 * Input (JSON):
 * {
 *   distanceYds: number (default 100),
 *   moaPerClick: number (default 0.25),
 *   targetWIn:   number (default 8.5),
 *   targetHIn:   number (default 11),
 *   bullTap: { x: 0..1, y: 0..1 },     // Tap #1
 *   taps:   [{ x:0..1, y:0..1 }, ...]  // Tap #2+ holes
 * }
 *
 * Conventions (INCHES):
 *  dxIn > 0 => RIGHT, dxIn < 0 => LEFT
 *  dyIn > 0 => UP,    dyIn < 0 => DOWN
 *
 * Canonical correction:
 *  correction = bull - POIB   (move impact to bull)
 *  windage/elevation labels come from sign of correction
 */

const express = require("express");
const cors = require("cors");

const SERVICE = "sczn3-backend-new1";
const BUILD = "TAPNSCORE_BACKEND_V1_TRUE_MOA";

const app = express();

app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type"]
}));

app.use(express.json({ limit: "2mb" }));

app.get("/", (req, res) => res.json({ ok: true, service: SERVICE, build: BUILD }));
app.get("/ping", (req, res) => res.json({ ok: true, route: "/ping", service: SERVICE, build: BUILD }));
app.get("/health", (req, res) => res.json({ ok: true, route: "/health", service: SERVICE, build: BUILD }));

function isNum(n){ return typeof n === "number" && Number.isFinite(n); }
function clamp01(v){ return Math.max(0, Math.min(1, v)); }

function round2(n){
  const x = Number(n);
  if (!Number.isFinite(x)) return 0;
  return Math.round(x * 100) / 100;
}
function fmt2(n){ return round2(n).toFixed(2); }

function inchesPerMOA(yards){
  // True MOA = 1.047" at 100 yds
  return 1.047 * (Number(yards) / 100);
}
function dirFromSign(val, posLabel, negLabel){
  if (val > 0) return posLabel;
  if (val < 0) return negLabel;
  return "";
}

function scorePlaceholder(dxIn, dyIn){
  // Simple placeholder: closer to bull => higher score
  const r = Math.sqrt(dxIn*dxIn + dyIn*dyIn);
  const base = 650;
  const penalty = r * 60;
  return Math.max(0, Math.round(base - penalty));
}

app.post("/tapscore", (req, res) => {
  try {
    const body = req.body || {};

    const distanceYds = Number(body.distanceYds || 100);
    const moaPerClick = Number(body.moaPerClick || 0.25);

    const targetWIn = Number(body.targetWIn || 8.5);
    const targetHIn = Number(body.targetHIn || 11);

    if (!Number.isFinite(distanceYds) || distanceYds <= 0) {
      return res.status(400).json({ ok:false, error:{ code:"BAD_DISTANCE", message:"distanceYds must be > 0" } });
    }
    if (!Number.isFinite(moaPerClick) || moaPerClick <= 0) {
      return res.status(400).json({ ok:false, error:{ code:"BAD_MOA_CLICK", message:"moaPerClick must be > 0" } });
    }
    if (!Number.isFinite(targetWIn) || targetWIn <= 0 || !Number.isFinite(targetHIn) || targetHIn <= 0) {
      return res.status(400).json({ ok:false, error:{ code:"BAD_TARGET_SIZE", message:"targetWIn/targetHIn must be > 0" } });
    }

    const bullTap = body.bullTap;
    const taps = Array.isArray(body.taps) ? body.taps : [];

    if (!bullTap || !isNum(bullTap.x) || !isNum(bullTap.y)) {
      return res.status(400).json({ ok:false, error:{ code:"NO_BULL", message:"Missing bullTap {x,y} (Tap #1)." } });
    }
    if (taps.length < 1) {
      return res.status(400).json({ ok:false, error:{ code:"NO_HOLES", message:"Need at least 1 bullet-hole tap after bull." } });
    }

    // Clamp normalized inputs
    const bull = { x: clamp01(Number(bullTap.x)), y: clamp01(Number(bullTap.y)) };
    const holes = taps
      .filter(p => p && isNum(p.x) && isNum(p.y))
      .map(p => ({ x: clamp01(Number(p.x)), y: clamp01(Number(p.y)) }));

    if (holes.length < 1) {
      return res.status(400).json({ ok:false, error:{ code:"NO_VALID_TAPS", message:"No valid hole taps." } });
    }

    // POIB = average of hole taps (normalized)
    const sum = holes.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x:0, y:0 });
    const poib = { x: sum.x / holes.length, y: sum.y / holes.length };

    // Convert normalized offset to inches (x right+, y up+)
    // dxIn = (POIB - bull) * width
    // dyIn = -(POIB - bull) * height   (because normalized y grows DOWN)
    const dxIn = (poib.x - bull.x) * targetWIn;
    const dyIn = -((poib.y - bull.y) * targetHIn);

    // Correction inches to dial = bull - POIB (move POIB to bull)
    const corrDxIn = -dxIn;
    const corrDyIn = -dyIn;

    const windDir = dirFromSign(corrDxIn, "RIGHT", "LEFT");
    const elevDir = dirFromSign(corrDyIn, "UP", "DOWN");

    const inchPerMOA = inchesPerMOA(distanceYds);

    const clicksFromInches = (inchesAbs) => {
      const v = Math.abs(Number(inchesAbs) || 0);
      const c = v / (inchPerMOA * moaPerClick);
      return round2(c);
    };

    const windClicks = clicksFromInches(corrDxIn);
    const elevClicks = clicksFromInches(corrDyIn);

    const score = scorePlaceholder(dxIn, dyIn);

    return res.json({
      ok: true,
      service: SERVICE,
      build: BUILD,

      distanceYds,
      moaPerClick,
      targetWIn,
      targetHIn,

      tapsCount: holes.length,

      bullTap: bull,
      poib, // normalized

      // offsets (POIB relative to bull) in inches (diagnostic)
      offset_in: { dx: round2(dxIn), dy: round2(dyIn) },

      // correction to dial (bull - POIB) in inches
      correction_in: { dx: round2(corrDxIn), dy: round2(corrDyIn) },

      directions: { windage: windDir, elevation: elevDir },
      clicks: { windage: fmt2(windClicks), elevation: fmt2(elevClicks) },

      score,

      tip: "Tap #1 bull/aim point, then tap holes. Correction moves POIB to bull. True MOA used."
    });

  } catch (e) {
    return res.status(500).json({
      ok:false,
      error:{ code:"SERVER_ERROR", message:String(e?.message || e) }
    });
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`${SERVICE} listening on ${PORT} build=${BUILD}`));
