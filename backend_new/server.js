// backend_new/server.js
const express = require("express");
const cors = require("cors");
const multer = require("multer");
const sharp = require("sharp");

const app = express();

// CORS (permissive for now; lock down later)
app.use(cors({ origin: true }));
app.use(express.json({ limit: "2mb" }));

// Upload: memory storage (sharp reads from buffer)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 12 * 1024 * 1024 } // 12MB
});

// Health check
app.get("/", (req, res) => {
  res.status(200).send("SCZN3 backend_new OK");
});

// Analyze endpoint (POST)
app.post("/api/analyze", upload.single("image"), async (req, res) => {
  try {
    if (!req.file || !req.file.buffer) {
      return res
        .status(400)
        .json({ ok: false, error: "Missing image file (field name: image)" });
    }

    // Optional inputs
    const distanceYards = Number(req.body.distanceYards || req.body.distance || 100);
    const moaPerClick = Number(req.body.moaPerClick || 0.25);

    // Proves sharp works + catches corrupt uploads
    const meta = await sharp(req.file.buffer).metadata();

    // -------- TEMP STUB (valid shape for your frontend) --------
    // Use "dx/dy" so it matches your output.js right now
    // dx: + means move RIGHT, dy: + means move UP
    const correction_in = { dx: 0.00, dy: 0.00 };

    const directions = {
      elevation: correction_in.dy === 0 ? "" : (correction_in.dy > 0 ? "UP" : "DOWN"),
      windage: correction_in.dx === 0 ? "" : (correction_in.dx > 0 ? "RIGHT" : "LEFT")
    };

    // True MOA inches per click at distance
    const inchesPerClick = 1.047 * (distanceYards / 100) * moaPerClick;

    const clicks = {
      elevation: inchesPerClick ? (Math.abs(correction_in.dy) / inchesPerClick) : 0,
      windage: inchesPerClick ? (Math.abs(correction_in.dx) / inchesPerClick) : 0
    };

    // 2-decimal rule
    const round2 = (n) => Number((Number(n) || 0).toFixed(2));

    return res.json({
      ok: true,
      secId: String(Date.now()).slice(-6),
      distanceYards,
      moaPerClick,
      image: { width: meta.width || null, height: meta.height || null },

      correction_in: {
        dx: round2(correction_in.dx),
        dy: round2(correction_in.dy)
      },
      directions,
      clicks: {
        elevation: round2(clicks.elevation),
        windage: round2(clicks.windage)
      },

      // placeholders your UI can show now
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

// Listen
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`SCZN3 backend_new listening on ${PORT}`);
});
