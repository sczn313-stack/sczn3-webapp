// backend_new/server.js
// SCZN3 backend (fresh build) — Analyze target image and return correction_in + directions
// Correction convention: correction = bull(center) - POIB(impact centroid)

const express = require("express");
const cors = require("cors");
const multer = require("multer");
const Jimp = require("jimp");

const app = express();

// ---------- CORS ----------
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || ""; // e.g. https://sczn3-frontend-new.onrender.com
app.use(
  cors({
    origin: FRONTEND_ORIGIN ? [FRONTEND_ORIGIN] : true,
    credentials: false,
  })
);

// ---------- Upload ----------
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 12 * 1024 * 1024 }, // 12MB
});

// ---------- Health ----------
app.get("/", (_req, res) => {
  res.type("text/plain").send("SCZN3 backend_new OK");
});

// Helpful message (so you don't see "Cannot GET /api/analyze")
app.get("/api/analyze", (_req, res) => {
  res
    .status(200)
    .json({ ok: true, note: "Use POST /api/analyze with multipart form-data field 'image'." });
});

// ---------- Core Analyze ----------
app.post("/api/analyze", upload.single("image"), async (req, res) => {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ ok: false, error: "Missing image file (field name must be 'image')." });
    }

    // Optional calibration: pixels-per-inch (PPI)
    // If you don't supply this, we assume 100 px per inch (demo default).
    // You can send as form field: pixelsPerInch
    const ppi = clampNum(Number(req.body?.pixelsPerInch || process.env.PIXELS_PER_INCH || 100), 10, 2000);

    // Read image
    const img = await Jimp.read(req.file.buffer);
    const w = img.bitmap.width;
    const h = img.bitmap.height;

    // Bull is assumed center of image
    const cx = w / 2;
    const cy = h / 2;

    // Detect orange pixels (tap dots / hit markers)
    // Thresholds tuned for orange-ish markers:
    // - R high
    // - G medium
    // - B low
    // - and some saturation guard (R-G difference)
    let sumX = 0;
    let sumY = 0;
    let count = 0;

    // Speed: sample every N pixels
    const step = clampNum(Number(req.body?.sampleStep || process.env.SAMPLE_STEP || 2), 1, 12);

    for (let y = 0; y < h; y += step) {
      for (let x = 0; x < w; x += step) {
        const rgba = Jimp.intToRGBA(img.getPixelColor(x, y));
        const r = rgba.r, g = rgba.g, b = rgba.b;

        // "Orange" heuristic
        const isOrange =
          r >= 160 &&
          g >= 70 &&
          g <= 190 &&
          b <= 120 &&
          (r - g) >= 25 &&
          (g - b) >= 20;

        if (isOrange) {
          sumX += x;
          sumY += y;
          count++;
        }
      }
    }

    // If nothing detected, return explicit nulls (but still ok:true)
    if (count < 30) {
      return res.status(200).json({
        ok: true,
        note: "No orange cluster detected (raise marker contrast or lower thresholds).",
        correction_in: null,
        directions: null,
        debug: {
          w, h, ppi, sampleStep: step, orangeCount: count,
        },
      });
    }

    // POIB centroid (in pixels)
    const px = sumX / count;
    const py = sumY / count;

    // Correction vector (center - POIB), converted to inches
    const dx_in = (cx - px) / ppi; // + means dial RIGHT to move impacts RIGHT
    const dy_in = (cy - py) / ppi; // + means dial UP to move impacts UP

    // Directions based on correction sign
    const windageDir = dx_in > 0 ? "RIGHT" : dx_in < 0 ? "LEFT" : "";
    const elevationDir = dy_in > 0 ? "UP" : dy_in < 0 ? "DOWN" : "";

    res.status(200).json({
      ok: true,
      correction_in: {
        dx: round4(dx_in),
        dy: round4(dy_in),
      },
      directions: {
        windage: windageDir,
        elevation: elevationDir,
      },
      debug: {
        w,
        h,
        ppi,
        sampleStep: step,
        orangeCount: count,
        center_px: { x: round2(cx), y: round2(cy) },
        poib_px: { x: round2(px), y: round2(py) },
      },
    });
  } catch (err) {
    res.status(500).json({
      ok: false,
      error: "Analyze failed",
      detail: String(err && err.message ? err.message : err),
    });
  }
});

// ---------- Start ----------
const PORT = Number(process.env.PORT || 3000);
app.listen(PORT, () => {
  console.log(`SCZN3 backend_new listening on port ${PORT}`);
});

// ---------- helpers ----------
function clampNum(n, lo, hi) {
  if (!Number.isFinite(n)) return lo;
  return Math.max(lo, Math.min(hi, n));
}
function round2(n) {
  return Math.round(n * 100) / 100;
}
function round4(n) {
  return Math.round(n * 10000) / 10000;
}
