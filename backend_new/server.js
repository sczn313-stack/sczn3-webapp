/* ============================================================
   server.js (FULL REPLACEMENT) — SCZN3 Backend New
   Purpose:
   - Backend is the ONLY authority for correction directions.
   - Computes correction vector POIB -> Bull (bull - poib).
   - Returns explicit direction strings + signed deltas for debug.
   ============================================================ */

const express = require("express");
const cors = require("cors");

const app = express();

// ---- Middleware
app.use(cors({ origin: true }));
app.use(express.json({ limit: "2mb" }));

// ---- Helpers
function clampNum(n, fallback = 0) {
  const x = Number(n);
  return Number.isFinite(x) ? x : fallback;
}

// Inches per MOA at a given distance (yards)
// 1 MOA ≈ 1.047 inches at 100 yards
function inchesPerMoa(distanceYds) {
  const d = clampNum(distanceYds, 0);
  return (1.047 * d) / 100;
}

function directionLR(dx) {
  if (dx > 0) return "RIGHT";
  if (dx < 0) return "LEFT";
  return "CENTER";
}

function directionUD(dy) {
  if (dy > 0) return "UP";
  if (dy < 0) return "DOWN";
  return "CENTER";
}

// ---- Health
app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "sczn3-backend-new", ts: new Date().toISOString() });
});

/* ============================================================
   POST /api/calc
   Input (JSON):
     {
       "distanceYds": 100,
       "clickMoa": 0.25,                 // optional, defaults 0.25 MOA/click
       "inchesPerPixel": 0.01,           // REQUIRED to convert pixels -> inches
       "bull": { "x": 512, "y": 400 },   // anchor tap (pixel coords in SAME space)
       "impacts": [                      // 1..N impact taps (pixel coords)
         { "x": 700, "y": 250 },
         ...
       ]
     }

   Output (JSON):
     - poib (average impact point)
     - correction vector = bull - poib  (POIB -> Bull)
     - windage/elevation with inches, moa, clicks, direction
============================================================ */
app.post("/api/calc", (req, res) => {
  try {
    const distanceYds = clampNum(req.body?.distanceYds, 0);
    const clickMoa = clampNum(req.body?.clickMoa, 0.25);
    const inchesPerPixel = clampNum(req.body?.inchesPerPixel, NaN);

    const bull = req.body?.bull || null;
    const impacts = Array.isArray(req.body?.impacts) ? req.body.impacts : [];

    if (!bull || !Number.isFinite(bull.x) || !Number.isFinite(bull.y)) {
      return res.status(400).json({ ok: false, error: "Missing/invalid bull {x,y}." });
    }
    if (!impacts.length) {
      return res.status(400).json({ ok: false, error: "No impacts provided." });
    }
    if (!Number.isFinite(distanceYds) || distanceYds <= 0) {
      return res.status(400).json({ ok: false, error: "distanceYds must be > 0." });
    }
    if (!Number.isFinite(clickMoa) || clickMoa <= 0) {
      return res.status(400).json({ ok: false, error: "clickMoa must be > 0." });
    }
    if (!Number.isFinite(inchesPerPixel) || inchesPerPixel <= 0) {
      return res.status(400).json({
        ok: false,
        error:
          "inchesPerPixel must be provided (>0). Backend will not guess scale. Supply it from your target profile."
      });
    }

    // ---- Compute POIB (average of impacts)
    let sumX = 0;
    let sumY = 0;
    let validCount = 0;

    for (const p of impacts) {
      const x = clampNum(p?.x, NaN);
      const y = clampNum(p?.y, NaN);
      if (Number.isFinite(x) && Number.isFinite(y)) {
        sumX += x;
        sumY += y;
        validCount += 1;
      }
    }

    if (!validCount) {
      return res.status(400).json({ ok: false, error: "All impacts were invalid." });
    }

    const poib = { x: sumX / validCount, y: sumY / validCount };

    // =========================================================
    // CORRECTION VECTOR (SOURCE OF TRUTH):
    // POIB -> Bull  (bull - poib)
    // dx > 0 => RIGHT, dx < 0 => LEFT
    // dy > 0 => UP,    dy < 0 => DOWN
    //
    // NOTE: This dy logic assumes your coordinate system is
    // "Top = Up" in the data you send. If your UI taps are in
    // screen pixels (where y grows downward), you MUST convert
    // to "math y" before sending OR keep sending screen y but
    // then ALSO invert consistently BEFORE this step.
    //
    // To enforce "backend only", do your inversion upstream and
    // always send backend-normalized y.
    // =========================================================
    const dxPx = bull.x - poib.x; // correction px
    const dyPx = bull.y - poib.y; // correction px

    const dxInSigned = dxPx * inchesPerPixel;
    const dyInSigned = dyPx * inchesPerPixel;

    const windDir = directionLR(dxInSigned);
    const elevDir = directionUD(dyInSigned);

    const windInAbs = Math.abs(dxInSigned);
    const elevInAbs = Math.abs(dyInSigned);

    const ipm = inchesPerMoa(distanceYds);
    const windMoa = windInAbs / ipm;
    const elevMoa = elevInAbs / ipm;

    const windClicks = windMoa / clickMoa;
    const elevClicks = elevMoa / clickMoa;

    const out = {
      ok: true,
      name: "SCZN3_BACKEND_DIRECTION_AUTHORITY",
      distanceYds,
      clickMoa,
      inchesPerPixel,

      bull: { x: bull.x, y: bull.y },
      poib: { x: poib.x, y: poib.y },

      // Signed correction (debug)
      delta: {
        dx_px: dxPx,
        dy_px: dyPx,
        dx_in_signed: dxInSigned,
        dy_in_signed: dyInSigned
      },

      windage: {
        inches: Number(windInAbs.toFixed(2)),
        moa: Number(windMoa.toFixed(2)),
        clicks: Number(windClicks.toFixed(2)),
        direction: windDir
      },

      elevation: {
        inches: Number(elevInAbs.toFixed(2)),
        moa: Number(elevMoa.toFixed(2)),
        clicks: Number(elevClicks.toFixed(2)),
        direction: elevDir
      },

      // Convenience strings for frontend (print exactly)
      ui: {
        windage: `${windInAbs.toFixed(2)}" ${windDir} • ${windMoa.toFixed(2)} MOA • ${windClicks.toFixed(2)} clicks ${windDir}`,
        elevation: `${elevInAbs.toFixed(2)}" ${elevDir} • ${elevMoa.toFixed(2)} MOA • ${elevClicks.toFixed(2)} clicks ${elevDir}`
      }
    };

    return res.json(out);
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: "Server error in /api/calc.",
      detail: String(err?.message || err)
    });
  }
});

// ---- Start
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`sczn3-backend-new listening on :${PORT}`);
});
