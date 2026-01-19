// backend_new/server.js (FULL REPLACEMENT)
// Tap-n-Score backend (stable + minimal)
//
// Routes:
//   GET  /ping
//   POST /tapscore
//       body: { distanceYds, bullTap:{x,y}, taps:[{x,y},...], vendorLink? }
//       x,y are normalized 0..1 coming from frontend
//
// Returns (no placeholders):
//   { ok, distanceYds, tapsCount, bullTap, poib, delta, directions }

const express = require("express");
const cors = require("cors");

const app = express();

// Keep wide-open during build; lock down later.
app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type"]
}));

app.use(express.json({ limit: "2mb" }));

app.get("/", (req, res) => res.json({ ok: true, service: "tapnscore-backend" }));
app.get("/ping", (req, res) => res.json({ ok: true, route: "/ping" }));

function isNum(n) {
  return typeof n === "number" && Number.isFinite(n);
}
function clamp01(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

// Canonical direction labels from delta = bull - POIB
// ΔX>0 RIGHT, ΔX<0 LEFT ; ΔY>0 UP, ΔY<0 DOWN
function dirX(dx) {
  if (!Number.isFinite(dx) || dx === 0) return "CENTER";
  return dx > 0 ? "RIGHT" : "LEFT";
}
function dirY(dy) {
  if (!Number.isFinite(dy) || dy === 0) return "CENTER";
  return dy > 0 ? "UP" : "DOWN";
}

app.post("/tapscore", (req, res) => {
  try {
    const body = req.body || {};

    const distanceYds = Number(body.distanceYds || 100);
    const bullTap = body.bullTap;
    const tapsIn = Array.isArray(body.taps) ? body.taps : [];

    if (!bullTap || !isNum(bullTap.x) || !isNum(bullTap.y)) {
      return res.status(400).json({ ok: false, error: "Missing bullTap {x,y}." });
    }
    if (tapsIn.length < 1) {
      return res.status(400).json({ ok: false, error: "Need at least 1 bullet-hole tap." });
    }

    // Clamp bull
    const bull = { x: clamp01(bullTap.x), y: clamp01(bullTap.y) };

    // Clamp holes
    const pts = tapsIn
      .filter(p => p && isNum(p.x) && isNum(p.y))
      .map(p => ({ x: clamp01(p.x), y: clamp01(p.y) }));

    if (pts.length < 1) {
      return res.status(400).json({ ok: false, error: "No valid bullet-hole taps." });
    }

    // POIB = average of hole taps (normalized)
    let sx = 0, sy = 0;
    for (const p of pts) { sx += p.x; sy += p.y; }
    const poib = { x: sx / pts.length, y: sy / pts.length };

    // correction delta = bull - POIB
    const delta = { x: bull.x - poib.x, y: bull.y - poib.y };

    return res.json({
      ok: true,
      distanceYds: Number.isFinite(distanceYds) && distanceYds > 0 ? distanceYds : 100,
      tapsCount: pts.length,
      bullTap: bull,
      poib,
      delta,
      directions: {
        windage: dirX(delta.x),
        elevation: dirY(delta.y)
      }
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
app.listen(PORT, () => console.log(`Tap-n-Score backend listening on ${PORT}`));
