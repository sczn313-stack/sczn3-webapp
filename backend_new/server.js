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

// --- Health check ---
app.get("/", (req, res) => {
  res.status(200).send("SCZN3 backend_new OK");
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

    // Optional inputs (safe defaults)
    const distanceYards = Number(req.body.distanceYards || req.body.distance || 100);
    const moaPerClick = Number(req.body.moaPerClick || 0.25);

    // Read image metadata (proves sharp works + catches corrupt uploads)
    const meta = await sharp(req.file.buffer).metadata();

    // ------------------------------------------------------------
    // DEMO OVERRIDE (Option #2)
    // If client sends dx/dy, we use them.
    // dx/dy are INCHES and represent: correction = bull - POIB
    //
    // dx > 0 => dial RIGHT
    // dx < 0 => dial LEFT
    // dy > 0 => dial UP
    // dy < 0 => dial DOWN
    // ------------------------------------------------------------
    const hasDx = req.body.dx !== undefined && req.body.dx !== null && String(req.body.dx).trim() !== "";
    const hasDy = req.body.dy !== undefined && req.body.dy !== null && String(req.body.dy).trim() !== "";

    // Defaults: 0.00 / 0.00 (stub)
    let dx = 0.0;
    let dy = 0.0;

    if (hasDx) dx = Number(req.body.dx);
    if (hasDy) dy = Number(req.body.dy);

    // If bad numbers come in, force 0
    if (!Number.isFinite(dx)) dx = 0.0;
    if (!Number.isFinite(dy)) dy = 0.0;

    const directions = {
      elevation: dy === 0 ? "" : (dy > 0 ? "UP" : "DOWN"),
      windage: dx === 0 ? "" : (dx > 0 ? "RIGHT" : "LEFT")
    };

    // True MOA inches per click at distance
    const inchesPerClick = 1.047 * (distanceYards / 100) * moaPerClick;

    const clicksElevation = inchesPerClick ? (Math.abs(dy) / inchesPerClick) : 0;
    const clicksWindage = inchesPerClick ? (Math.abs(dx) / inchesPerClick) : 0;

    // 2-decimal rule
    const round2 = (n) => Number((Number(n) || 0).toFixed(2));

    // Nice debug info you can see in browser devtools if you print it
    const demoOverrideUsed = Boolean(hasDx || hasDy);

    return res.json({
      ok: true,
      secId: String(Date.now()).slice(-6),
      distanceYards,
      moaPerClick,
      image: { width: meta.width || null, height: meta.height || null },

      // Shape your output.js expects
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
