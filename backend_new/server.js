// backend_new/server.js
// SCZN3 backend_new — CALC + ANALYZE
// - GET  /health
// - POST /api/calc    (bull - POIB, direction locked, 2 decimals)
// - POST /api/analyze (upload image -> heuristic POIB offsets in inches)

const express = require("express");
const cors = require("cors");
const multer = require("multer");
const Jimp = require("jimp");

const app = express();

app.use(cors({ origin: true, methods: ["GET", "POST", "OPTIONS"] }));
app.use(express.json({ limit: "1mb" }));

// Upload in memory
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

// ---------- helpers ----------
function toNum(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

function dirLR(dx) {
  if (dx > 0) return "RIGHT";
  if (dx < 0) return "LEFT";
  return "NONE";
}

function dirUD(dy) {
  if (dy > 0) return "UP";
  if (dy < 0) return "DOWN";
  return "NONE";
}

function inchesPerMOA(distanceYards, trueMoaOn) {
  const baseAt100 = trueMoaOn ? 1.047 : 1.0;
  return baseAt100 * (distanceYards / 100);
}

// Heuristic: find dark centroid in center region
function estimateDarkCentroid(image) {
  const { width, height, data } = image.bitmap;

  const x0 = Math.floor(width * 0.10);
  const x1 = Math.floor(width * 0.90);
  const y0 = Math.floor(height * 0.10);
  const y1 = Math.floor(height * 0.90);

  const step = Math.max(2, Math.floor(Math.min(width, height) / 500));

  let sumW = 0;
  let sumX = 0;
  let sumY = 0;
  let count = 0;

  for (let y = y0; y < y1; y += step) {
    for (let x = x0; x < x1; x += step) {
      const idx = (width * y + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];

      // luminance
      const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;

      // darker = more weight
      if (lum < 60) {
        const w = 60 - lum;
        sumW += w;
        sumX += x * w;
        sumY += y * w;
        count++;
      }
    }
  }

  if (sumW <= 0 || count < 30) {
    return { cx: width / 2, cy: height / 2, scoreCount: count };
  }
  return { cx: sumX / sumW, cy: sumY / sumW, scoreCount: count };
}

// ---------- routes ----------
app.get("/", (req, res) => {
  res.type("text/plain").send(
    [
      "SCZN3 backend_new is running.",
      "",
      "Endpoints:",
      "GET  /health",
      "POST /api/calc",
      "POST /api/analyze (multipart form-data: image)",
      "",
    ].join("\n")
  );
});

app.get("/health", (req, res) => {
  res.json({ ok: true, service: "sczn3-backend-new" });
});

// POST /api/calc
app.post("/api/calc", (req, res) => {
  try {
    const distanceYards = toNum(req.body?.distanceYards, 100);

    // accept clickValue or clickValueMoa
    let clickValue = toNum(req.body?.clickValue, NaN);
    if (!Number.isFinite(clickValue)) clickValue = toNum(req.body?.clickValueMoa, NaN);
    if (!Number.isFinite(clickValue)) clickValue = 0.25;

    const trueMoa = Boolean(req.body?.trueMoa);

    const bull = req.body?.bull || {};
    const poib = req.body?.poib || {};

    const bullX = toNum(bull.x, 0);
    const bullY = toNum(bull.y, 0);
    const poibX = toNum(poib.x, 0);
    const poibY = toNum(poib.y, 0);

    // rule: correction = bull - POIB
    const dxIn = bullX - poibX; // + RIGHT
    const dyIn = bullY - poibY; // + UP

    const ipm = inchesPerMOA(distanceYards, trueMoa);

    const windMoa = ipm === 0 ? 0 : Math.abs(dxIn) / ipm;
    const elevMoa = ipm === 0 ? 0 : Math.abs(dyIn) / ipm;

    const windClicks = clickValue === 0 ? 0 : windMoa / clickValue;
    const elevClicks = clickValue === 0 ? 0 : elevMoa / clickValue;

    res.json({
      settings: {
        distanceYards: round2(distanceYards),
        clickValueMoa: round2(clickValue),
        trueMoa,
        inchesPerMoa: round2(ipm),
      },
      inputs: {
        bull: { x: round2(bullX), y: round2(bullY) },
        poib: { x: round2(poibX), y: round2(poibY) },
      },
      delta: {
        dxIn: round2(dxIn),
        dyIn: round2(dyIn),
      },
      windage: {
        direction: dirLR(dxIn),
        moa: round2(windMoa),
        clicks: round2(windClicks),
      },
      elevation: {
        direction: dirUD(dyIn),
        moa: round2(elevMoa),
        clicks: round2(elevClicks),
      },
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err?.message || err) });
  }
});

// POST /api/analyze (upload image)
app.post("/api/analyze", upload.single("image"), async (req, res) => {
  try {
    if (!req.file?.buffer) {
      return res.status(400).json({ ok: false, error: "No image uploaded" });
    }

    const img = await Jimp.read(req.file.buffer);

    // Normalize
    img.resize(1200, Jimp.AUTO);
    img.contrast(0.2);

    const { cx, cy, scoreCount } = estimateDarkCentroid(img);

    const w = img.bitmap.width;
    const h = img.bitmap.height;

    // bull assumed at center of image
    const bullPxX = w / 2;
    const bullPxY = h / 2;

    // paper assumption for pixels-per-inch
    const portrait = h >= w;
    const paperW = portrait ? 8.5 : 11;
    const paperH = portrait ? 11 : 8.5;

    const ppiX = w / paperW;
    const ppiY = h / paperH;

    // image coords: +Y is down, so invert for "Up +"
    const dpx = cx - bullPxX;
    const dpy = cy - bullPxY;

    const poibX_in = dpx / ppiX;     // Right +
    const poibY_in = -(dpy / ppiY);  // Up +

    res.json({
      ok: true,
      note: "Heuristic POIB (dark centroid) relative to bull(center).",
      debug: {
        resizedW: w,
        resizedH: h,
        samples: scoreCount,
        portrait,
        ppiX: round2(ppiX),
        ppiY: round2(ppiY),
      },
      bull: { x: 0.0, y: 0.0 },
      poib: { x: round2(poibX_in), y: round2(poibY_in) },
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err?.message || err) });
  }
});

// ---------- start ----------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`SCZN3 backend_new listening on port ${PORT}`);
});
