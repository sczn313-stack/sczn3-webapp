// backend_new/server.js (FULL REPLACEMENT)
// Express backend for Tap-n-Score
// Routes:
//  GET  /
//  GET  /ping
//  POST /tapscore  { distanceYds, bullTap:{x,y}, taps:[{x,y},...] }
//
// IMPORTANT AXIS LOCK:
// - Right = Right uses +dx => RIGHT, -dx => LEFT
// - Top = Up requires Y flip because screen Y grows downward.
//   We compute dyUp = -(bullY - poibY)
//   Then +dyUp => UP, -dyUp => DOWN

const express = require("express");
const cors = require("cors");

const app = express();

app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type"]
}));

app.use(express.json({ limit: "10mb" }));

app.get("/", (req, res) => res.json({ ok: true, service: "sczn3-backend-new" }));
app.get("/ping", (req, res) => res.json({ ok: true, route: "/ping" }));

function isNum(n) { return typeof n === "number" && Number.isFinite(n); }
function clamp01(v) { return Math.max(0, Math.min(1, v)); }

function avgPoint(points) {
  const sum = points.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 });
  return { x: sum.x / points.length, y: sum.y / points.length };
}

function dirFromDx(dx) {
  if (dx > 0) return "RIGHT";
  if (dx < 0) return "LEFT";
  return "CENTER";
}

function dirFromDyUp(dyUp) {
  if (dyUp > 0) return "UP";
  if (dyUp < 0) return "DOWN";
  return "CENTER";
}

app.post("/tapscore", (req, res) => {
  try {
    const body = req.body || {};
    const distanceYds = Number(body.distanceYds || 100);

    const bullTap = body.bullTap;
    const taps = Array.isArray(body.taps) ? body.taps : [];

    if (!bullTap || !isNum(bullTap.x) || !isNum(bullTap.y)) {
      return res.status(400).json({ ok: false, error: "Missing bullTap {x,y}." });
    }
    if (taps.length < 1) {
      return res.status(400).json({ ok: false, error: "Need at least 1 bullet-hole tap." });
    }

    // Normalize/clamp
    const bull = { x: clamp01(Number(bullTap.x)), y: clamp01(Number(bullTap.y)) };
    const pts = taps
      .filter(p => p && isNum(p.x) && isNum(p.y))
      .map(p => ({ x: clamp01(Number(p.x)), y: clamp01(Number(p.y)) }));

    if (pts.length < 1) {
      return res.status(400).json({ ok: false, error: "No valid taps." });
    }

    // POIB = average of hole taps (normalized 0..1)
    const poib = avgPoint(pts);

    // Canonical geometry:
    // dx: bull - POIB (right positive)
    const dx = bull.x - poib.x;

    // screenDy: bullY - poibY (positive when bull is LOWER on screen)
    const screenDy = bull.y - poib.y;

    // dyUp flips screen Y so "Top = Up"
    const dyUp = -screenDy;

    const windDir = dirFromDx(dx);
    const elevDir = dirFromDyUp(dyUp);

    return res.json({
      ok: true,
      distanceYds,
      tapsCount: pts.length,
      bullTap: bull,
      poib,
      // Keep these as raw normalized deltas for debugging
      delta: { dx, dyUp },
      // Directions (truth-locked)
      windageDir: windDir,
      elevationDir: elevDir,
      // Placeholders for later inches/MOA/clicks
      windage: windDir,
      elevation: elevDir,
      score: "--"
    });
  } catch (e) {
    return res.status(500).json({
      ok: false,
      error: "Server error",
      detail: String(e && e.message ? e.message : e)
    });
  }
});

// Render uses PORT
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`tapscore backend listening on ${PORT}`));
