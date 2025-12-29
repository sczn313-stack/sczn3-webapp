/**
 * server.js — SCZN3 SEC Backend (PIPE) — Deterministic Directions
 *
 * Conventions enforced:
 * - POIB inches: Right +, Left -, Up +, Down -
 * - Image pixel Y grows DOWN, but POIB Y must grow UP  (flip exactly once)
 * - clicksSigned are CORRECTION clicks (what to dial): correction = -POIB
 * - Dial text is derived ONLY from clicksSigned signs
 *
 * Endpoint:
 * - POST /api/sec  (multipart form-data field: "image")
 *   fields:
 *     - distanceYards (number)
 *     - clickValueMoa (number)
 *     - targetSizeInches (number)  // LONG SIDE ONLY (ex: 11 for 8.5x11)
 */

const express = require("express");
const cors = require("cors");
const multer = require("multer");
const sharp = require("sharp");

const BUILD_TAG = "PIPE_DETERMINISTIC_DIR_v1";
const SERVICE_NAME = "sczn3-sec-backend-pipe";

const app = express();

// CORS (allow browser static site)
app.use(
  cors({
    origin: true,
    credentials: false,
  })
);

// Always JSON (avoid HTML error pages)
app.use((req, res, next) => {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  next();
});

app.get("/health", (req, res) => {
  res.status(200).send(JSON.stringify({ ok: true, service: SERVICE_NAME, build: BUILD_TAG }));
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 }, // 8MB
});

function num(v, fallback = NaN) {
  const x = Number(v);
  return Number.isFinite(x) ? x : fallback;
}

function round2(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return 0;
  return Math.round(x * 100) / 100;
}

function fmt2(n) {
  return round2(n).toFixed(2);
}

function inchesPerMoaAtYards(yards) {
  // True MOA
  return 1.047 * (yards / 100);
}

function dialFromSignedClicks(clicksSigned) {
  const w = num(clicksSigned.windage, 0);
  const e = num(clicksSigned.elevation, 0);

  const windDir = w > 0 ? "RIGHT" : w < 0 ? "LEFT" : "CENTER";
  const elevDir = e > 0 ? "UP" : e < 0 ? "DOWN" : "LEVEL";

  return {
    windage: windDir === "CENTER" ? "CENTER 0.00 clicks" : `${windDir} ${fmt2(Math.abs(w))} clicks`,
    elevation: elevDir === "LEVEL" ? "LEVEL 0.00 clicks" : `${elevDir} ${fmt2(Math.abs(e))} clicks`,
  };
}

/**
 * Minimal deterministic image-to-target mapping:
 * - Detect corner fiducials (dark blobs) in 4 corner windows
 * - Map pixels -> inches using linear scaling:
 *    xIn = (x - xLeft) / (xRight - xLeft) * widthIn
 *    yIn = (y - yTop)  / (yBottom - yTop) * heightIn
 *
 * Assumes the photo is not wildly skewed. (This is your PIPE sanity backend.)
 */
async function extractRawGrayscale(buffer) {
  // Normalize orientation + size a bit for consistent detection
  const normalized = sharp(buffer).rotate().resize({ width: 1400, withoutEnlargement: true });
  const meta = await normalized.metadata();
  const w = meta.width || 0;
  const h = meta.height || 0;

  const raw = await normalized
    .grayscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  return {
    width: w,
    height: h,
    data: raw.data, // Uint8 values (0..255)
  };
}

function centroidOfDarkPixels(gray, width, height, x0, y0, x1, y1, thr = 40) {
  // returns {x,y,count} in pixel coords or null
  let sx = 0,
    sy = 0,
    c = 0;

  const ix0 = Math.max(0, Math.floor(x0));
  const iy0 = Math.max(0, Math.floor(y0));
  const ix1 = Math.min(width - 1, Math.floor(x1));
  const iy1 = Math.min(height - 1, Math.floor(y1));

  for (let y = iy0; y <= iy1; y++) {
    const row = y * width;
    for (let x = ix0; x <= ix1; x++) {
      const v = gray[row + x];
      if (v <= thr) {
        sx += x;
        sy += y;
        c++;
      }
    }
  }

  if (c < 50) return null; // too few pixels
  return { x: sx / c, y: sy / c, count: c };
}

function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}

function computeCornerFiducials(gray, width, height) {
  // Search in corner windows for dark fiducial blobs.
  const wx = Math.floor(width * 0.18);
  const wy = Math.floor(height * 0.18);

  const tl = centroidOfDarkPixels(gray, width, height, 0, 0, wx, wy);
  const tr = centroidOfDarkPixels(gray, width, height, width - wx, 0, width - 1, wy);
  const bl = centroidOfDarkPixels(gray, width, height, 0, height - wy, wx, height - 1);
  const br = centroidOfDarkPixels(gray, width, height, width - wx, height - wy, width - 1, height - 1);

  return { tl, tr, bl, br };
}

