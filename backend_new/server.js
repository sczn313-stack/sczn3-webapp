// backend_new/server.js
// Express backend for Tap-n-Score
// Routes:
//  GET  /ping
//  POST /tapscore  { distanceYds, bullTap:{x,y}, taps:[{x,y},...] }

const express = require("express");
const cors = require("cors");

const app = express();

// If you want to restrict origins later, do it here.
app.use(cors({
  origin: "*",
  methods: ["GET","POST","OPTIONS"],
  allowedHeaders: ["Content-Type"]
}));

// IMPORTANT: allow enough JSON size if you ever send base64.
// Right now frontend sends imageDataUrl: null, so this is just safe.
app.use(express.json({ limit: "10mb" }));

app.get("/", (req, res) => res.json({ ok: true, service: "sczn3-backend-new1" }));
app.get("/ping", (req, res) => res.json({ ok: true, route: "/ping" }));

function isNum(n){ return typeof n === "number" && Number.isFinite(n); }
function clamp01(v){ return Math.max(0, Math.min(1, v)); }

app.post("/tapscore", (req, res) => {
  try {
    const body = req.body || {};
    const distanceYds = Number(body.distanceYds || 100);

    const bullTap = body.bullTap;
    const taps = Array.isArray(body.taps) ? body.taps : [];

    if (!bullTap || !isNum(bullTap.x) || !isNum(bullTap.y)) {
      return res.status(400).json({ ok:false, error:"Missing bullTap {x,y}." });
    }
    if (taps.length < 1) {
      return res.status(400).json({ ok:false, error:"Need at least 1 bullet-hole tap." });
    }

    // Normalize/clamp
    const bull = { x: clamp01(Number(bullTap.x)), y: clamp01(Number(bullTap.y)) };
    const pts = taps
      .filter(p => p && isNum(p.x) && isNum(p.y))
      .map(p => ({ x: clamp01(Number(p.x)), y: clamp01(Number(p.y)) }));

    if (pts.length < 1) {
      return res.status(400).json({ ok:false, error:"No valid taps." });
    }

    // POIB = average of hole taps
    const sum = pts.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x:0, y:0 });
    const poib = { x: sum.x / pts.length, y: sum.y / pts.length };

    // Canonical: correction = bull - POIB (direction to move POIB to bull)
    const delta = { x: bull.x - poib.x, y: bull.y - poib.y };

    // NOTE: We are NOT converting to inches/MOA/clicks here because that requires a known scale.
    // This backend returns normalized values only (0..1), so the frontend can display/verify.

    return res.json({
      ok: true,
      distanceYds,
      tapsCount: pts.length,
      bullTap: bull,
      poib,
      delta, // bull - POIB
      windage: "--",
      elevation: "--",
      score: "--"
    });
  } catch (e) {
    return res.status(500).json({ ok:false, error:"Server error", detail: String(e && e.message ? e.message : e) });
  }
});

// Render uses PORT
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`tapscore backend listening on ${PORT}`));
