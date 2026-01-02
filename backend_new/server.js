// backend_new/server.js
const express = require("express");
const cors = require("cors");

const app = express();

// CORS: allow your Render static site + local dev
app.use(
  cors({
    origin: [
      "https://sczn3-webapp-313.onrender.com",
      "http://localhost:3000",
      "http://localhost:5173",
    ],
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type"],
  })
);

app.use(express.json({ limit: "2mb" }));

// Health check
app.get("/api/health", (req, res) => {
  res.json({ ok: true, service: "sczn3-backend-new" });
});

/**
 * POST /api/calc
 * Rule: correction = bull - POIB
 * X: Right +, Left -
 * Y: Up +, Down -
 * Two decimals.
 */
app.post("/api/calc", (req, res) => {
  try {
    const {
      yards = 100,
      clickValue = 0.25,
      trueMoa = true,
      bullX = 0,
      bullY = 0,
      poibX = 0,
      poibY = 0,
    } = req.body || {};

    const y = Number(yards);
    const cv = Number(clickValue);

    const bx = Number(bullX);
    const by = Number(bullY);
    const px = Number(poibX);
    const py = Number(poibY);

    if (!isFinite(y) || y <= 0) return res.status(400).json({ error: "yards must be > 0" });
    if (!isFinite(cv) || cv <= 0) return res.status(400).json({ error: "clickValue must be > 0" });

    // Core rule
    const dx = bx - px; // + = RIGHT
    const dy = by - py; // + = UP

    const windageDir = dx >= 0 ? "RIGHT" : "LEFT";
    const elevationDir = dy >= 0 ? "UP" : "DOWN";

    // MOA conversion
    const inchesPerMoaAt100 = trueMoa ? 1.047 : 1.0;
    const inchesPerMoa = inchesPerMoaAt100 * (y / 100);

    const windageMoa = Math.abs(dx) / inchesPerMoa;
    const elevationMoa = Math.abs(dy) / inchesPerMoa;

    const windageClicks = windageMoa / cv;
    const elevationClicks = elevationMoa / cv;

    return res.json({
      inputs: {
        yards: y,
        clickValue: cv,
        trueMoa: !!trueMoa,
        bull: { x: bx, y: by },
        poib: { x: px, y: py },
      },
      delta: {
        dx: Number(dx.toFixed(2)),
        dy: Number(dy.toFixed(2)),
      },
      windage: {
        direction: windageDir,
        moa: Number(windageMoa.toFixed(2)),
        clicks: Number(windageClicks.toFixed(2)),
      },
      elevation: {
        direction: elevationDir,
        moa: Number(elevationMoa.toFixed(2)),
        clicks: Number(elevationClicks.toFixed(2)),
      },
    });
  } catch (e) {
    return res.status(500).json({ error: "server error", detail: String(e?.message || e) });
  }
});

// Render provides PORT — MUST listen on it
const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`SCZN3 backend_new listening on port ${PORT}`);
});
