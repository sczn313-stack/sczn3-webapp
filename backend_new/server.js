/**
 * server.js — SCZN3 Backend NEW — Analyze API
 * Adds guaranteed routes:
 *   GET  /        -> ok
 *   GET  /health  -> ok + build tag
 *   POST /api/analyze (multipart form-data: image, distanceYards, moaPerClick, optional dx, dy)
 */

const express = require("express");
const cors = require("cors");
const multer = require("multer");

const BUILD_TAG = "BACKEND_NEW_PARSER_v2";
const SERVICE_NAME = "sczn3-backend-new";

const app = express();

// CORS for your static frontend
app.use(cors({ origin: true }));

// --- upload ---
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

// IMPORTANT:
// dx,dy are CORRECTION IN INCHES to move POIB to bull.
// +dx => move RIGHT, -dx => move LEFT
// +dy => move UP,    -dy => move DOWN
function directionsFromCorrection(dx, dy) {
  const windage = dx > 0 ? "RIGHT" : dx < 0 ? "LEFT" : "";
  const elevation = dy > 0 ? "UP" : dy < 0 ? "DOWN" : "";
  return { windage, elevation };
}

// ---------- GUARANTEED TEST ROUTES ----------
app.get("/", (req, res) => {
  res.status(200).json({ ok: true, service: SERVICE_NAME, build: BUILD_TAG });
});

app.get("/health", (req, res) => {
  res.status(200).json({ ok: true, service: SERVICE_NAME, build: BUILD_TAG });
});

// ---------- MAIN ENDPOINT ----------
app.post("/api/analyze", upload.single("image"), async (req, res) => {
  try {
    if (!req.file?.buffer) {
      return res.status(400).json({
        ok: false,
        service: SERVICE_NAME,
        build: BUILD_TAG,
        error: { code: "NO_IMAGE", message: 'multipart field "image" is required' },
      });
    }

    const distanceYards = num(req.body.distanceYards, 100);
    const moaPerClick = num(req.body.moaPerClick, 0.25);

    // DEMO/TEST OVERRIDE: allow frontend to send dx/dy directly
    // (this is what your output.js is trying to do)
    const dx = num(req.body.dx, 0);
    const dy = num(req.body.dy, 0);

    // Basic score stub (keep your existing one if you want)
    const score = 614;

    const directions = directionsFromCorrection(dx, dy);

    return res.status(200).json({
      ok: true,
      service: SERVICE_NAME,
      build: BUILD_TAG,
      received: {
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
        bytes: req.file.size,
      },
      correction_in: {
        dx: round2(dx),
        dy: round2(dy),
      },
      directions,
      score,
      tip:
        dx === 0 && dy === 0
          ? "Stub active — dx/dy defaulted to 0.00. Send dx/dy to test directions/clicks."
          : `DEMO OVERRIDE active — dx=${round2(dx)} in, dy=${round2(dy)} in.`,
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      service: SERVICE_NAME,
      build: BUILD_TAG,
      error: { code: "SERVER_ERROR", message: String(err?.message || err) },
    });
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`${SERVICE_NAME} listening on ${PORT} build=${BUILD_TAG}`);
});
