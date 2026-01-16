// backend_new/server.js
const express = require("express");
const cors = require("cors");
const multer = require("multer");
const sharp = require("sharp");

const app = express();

// --- CORS (keep permissive for now; lock down later) ---
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

// --- Analyze endpoint (POST) ---
app.post("/api/analyze", upload.single("image"), async (req, res) => {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ ok: false, error: "Missing image file (field name: image)" });
    }

    // Optional inputs (safe defaults)
    const distanceYards = Number(req.body.distanceYards || req.body.distance || 100);
    const moaPerClick = Number(req.body.moaPerClick || 0.25);

    // Read image metadata (proves sharp works, and catches corrupt uploads)
    const meta = await sharp(req.file.buffer).metadata();

    // ------------------------------------------------------------
    // TEMP STUB (until real bullet-hole / POIB logic is wired)
    // We return a valid shape your frontend can render immediately.
    // ------------------------------------------------------------
    const correction_in = {
      // +up means POIB is low -> move impact UP (dial UP)
      up: 0.00,
      // +right means POIB is left -> move impact RIGHT (dial RIGHT)
      right: 0.00
    };

    const directions = {
      elevation: correction_in.up === 0 ? "" : (correction_in.up > 0 ? "UP" : "DOWN"),
      windage: correction_in.right === 0 ? "" : (correction_in.right > 0 ? "RIGHT" : "LEFT")
    };

    // True MOA inches per click at distance
    const inchesPerClick =
      1.047 * (distanceYards / 100) * moaPerClick;

    const clicks = {
      elevation: inchesPerClick ? (Math.abs(correction_in.up) / inchesPerClick) : 0,
      windage: inchesPerClick ? (Math.abs(correction_in.right) / inchesPerClick) : 0
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
        up: round2(correction_in.up),
        right: round2(correction_in.right)
      },
      directions,
      clicks: {
        elevation: round2(clicks.elevation),
        windage: round2(clicks.windage)
      },
      // placeholder score + tip (your frontend can display these now)
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
