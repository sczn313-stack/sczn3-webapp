/* ============================================================
   backend_new/server.js — SCZN3 / Tap-n-Score SEC Backend (Clean Bridge)
   Routes:
   - GET  /api/health  -> JSON health check
   - GET  /api/poster  -> simple text check
   - POST /api/calc    -> authoritative correction math + directions
   Conventions:
   - Screen/target space: x increases RIGHT, y increases DOWN
   - delta = bull - poib
     deltaX < 0 => move LEFT,  deltaX > 0 => move RIGHT
     deltaY < 0 => move UP,    deltaY > 0 => move DOWN
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
// 1 MOA ≈ 1.047 inches @ 100 yards
function inchesPerMOA(distanceYds) {
  const d = clampNum(distanceYds, 100);
  return (d / 100) * 1.047;
}

// ---- Routes
app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    service: "sczn3-backend-new",
    time: new Date().toISOString(),
  });
});

app.get("/api/poster", (req, res) => {
  res.type("text/plain").send("SEC backend poster OK");
});

/**
 * POST /api/calc
 * Expects JSON like:
 * {
 *   "bull": {"x": 0, "y": 0},
 *   "poib": {"x": 1.25, "y": -0.75},
 *   "distanceYds": 100,
 *   "clickValueMoa": 0.25
 * }
 *
 * NOTE: bull/poib units must match each other (inches recommended).
 */
app.post("/api/calc", (req, res) => {
  try {
    const bull = req.body?.bull || {};
    const poib = req.body?.poib || {};

    const bullX = clampNum(bull.x, 0);
    const bullY = clampNum(bull.y, 0);
    const poibX = clampNum(poib.x, 0);
    const poibY = clampNum(poib.y, 0);

    const distanceYds = clampNum(req.body?.distanceYds, 100);
    const clickValueMoa = clampNum(req.body?.clickValueMoa, 0.25); // 1/4 MOA default

    // Authoritative correction vector (POIB -> Bull)
    const deltaX = bullX - poibX;
    const deltaY = bullY - poibY;

    // Directions (screen/target space: y down is positive)
    const windage =
      deltaX === 0 ? "NONE" : deltaX > 0 ? "RIGHT" : "LEFT";
    const elevation =
      deltaY === 0 ? "NONE" : deltaY > 0 ? "DOWN" : "UP";

    // Convert to MOA clicks
    const moaInches = inchesPerMOA(distanceYds);
    const inchesPerClick = moaInches * clickValueMoa;

    const clicksX = inchesPerClick === 0 ? 0 : deltaX / inchesPerClick;
    const clicksY = inchesPerClick === 0 ? 0 : deltaY / inchesPerClick;

    res.json({
      ok: true,
      inputs: {
        bull: { x: bullX, y: bullY },
        poib: { x: poibX, y: poibY },
        distanceYds,
        clickValueMoa,
      },
      deltas: {
        x: round2(deltaX),
        y: round2(deltaY),
      },
      directions: {
        windage,
        elevation,
      },
      clicks: {
        windage: round2(clicksX),
        elevation: round2(clicksY),
      },
    });
  } catch (err) {
    res.status(500).json({
      ok: false,
      error: "Server error",
      detail: String(err?.message || err),
    });
  }
});

// Helpful fallback so you never get “Cannot GET …” without context
app.use((req, res) => {
  res.status(404).json({
    ok: false,
    error: "Not found",
    path: req.path,
    hint: "Try GET /api/health, GET /api/poster, POST /api/calc",
  });
});

// ---- Start
const port = Number(process.env.PORT || 3000);
app.listen(port, () => {
  console.log(`SEC backend listening on port ${port}`);
});
