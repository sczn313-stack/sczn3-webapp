/**
 * backend_new/server.js — SCZN3 Backend NEW — Tap-N-Score + dx/dy override
 *
 * Conventions (inches):
 *  - dx > 0 => RIGHT, dx < 0 => LEFT
 *  - dy > 0 => UP,    dy < 0 => DOWN
 *
 * Endpoints:
 *  - GET  /health
 *  - POST /api/analyze  (multipart form-data, field "image")
 *
 * Fields:
 *  - distanceYards  (number, required)
 *  - moaPerClick    (number, optional, default 0.25)
 *  - dx, dy         (string/number, optional)   <-- override inches
 *  - tapsJson       (string JSON, optional)     <-- [{x,y}, ...] in NATURAL pixels (bull first)
 *  - targetWIn      (number, optional, default 8.5)
 *  - targetHIn      (number, optional, default 11)
 */

const express = require("express");
const cors = require("cors");
const multer = require("multer");

const SERVICE = "sczn3-backend-new";
const BUILD = "BACKEND_NEW_PARSER_V3_TAPNSCORE";

const app = express();

app.use(cors({ origin: true, credentials: false }));

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

function safeJsonParse(s) {
  try {
    return JSON.parse(String(s || ""));
  } catch {
    return null;
  }
}

function scoreFromBullAndGroup(dxIn, dyIn) {
  // Simple “distance from bull” score placeholder (keep yours if you already have one)
  // Smaller miss => higher score. Tuned so it doesn’t go negative.
  const r = Math.sqrt(dxIn * dxIn + dyIn * dyIn);
  const base = 650;
  const penalty = r * 60;
  return Math.max(0, Math.round(base - penalty));
}

app.post("/api/analyze", upload.single("image"), async (req, res) => {
  try {
    // image is optional for Tap-N-Score-only mode, but keep the field so FormData is consistent
    // (Your frontend currently always sends the image.)
    const distanceYards = num(req.body.distanceYards, NaN);
    const moaPerClick = num(req.body.moaPerClick, 0.25);

    if (!Number.isFinite(distanceYards) || distanceYards <= 0) {
      res.status(400).send(JSON.stringify({
        ok: false,
        error: { code: "BAD_DISTANCE", message: "distanceYards must be > 0" }
      }));
      return;
    }

    const targetWIn = num(req.body.targetWIn, 8.5);
    const targetHIn = num(req.body.targetHIn, 11.0);

    // 1) DX/DY OVERRIDE (inches) — highest priority
    const dxOverride = num(req.body.dx, NaN);
    const dyOverride = num(req.body.dy, NaN);

    let dxIn = NaN;
    let dyIn = NaN;
    let mode = "";

    if (Number.isFinite(dxOverride) && Number.isFinite(dyOverride)) {
      dxIn = dxOverride;
      dyIn = dyOverride;
      mode = "OVERRIDE_DXDY_IN";
    } else {
      // 2) Tap-N-Score mode: bull first, then holes
      const taps = safeJsonParse(req.body.tapsJson);
      if (Array.isArray(taps) && taps.length >= 2) {
        const bull = taps[0];
        const holes = taps.slice(1);

        // Use uploaded image natural size if available from client (preferred)
        // If not provided, infer from max tap values (ok for now)
        const nw = num(req.body.nw, NaN);
        const nh = num(req.body.nh, NaN);

        let naturalW = Number.isFinite(nw) && nw > 0 ? nw : NaN;
        let naturalH = Number.isFinite(nh) && nh > 0 ? nh : NaN;

        if (!Number.isFinite(naturalW) || !Number.isFinite(naturalH)) {
          // fallback: infer from taps (not perfect but works)
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

        // group center px
        let sx = 0, sy = 0;
        for (const p of holes) { sx += num(p.x, 0); sy += num(p.y, 0); }
        const gcx = sx / holes.length;
        const gcy = sy / holes.length;

        // dx inches: right +
        dxIn = (gcx - num(bull.x, 0)) / pxPerInX;

        // dy inches: UP +, but pixel y grows DOWN -> flip
        dyIn = -((gcy - num(bull.y, 0)) / pxPerInY);

        mode = "TAPNSCORE_PIXELS_TO_INCHES";
      }
    }

    if (!Number.isFinite(dxIn) || !Number.isFinite(dyIn)) {
      res.status(422).send(JSON.stringify({
        ok: false,
        error: {
          code: "NO_INPUT",
          message: "Need either (dx & dy) inches override OR tapsJson with bull+holes."
        }
      }));
      return;
    }

    // CORRECTION inches (what to dial) = move impact to bull = -(cluster offset)
    const corrDx = -dxIn;
    const corrDy = -dyIn;

    const windDir = dirFromSign(corrDx, "RIGHT", "LEFT");
    const elevDir = dirFromSign(corrDy, "UP", "DOWN");

    const inchPerMOA = inchesPerMOA(distanceYards);
    const clicks = (inches) => round2(Math.abs(inches) / (inchPerMOA * moaPerClick));

    const windClicks = clicks(corrDx);
    const elevClicks = clicks(corrDy);

    const score = scoreFromBullAndGroup(dxIn, dyIn);

    const tip =
      mode === "OVERRIDE_DXDY_IN"
        ? `DEMO override active — dx=${fmt2(dxIn)} in, dy=${fmt2(dyIn)} in.`
        : `Tap-N-Score active — bull first, then holes.`;

    res.status(200).send(JSON.stringify({
      ok: true,
      service: SERVICE,
      build: BUILD,
      mode,
      distanceYards,
      moaPerClick,
      // what the frontend expects:
      correction_in: { dx: round2(corrDx), dy: round2(corrDy) },
      directions: { windage: windDir, elevation: elevDir },
      clicks: { windage: fmt2(windClicks), elevation: fmt2(elevClicks) },
      score,
      tip
    }));
  } catch (err) {
    res.status(500).send(JSON.stringify({
      ok: false,
      error: { code: "SERVER_ERROR", message: String(err?.message || err) }
    }));
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`${SERVICE} on ${PORT} build=${BUILD}`));
