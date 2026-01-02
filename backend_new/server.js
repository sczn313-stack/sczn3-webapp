// backend_new/server.js
const express = require("express");
const cors = require("cors");

const app = express();

// ---- middleware ----
app.use(cors({ origin: "*" }));
app.use(express.json({ limit: "1mb" }));

// ---- helpers ----
function to2(n) {
  return Number.isFinite(n) ? Number(n.toFixed(2)) : 0;
}

function calcAxis(deltaIn, distanceYards, clickValueMOA, useTrueMOA) {
  const absIn = Math.abs(deltaIn);

  const moaAt100 = useTrueMOA ? 1.047 : 1.0; // inches per MOA at 100y
  const inchesPerMOA = moaAt100 * (distanceYards / 100);

  const moa = inchesPerMOA === 0 ? 0 : absIn / inchesPerMOA;
  const clicks = clickValueMOA === 0 ? 0 : moa / clickValueMOA;

  return {
    moa: to2(moa),
    clicks: to2(clicks),
  };
}

// ---- routes ----
app.get("/", (req, res) => {
  res
    .status(200)
    .send("SCZN3 backend is live. Try /api/health or POST /api/calc");
});

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    service: "sczn3-backend-new",
    ts: new Date().toISOString(),
  });
});

/**
 * POST /api/calc
 * Body:
 * {
 *   distanceYards: 100,
 *   clickValueMOA: 0.25,
 *   trueMOA: true,
 *   bullX: 0,
 *   bullY: 0,
 *   poibX: -1,
 *   poibY: 1
 * }
 *
 * Rule: correction = bull - POIB
 * ΔX > 0 => RIGHT, ΔX < 0 => LEFT
 * ΔY > 0 => UP,    ΔY < 0 => DOWN
 */
app.post("/api/calc", (req, res) => {
  const {
    distanceYards = 100,
    clickValueMOA = 0.25,
    trueMOA = true,
    bullX = 0,
    bullY = 0,
    poibX = 0,
    poibY = 0,
  } = req.body || {};

  const dx = Number(bullX) - Number(poibX);
  const dy = Number(bullY) - Number(poibY);

  const windDir = dx > 0 ? "RIGHT" : dx < 0 ? "LEFT" : "NONE";
  const elevDir = dy > 0 ? "UP" : dy < 0 ? "DOWN" : "NONE";

  const wind = calcAxis(dx, Number(distanceYards), Number(clickValueMOA), !!trueMOA);
  const elev = calcAxis(dy, Number(distanceYards), Number(clickValueMOA), !!trueMOA);

  res.json({
    inputs: {
      distanceYards: Number(distanceYards),
      clickValueMOA: Number(clickValueMOA),
      trueMOA: !!trueMOA,
      bullX: to2(Number(bullX)),
      bullY: to2(Number(bullY)),
      poibX: to2(Number(poibX)),
      poibY: to2(Number(poibY)),
    },
    deltas: {
      dx: to2(dx),
      dy: to2(dy),
    },
    windage: { direction: windDir, moa: wind.moa, clicks: wind.clicks },
    elevation: { direction: elevDir, moa: elev.moa, clicks: elev.clicks },
  });
});

// ---- start ----
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`SCZN3 backend_new listening on ${PORT}`);
});
