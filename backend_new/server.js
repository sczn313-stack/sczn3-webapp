/* ============================================================
   backend_new/server.js — SCZN3 / Tap-n-Score SEC Backend
   Purpose:
   - Prove the deployed server is the one we think it is
   - Provide stable health + poster endpoints
   - Provide POST /api/calc for SEC math handoff
   ============================================================ */

const express = require("express");
const cors = require("cors");

const app = express();

// --- Middleware
app.use(cors({ origin: true }));
app.use(express.json({ limit: "2mb" }));

// --- Helpers
function clampNum(n, fallback = 0) {
  const x = Number(n);
  return Number.isFinite(x) ? x : fallback;
}
function round2(n) {
  return Math.round(n * 100) / 100;
}

// --- Root
app.get("/", (req, res) => {
  res.type("text/plain").send("SCZN3 SEC backend is up. Try /api/health");
});

// --- MUST-HAVE: Health
app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    service: "sczn3-sec-backend",
    build: process.env.RENDER_GIT_COMMIT || "unknown",
    time: new Date().toISOString()
  });
});

// --- MUST-HAVE: Poster (your earlier test endpoint)
app.get("/api/poster", (req, res) => {
  res.type("text/plain").send("SEC backend poster OK");
});

/*
  POST /api/calc
  Expected body (example):
  {
    "bull": {"x": 100, "y": 100},
    "poib": {"x": 120, "y": 130},
    "yards": 100,
    "clickValue": 0.25
  }

  Screen-space convention (DOM/canvas):
    x increases to the RIGHT
    y increases DOWN
  Vector for corrections (what to dial):
    delta = bull - poib
*/
app.post("/api/calc", (req, res) => {
  try {
    const bull = req.body?.bull || {};
    const poib = req.body?.poib || {};

    const bullX = clampNum(bull.x);
    const bullY = clampNum(bull.y);
    const poibX = clampNum(poib.x);
    const poibY = clampNum(poib.y);

    const deltaX = bullX - poibX;
    const deltaY = bullY - poibY;

    // Direction strings derived ONLY from signed deltas
    const windage = deltaX > 0 ? "RIGHT" : deltaX < 0 ? "LEFT" : "NONE";
    const elevation = deltaY > 0 ? "DOWN" : deltaY < 0 ? "UP" : "NONE";

    // This endpoint is “math bridge” only. If you later send inches & MOA,
    // we’ll compute clicks here. For now we return deltas + directions.
    res.json({
      ok: true,
      bull: { x: bullX, y: bullY },
      poib: { x: poibX, y: poibY },
      deltas: { x: round2(deltaX), y: round2(deltaY) },
      directions: { windage, elevation }
    });
  } catch (err) {
    res.status(500).json({
      ok: false,
      error: "server_error",
      detail: String(err?.message || err)
    });
  }
});

// ---- Start
const port = Number(process.env.PORT || 3000);
app.listen(port, () => {
  console.log(`SEC backend listening on port ${port}`);
});
