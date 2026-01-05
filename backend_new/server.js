/**
 * backend_new/server.js
 *
 * SCZN3 BACKEND — PADLOCKED COORDS (LOCK_V1) + SEC IMAGE URL (LOCK_V1_SECIMG)
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
 * SEC IMAGE RULE:
 * - /api/analyze creates a unique PNG and returns sec_image_url.
 * - The PNG includes the uploaded target photo + a clean SEC overlay.
 *
 * Endpoints:
 *   GET  /health
 *   GET  /api/health
 *   POST /api/calc
 *   POST /api/analyze   (multipart form-data: image)
 *   GET  /sec/:file     (serves generated SEC images)
 */

const express = require("express");
const cors = require("cors");
const multer = require("multer");
const Jimp = require("jimp");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

// =====================
// PADLOCK STAMP
// =====================
const LOCK_VERSION = "LOCK_V1";
const COORD_SYSTEM = "TARGET_INCHES_X_RIGHT_Y_UP";
const SEC_LOCK = "LOCK_V1_SECIMG";

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
// FILE OUTPUT (Render-safe)
// =====================
// Render filesystem is ephemeral, but fine for a test preview.
// Store SEC images under /tmp so it always exists.
const SEC_DIR = path.join(process.env.TMPDIR || "/tmp", "sczn3-sec");
fs.mkdirSync(SEC_DIR, { recursive: true });

// Serve the SEC images with no-cache
app.use(
  "/sec",
  express.static(SEC_DIR, {
    setHeaders(res) {
      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
      res.setHeader("Pragma", "no-cache");
      res.setHeader("Expires", "0");
      res.setHeader("Surrogate-Control", "no-store");
    },
  })
);

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
 * True MOA uses 1.047" at 100y; Shooter MOA uses 1.000" at 100y
 */
function inchesPerMOAAtDistance(distanceYards, moaMode) {
  const baseAt100 = (moaMode || "true") === "true" ? 1.047 : 1.0;
  return baseAt100 * (n(distanceYards, 100) / 100);
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

  let groupX_px, groupY_px;

  const bullX_px = bullCount > 0 ? bullSumX / bullCount : w / 2;
  const bullY_px = bullCount > 0 ? bullSumY / bullCount : h / 2;

  if (grpCount > 50) {
    groupX_px = grpSumX / grpCount;
    groupY_px = grpSumY / grpCount;
  } else {
    // fallback: dark pixels far from bull
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

  // PPI fallback (direction doesn't depend on exact ppi)
  const ppi = 100;

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
// SEC IMAGE GENERATION
// =====================
async function buildSecImagePng({
  originalBuffer,
  distanceYards,
  moaPerClick,
  moaMode,
  directions,
  clicks,
}) {
  const img = await Jimp.read(originalBuffer);

  // Normalize for consistent output
  const maxW = 900;
  if (img.bitmap.width > maxW) img.resize(maxW, Jimp.AUTO);

  const w = img.bitmap.width;
  const h = img.bitmap.height;

  // Create a bottom “card strip”
  const stripH = Math.max(180, Math.floor(h * 0.22));
  const canvas = new Jimp(w, h + stripH, 0xffffffff);

  // Put the target photo on top
  canvas.composite(img, 0, 0);

  // Card background (white strip)
  const strip = new Jimp(w, stripH, 0xffffffff);
  canvas.composite(strip, 0, h);

  // Fonts (built-in)
  const fontTitle = await Jimp.loadFont(Jimp.FONT_SANS_32_BLACK);
  const fontBody = await Jimp.loadFont(Jimp.FONT_SANS_24_BLACK);

  // Title
  const title = "Shooter Experience Card (SEC)";
  canvas.print(fontTitle, 18, h + 12, title);

  // Lines (simple, short, no jargon)
  const windLine = `Windage: ${directions.windage} ${f2(clicks.wind)} clicks`;
  const elevLine = `Elevation: ${directions.elevation} ${f2(clicks.elev)} clicks`;
  const distLine = `Distance: ${n(distanceYards, 100)} yd   MOA/click: ${n(moaPerClick, 0.25)}   Mode: ${(moaMode || "true")}`;

  canvas.print(fontBody, 18, h + 60, windLine);
  canvas.print(fontBody, 18, h + 92, elevLine);
  canvas.print(fontBody, 18, h + 130, distLine);

  // Export as PNG buffer
  const out = await canvas.getBufferAsync(Jimp.MIME_PNG);
  return out;
}

function makeFileName() {
  const ts = Date.now();
  const rnd = crypto.randomBytes(6).toString("hex");
  return `SEC_${ts}_${rnd}.png`;
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
    sec_lock: SEC_LOCK,
    time: new Date().toISOString(),
  });
});

