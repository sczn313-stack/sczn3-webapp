/**
 * backend_new/server.js
 *
 * SCZN3 BACKEND — PADLOCKED COORDS (LOCK_V1)
 *
 * LOCK RULES (DO NOT EDIT WITHOUT UPDATING LOCK_VERSION + TESTS):
 * 1) Target coordinate system is:
 *      +X = RIGHT, +Y = UP
 * 2) POIB inches returned by /api/analyze MUST be in target coords.
 * 3) Correction is ALWAYS:
 *      correction = bull - POIB
 *    where bull is in target coords (usually 0,0), POIB is target coords inches.
 * 4) Backend returns DIRECTIONS (frontend must display, not reinterpret).
 *
 * Endpoints:
 *   GET  /
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

// =====================
// APP
// =====================
const app = express();
app.use(cors());
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

/**
 * Rough heuristic analyzer (direction-safe):
 * - Finds bull center by locating the centroid of "dark" pixels in the image.
 * - Finds group center by locating centroid of "orange-ish" pixels (bullet holes).
 */
async function analyzeImage(buffer) {
  const img = await Jimp.read(buffer);

  // Normalize size for stable thresholding
  const targetW = 1200;
  if (img.bitmap.width > targetW) img.resize(targetW, Jimp.AUTO);

  const w = img.bitmap.width;
  const h = img.bitmap.height;

  // 1) Bull centroid (dark pixels)
  let bullSumX = 0,
    bullSumY = 0,
    bullCount = 0;

  // 2) Group centroid (orange pixels)
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
    // fallback: far-from-bull dark centroid
    let farSumX = 0,
      farSumY = 0,
      farCount = 0;

    for (let y = 0; y < h; y += step) {
      for (let x = 0; x < w; x += step) {
        const { r, g, b } = Jimp.intToRGBA(img.getPixelColor(x, y));
        const brightness = (r + g + b) / 3;
        const isDark = brightness < 60;
        if (!isDark) continue;

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
  const ppi = ppi_fallback;

  return {
    resizedW: w,
    resizedH: h,
    bull_px: { x: bullX_px, y: bullY_px },
    group_px: { x: groupX_px, y: groupY_px },
    ppi_estimate: ppi,
    method: grpCount > 50 ? "orange_centroid" : "dark_far_centroid",
    samples: Math.floor((w / step) * (h / step)),
    orangeCount: grpCount,
    darkCount: bullCount,
  };
}

// =====================
// ROUTES
// =====================

// ✅ PADLOCK: root route so visiting the base URL never shows "Cannot GET /"
app.get("/", (req, res) => {
  res
    .status(200)
    .type("text/plain")
    .send(
      [
        "SCZN3 backend_new is running.",
        "",
        "Padlock:",
        `lock_version: ${LOCK_VERSION}`,
        `coord_system: ${COORD_SYSTEM}`,
        "",
        "Endpoints:",
        "GET  /health",
        "GET  /api/health",
        "POST /api/calc",
        "POST /api/analyze (multipart form-data: image)",
      ].join("\n")
    );
});

app.get(["/health", "/api/health"], (req, res) => {
  res.json({
    ok: true,
    service: "sczn3-backend-new",
    lock_version: LOCK_VERSION,
    coord_system: COORD_SYSTEM,
    time: new Date().toISOString(),
  });
});

app.post("/api/calc", (req, res) => {
  const bullX = n(req.body?.bull_in?.x, 0);
  const bullY = n(req.body?.bull_in?.y, 0);

  const poibX = n(req.body?.poib_in?.x, 0);
  const poibY = n(req.body?.poib_in?.y, 0);

  const corr = computeCorrection(bullX, bullY, poibX, poibY);

  res.json({
    ok: true,
    lock_version: LOCK_VERSION,
    coord_system: COORD_SYSTEM,
    bull_in: { x: bullX, y: bullY },
    poib_in: { x: poibX, y: poibY },
    correction_in: { dx: corr.dx, dy: corr.dy },
    directions: {
      windage: corr.windageDirection,
      elevation: corr.elevationDirection,
    },
  });
});

app.post("/api/analyze", upload.single("image"), async (req, res) => {
  try {
    if (!req.file || !req.file.buffer) {
      return res
        .status(400)
        .json({ ok: false, error: "No image uploaded (field name: image)" });
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

    return res.json({
      ok: true,
      lock_version: LOCK_VERSION,
      coord_system: COORD_SYSTEM,
      bull_in,
      poib_in,
      correction_in: { dx: f2(corr.dx), dy: f2(corr.dy) },
      directions: {
        windage: corr.windageDirection,
        elevation: corr.elevationDirection,
      },
      note: "LOCKED: target coords +X right +Y up; poibY uses Y flip; correction = bull - POIB",
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
});