function pxToInchesMapper(corners, targetWIn, targetHIn) {
  // Use TL/TR for x-range and TL/BL for y-range.
  // Fallback to whichever corners exist.
  const tl = corners.tl;
  const tr = corners.tr;
  const bl = corners.bl;
  const br = corners.br;

  const xLeft = tl?.x ?? bl?.x ?? 0;
  const xRight = tr?.x ?? br?.x ?? 1;
  const yTop = tl?.y ?? tr?.y ?? 0;
  const yBottom = bl?.y ?? br?.y ?? 1;

  const dx = Math.max(1, xRight - xLeft);
  const dy = Math.max(1, yBottom - yTop);

  return (px) => {
    const xn = (px.x - xLeft) / dx;
    const yn = (px.y - yTop) / dy;

    const xIn = clamp(xn, 0, 1) * targetWIn;
    const yIn = clamp(yn, 0, 1) * targetHIn;
    return { xIn, yIn };
  };
}

function detectBulletHolesSimple(gray, width, height) {
  /**
   * Very simple “dark blob” hole finder:
   * - Threshold dark pixels
   * - Ignore corner windows (fiducials + QR)
   * - Flood fill connected components
   * - Keep components within area bounds
   */
  const thr = 70;
  const visited = new Uint8Array(width * height);

  const ignoreMarginX = Math.floor(width * 0.14);
  const ignoreMarginY = Math.floor(height * 0.14);

  function inIgnoreZone(x, y) {
    const left = x < ignoreMarginX;
    const right = x > width - 1 - ignoreMarginX;
    const top = y < ignoreMarginY;
    const bottom = y > height - 1 - ignoreMarginY;

    // ignore the 4 corners (fiducials + QR region)
    if ((left && top) || (right && top) || (left && bottom) || (right && bottom)) return true;
    return false;
  }

  const components = [];
  const stack = [];

  for (let y = 0; y < height; y++) {
    const row = y * width;
    for (let x = 0; x < width; x++) {
      const idx = row + x;
      if (visited[idx]) continue;
      visited[idx] = 1;

      if (inIgnoreZone(x, y)) continue;

      const v = gray[idx];
      if (v > thr) continue;

      // start new component
      let minX = x,
        maxX = x,
        minY = y,
        maxY = y;
      let area = 0;
      let sx = 0,
        sy = 0;

      stack.push({ x, y });

      while (stack.length) {
        const p = stack.pop();
        const px = p.x;
        const py = p.y;
        const pidx = py * width + px;

        // pixel qualifies?
        if (gray[pidx] > thr) continue;

        area++;
        sx += px;
        sy += py;

        if (px < minX) minX = px;
        if (px > maxX) maxX = px;
        if (py < minY) minY = py;
        if (py > maxY) maxY = py;

        // neighbors 4-dir
        const nbrs = [
          { x: px - 1, y: py },
          { x: px + 1, y: py },
          { x: px, y: py - 1 },
          { x: px, y: py + 1 },
        ];

        for (const n of nbrs) {
          if (n.x < 0 || n.x >= width || n.y < 0 || n.y >= height) continue;
          const nidx = n.y * width + n.x;
          if (visited[nidx]) continue;
          visited[nidx] = 1;
          if (!inIgnoreZone(n.x, n.y)) stack.push(n);
        }
      }

      // area filter (tuned for resized images)
      // too small = noise, too big = rings/lines blocks
      if (area >= 30 && area <= 900) {
        const cx = sx / area;
        const cy = sy / area;
        components.push({ cx, cy, area, bbox: { minX, minY, maxX, maxY } });
      }
    }
  }

  // choose top N by area (holes tend to be darker, mid-sized blobs)
  components.sort((a, b) => b.area - a.area);
  return components.slice(0, 8);
}

