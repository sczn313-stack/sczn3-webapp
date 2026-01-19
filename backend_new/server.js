/**
 * backend_new/server.js — Tap-n-Score backend (STABLE)
 *
 * Routes:
 *  - GET  /            (health)
 *  - GET  /health
 *  - GET  /ping
 *  - POST /tapscore    (JSON)  { distanceYds, bullTap:{x,y}, taps:[{x,y},...] }
 *  - POST /api/analyze (JSON)  alias -> /tapscore (keeps older frontend alive)
 *
 * Normalized tap coords:
 *  - x grows RIGHT  (0..1)
 *  - y grows DOWN   (0..1)
 *
 * Canonical correction direction:
 *  - We return delta = bull - POIB in normalized units.
 *    dx > 0 => RIGHT, dx < 0 => LEFT
 *    dy > 0 => DOWN,  dy < 0 => UP        (because y grows down)
 *
 * IMPORTANT:
 *  - This backend does NOT compute inches/MOA/clicks (needs known scale).
 *  - It returns directions consistently so frontend cannot flip itself.
 */

const express = require("express");
const cors = require("cors");

const SERVICE = "sczn3-backend-new1";
const BUILD = "TAPNSCORE_STABLE_V1";

const app = express();

app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type"],
  })
);

// JSON parser
app.use(express.json({ limit: "2mb" }));

app.get("/", (req, res) => res.json({ ok: true, service: SERVICE, build: BUILD }));
app.get("/health", (req, res) => res.json({ ok: true, service: SERVICE, build: BUILD }));
app.get("/ping", (req, res) => res.json({ ok: true, route: "/ping", service: SERVICE, build: BUILD }));

function isNum(n) {
  return typeof n === "number" && Number.isFinite(n);
}
function clamp01(v) {
  return Math.max(0, Math.min(1, v));
}

function computePoib(pts) {
  const sum = pts.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 });
  return { x: sum.x / pts.length, y: sum.y / pts.length };
}

// Direction labels using pixel-style normalized coordinates (y down)
function dirX(dx) {
  if (dx > 0) return "RIGHT";
  if (dx < 0) return "LEFT";
  return "CENTER";
}
function dirY(dy) {
  if (dy > 0) return "DOWN";
  if (dy < 0) return "UP";
  return "CENTER";
}

function tapscoreHandler(req, res) {
  try {
    const body = req.body || {};

    const distanceYds = Number(body.distanceYds || 100);

    const bullTap = body.bullTap;
    const tapsRaw = Array.isArray(body.taps) ? body.taps : [];

    if (!bullTap || !isNum(bullTap.x) || !isNum(bullTap.y)) {
      return res.status(400).json({
        ok: false,
        error: { code: "NO_BULL", message: "Missing bullTap {x,y}." },
      });
    }

    const pts = tapsRaw
      .filter((p) => p && isNum(p.x) && isNum(p.y))
      .map((p) => ({ x: clamp01(Number(p.x)), y: clamp01(Number(p.y)) }));

    if (pts.length < 1) {
      return res.status(400).json({
        ok: false,
        error: { code: "NO_TAPS", message: "Need at least 1 bullet-hole tap." },
      });
    }

    const bull = { x: clamp01(Number(bullTap.x)), y: clamp01(Number(bullTap.y)) };
    const poib = computePoib(pts);

    // Canonical delta in normalized coords (y down)
    const delta = { x: bull.x - poib.x, y: bull.y - poib.y };

    // Frontend-friendly direction labels
    const directions = {
      windage: dirX(delta.x),
      elevation: dirY(delta.y),
    };

    return res.json({
      ok: true,
      service: SERVICE,
      build: BUILD,
      distanceYds,
      tapsCount: pts.length,
      bullTap: bull,
      poib,
      delta,        // bull - POIB (normalized)
      directions,   // RIGHT/LEFT and UP/DOWN in y-down coordinate system
      windage: directions.windage,
      elevation: directions.elevation,
      score: "--",
    });
  } catch (e) {
    return res.status(500).json({
      ok: false,
      error: { code: "SERVER_ERROR", message: String(e?.message || e) },
    });
  }
}

app.post("/tapscore", tapscoreHandler);

// Back-compat alias (if any old frontend is still calling this)
app.post("/api/analyze", tapscoreHandler);

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`${SERVICE} on ${PORT} build=${BUILD}`));
