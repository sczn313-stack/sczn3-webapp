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

// --- Upload (memory, since we'll read via sharp) ---
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 12 * 1024 * 1024 } // 12MB
});

// --- Health check ---
app.get("/", (req, res) => {
  res.status(200).send("SCZN3 backend_new OK");
});

// Optional GET helper (nice for Safari quick test)
app.get("/api/analyze", (req, res) => {
  res.status(200).json({
    ok: true,
    note: "Use POST /api/analyze with multipart field 'image' (and optional distanceYards, moaPerClick)."
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

    // Prove sharp works + basic integrity check
    const meta = await sharp(req.file.buffer).metadata();

    // ------------------------------------------------------------
    // TEMP STUB (until real bullet-hole / POIB logic is wired)
    // Return the EXACT shape output.js needs:
    // correction_in: { dx, dy }
    //   dx > 0 => move RIGHT, dx < 0 => move LEFT
    //   dy > 0 => move UP,    dy < 0 => move DOWN
    // ------------------------------------------------------------
    const dx = 0.00;
    const dy = 0.00;

    const directions = {
      elevation: dy === 0 ? "" : (dy > 0 ? "UP" : "DOWN"),
      windage: dx === 0 ? "" : (dx > 0 ? "RIGHT" : "LEFT")
    };

    const inchesPerClick = 1.047 * (distanceYards / 100) * moaPerClick;
    const clicksElevation = inchesPerClick ? (Math.abs(dy) / inchesPerClick) : 0;
    const clicksWindage = inchesPerClick ? (Math.abs(dx) / inchesPerClick) : 0;

    const round2 = (n) => Number((Number(n) || 0).toFixed(2));

    return res.json({
      ok: true,
      secId: String(Date.now()).slice(-6),
      distanceYards,
      moaPerClick,
      image: { width: meta.width || null, height: meta.height || null },

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
      tip: "Tap N Score pilot — shot(s) recorded."
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