app.post("/api/sec", upload.single("image"), async (req, res) => {
  try {
    if (!req.file?.buffer) {
      res.status(400).send(
        JSON.stringify({
          ok: false,
          service: SERVICE_NAME,
          build: BUILD_TAG,
          error: { code: "NO_IMAGE", message: 'multipart form-data field "image" is required' },
        })
      );
      return;
    }

    const distanceYards = num(req.body.distanceYards, NaN);
    const clickValueMoa = num(req.body.clickValueMoa, NaN);
    const targetSizeInches = num(req.body.targetSizeInches, NaN);

    if (!Number.isFinite(distanceYards) || distanceYards <= 0) {
      res.status(400).send(
        JSON.stringify({
          ok: false,
          service: SERVICE_NAME,
          build: BUILD_TAG,
          error: { code: "BAD_DISTANCE", message: "distanceYards must be > 0" },
        })
      );
      return;
    }

    if (!Number.isFinite(clickValueMoa) || clickValueMoa <= 0) {
      res.status(400).send(
        JSON.stringify({
          ok: false,
          service: SERVICE_NAME,
          build: BUILD_TAG,
          error: { code: "BAD_CLICK", message: "clickValueMoa must be > 0" },
        })
      );
      return;
    }

    if (!Number.isFinite(targetSizeInches) || targetSizeInches <= 0) {
      res.status(400).send(
        JSON.stringify({
          ok: false,
          service: SERVICE_NAME,
          build: BUILD_TAG,
          error: { code: "BAD_TARGET_SIZE", message: "targetSizeInches must be > 0 (long side only)" },
        })
      );
      return;
    }

    // In PIPE mode, we treat targetSizeInches as LONG SIDE.
    // We infer aspect as 8.5x11 if long ~ 11, else square long x long.
    const long = targetSizeInches;
    const isElevenish = Math.abs(long - 11) < 0.25;

    const targetWIn = isElevenish ? 8.5 : long;
    const targetHIn = isElevenish ? 11.0 : long;

    // Bull position (inches):
    // - 8.5x11 Grid v1 bull at (4.25, 5.50)
    // - Square default bull at center (long/2, long/2)
    const bull = isElevenish
      ? { x: 4.25, y: 5.5 }
      : { x: long / 2, y: long / 2 };

    const img = await extractRawGrayscale(req.file.buffer);
    const corners = computeCornerFiducials(img.data, img.width, img.height);

    // If we can't find corners, fail fast (don’t output junk directions)
    if (!corners.tl || !corners.tr || !corners.bl) {
      res.status(422).send(
        JSON.stringify({
          ok: false,
          service: SERVICE_NAME,
          build: BUILD_TAG,
          computeStatus: "FAILED_FIDUCIALS",
          error: {
            code: "FIDUCIALS_NOT_FOUND",
            message: "Could not reliably detect corner fiducials. Retake photo or improve contrast.",
          },
          detect: {
            normalized: { width: img.width, height: img.height },
            corners,
          },
          sec: { distanceYards, clickValueMoa, targetSizeInches: long },
        })
      );
      return;
    }

    const mapPxToIn = pxToInchesMapper(corners, targetWIn, targetHIn);

    const holes = detectBulletHolesSimple(img.data, img.width, img.height);
    if (!holes.length) {
      res.status(422).send(
        JSON.stringify({
          ok: false,
          service: SERVICE_NAME,
          build: BUILD_TAG,
          computeStatus: "FAILED_HOLES",
          error: {
            code: "HOLES_NOT_FOUND",
            message: "No bullet holes detected. Use a clearer photo or darker backer.",
          },
          detect: {
            normalized: { width: img.width, height: img.height },
            corners,
            holesDetected: 0,
          },
          sec: { distanceYards, clickValueMoa, targetSizeInches: long },
        })
      );
      return;
    }

    // Group center in pixels = average of hole centroids
    let sx = 0,
      sy = 0;
    for (const h of holes) {
      sx += h.cx;
      sy += h.cy;
    }
    const groupCenterPx = { x: sx / holes.length, y: sy / holes.length };

    const groupCenterIn = mapPxToIn(groupCenterPx);

    // POIB (cluster relative to bull), inches:
    // x: Right + ; y: Up +  (flip Y exactly once here)
    const dxIn = groupCenterIn.xIn - bull.x;
    const dyImgIn = groupCenterIn.yIn - bull.y; // image-space inches (down +)
    const poibX = dxIn;
    const poibY = -dyImgIn; // flip: down becomes negative (Down -), up becomes positive (Up +)

    // Correction inches = move impact to bull => -POIB
    const corrX = -poibX;
    const corrY = -poibY;

    const inchesPerClick = inchesPerMoaAtYards(distanceYards) * clickValueMoa;

    const clicksSigned = {
      windage: round2(corrX / inchesPerClick),
      elevation: round2(corrY / inchesPerClick),
    };

    const dial = dialFromSignedClicks(clicksSigned);

    res.status(200).send(
      JSON.stringify({
        ok: true,
        service: SERVICE_NAME,
        build: BUILD_TAG,
        received: {
          field: "image",
          originalname: req.file.originalname,
          mimetype: req.file.mimetype,
          bytes: req.file.size,
        },
        sec: {
          distanceYards,
          clickValueMoa,
          targetSizeInches: long,
          inferred: { targetWIn, targetHIn, bullIn: bull },
        },
        computeStatus: "COMPUTED_FROM_IMAGE",
        poibInches: {
          x: round2(poibX),
          y: round2(poibY),
        },
        clicksSigned,
        dial,
        detect: {
          normalized: { width: img.width, height: img.height },
          corners,
          groupCenterPx,
          holesDetected: holes.length,
          holes: holes.map((h) => ({ cx: round2(h.cx), cy: round2(h.cy), area: h.area })),
        },
      })
    );
  } catch (err) {
    res.status(500).send(
      JSON.stringify({
        ok: false,
        service: SERVICE_NAME,
        build: BUILD_TAG,
        error: { code: "SERVER_ERROR", message: String(err?.message || err) },
      })
    );
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`${SERVICE_NAME} listening on ${PORT} build=${BUILD_TAG}`);
});
