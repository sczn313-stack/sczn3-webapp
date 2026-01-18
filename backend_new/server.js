// backend_new/server.js
const express = require("express");
const cors = require("cors");

const app = express();

/**
 * CORS (iOS Safari safe)
 * - allow all origins for now (tighten later)
 * - answer preflight OPTIONS
 */
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type"],
  })
);
app.options("*", cors());

/**
 * Body size
 * IMPORTANT: Do NOT send the base64 photo to backend right now.
 * Only send distance + taps.
 */
app.use(express.json({ limit: "2mb" }));

/** Health check */
app.get("/health", (req, res) => {
  res.status(200).json({ ok: true, service: "sczn3-backend-new1" });
});

/** Tap-n-Score endpoint */
app.post("/tapscore", (req, res) => {
  try {
    const { distanceYds, taps } = req.body || {};

    if (!distanceYds || !Array.isArray(taps) || taps.length < 1) {
      return res.status(400).json({
        ok: false,
        error: "Missing distanceYds or taps[]",
        got: { distanceYds, tapsType: typeof taps, tapsLen: taps?.length },
      });
    }

    // POIB (average of taps in pixel coords). Later convert to inches/MOA.
    const sum = taps.reduce(
      (a, p) => ({ x: a.x + Number(p.x || 0), y: a.y + Number(p.y || 0) }),
      { x: 0, y: 0 }
    );

    const poib = {
      x: sum.x / taps.length,
      y: sum.y / taps.length,
    };

    // Temporary placeholders so we can confirm front/back are talking.
    return res.json({
      ok: true,
      distanceYds: Number(distanceYds),
      tapsCount: taps.length,
      poib,
      windage: "--",
      elevation: "--",
      score: "--",
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

/** Root */
app.get("/", (req, res) => {
  res.status(200).send("SCZN3 backend alive. Try /health");
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`SCZN3 backend listening on ${PORT}`);
});
