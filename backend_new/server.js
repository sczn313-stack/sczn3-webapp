/**
 * backend_new/server.js  (FULL CUT/PASTE REPLACEMENT)
 * Tap-N-Score backend:
 * - accepts tapsJson as NORMALIZED coords (0..1) OR NATURAL pixels
 * - auto-detects normalized vs pixels
 * - returns dx/dy and click corrections with 2 decimals
 *
 * Conventions (inches):
 *  - dx > 0 => RIGHT, dx < 0 => LEFT
 *  - dy > 0 => UP,    dy < 0 => DOWN
 *
 * Endpoints:
 *  - GET  /health
 *  - POST /api/analyze  (JSON or multipart)
 *
 * JSON body fields:
 *  - distanceYards (number, required)
 *  - moaPerClick   (number, optional, default 0.25)
 *  - tapsJson      (string JSON, optional)  [{x,y}, ...] bull first
 *  - targetWIn     (number, optional, default 8.5)
 *  - targetHIn     (number, optional, default 11)
 *  - nw, nh        (number, optional) natural image px dims (if taps are px)
 *
 * NOTE:
 *  If taps are normalized (0..1): we convert using target inches directly.
 *  If taps are pixels: we need nw/nh (or infer from max coords).
 */

const express = require("express");
const cors = require("cors");
const multer = require("multer");

const SERVICE = "sczn3-backend-new";
const BUILD = "BACKEND_NEW_TAPNSCORE_V4_NORM_OR_PX";

const app = express();

app.use(cors({ origin: true, credentials: false }));
app.use(express.json({ limit: "2mb" })); // allow JSON posts

// Always JSON (avoid HTML error pages)
app.use((req, res, next) => {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  next();
});

app.get("/", (req, res) => {
  res.status(200).send(JSON.stringify({ ok: true, service: SERVICE, build: BUILD }));
});

