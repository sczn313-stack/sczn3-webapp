/* ============================================================
   backend_new/server.js  (FULL REPLACEMENT)
   SCZN3 / Tap-n-Score — SEC Backend (Clean Bridge)

   What this fixes:
   - GET /api/health  ✅
   - GET /api/poster  ✅
   - GET /api/calc    ✅ (returns guidance instead of "Cannot GET")
   - POST /api/calc   ✅ (real calculator endpoint)

   IMPORTANT:
   - This endpoint expects ALL positions in INCHES (not pixels).
   - Screen-space convention:
       x increases RIGHT
       y increases DOWN   (like canvas / DOM)
     Correction vector is bull - poib:
       deltaX < 0 => move LEFT  => dial LEFT
       deltaX > 0 => move RIGHT => dial RIGHT
       deltaY < 0 => move UP    => dial UP
       deltaY > 0 => move DOWN  => dial DOWN
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
function round2(n) {
  return Math.round(n * 100) / 100;
}

// Inches per MOA at a given distance (yards)
// 1 MOA ≈ 1.047 inches at 100 yards
function inchesPerMoa(distanceYds) {
  const d = clampNum(distanceYds, 100);
  return 1.047 * (d / 100);
}

function directionFromDeltaX(deltaX) {
  if (deltaX === 0) return "NONE";
  return deltaX > 0 ? "RIGHT" : "LEFT";
}

function directionFromDeltaY(deltaY) {
  // screen-space: y increases DOWN
  if (deltaY === 0) return "NONE";
  return deltaY > 0 ? "DOWN" : "UP";
}

function buildCalcResult(payload) {
  // Required-ish
  const distanceYds = clampNum(payload?.distanceYds, 100);

  // MOA per click (default 0.25)
  const moaPerClick = clampNum(payload?.moaPerClick, 0.25) || 0.25;

  // Expect inches
  const bullX = clampNum(payload?.bull?.x, 0);
  const bullY = clampNum(payload?.bull?.y, 0);
  const poibX = clampNum(payload?.poib?.x, 0);
  const poibY = clampNum(payload?.poib?.y, 0);

  // Correction vector = bull - poib
  const deltaX = bullX - poibX;
  const deltaY = bullY - poibY;

  const ipm = inchesPerMoa(distanceYds);
  const windMoa = ipm === 0 ? 0 : (deltaX / ipm);
  const elevMoa = ipm === 0 ? 0 : (deltaY / ipm);

  const windClicks = moaPerClick === 0 ? 0 : (windMoa / moaPerClick);
  const elevClicks = moaPerClick === 0 ? 0 : (elevMoa / moaPerClick);

  return {
    ok: true,
    distanceYds,
    moaPerClick,
    inchesPerMoa: round2(ipm),

    // Raw inputs
    bull: { x: bullX, y: bullY },
    poib: { x: poibX, y: poibY },

    // Signed correction vector (inches)
    delta: { x: round2(deltaX), y: round2(deltaY) },

    // Directions derived ONLY from signed deltas
    directions: {
      windage: directionFromDeltaX(deltaX),
      elevation: directionFromDeltaY(deltaY),
    },

    // MOA + Clicks (keep sign, frontend can show abs if it wants)
    moa: {
      windage: round2(windMoa),
      elevation: round2(elevMoa),
    },
    clicks: {
      windage: round2(windClicks),
      elevation: round2(elevClicks),
    },
  };
}

// ---- Routes
app.get("/", (req, res) => {
  res.type("text/plain").send("SCZN3 backend is running. Try /api/health");
});

app.get("/api/poster", (req, res) => {
  res.type("text/plain").send("SEC backend poster OK");
});

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    service: "sczn3-backend-new",
    time: new Date().toISOString(),
  });
});

// Helpful GET so Safari testing doesn't look “broken”
app.get("/api/calc", (req, res) => {
  res.status(405).json({
    ok: false,
    error: "Method Not Allowed",
    hint: "Use POST /api/calc with JSON body. (Browsers do GET when you paste a URL.)",
    exampleBody: {
      distanceYds: 100,
      moaPerClick: 0.25,
      bull: { x: 0, y: 0 },
      poib: { x: 1.25, y: -0.5 },
    },
  });
});

// Real calculator
app.post("/api/calc", (req, res) => {
  try {
    const payload = req.body || {};
    const result = buildCalcResult(payload);
    res.json(result);
  } catch (err) {
    res.status(500).json({
      ok: false,
      error: "Server error",
      detail: String(err?.message || err),
    });
  }
});

// Catch-all to keep responses friendly
app.use((req, res) => {
  res.status(404).json({
    ok: false,
    error: "Not found",
    path: req.path,
    hint: "Try GET /api/health, GET /api/poster, POST /api/calc",
  });
});

// ---- Start
const port = Number(process.env.PORT || 10000);
app.listen(port, () => {
  console.log(`SEC backend listening on port ${port}`);
});
