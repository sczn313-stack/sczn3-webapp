// backend_new/server.js (FULL REPLACEMENT)
// Express backend for Tap-n-Score
// Routes:
//  GET  /        -> health
//  GET  /ping
//  POST /tapscore  { distanceYds, bullTap:{x,y}, taps:[{x,y},...] }

const express = require("express");
const cors = require("cors");

const app = express();

app.use(cors({
  origin: "*",
  methods: ["GET","POST","OPTIONS"],
  allowedHeaders: ["Content-Type"]
}));

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

    // Canonical: correction = bull - POIB (move POIB to bull)
    const delta = { x: bull.x - poib.x, y: bull.y - poib.y };

    return res.json({
      ok: true,
      distanceYds,
      tapsCount: pts.length,
      bullTap: bull,
      poib,
      delta,
      windage: "--",
      elevation: "--",
      score: "--"
    });
  } catch (e) {
    return res.status(500).json({
      ok:false,
      error:"Server error",
      detail: String(e && e.message ? e.message : e)
    });
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`tapscore backend listening on ${PORT}`));
