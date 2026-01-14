/**
 * backend_new/server.js
 *
 * SCZN3 BACKEND — PADLOCKED COORDS (LOCK_V1) + PILOT SCORE (OFFSET_ONLY_V1)
 *
 * Endpoints:
 *   GET  /health
 *   GET  /api/health
 *   POST /api/calc
 *   POST /api/analyze   (multipart form-data: image)
 */

const express = require("express");
const cors = require("cors");
const multer = require("multer");
const Jimp = require("jimp");

// =====================
// PADLOCK STAMP
// =====================
const LOCK_VERSION = "LOCK_V1";
const COORD_SYSTEM = "TARGET_INCHES_X_RIGHT_Y_UP";
const SCORE_VERSION = "OFFSET_ONLY_V1";

// =====================
// APP
// =====================
const app = express();

// CORS: allow your frontend + general testing
app.use(
  cors({
    origin: true,
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type"],
  })
);

app.use(express.json({ limit: "2mb" }));

// Multer (memory)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB
});

// =====================
// HELPERS (LOCKED)
// =====================
function n(v, fallback = 0) {
  const x = Number(v);
  return Number.isFinite(x) ? x : fallback;
}

function f2(v) {
  const x = n(v);
  return Math.round(x * 100) / 100;
}

function clamp(x, lo, hi) {
  const xx = n(x);
  return Math.max(lo, Math.min(hi, xx));
}

function computeOffsetScore(poibX_in, poibY_in) {
  const x = n(poibX_in);
  const y = n(poibY_in);
  const r = Math.sqrt(x * x + y * y); // inches
  const score = clamp(100 * (1 - r / 6), 0, 100);
  return { r_in: r, score };
}

/**
 * LOCKED direction/correction:
 * correction = bull - POIB
 */
function computeCorrection(bullX_in, bullY_in, poibX_in, poibY_in) {
  const dx = n(bullX_in) - n(poibX_in);
  const dy = n(bullY_in) - n(poibY_in);

  return {
    dx,
    dy,
    windageDirection: dx >= 0 ? "RIGHT" : "LEFT",
    elevationDirection: dy >= 0 ? "UP" : "DOWN",
  };
}

/**
 * LOCKED pixel -> inches conversion in TARGET coords
 * image coords: +X right, +Y down
 * target coords: +X right, +Y up
 *
 * poibX_in = (groupX_px - bullX_px)/ppi
 * poibY_in = (bullY_px - groupY_px)/ppi   <-- Y flipped (LOCK)
 */
function pixelsToTargetInches(groupX_px, groupY_px, bullX_px, bullY_px, ppi) {
  const p = n(ppi);
  if (!(p > 0)) return { poibX_in: 0, poibY_in: 0, ppi_used: 0 };

  const poibX_in = (n(groupX_px) - n(bullX_px)) / p;
  const poibY_in = (n(bullY_px) - n(groupY_px)) / p; // LOCK: Y flipped

  return { poibX_in, poibY_in, ppi_used: p };
}

async function analyzeImage(buffer) {
  const img = await Jimp.read(buffer);

  // Normalize size for stable thresholding
  const targetW = 1200;
  if (img.bitmap.width > targetW) img.resize(targetW, Jimp.AUTO);

  const w = img.bitmap.width;
  const h = img.bitmap.height;

  // 1) Bull center = centroid of dark pixels
  let bullSumX = 0,
    bullSumY = 0,
    bullCount = 0;

  // 2) Group center = centroid of orange pixels
  let grpSumX = 0,
    grpSumY = 0,
    grpCount = 0;

  const step = 2;

  for (let y = 0; y < h; y += step) {
    for (let x = 0; x < w; x += step) {
      const { r, g, b } = Jimp.intToRGBA(img.getPixelColor(x, y));

      const brightness = (r + g + b) / 3;
      const isDark = brightness < 70;

      if (isDark) {
        bullSumX += x;
        bullSumY += y;
        bullCount++;
      }

      const isOrange =
        r > 140 && g > 70 && g < 200 && b < 120 && r > g && g > b;

      if (isOrange) {
        grpSumX += x;
        grpSumY += y;
        grpCount++;
      }
    }
  }

  const bullX_px = bullCount > 0 ? bullSumX / bullCount : w / 2;
  const bullY_px = bullCount > 0 ? bullSumY / bullCount : h / 2;

  let groupX_px, groupY_px;

  if (grpCount > 50) {
    groupX_px = grpSumX / grpCount;
    groupY_px = grpSumY / grpCount;
  } else {
    let farSumX = 0,
      farSumY = 0,
      farCount = 0;

    for (let y = 0; y < h; y += step) {
      for (let x = 0; x < w; x += step) {
        const { r, g, b } = Jimp.intToRGBA(img.getPixelColor(x, y));
        const brightness = (r + g + b) / 3;
        const isDark2 = brightness < 60;
        if (!isDark2) continue;

        const dx = x - bullX_px;
        const dy = y - bullY_px;
        const dist2 = dx * dx + dy * dy;

        if (dist2 < 140 * 140) continue;

        farSumX += x;
        farSumY += y;
        farCount++;
      }
    }

    groupX_px = farCount > 0 ? farSumX / farCount : bullX_px;
    groupY_px = farCount > 0 ? farSumY / farCount : bullY_px;
  }

  const ppi_fallback = 100;

  return {
    resizedW: w,
    resizedH: h,
    bull_px: { x: bullX_px, y: bullY_px },
    group_px: { x: groupX_px, y: groupY_px },
    ppi_estimate: ppi_fallback,
    method: grpCount > 50 ? "orange_centroid" : "dark_far_centroid",
    samples: Math.floor((w / step) * (h / step)),
    orangeCount: grpCount,
    darkCount: bullCount,
  };
}

