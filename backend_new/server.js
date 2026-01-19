// backend_new/server.js  (FULL REPLACEMENT)
// SCZN3 Tap-n-Score Backend (normalized 0..1 coords, bull-first)
// Routes:
//   GET  /
//   GET  /ping
//   GET  /health
//   POST /tapscore   { distanceYds, bullTap:{x,y}, taps:[{x,y},...], vendorLink? }
//
// Notes:
// - This backend returns normalized math ONLY (0..1 space) so the frontend can verify flow.
// - No inches/MOA/click conversion here until we lock a reliable scale.
// - Includes strong CORS + JSON error handling so frontend always gets JSON.

const express = require("express");
const cors = require("cors");

const SERVICE = "sczn3-backend-new1";
const BUILD   = "TAPNSCORE_BACKEND_V1_FULL";

const app = express();

// ---- CORS (keep wide open during dev) ----
app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type"],
}));

// ---- JSON parsing ----
app.use(express.json({ limit: "10mb" }));

// ---- Always return JSON (even on errors) ----
app.use((req, res, next) => {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  next();
});

// ---- Helpers ----
function isNum(n) {
  return typeof n === "number" && Number.isFinite(n);
}

function clamp01(v) {
  const x = Number(v);
  if (!Number.isFinite(x)) return 0;
  return Math.max(0, Math.min(1, x));
}

function meanPoint(points) {
  const sum = points.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 });
  return { x: sum.x / points.length, y: sum.y / points.length };
}

function round6(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return 0;
  return Math.round(x * 1e6) / 1e6;
}

function cleanPoint(p) {
  return { x: round6(p.x), y: round6(p.y) };
}

// ---- Routes ----
app.get("/", (req, res) => {
  res.status(200).send(JSON.stringify({ ok: true, service: SERVICE, build: BUILD }));
});

app.get("/ping", (req, res) => {
  res.status(200).send(JSON.stringify({ ok: true, service: SERVICE, route: "/ping" }));
});

app.get("/health", (req, res) => {
  res.status(200).send(JSON.stringify({
    ok: true,
    service: SERVICE,
    build: BUILD,
    uptime_s: Math.round(process.uptime()),
    ts: new Date().toISOString()
  }));
});

app.post("/tapscore", (req, res) => {
  try {
    const body = req.body || {};

    const distanceYds = Number(body.distanceYds || 100);
    const bullTap = body.bullTap;
    const tapsRaw = Array.isArray(body.taps) ? body.taps : [];

    if (!bullTap || !isNum(bullTap.x) || !isNum(bullTap.y)) {
      return res.status(400).send(JSON.stringify({
        ok: false,
        error: { code: "BAD_BULL", message: "Missing bullTap {x,y} (numbers)." }
      }));
    }

    if (tapsRaw.length < 1) {
      return res.status(400).send(JSON.stringify({
        ok: false,
        error: { code: "NO_HOLES", message: "Need at least 1 bullet-hole tap after the bull." }
      }));
    }

    // Clamp bull + hole taps into normalized space
    const bull = { x: clamp01(bullTap.x), y: clamp01(bullTap.y) };

    const holes = tapsRaw
      .filter(p => p && isNum(p.x) && isNum(p.y))
      .map(p => ({ x: clamp01(p.x), y: clamp01(p.y) }));

    if (holes.length < 1) {
      return res.status(400).send(JSON.stringify({
        ok: false,
        error: { code: "BAD_HOLES", message: "No valid hole taps found." }
      }));
    }

    // POIB in normalized space
    const poib = meanPoint(holes);

    // Canonical delta: bull - POIB  (direction to move POIB to bull)
    const delta = { x: bull.x - poib.x, y: bull.y - poib.y };

    // Lightweight score placeholder: just based on distance from bull (normalized)
    // (Replace later with your Smart Score framework.)
    const r = Math.sqrt((poib.x - bull.x) ** 2 + (poib.y - bull.y) ** 2);
    const score = Math.max(0, Math.round(650 - r * 900));

    // Debug echo fields (helps frontend prove it’s receiving JSON)
    const vendorLink = typeof body.vendorLink === "string" ? body.vendorLink.trim() : null;

    return res.status(200).send(JSON.stringify({
      ok: true,
      service: SERVICE,
      build: BUILD,

      distanceYds: Number.isFinite(distanceYds) && distanceYds > 0 ? distanceYds : 100,

      tapsCount: holes.length,
      bullTap: cleanPoint(bull),
      poib: cleanPoint(poib),
      delta: cleanPoint(delta),

      // placeholders (until inches/MOA conversion is wired)
      windage: "--",
      elevation: "--",

      score,
      vendorLink,

      tip: "Normalized output (0..1). delta = bull - POIB."
    }));
  } catch (e) {
    return res.status(500).send(JSON.stringify({
      ok: false,
      error: { code: "SERVER_ERROR", message: String(e?.message || e) }
    }));
  }
});

// ---- Render PORT ----
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`${SERVICE} on ${PORT} build=${BUILD}`));
