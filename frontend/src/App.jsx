// server.js — SCZN3 SEC Backend (PIPE)
// Always JSON (never HTML error pages)
// POST /api/sec accepts multipart: field "image" + optional numeric fields
//
// Fields (any of these names work):
// - poibX, poibY  (inches)   [X: Right + / Left -, Y: Up + / Down -]
// - distanceYards
// - clickValueMoa
//
// Response returns signed clicks + dial text (RIGHT/LEFT, UP/DOWN)

import express from "express";
import cors from "cors";
import multer from "multer";
import sharp from "sharp";

const BUILD_TAG = "PIPE_v3_2025-12-26";

const app = express();
app.use(cors({ origin: true }));

// Force JSON content-type on everything
app.use((req, res, next) => {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  next();
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 12 * 1024 * 1024 }, // 12MB
});

function toNum(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

// 1 MOA ≈ 1.047" @ 100 yards
function moaInchesAt(distanceYards) {
  return 1.047 * (distanceYards / 100);
}

function dialWindageText(signedClicks) {
  const dir = signedClicks >= 0 ? "RIGHT" : "LEFT";
  return `${dir} ${Math.abs(signedClicks).toFixed(2)} clicks`;
}

function dialElevationText(signedClicks) {
  const dir = signedClicks >= 0 ? "UP" : "DOWN";
  return `${dir} ${Math.abs(signedClicks).toFixed(2)} clicks`;
}

function readFirstDefined(obj, keys) {
  for (const k of keys) {
    const v = obj?.[k];
    if (v !== undefined && v !== null && String(v).trim() !== "") return v;
  }
  return undefined;
}

app.get("/health", (req, res) => {
  res.status(200).send(JSON.stringify({ ok: true, service: "sczn3-sec-backend-pipe", build: BUILD_TAG }));
});

// Make "/" return JSON (avoids "Cannot GET /" confusion)
app.get("/", (req, res) => {
  res.status(200).send(
    JSON.stringify({
      ok: true,
      service: "sczn3-sec-backend-pipe",
      build: BUILD_TAG,
      note: 'Use POST /api/sec (multipart: field "image" + optional poib fields).',
    })
  );
});

app.post("/api/sec", upload.single("image"), async (req, res) => {
  try {
    const file = req.file || null;

    if (!file || !file.buffer) {
      return res.status(400).send(
        JSON.stringify({
          ok: false,
          error: 'No file uploaded. Use multipart field name "image".',
          build: BUILD_TAG,
        })
      );
    }

    // ---- Read numeric inputs (strings from multipart) ----
    const rawPoibX = readFirstDefined(req.body, ["poibX", "poibXInches", "poib_x", "x"]);
    const rawPoibY = readFirstDefined(req.body, ["poibY", "poibYInches", "poib_y", "y"]);

    const rawDistance = readFirstDefined(req.body, ["distanceYards", "distance", "yards"]);
    const rawClick = readFirstDefined(req.body, ["clickValueMoa", "click", "clickValue"]);

    const distanceYards = toNum(rawDistance, 100);
    const clickValueMoa = toNum(rawClick, 0.25);

    const poibX = toNum(rawPoibX, 0); // inches: Right + / Left -
    const poibY = toNum(rawPoibY, 0); // inches: Up + / Down -

    // ---- Image metadata (optional, but nice for pipeline) ----
    let meta = {};
    try {
      const m = await sharp(file.buffer).metadata();
      meta = { width: m.width || null, height: m.height || null, format: m.format || null };
    } catch {
      meta = {};
    }

    // ---- Compute clicks (signed) ----
    const inchesPerMoa = moaInchesAt(distanceYards);

    // signed MOA offset
    const moaX = inchesPerMoa ? poibX / inchesPerMoa : 0;
    const moaY = inchesPerMoa ? poibY / inchesPerMoa : 0;

    // signed clicks
    const windageClicks = clickValueMoa ? moaX / clickValueMoa : 0;
    const elevationClicks = clickValueMoa ? moaY / clickValueMoa : 0;

    // ---- Response ----
    return res.status(200).send(
      JSON.stringify({
        ok: true,
        service: "sczn3-sec-backend-pipe",
        build: BUILD_TAG,
        received: {
          field: "image",
          originalname: file.originalname || null,
          mimetype: file.mimetype || null,
          bytes: file.size || null,
        },
        image: meta,
        sec: {
          distanceYards,
          clickValueMoa,
          center: { col: "L", row: 12 },
          poibInches: { x: poibX, y: poibY },
          clicksSigned: {
            windage: Number(windageClicks.toFixed(2)),
            elevation: Number(elevationClicks.toFixed(2)),
          },
          dial: {
            windage: dialWindageText(windageClicks),
            elevation: dialElevationText(elevationClicks),
          },
          computeStatus: "POIB_TO_CLICKS_OK",
        },
      })
    );
  } catch (err) {
    return res.status(500).send(
      JSON.stringify({
        ok: false,
        error: "Server error",
        message: err?.message || String(err),
        build: BUILD_TAG,
      })
    );
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  // Keep logs minimal; Render still captures this
  console.log(`SCZN3 PIPE listening on ${PORT} (${BUILD_TAG})`);
});
