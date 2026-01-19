// backend_new/server.js (FULL REPLACEMENT)
// SCZN3 Tap-n-Score backend for Render
// Routes:
//   GET  /           health
//   GET  /ping       health
//   POST /tapscore   { distanceYds, bullTap:{x,y}, taps:[{x,y},...] }
//
// Notes:
// - Coordinates are normalized 0..1 (from the frontend image box)
// - Canonical correction: delta = bull - POIB
//   dx > 0 => RIGHT, dx < 0 => LEFT
//   dy > 0 => UP,    dy < 0 => DOWN  (TOP = UP on the screen)

const express = require("express");
const cors = require("cors");

const app = express();

// ---- CORS (safe + simple) ----
// If you later want to lock it down, replace origin:"*" with your frontend URL.
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type"],
  })
);

// Ensure preflight always succeeds
app.options("*", cors());

// JSON body
app.use(express.json({ limit: "2mb" }));

function isNum(n) {
  return typeof n === "number" && Number.isFinite(n);
}
function clamp01(v) {
  return Math.max(0, Math.min(1, v));
}
function normPoint(p) {
  return { x: clamp01(Number(p.x)), y: clamp01(Number(p.y)) };
}

// ---- Health ----
app.get("/", (req, res) => {
  res.json({ ok: true, service: "sczn3-backend-new", route: "/" });
});

app.get("/ping", (req, res) => {
  res.json({ ok: true, service: "sczn3-backend-new", route: "/ping" });
});

// ---- Core ----
app.post("/tapscore", (req, res) => {
  try {
    const body = req.body || {};

    const distanceYds = Number(body.distanceYds ?? 100);
    const bullTap = body.bullTap;
    const tapsIn = Array.isArray(body.taps) ? body.taps : [];

    if (!bullTap || !isNum(bullTap.x) || !isNum(bullTap.y)) {
      return res.status(400).json({ ok: false, error: "Missing bullTap {x,y}." });
    }
    if (tapsIn.length < 1) {
      return res.status(400).json({ ok: false, error: "Need at least 1 bullet-hole tap." });
    }

    const bull = normPoint(bullTap);

    const taps = tapsIn
      .filter((p) => p && isNum(p.x) && isNum(p.y))
      .map(normPoint);

    if (taps.length < 1) {
      return res.status(400).json({ ok: false, error: "No valid taps." });
    }

    // POIB = average of hole taps
    let sx = 0,
      sy = 0;
    for (const p of taps) {
      sx += p.x;
      sy += p.y;
    }
    const poib = { x: sx / taps.length, y: sy / taps.length };

    // Canonical correction: bull - POIB
    const dx = bull.x - poib.x;
    const dy = bull.y - poib.y;

    const windDir = dx > 0 ? "RIGHT" : dx < 0 ? "LEFT" : "CENTER";
    const elevDir = dy > 0 ? "UP" : dy < 0 ? "DOWN" : "CENTER";

    // Return normalized deltas + directions.
    // (Clicks/inches require a known inch-scale; keep that on the frontend once scale is defined.)
    return res.json({
      ok: true,
      distanceYds,
      tapsCount: taps.length,
      bullTap: bull,
      poib,
      delta: { x: dx, y: dy }, // bull - POIB
      directions: { windage: windDir, elevation: elevDir },
    });
  } catch (e) {
    return res.status(500).json({
      ok: false,
      error: "Server error",
      detail: String(e && e.message ? e.message : e),
    });
  }
});

// Render uses PORT
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`sczn3-backend-new listening on ${PORT}`);
});
