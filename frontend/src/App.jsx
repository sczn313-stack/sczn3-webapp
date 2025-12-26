import express from "express";
import cors from "cors";
import multer from "multer";
import sharp from "sharp";

const app = express();

// ---- CORS ----
// Accept requests from your static site + Hoppscotch + local dev.
// (Render will set the host; we also allow any origin for now.)
app.use(
  cors({
    origin: true,
    credentials: false,
  })
);

// Health check
app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "sczn3-sec-backend-pipe", ts: Date.now() });
});

// Multer in-memory upload
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB
});

// ---- SCZN3 SEC Endpoint ----
// EXPECTS multipart/form-data with field name "image"
app.post("/api/sec", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        ok: false,
        error: 'No file received. Field name must be exactly "image".',
      });
    }

    const img = sharp(req.file.buffer);
    const meta = await img.metadata();

    // ✅ SEC-shaped payload (this is what the frontend should use)
    // For now the "compute" section is a stub with zeros,
    // but it’s structured like the real output.
    const payload = {
      ok: true,
      build: process.env.BUILD_ID || "PIPE_v1_2025-12-25",
      received: {
        field: "image",
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
        bytes: req.file.size,
      },
      image: {
        width: meta.width || null,
        height: meta.height || null,
        format: meta.format || null,
      },

      // ---- SCZN3 "SEC compute" placeholder ----
      // Next step after this commit: plug real POIB + click math here.
      sec: {
        defaults: {
          distanceYards: 100,
          clickValueMoa: 0.25,
          outputPrecision: 2,
        },
        poib: {
          // inches from center (+Right, +Up)
          xIn: 0.0,
          yIn: 0.0,
        },
        adjustment: {
          // clicks (+Right, +Up) or convert to your naming
          windageClicks: 0.0,
          elevationClicks: 0.0,
        },
        note:
          "SEC payload shape is live. Next: replace poib + adjustment with real SCZN3 compute.",
      },
    };

    return res.json(payload);
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: err?.message || "Server error",
    });
  }
});

// Render port
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`SCZN3 SEC backend listening on ${PORT}`);
});