app.get("/health", (req, res) => {
  res.status(200).send(JSON.stringify({ ok: true, service: SERVICE, build: BUILD }));
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

function num(v, fallback = NaN) {
  const x = Number(v);
  return Number.isFinite(x) ? x : fallback;
}

function round2(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return 0;
  return Math.round(x * 100) / 100;
}

function fmt2(n) {
  const x = round2(n);
  return x.toFixed(2);
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

function safeJsonParse(s) {
  try {
    return JSON.parse(String(s || ""));
  } catch {
    return null;
  }
}

function scoreFromBullAndGroup(dxIn, dyIn) {
  // placeholder score: smaller miss => higher score
  const r = Math.sqrt(dxIn * dxIn + dyIn * dyIn);
  const base = 650;
  const penalty = r * 60;
  return Math.max(0, Math.round(base - penalty));
}

// Determine if taps look normalized (0..1-ish) or pixel coords
function detectTapMode(taps) {
  // If all values are between 0 and 1.2 -> treat as normalized
  let looksNorm = true;
  for (const p of taps) {
    const x = num(p?.x, NaN);
    const y = num(p?.y, NaN);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return "BAD";
    if (x < 0 || y < 0 || x > 1.2 || y > 1.2) looksNorm = false;
  }
  return looksNorm ? "NORM" : "PX";
}

// Compute dx/dy inches from taps
function tapsToInches({ taps, targetWIn, targetHIn, nw, nh }) {
  const mode = detectTapMode(taps);
  if (mode === "BAD") return { ok: false, mode: "BAD_TAPS" };

  const bull = taps[0];
  const holes = taps.slice(1);
  if (!holes.length) return { ok: false, mode: "NEED_HOLES" };

  // group center in same coord system as taps
  let sx = 0, sy = 0;
  for (const p of holes) { sx += num(p.x, 0); sy += num(p.y, 0); }
  const gcx = sx / holes.length;
  const gcy = sy / holes.length;

  if (mode === "NORM") {
    // taps are 0..1 relative to displayed wrapper
    // Convert directly to inches:
    // dx inches = (gcx - bull.x) * targetWIn
    // dy inches = -((gcy - bull.y) * targetHIn) (pixel y grows down; norm y follows same)
    const dxIn = (gcx - num(bull.x, 0)) * targetWIn;
    const dyIn = -((gcy - num(bull.y, 0)) * targetHIn);
    return { ok: true, mode: "TAP_NORM_TO_INCHES", dxIn, dyIn };
  }

  // mode === PX
  // need natural image dims; if absent, infer from max coords
  let naturalW = num(nw, NaN);
  let naturalH = num(nh, NaN);

  if (!Number.isFinite(naturalW) || naturalW <= 0 || !Number.isFinite(naturalH) || naturalH <= 0) {
    let mx = 0, my = 0;
    for (const p of taps) {
      mx = Math.max(mx, num(p.x, 0));
      my = Math.max(my, num(p.y, 0));
    }
    naturalW = Math.max(1, mx);
    naturalH = Math.max(1, my);
  }

  const pxPerInX = naturalW / targetWIn;
  const pxPerInY = naturalH / targetHIn;

  const dxIn = (gcx - num(bull.x, 0)) / pxPerInX;
  const dyIn = -((gcy - num(bull.y, 0)) / pxPerInY);

  return { ok: true, mode: "TAP_PX_TO_INCHES", dxIn, dyIn };
}

// Unified handler for JSON or multipart
async function handleAnalyze(req, res) {
  try {
    const body = req.body || {};

    const distanceYards = num(body.distanceYards, NaN);
    const moaPerClick = num(body.moaPerClick, 0.25);

    if (!Number.isFinite(distanceYards) || distanceYards <= 0) {
      res.status(400).send(JSON.stringify({
        ok: false,
        error: { code: "BAD_DISTANCE", message: "distanceYards must be > 0" }
      }));
      return;
    }

    const targetWIn = num(body.targetWIn, 8.5);
    const targetHIn = num(body.targetHIn, 11.0);

    // Accept dx/dy override inches if provided (optional)
    const dxOverride = num(body.dx, NaN);
    const dyOverride = num(body.dy, NaN);

    let dxIn = NaN;
    let dyIn = NaN;
    let mode = "";

    if (Number.isFinite(dxOverride) && Number.isFinite(dyOverride)) {
      dxIn = dxOverride;
      dyIn = dyOverride;
      mode = "OVERRIDE_DXDY_IN";
    } else {
      const taps = safeJsonParse(body.tapsJson);
      if (!Array.isArray(taps) || taps.length < 2) {
        res.status(422).send(JSON.stringify({
          ok: false,
          error: { code: "NO_INPUT", message: "Need dx/dy override OR tapsJson with bull+holes." }
        }));
        return;
      }

      const nw = num(body.nw, NaN);
      const nh = num(body.nh, NaN);

      const calc = tapsToInches({ taps, targetWIn, targetHIn, nw, nh });
      if (!calc.ok) {
        res.status(422).send(JSON.stringify({
          ok: false,
          error: { code: "BAD_TAPS", message: "Invalid taps. Bull first, then at least one hole." }
        }));
        return;
      }

      dxIn = calc.dxIn;
      dyIn = calc.dyIn;
      mode = calc.mode;
    }

    // CORRECTION inches = move impact to bull = -(cluster offset)
    const corrDx = -dxIn;
    const corrDy = -dyIn;

    const windDir = dirFromSign(corrDx, "RIGHT", "LEFT");
    const elevDir = dirFromSign(corrDy, "UP", "DOWN");

    const inchPerMOA = inchesPerMOA(distanceYards);

    const clicks = (inches) => {
      const raw = Math.abs(inches) / (inchPerMOA * moaPerClick);
      return fmt2(raw);
    };

    const windClicks = clicks(corrDx);
    const elevClicks = clicks(corrDy);

    const score = scoreFromBullAndGroup(dxIn, dyIn);

    const tip =
      mode === "OVERRIDE_DXDY_IN"
        ? `Override active — dx=${fmt2(dxIn)} in, dy=${fmt2(dyIn)} in.`
        : (mode === "TAP_NORM_TO_INCHES"
            ? "Tap-N-Score active (normalized taps). Bull first, then holes."
            : "Tap-N-Score active (pixel taps). Bull first, then holes.");

    res.status(200).send(JSON.stringify({
      ok: true,
      service: SERVICE,
      build: BUILD,
      mode,
      distanceYards,
      moaPerClick,

      // report offsets and corrections with 2 decimals
      offset_in:      { dx: round2(dxIn),   dy: round2(dyIn) },
      correction_in:  { dx: round2(corrDx), dy: round2(corrDy) },

      directions: { windage: windDir, elevation: elevDir },
      clicks: { windage: windClicks, elevation: elevClicks },

      score,
      tip
    }));
  } catch (err) {
    res.status(500).send(JSON.stringify({
      ok: false,
      error: { code: "SERVER_ERROR", message: String(err?.message || err) }
    }));
  }
}

app.post("/api/analyze", upload.single("image"), handleAnalyze);

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`${SERVICE} on ${PORT} build=${BUILD}`));
