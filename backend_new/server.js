// backend_new/server.js
"use strict";

const express = require("express");
const cors = require("cors");
const multer = require("multer");
const sharp = require("sharp");

const app = express();

// --- CORS (permissive for now; lock down later) ---
app.use(cors({ origin: true }));
app.use(express.json({ limit: "2mb" }));

// --- Upload (memory) ---
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 12 * 1024 * 1024 } // 12MB
});

// --- helpers ---
const round2 = (n) => Number((Number(n) || 0).toFixed(2));

function parseNum(v, fallback = 0) {
  if (v === undefined || v === null) return fallback;
  const s = String(v).trim();
  if (!s) return fallback;
  const num = Number(s);
  return Number.isFinite(num) ? num : fallback;
}

function buildResponse({ distanceYards, moaPerClick, dx, dy, meta, demoOverrideUsed, source }) {
  const directions = {
    elevation: dy === 0 ? "" : (dy > 0 ? "UP" : "DOWN"),
    windage: dx === 0 ? "" : (dx > 0 ? "RIGHT" : "LEFT")
  };

  const inchesPerClick = 1.047 * (distanceYards / 100) * moaPerClick;
  const clicksElevation = inchesPerClick ? (Math.abs(dy) / inchesPerClick) : 0;
  const clicksWindage = inchesPerClick ? (Math.abs(dx) / inchesPerClick) : 0;

  return {
    ok: true,
    source,
    secId: String(Date.now()).slice(-6),
    distanceYards,
    moaPerClick,
    image: meta ? { width: meta.width || null, height: meta.height || null } : null,

    correction_in: {
      dx: round2(dx),
      dy: round2(dy)
    },

    directions,

    clicks: {
      elevation: round2(clicksElevation),
      windage: round2(clicksWindage)
    },

    score: 614,
    tip: demoOverrideUsed
      ? `DEMO OVERRIDE active — dx=${round2(dx)} in, dy=${round2(dy)} in.`
      : "Stub active — dx/dy defaulted to 0.00."
  };
}

// --- Health check ---
app.get("/", (req, res) => {
  res.status(200).send("SCZN3 backend_new OK");
});

// --- GET helper (NOW supports querystring dx/dy for quick testing) ---
app.get("/api/analyze", (req, res) => {
  const distanceYards = parseNum(req.query.distanceYards || req.query.distance, 100);
  const moaPerClick = parseNum(req.query.moaPerClick, 0.25);

  const hasDx = req.query.dx !== undefined && String(req.query.dx).trim() !== "";
  const hasDy = req.query.dy !== undefined && String(req.query.dy).trim() !== "";

  const dx = parseNum(req.query.dx, 0);
  const dy = parseNum(req.query.dy, 0);

  const demoOverrideUsed = Boolean(hasDx || hasDy);

  return res.status(200).json(
    buildResponse({
      distanceYards,
      moaPerClick,
      dx,
      dy,
      meta: null,
      demoOverrideUsed,
      source: "GET /api/analyze (query)"
    })
  );
});

// --- Analyze endpoint (POST multipart) ---
app.post("/api/analyze", upload.single("image"), async (req, res) => {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({
        ok: false,
        error: "Missing image file (field name must be: image)"
      });
    }

    const distanceYards = parseNum(req.body.distanceYards || req.body.distance, 100);
    const moaPerClick = parseNum(req.body.moaPerClick, 0.25);

    const hasDx = req.body.dx !== undefined && String(req.body.dx).trim() !== "";
    const hasDy = req.body.dy !== undefined && String(req.body.dy).trim() !== "";

    const dx = parseNum(req.body.dx, 0);
    const dy = parseNum(req.body.dy, 0);

    const demoOverrideUsed = Boolean(hasDx || hasDy);

    const meta = await sharp(req.file.buffer).metadata();

    return res.json(
      buildResponse({
        distanceYards,
        moaPerClick,
        dx,
        dy,
        meta,
        demoOverrideUsed,
        source: "POST /api/analyze (multipart)"
      })
    );
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: err?.message || "Server error",
      where: "POST /api/analyze"
    });
  }
});

// --- Listen ---
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`SCZN3 backend_new listening on ${PORT}`);
});