/**
 * POST /api/calc
 * body:
 *   bull_in: {x,y} (optional, default 0,0)
 *   poib_in: {x,y} (required)
 */
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

/**
 * POST /api/analyze
 * multipart form-data:
 *   image: file
 *
 * Optional query params for SEC click computation:
 *   distanceYards=100
 *   moaPerClick=0.25
 *   moaMode=true  (true|shooter)
 *
 * Returns:
 *   poib_in (target coords)
 *   correction_in
 *   directions
 *   sec_image_url (PNG)
 */
app.post("/api/analyze", upload.single("image"), async (req, res) => {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ ok: false, error: "No image uploaded (field name: image)" });
    }

    const distanceYards = n(req.query.distanceYards, 100);
    const moaPerClick = n(req.query.moaPerClick, 0.25);
    const moaMode = (String(req.query.moaMode || "true")).toLowerCase() === "shooter" ? "shooter" : "true";

    // Analyze pixels
    const a = await analyzeImage(req.file.buffer);

    // Bull in target coords defined as 0,0
    const bull_in = { x: 0, y: 0 };

    // Convert pixels -> inches in TARGET coords (LOCKED Y flip)
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

    // LOCKED correction and directions
    const corr = computeCorrection(bull_in.x, bull_in.y, poib_in.x, poib_in.y);

    // Click math (absolute values) for SEC image
    const inPerMOA = inchesPerMOAAtDistance(distanceYards, moaMode);
    const windMOA = inPerMOA > 0 ? Math.abs(corr.dx) / inPerMOA : 0;
    const elevMOA = inPerMOA > 0 ? Math.abs(corr.dy) / inPerMOA : 0;

    const windClicks = moaPerClick > 0 ? windMOA / moaPerClick : 0;
    const elevClicks = moaPerClick > 0 ? elevMOA / moaPerClick : 0;

    // Generate SEC image PNG
    const fileName = makeFileName();
    const outPath = path.join(SEC_DIR, fileName);

    const secPng = await buildSecImagePng({
      originalBuffer: req.file.buffer,
      distanceYards,
      moaPerClick,
      moaMode,
      directions: { windage: corr.windageDirection, elevation: corr.elevationDirection },
      clicks: { wind: windClicks, elev: elevClicks },
    });

    fs.writeFileSync(outPath, secPng);

    // Absolute URL for convenience
    const baseUrl = `${req.protocol}://${req.get("host")}`;
    const sec_image_url = `/sec/${fileName}`;
    const sec_image_abs = `${baseUrl}${sec_image_url}?v=${Date.now()}`;

    return res.json({
      ok: true,

      // Padlock stamp
      lock_version: LOCK_VERSION,
      coord_system: COORD_SYSTEM,
      sec_lock: SEC_LOCK,

      // Canonical values
      bull_in,
      poib_in,
      correction_in: { dx: f2(corr.dx), dy: f2(corr.dy) },
      directions: {
        windage: corr.windageDirection,
        elevation: corr.elevationDirection,
      },

      // SEC Image URL (Option 1)
      sec_image_url,
      sec_image_abs,

      // Minimal click info (also useful for UI)
      inputs: { distanceYards, moaPerClick, moaMode },
      clicks: { windage: f2(windClicks), elevation: f2(elevClicks) },

      // Debug info
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
        sec_dir: SEC_DIR,
        sec_file: fileName,
      },
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      lock_version: LOCK_VERSION,
      coord_system: COORD_SYSTEM,
      sec_lock: SEC_LOCK,
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
  console.log(`[SEC] ${SEC_LOCK} — serving /sec from ${SEC_DIR}`);
});
