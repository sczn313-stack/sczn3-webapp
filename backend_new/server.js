// backend_new/server.js  (FULL REPLACEMENT)
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
const asNum = (v, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

// --- Health check ---
app.get("/", (req, res) => {
  res.status(200).send("SCZN3 backend_new OK");
});

// --- URL TEST ROUTE (NO IMAGE REQUIRED) ---
// Example:
// /api/demo?distanceYards=50&moaPerClick=0.25&dx=2&dy=-1
app.get("/api/demo", (req, res) => {
  const distanceYards = asNum(req.query.distanceYards || req.query.distance || 100, 100);
  const moaPerClick = asNum(req.query.moaPerClick || 0.25, 0.25);

  const dx = asNum(req.query.dx, 0);
  const dy = asNum(req.query.dy, 0);

  const directions = {
    elevation: dy === 0 ? "" : (dy > 0 ? "UP" : "DOWN"),
    windage: dx === 0 ? "" : (dx > 0 ? "RIGHT" : "LEFT")
  };

  const inchesPerClick = 1.047 * (distanceYards / 100) * moaPerClick;
  const clicksElevation = inchesPerClick ? (Math.abs(dy) / inchesPerClick) : 0;
  const clicksWindage = inchesPerClick ? (Math.abs(dx) / inchesPerClick) : 0;

  return res.json({
    ok: true,
    mode: "demo",
    distanceYards,
    moaPerClick,
    correction_in: { dx: round2(dx), dy: round2(dy) },
    directions,
    clicks: { elevation: round2(clicksElevation), windage: round2(clicksWindage) },
    tip: `DEMO URL — dx=${round2(dx)} in, dy=${round2(dy)} in`
  });
});

// --- Quick GET helper (Safari test) ---
app.get("/api/analyze", (req, res) => {
  res.status(200).json({
    ok: true,
    note:
      "Use POST /api/analyze with multipart field 'image' and optional fields: distanceYards, moaPerClick, dx, dy (inches)."
  });
});

// --- Analyze endpoint (POST) ---
app.post("/api/analyze", upload.single("image"), async (req, res) => {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({
        ok: false,
        error: "Missing image file (field name must be: image)"
      });
    }

    const distanceYards = asNum(req.body.distanceYards || req.body.distance || 100, 100);
    const moaPerClick = asNum(req.body.moaPerClick || 0.25, 0.25);

    // Prove sharp works + catches corrupt uploads
    const meta = await sharp(req.file.buffer).metadata();

    // DEMO OVERRIDE via POST fields dx/dy (inches)
    const hasDx = req.body.dx !== undefined && req.body.dx !== null && String(req.body.dx).trim() !== "";
    const hasDy = req.body.dy !== undefined && req.body.dy !== null && String(req.body.dy).trim() !== "";

    let dx = hasDx ? asNum(req.body.dx, 0) : 0.0;
    let dy = hasDy ? asNum(req.body.dy, 0) : 0.0;

    const directions = {
      elevation: dy === 0 ? "" : (dy > 0 ? "UP" : "DOWN"),
      windage: dx === 0 ? "" : (dx > 0 ? "RIGHT" : "LEFT")
    };

    const inchesPerClick = 1.047 * (distanceYards / 100) * moaPerClick;
    const clicksElevation = inchesPerClick ? (Math.abs(dy) / inchesPerClick) : 0;
    const clicksWindage = inchesPerClick ? (Math.abs(dx) / inchesPerClick) : 0;

    const demoOverrideUsed = Boolean(hasDx || hasDy);

    return res.json({
      ok: true,
      secId: String(Date.now()).slice(-6),
      distanceYards,
      moaPerClick,
      image: { width: meta.width || null, height: meta.height || null },

      correction_in: { dx: round2(dx), dy: round2(dy) },

      directions,

      clicks: {
        elevation: round2(clicksElevation),
        windage: round2(clicksWindage)
      },

      score: 614,
      tip: demoOverrideUsed
        ? `DEMO OVERRIDE active — dx=${round2(dx)} in, dy=${round2(dy)} in.`
        : "Stub active — dx/dy defaulted to 0.00. Send dx/dy to test directions/clicks."
    });
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
