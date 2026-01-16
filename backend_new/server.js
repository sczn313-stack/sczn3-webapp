// sczn3-webapp/backend_new/server.js
// Real /api/analyze: detect orange shot marks -> POIB -> correction_in -> directions

const express = require("express");
const cors = require("cors");
const multer = require("multer");
const sharp = require("sharp");

const app = express();

// ---- CORS (safe for Render + static frontend) ----
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type"],
  })
);

app.get("/", (_req, res) => {
  res.status(200).send("SCZN3 backend_new OK");
});

// ---- Multer: memory upload ----
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 12 * 1024 * 1024 }, // 12MB
});

// -------- helpers --------
function num(v, fallback) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

// Orange mask tuned for your orange stickers/markers.
// You can tweak thresholds later.
function isOrange(r, g, b) {
  return (
    r > 150 &&
    g > 70 &&
    b < 140 &&
    r > g + 25 &&
    r > b + 60
  );
}

// Convert pixel delta -> inches using assumed target physical width.
// Default to 8.5" wide (works for common print sizes).
function pxToInches(dxPx, imgW, targetWidthIn) {
  if (!imgW) return 0;
  return (dxPx * targetWidthIn) / imgW;
}

// Directions based on correction = bull - POIB.
// dx > 0 => need move POI RIGHT
// dy > 0 => need move POI DOWN (because +y is down in images)
function directionsFromCorrection(dxIn, dyIn) {
  const windage = dxIn === 0 ? "—" : dxIn > 0 ? "RIGHT" : "LEFT";
  const elevation = dyIn === 0 ? "—" : dyIn > 0 ? "DOWN" : "UP";
  return { windage, elevation };
}

// -------- /api/analyze --------
app.post("/api/analyze", upload.single("image"), async (req, res) => {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ ok: false, error: "No image uploaded." });
    }

    // Optional knobs (you can send these later if you want)
    const distanceYards = num(req.body?.distanceYards, 100);
    const targetWidthIn = num(req.body?.targetWidthIn, 8.5);

    // Decode image to raw pixels (RGB)
    const img = sharp(req.file.buffer, { failOnError: false });
    const meta = await img.metadata();
    const w = meta.width || 0;
    const h = meta.height || 0;

    if (!w || !h) {
      return res.status(400).json({ ok: false, error: "Could not read image dimensions." });
    }

    // Get raw RGB
    const { data, info } = await img
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const channels = info.channels; // should be 3 (RGB)
    if (channels < 3) {
      return res.status(400).json({ ok: false, error: "Unexpected image format (not RGB)." });
    }

    // Sample pixels (stride) to speed up
    const stride = 3; // 1 = best, 3 = faster, 4 = faster
    let sumX = 0;
    let sumY = 0;
    let count = 0;

    // scan every 'stride' pixels
    for (let y = 0; y < h; y += stride) {
      for (let x = 0; x < w; x += stride) {
        const idx = (y * w + x) * channels;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];

        if (isOrange(r, g, b)) {
          sumX += x;
          sumY += y;
          count++;
        }
      }
    }

    // If we found no orange, return a clear message (frontend will show debug)
    if (count < 30) {
      return res.status(200).json({
        ok: true,
        note: "No orange pixels detected. Ensure orange markers are visible and not overexposed.",
        correction_in: null,
        directions: null,
        meta: { w, h, orangeCount: count, distanceYards, targetWidthIn },
      });
    }

    // POIB in pixels
    const poibX = sumX / count;
    const poibY = sumY / count;

    // Bull is the center of the image (good for centered targets)
    const bullX = w / 2;
    const bullY = h / 2;

    // correction = bull - POIB  (your standard)
    const dxPx = bullX - poibX;
    const dyPx = bullY - poibY;

    const dxIn = pxToInches(dxPx, w, targetWidthIn);
    const dyIn = pxToInches(dyPx, w, targetWidthIn); // use width scale to keep square mapping

    const dirs = directionsFromCorrection(dxIn, dyIn);

    return res.status(200).json({
      ok: true,
      note: "Orange POIB detected from image.",
      poib_px: { x: Number(poibX.toFixed(2)), y: Number(poibY.toFixed(2)) },
      bull_px: { x: Number(bullX.toFixed(2)), y: Number(bullY.toFixed(2)) },
      correction_in: { dx: Number(dxIn.toFixed(3)), dy: Number(dyIn.toFixed(3)) },
      directions: dirs,
      meta: { w, h, orangeCount: count, distanceYards, targetWidthIn },
    });
  } catch (e) {
    return res.status(500).json({
      ok: false,
      error: String(e?.message || e),
    });
  }
});

// ---- Render PORT ----
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log("SCZN3 backend_new listening on", PORT);
});
