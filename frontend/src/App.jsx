import express from "express";
import cors from "cors";
import multer from "multer";
import sharp from "sharp";

const app = express();

// Allow your static site(s) + Hoppscotch + local dev
app.use(
  cors({
    origin: true,
    credentials: false,
  })
);

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "sczn3-sec-backend-pipe", ts: Date.now() });
});

// IMPORTANT: use memory storage so we can pass buffer to sharp/compute
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB
});

// ---- SCZN3 defaults (v1.2) ----
const DEFAULT_DISTANCE_YARDS = 100;
const DEFAULT_CLICK_MOA = 0.25;

// Placeholder compute hook (swap later with real POIB/cluster math)
function computeSecPayload({ width, height }) {
  // For now: return a “real-shaped” payload that your frontend can render.
  // Replace these with actual SCZN3 compute results later.
  return {
    distance_yards: DEFAULT_DISTANCE_YARDS,
    click_moa: DEFAULT_CLICK_MOA,

    // Placeholder numbers
    poib_inches: { x: 0.0, y: 0.0 }, // +x = right, +y = up (example convention)
    adjustment: {
      windage: { direction: "R", clicks: 0.0, moa: 0.0 },
      elevation: { direction: "U", clicks: 0.0, moa: 0.0 },
    },

    // UI hooks
    smart_score: null,
    percent_change_vs_last: null,

    // Debug info you can remove later
    debug: {
      image_width: width,
      image_height: height,
      note: "Stub payload. Plug in SCZN3 compute next.",
    },
  };
}

app.post("/api/sec", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        ok: false,
        error: 'No file uploaded. Use multipart field name: "image".',
      });
    }

    // Read image meta
    const meta = await sharp(req.file.buffer).metadata();

    const received = {
      field: req.file.fieldname,
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      bytes: req.file.size,
    };

    const image = {
      width: meta.width || null,
      height: meta.height || null,
      format: meta.format || null,
    };

    // Build SCZN3 SEC payload
    const sec = computeSecPayload({
      width: image.width,
      height: image.height,
    });

    return res.json({
      ok: true,
      build: "PIPE_v2_SEC_PAYLOAD",
      received,
      image,
      sec,
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: "Server error during /api/sec",
      details: String(err?.message || err),
    });
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`SCZN3 SEC backend running on port ${PORT}`);
});
