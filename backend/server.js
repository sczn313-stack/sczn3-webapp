// server.js
import express from "express";
import cors from "cors";
import multer from "multer";
import sharp from "sharp";

const app = express();

app.use(cors());
app.use(express.json({ limit: "2mb" }));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 }, // 8MB
});

// =====================
// SCZN3 defaults (v1.2)
// =====================
const DISTANCE_YARDS = Number(process.env.DISTANCE_YARDS ?? 100);
const MOA_PER_CLICK = Number(process.env.MOA_PER_CLICK ?? 0.25);
const TARGET_WIDTH_IN = Number(process.env.TARGET_WIDTH_IN ?? 23);

// Image/detection tuning (override via Render env vars if needed)
const MAX_W = Number(process.env.MAX_W ?? 1400);                 // resize width for speed
const INK_PAD_PCT = Number(process.env.INK_PAD_PCT ?? 0.03);     // padding around detected target bbox
const OTSU_CLAMP_MIN = Number(process.env.OTSU_CLAMP_MIN ?? 35); // clamp threshold range
const OTSU_CLAMP_MAX = Number(process.env.OTSU_CLAMP_MAX ?? 150);

const MIN_SHOTS = Number(process.env.MIN_SHOTS ?? 3);
const MAX_SHOTS = Number(process.env.MAX_SHOTS ?? 7);

// Blob filtering (these are conservative; tune if needed)
const MIN_AREA_PCT = Number(process.env.MIN_AREA_PCT ?? 0.00003); // min blob area as pct of target area
const MAX_AREA_PCT = Number(process.env.MAX_AREA_PCT ?? 0.006);   // max blob area as pct of target area
const MAX_ASPECT = Number(process.env.MAX_ASPECT ?? 3.0);         // exclude long lines
const MIN_FILL = Number(process.env.MIN_FILL ?? 0.20);            // exclude outlines/very hollow shapes

app.get("/", (req, res) => {
  res.status(200).send("SCZN3 SEC Backend is up");
});

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    routes: ["GET /", "GET /api/health", "POST /api/upload", "POST /api/sec"],
    config: { DISTANCE_YARDS, MOA_PER_CLICK, TARGET_WIDTH_IN },
  });
});

app.post("/api/upload", upload.single("file"), (req, res) => {
  if (!req.file) {
    return res
      .status(400)
      .json({ ok: false, error: "No file received (field name must be: file)" });
  }
  res.json({
    ok: true,
    received: {
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
    },
  });
});

// ---------- helpers ----------
function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

function inchesPerMOA(distanceYds) {
  return 1.047 * (distanceYds / 100);
}

// Otsu threshold on grayscale bytes (0..255)
function otsuThreshold(gray) {
  const hist = new Uint32Array(256);
  for (let i = 0; i < gray.length; i++) hist[gray[i]]++;

  const total = gray.length;
  let sum = 0;
  for (let t = 0; t < 256; t++) sum += t * hist[t];

  let sumB = 0;
  let wB = 0;
  let wF = 0;

  let varMax = -1;
  let threshold = 90;

  for (let t = 0; t < 256; t++) {
    wB += hist[t];
    if (wB === 0) continue;

    wF = total - wB;
    if (wF === 0) break;

    sumB += t * hist[t];

    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;

    const between = wB * wF * (mB - mF) * (mB - mF);
    if (between > varMax) {
      varMax = between;
      threshold = t;
    }
  }

  return threshold;
}

