// server.js (FULL REPLACEMENT)
// SCZN3 Backend — Deterministic dx/dy parser (POIB -> CORRECTION)
// --------------------------------------------------------------
// Convention:
// - Incoming dx/dy (multipart fields) are **POIB inches** (cluster relative to bull):
//     dx > 0 = RIGHT, dx < 0 = LEFT
//     dy > 0 = UP,    dy < 0 = DOWN
// - Backend converts to CORRECTION inches (what to dial):
//     correction = -POIB
// - Returns a response format your frontend/output.js already understands.
//
// Endpoint your frontend is calling now:
//   POST /api/analyze   (multipart form-data: field "image")
//   optional fields: distanceYards, moaPerClick, dx, dy
//
// Notes:
// - If dx/dy are NOT provided, this returns 0.00 with a clear tip (no guessing).
// - This is the clean “prove the directions/clicks” backend.

const express = require("express");
const cors = require("cors");
const multer = require("multer");

const app = express();

const SERVICE_NAME = "sczn3-backend";
const BUILD_TAG = "DETERMINISTIC_PARSER_POIB_TO_CORR_v1";

// CORS for your static Render frontend
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

app.get("/", (req, res) => {
  res.status(200).send(
    JSON.stringify({
      ok: true,
      service: SERVICE_NAME,
      build: BUILD_TAG,
      note:
        "Use POST /api/analyze with multipart field 'image' and optional fields: distanceYards, moaPerClick, dx, dy (inches). dx/dy are POIB; backend returns correction.",
    })
  );
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

function dirFromSignedInches(dxCorr, dyCorr) {
  const windage = dxCorr > 0 ? "RIGHT" : dxCorr < 0 ? "LEFT" : "CENTER";
  const elevation = dyCorr > 0 ? "UP" : dyCorr < 0 ? "DOWN" : "LEVEL";
  return { windage, elevation };
}

app.post("/api/analyze", upload.single("image"), async (req, res) => {
  try {
    // Image is still required so your frontend stays consistent.
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

    const distanceYards = num(req.body.distanceYards, 100);
    const moaPerClick = num(req.body.moaPerClick, 0.25);

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

    if (!Number.isFinite(moaPerClick) || moaPerClick <= 0) {
      res.status(400).send(
        JSON.stringify({
          ok: false,
          service: SERVICE_NAME,
          build: BUILD_TAG,
          error: { code: "BAD_CLICK", message: "moaPerClick must be > 0" },
        })
      );
      return;
    }

    // ------------------------------
    // EXACT PARSER (POIB -> CORR)
    // ------------------------------
    const hasDx = req.body.dx !== undefined && req.body.dx !== null && String(req.body.dx).trim() !== "";
    const hasDy = req.body.dy !== undefined && req.body.dy !== null && String(req.body.dy).trim() !== "";

    let poibDx = 0;
    let poibDy = 0;

    if (hasDx || hasDy) {
      poibDx = num(req.body.dx, 0); // POIB inches
      poibDy = num(req.body.dy, 0); // POIB inches (UP +, DOWN -)
    }

    // CORRECTION inches (what to dial) = -POIB
    const corrDx = -poibDx;
    const corrDy = -poibDy;

    // Clicks from CORRECTION inches
    const inchPerMOA = inchesPerMoaAtYards(distanceYards);
    const clicksFromInches = (inches) => round2(Math.abs(inches) / inchPerMOA / moaPerClick);

    const directions = dirFromSignedInches(corrDx, corrDy);

    // Response shape that output.js already reads:
    // - correction_in: { dx, dy }
    // - directions: { windage, elevation }
    res.status(200).send(
      JSON.stringify({
        ok: true,
        service: SERVICE_NAME,
        build: BUILD_TAG,
        score: 614, // keep your current demo score
        correction_in: {
          dx: round2(corrDx), // CORRECTION inches
          dy: round2(corrDy), // CORRECTION inches
        },
        directions,
        clicks: {
          windage: fmt2(clicksFromInches(corrDx)),
          elevation: fmt2(clicksFromInches(corrDy)),
        },
        tip: hasDx || hasDy
          ? `DEMO OVERRIDE active (POIB received). POIB dx=${fmt2(poibDx)} in, dy=${fmt2(poibDy)} in. Returning correction = -POIB.`
          : "Stub active — no dx/dy sent. Send POIB dx/dy (inches) to test directions/clicks.",
        received: {
          distanceYards,
          moaPerClick,
          poib_in: { dx: round2(poibDx), dy: round2(poibDy) },
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
