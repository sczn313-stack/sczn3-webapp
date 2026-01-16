// backend_new/server.js
"use strict";

const express = require("express");
const cors = require("cors");
const multer = require("multer");
const sharp = require("sharp");

const app = express();

/**
 * ===== CORS =====
 * Keep permissive while building. (Lock down later to your frontend domain.)
 */
app.use(cors({ origin: true, credentials: false }));

/**
 * Optional: JSON parsing (not required for multipart uploads, but harmless)
 */
app.use(express.json({ limit: "2mb" }));

/**
 * ===== Upload (memory) =====
 * Frontend sends: FormData { image: blob, distanceYards, moaPerClick }
 */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 12 * 1024 * 1024 }, // 12MB
});

/**
 * ===== Helpers =====
 */
const round2 = (n) => Number((Number(n) || 0).toFixed(2));

function getNumber(v, fallback) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * ===== Health / sanity =====
 */
app.get("/", (req, res) => {
  res.status(200).type("text").send("SCZN3 backend_new OK");
});

app.get("/api/health", (req, res) => {
  res.json({ ok: true, service: "sczn3-backend-new", ts: Date.now() });
});

/**
 * Optional: respond to GET /api/analyze so you don't see "Cannot GET /api/analyze"
 * when you hit it in a browser. (Analyze is POST.)
 */
app.get("/api/analyze", (req, res) => {
  res
    .status(200)
    .json({ ok: true, note: "Use POST /api/analyze with multipart form-data (field: image)." });
});

/**
 * ===== Analyze endpoint =====
 * POST /api/analyze
 * multipart/form-data:
 *  - image: file
 *  - distanceYards: number (optional)
 *  - moaPerClick: number (optional, default 0.25)
 */
app.post("/api/analyze", upload.single("image"), async (req, res) => {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({
        ok: false,
        error: "Missing image file. Expected multipart field name: image",
      });
    }

    const distanceYards = getNumber(req.body.distanceYards || req.body.distance, 100);
    const moaPerClick = getNumber(req.body.moaPerClick, 0.25);

    // Verify the buffer is a real image + capture metadata
    const meta = await sharp(req.file.buffer).metadata();

    // ============================================================
    // TEMP STUB (Replace this block with real POIB / hole logic)
    // correction_in is "click the scope THIS WAY" (sign matters)
    // +up    => dial UP
    // +right => dial RIGHT
    // ============================================================
    const correction_in = {
      up: 0,
      right: 0,
    };

    const directions = {
      elevation: correction_in.up === 0 ? "" : (correction_in.up > 0 ? "UP" : "DOWN"),
      windage: correction_in.right === 0 ? "" : (correction_in.right > 0 ? "RIGHT" : "LEFT"),
    };

    // True MOA inches per click at distance
    const inchesPerClick = 1.047 * (distanceYards / 100) * moaPerClick;

    const clicks = {
      elevation: inchesPerClick ? Math.abs(correction_in.up) / inchesPerClick : 0,
      windage: inchesPerClick ? Math.abs(correction_in.right) / inchesPerClick : 0,
    };

    return res.json({
      ok: true,
      secId: String(Date.now()).slice(-6),
      distanceYards: round2(distanceYards),
      moaPerClick: round2(moaPerClick),

      image: {
        width: meta.width ?? null,
        height: meta.height ?? null,
        format: meta.format ?? null,
      },

      // 2-decimal rule enforced here
      correction_in: {
        up: round2(correction_in.up),
        right: round2(correction_in.right),
      },
      directions,
      clicks: {
        elevation: round2(clicks.elevation),
        windage: round2(clicks.windage),
      },

      // placeholders for now (frontend can show immediately)
      score: 614,
      tip: "Tap N Score pilot — shot(s) recorded.",
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: err?.message || "Server error",
      where: "POST /api/analyze",
    });
  }
});

/**
 * ===== Listen (Render) =====
 */
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`SCZN3 backend_new listening on ${PORT}`);
});
