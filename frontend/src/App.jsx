import express from "express";
import cors from "cors";
import multer from "multer";
import sharp from "sharp";

const app = express();

// CORS: allow requests from your Static Site + Hoppscotch + local dev
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

// Multer memory storage (we want the raw bytes in RAM)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB
});

// IMPORTANT: field name must be exactly "image"
app.post("/api/sec", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        ok: false,
        error: 'Missing file. Use multipart/form-data field name "image".',
      });
    }

    const img = sharp(req.file.buffer);
    const meta = await img.metadata();

    return res.json({
      ok: true,
      build: "PIPE_v1_2025-12-25",
      received: {
        field: "image",
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
        bytes: req.file.size,
      },
      image: {
        width: meta.width,
        height: meta.height,
        format: meta.format,
      },
      note: "Backend is live. Next: plug in SCZN3 SEC compute + return real payload.",
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: String(err?.message || err),
    });
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`SCZN3 SEC backend listening on ${PORT}`);
});