function findBBoxNotWhite(gray, w, h, notWhiteThresh = 235) {
  let minX = w,
    minY = h,
    maxX = -1,
    maxY = -1;

  for (let i = 0; i < gray.length; i++) {
    if (gray[i] < notWhiteThresh) {
      const x = i % w;
      const y = (i / w) | 0;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }

  if (maxX < 0) return null;
  return { minX, minY, maxX, maxY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

function connectedComponents(mask, w, h, region) {
  const visited = new Uint8Array(w * h);
  const comps = [];

  const { minX, minY, maxX, maxY } = region;

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const i0 = y * w + x;
      if (!mask[i0] || visited[i0]) continue;

      const stack = [i0];
      visited[i0] = 1;

      let area = 0;
      let sumX = 0;
      let sumY = 0;
      let bx0 = w,
        by0 = h,
        bx1 = -1,
        by1 = -1;

      while (stack.length) {
        const i = stack.pop();
        area++;

        const ix = i % w;
        const iy = (i / w) | 0;

        sumX += ix;
        sumY += iy;

        if (ix < bx0) bx0 = ix;
        if (iy < by0) by0 = iy;
        if (ix > bx1) bx1 = ix;
        if (iy > by1) by1 = iy;

        // 4-neighbors
        const left = i - 1;
        const right = i + 1;
        const up = i - w;
        const down = i + w;

        if (ix > minX && mask[left] && !visited[left]) {
          visited[left] = 1;
          stack.push(left);
        }
        if (ix < maxX && mask[right] && !visited[right]) {
          visited[right] = 1;
          stack.push(right);
        }
        if (iy > minY && mask[up] && !visited[up]) {
          visited[up] = 1;
          stack.push(up);
        }
        if (iy < maxY && mask[down] && !visited[down]) {
          visited[down] = 1;
          stack.push(down);
        }
      }

      const bw = bx1 - bx0 + 1;
      const bh = by1 - by0 + 1;
      const fill = area / (bw * bh);
      const aspect = Math.max(bw / bh, bh / bw);

      comps.push({
        area,
        cx: sumX / area,
        cy: sumY / area,
        bx0,
        by0,
        bx1,
        by1,
        bw,
        bh,
        fill,
        aspect,
      });
    }
  }

  return comps;
}

function pickTightest(points, kMax) {
  if (points.length <= kMax) return points;

  const mx = points.reduce((a, p) => a + p.cx, 0) / points.length;
  const my = points.reduce((a, p) => a + p.cy, 0) / points.length;

  return points
    .map((p) => ({ p, d2: (p.cx - mx) ** 2 + (p.cy - my) ** 2 }))
    .sort((a, b) => a.d2 - b.d2)
    .slice(0, kMax)
    .map((x) => x.p);
}

// ---------- REAL SEC ----------
app.post("/api/sec", upload.single("file"), async (req, res) => {
  try {
    if (!req.file?.buffer) {
      return res
        .status(400)
        .json({ ok: false, error: "No image uploaded. Field name must be: file" });
    }

    const img = sharp(req.file.buffer).rotate();
    const meta = await img.metadata();

    const { data, info } = await img
      .resize({ width: MAX_W, withoutEnlargement: true })
      .grayscale()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const w = info.width;
    const h = info.height;

    // Find a broad target region via "not-white" pixels
    const inkBox = findBBoxNotWhite(data, w, h, 235);
    if (!inkBox || inkBox.width < 200 || inkBox.height < 200) {
      return res.status(422).json({
        ok: false,
        error: "Could not find target region. Use a clearer photo with the full target in frame.",
      });
    }

    // Pad bbox slightly, then force a square crop (SCZN3 target is square)
    const padX = Math.round(inkBox.width * INK_PAD_PCT);
    const padY = Math.round(inkBox.height * INK_PAD_PCT);

    let minX = clamp(inkBox.minX - padX, 0, w - 1);
    let minY = clamp(inkBox.minY - padY, 0, h - 1);
    let maxX = clamp(inkBox.maxX + padX, 0, w - 1);
    let maxY = clamp(inkBox.maxY + padY, 0, h - 1);

    const bw = maxX - minX + 1;
    const bh = maxY - minY + 1;
    const side = Math.min(bw, bh);

    const cx = minX + bw / 2;
    const cy = minY + bh / 2;

    minX = clamp(Math.round(cx - side / 2), 0, w - side);
    minY = clamp(Math.round(cy - side / 2), 0, h - side);
    maxX = minX + side - 1;
    maxY = minY + side - 1;

    const region = { minX, minY, maxX, maxY, width: side, height: side };
    const targetCx = minX + side / 2;
    const targetCy = minY + side / 2;

    // Threshold for dark pixels using Otsu within region
    // Build a sample array to compute Otsu (region only)
    const regionGray = [];
    regionGray.length = region.width * region.height;
    let k = 0;
    for (let y = minY; y <= maxY; y++) {
      const row = y * w;
      for (let x = minX; x <= maxX; x++) {
        regionGray[k++] = data[row + x];
      }
    }

    let t = otsuThreshold(regionGray);
    t = clamp(t, OTSU_CLAMP_MIN, OTSU_CLAMP_MAX);

    // Build binary mask of "dark" pixels in region
    const mask = new Uint8Array(w * h);
    for (let y = minY; y <= maxY; y++) {
      const row = y * w;
      for (let x = minX; x <= maxX; x++) {
        const i = row + x;
        mask[i] = data[i] < t ? 1 : 0;
      }
    }

    const comps = connectedComponents(mask, w, h, region);

    const targetArea = region.width * region.height;
    const minArea = Math.round(targetArea * MIN_AREA_PCT);
    const maxArea = Math.round(targetArea * MAX_AREA_PCT);

    // Candidate filtering (avoid gridlines/text as best as possible)
    const candidates = comps.filter((c) => {
      if (c.area < minArea || c.area > maxArea) return false;
      if (c.aspect > MAX_ASPECT) return false;
      if (c.fill < MIN_FILL) return false;

      // Reject blobs too close to region border (often borders/labels)
      const margin = Math.max(8, Math.round(region.width * 0.01));
      if (c.bx0 <= minX + margin) return false;
      if (c.by0 <= minY + margin) return false;
      if (c.bx1 >= maxX - margin) return false;
      if (c.by1 >= maxY - margin) return false;

      return true;
    });

    if (candidates.length < MIN_SHOTS) {
      return res.status(422).json({
        ok: false,
        error: `Not enough shots detected (${candidates.length}). Need at least ${MIN_SHOTS}.`,
        debug: { threshold: t, minArea, maxArea, region, candidates: candidates.length },
      });
    }

    const cluster = pickTightest(candidates, Math.min(MAX_SHOTS, candidates.length));

    // POI balance (centroid of cluster)
    const poiX = cluster.reduce((a, p) => a + p.cx, 0) / cluster.length;
    const poiY = cluster.reduce((a, p) => a + p.cy, 0) / cluster.length;

    // Pixel offsets from target center (+right, +down)
    const dxPx = poiX - targetCx;
    const dyPx = poiY - targetCy;

    // Pixel → inches using known target width
    const inchPerPx = TARGET_WIDTH_IN / region.width;
    const dxIn = dxPx * inchPerPx; // +right
    const dyIn = dyPx * inchPerPx; // +down

    // Inches → MOA → clicks (SCZN3 defaults)
    const inPerMoa = inchesPerMOA(DISTANCE_YARDS);

    const windMoa = dxIn / inPerMoa; // +right impacts
    const elevMoa = dyIn / inPerMoa; // +down impacts

    // Corrections to move impacts to center:
    // impacts right => dial left (negative wind clicks)
    // impacts low  => dial up  (positive elev clicks)
    const windClicks = -(windMoa / MOA_PER_CLICK);
    const elevClicks = +(elevMoa / MOA_PER_CLICK);

    res.json({
      ok: true,
      sec: {
        windage_clicks: Number(windClicks.toFixed(2)),
        elevation_clicks: Number(elevClicks.toFixed(2)),
      },
      debug: {
        image_in: { w: meta.width, h: meta.height },
        image_proc: { w, h },
        region,
        threshold: t,
        shots_detected: candidates.length,
        shots_used: cluster.length,
        offsets: {
          dxPx: Number(dxPx.toFixed(1)),
          dyPx: Number(dyPx.toFixed(1)),
          dxIn: Number(dxIn.toFixed(2)),
          dyIn: Number(dyIn.toFixed(2)),
        },
        config: { DISTANCE_YARDS, MOA_PER_CLICK, TARGET_WIDTH_IN },
      },
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err?.message || "SEC processing failed" });
  }
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ ok: false, error: `Not found: ${req.method} ${req.path}` });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`SCZN3 SEC Backend listening on port ${PORT}`);
});
