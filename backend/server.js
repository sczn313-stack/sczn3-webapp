// SCZN3 SEC Backend — JSON-safe error wrapper for /api/sec
// Paste this as the ENTIRE FILE that currently contains your POST /api/sec route.

import express from "express";
import cors from "cors";
import multer from "multer";

// If your existing code imports the SEC engine, keep that import here.
// Example (rename to match your project):
// import { runSec } from "./secEngine.js";

const app = express();

// ---- LOCKED CONFIG (matches your /api/health screenshot) ----
const CONFIG = {
  DISTANCE_YARDS: 100,
  MOA_PER_CLICK: 0.25,
  TARGET_WIDTH_IN: 23,
  MIN_SHOTS: 3,
  MAX_SHOTS: 7,
  MAX_ABS_CLICKS: 80,
};

// ---- CORS ----
app.use(cors({ origin: "*" }));

// ---- Multer: memory upload (simple & reliable on Render) ----
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 12 * 1024 * 1024, // 12MB
  },
});

// ---- Helpers ----
function safeError(err) {
  return {
    name: err?.name || "Error",
    message: err?.message || String(err),
    // keep stack short so it’s readable on iPad
    stack: (err?.stack || "").split("\n").slice(0, 8).join("\n"),
  };
}

function isFiniteNumber(n) {
  return typeof n === "number" && Number.isFinite(n);
}

// ---- Routes ----
app.get("/", (_req, res) => {
  res.json({ ok: true, routes: ["GET /", "GET /api/health", "POST /api/sec"] });
});

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    routes: ["GET /", "GET /api/health", "POST /api/sec"],
    config: CONFIG,
  });
});

app.post("/api/sec", upload.single("image"), async (req, res) => {
  const started = Date.now();

  try {
    if (!req.file) {
      return res.status(400).json({
        ok: false,
        error: "NO_FILE",
        message: 'No file uploaded. Expected form field name: "image".',
      });
    }

    const { originalname, mimetype, size } = req.file;

    // Basic sanity check
    if (!mimetype?.startsWith("image/")) {
      return res.status(400).json({
        ok: false,
        error: "NOT_IMAGE",
        message: `Upload must be an image. Got mimetype: ${mimetype}`,
      });
    }

    // ---- CALL YOUR EXISTING ENGINE HERE ----
    // Replace this block with your existing logic that produces signed click numbers.
    //
    // Example expected return:
    // const { windage_clicks, elevation_clicks } = await runSec(req.file.buffer, CONFIG);
    //
    // For now, this placeholder throws so we *see* exactly what file you’re in
    // if you forgot to wire your existing function.
    throw new Error(
      "SEC engine call not wired in this file yet. Paste your existing SEC engine call where indicated."
    );

    // if (!isFiniteNumber(windage_clicks) || !isFiniteNumber(elevation_clicks)) {
    //   return res.status(422).json({
    //     ok: false,
    //     error: "MISSING_CLICKS",
    //     message: "Engine did not return numeric windage/elevation clicks.",
    //   });
    // }

    // return res.json({
    //   ok: true,
    //   units: "CLICKS",
    //   convention: "DIAL_TO_CENTER",
    //   sec: { windage_clicks, elevation_clicks },
    //   meta: { ms: Date.now() - started, originalname, mimetype, size },
    // });
  } catch (err) {
    // IMPORTANT: always return JSON (never HTML)
    return res.status(500).json({
      ok: false,
      error: "SEC_500",
      message: "SEC processing failed in backend.",
      meta: {
        ms: Date.now() - started,
        file: req?.file
          ? { originalname: req.file.originalname, mimetype: req.file.mimetype, size: req.file.size }
          : null,
      },
      detail: safeError(err),
    });
  }
});

// ---- Start ----
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`SCZN3 SEC backend listening on ${PORT}`);
});
