// backend_new/server.js (FULL REPLACEMENT)
// Tap-n-Score backend — direction LOCKED (Top=Up, Right=Right)
// IMPORTANT: image Y is inverted (smaller y is UP), so elevation uses inverted mapping.
// Routes:
//   GET  /ping
//   POST /tapscore   { distanceYds, bullTap:{x,y}, taps:[{x,y},...] }
// Returns:
//   { ok, distanceYds, tapsCount, bullTap, poib, delta, directions:{windage,elevation} }

const express = require("express");
const cors = require("cors");

const app = express();

app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type"]
}));

app.use(express.json({ limit: "2mb" }));

app.get("/", (req, res) => res.json({ ok: true, service: "tapnscore-backend" }));
app.get("/ping", (req, res) => res.json({ ok: true, route: "/ping" }));

function isNum(n) { return typeof n === "number" && Number.isFinite(n); }
function clamp01(v) { return Math.max(0, Math.min(1, v)); }

function meanPoint(pts) {
  const sum = pts.reduce((a, p) => ({ x: a.x + p.x, y: a.y + p.y }), { x: 0, y: 0 });
  return { x: sum.x / pts.length, y: sum.y / pts.length };
}

// Canonical direction rule (LOCKED):
// dx = bull.x - poib.x
//   dx>0 => RIGHT, dx<0 => LEFT
//
// dy = bull.y - poib.y  (NOTE: y grows DOWN on images)
//   dy>0 => POIB above bull => move DOWN
//   dy<0 => POIB below bull => move UP
function dirWindage(dx) {
  if (dx > 0) return "RIGHT";
  if (dx < 0) return "LEFT";
  return "CENTER";
}
function dirElevationImage(dy) {
  if (dy > 0) return "DOWN";
  if (dy < 0) return "UP";
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

    const bull = { x: clamp01(Number(bullTap.x)), y: clamp01(Number(bullTap.y)) };
    const pts = taps
      .filter(p => p && isNum(p.x) && isNum(p.y))
      .map(p => ({ x: clamp01(Number(p.x)), y: clamp01(Number(p.y)) }));

    if (pts.length < 1) {
      return res.status(400).json({ ok: false, error: "No valid taps." });
    }

    const poib = meanPoint(pts);

    // Canonical delta (bull - POIB)
    const dx = bull.x - poib.x;
    const dy = bull.y - poib.y;

    const directions = {
      windage: dirWindage(dx),
      elevation: dirElevationImage(dy)
    };

    return res.json({
      ok: true,
      distanceYds,
      tapsCount: pts.length,
      bullTap: bull,
      poib,
      delta: { x: dx, y: dy },
      directions
    });
  } catch (e) {
    return res.status(500).json({
      ok: false,
      error: "Server error",
      detail: String(e && e.message ? e.message : e)
    });
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Tap-n-Score backend listening on ${PORT}`));