// =====================
// ROUTES
// =====================
app.get(["/health", "/api/health"], (req, res) => {
  res.json({
    ok: true,
    service: "sczn3-backend-new",
    lock_version: LOCK_VERSION,
    coord_system: COORD_SYSTEM,
    score_version: SCORE_VERSION,
    time: new Date().toISOString(),
  });
});

app.post("/api/calc", (req, res) => {
  const bullX = n(req.body?.bull_in?.x, 0);
  const bullY = n(req.body?.bull_in?.y, 0);

  const poibX = n(req.body?.poib_in?.x, 0);
  const poibY = n(req.body?.poib_in?.y, 0);

  const corr = computeCorrection(bullX, bullY, poibX, poibY);
  const scoreObj = computeOffsetScore(poibX, poibY);

  res.json({
    ok: true,
    lock_version: LOCK_VERSION,
    coord_system: COORD_SYSTEM,
    score_version: SCORE_VERSION,

    bull_in: { x: bullX, y: bullY },
    poib_in: { x: poibX, y: poibY },

    correction_in: { dx: f2(corr.dx), dy: f2(corr.dy) },
    directions: {
      windage: corr.windageDirection,
      elevation: corr.elevationDirection,
    },

    offset_in: f2(scoreObj.r_in),
    score: f2(scoreObj.score),
  });
});

app.post("/api/analyze", upload.single("image"), async (req, res) => {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({
        ok: false,
        error: "No image uploaded (field name: image)",
      });
    }

    const a = await analyzeImage(req.file.buffer);

    const bull_in = { x: 0, y: 0 };

    const conv = pixelsToTargetInches(
      a.group_px.x,
      a.group_px.y,
      a.bull_px.x,
      a.bull_px.y,
      a.ppi_estimate
    );

    const poib_in = {
      x: f2(conv.poibX_in),
      y: f2(conv.poibY_in),
    };

    const corr = computeCorrection(bull_in.x, bull_in.y, poib_in.x, poib_in.y);
    const scoreObj = computeOffsetScore(poib_in.x, poib_in.y);

    return res.json({
      ok: true,
      lock_version: LOCK_VERSION,
      coord_system: COORD_SYSTEM,
      score_version: SCORE_VERSION,

      bull_in,
      poib_in,

      correction_in: { dx: f2(corr.dx), dy: f2(corr.dy) },
      directions: {
        windage: corr.windageDirection,
        elevation: corr.elevationDirection,
      },

      offset_in: f2(scoreObj.r_in),
      score: f2(scoreObj.score),

      note:
        "LOCKED: target coords +X right +Y up; poibY uses Y flip; correction = bull - POIB; score = OffsetOnly",
      debug: {
        method: a.method,
        resizedW: a.resizedW,
        resizedH: a.resizedH,
        bull_px: { x: f2(a.bull_px.x), y: f2(a.bull_px.y) },
        group_px: { x: f2(a.group_px.x), y: f2(a.group_px.y) },
        ppi_estimate: a.ppi_estimate,
        orangeCount: a.orangeCount,
        darkCount: a.darkCount,
        samples: a.samples,
      },
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      lock_version: LOCK_VERSION,
      coord_system: COORD_SYSTEM,
      score_version: SCORE_VERSION,
      error: String(err),
    });
  }
});

// =====================
// START
// =====================
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`[sczn3-backend-new] listening on :${PORT}`);
  console.log(`[LOCK] ${LOCK_VERSION} — ${COORD_SYSTEM}`);
  console.log(`[SCORE] ${SCORE_VERSION}`);
});
