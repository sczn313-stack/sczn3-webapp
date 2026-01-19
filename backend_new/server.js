// backend_new/server.js (FULL REPLACEMENT)
// Express backend for Tap-n-Score™
//
// Routes:
//   GET  /
//   GET  /ping
//   POST /tapscore
//
// Expected POST body:
// {
//   distanceYds: number,
//   bullTap: { x: number, y: number },   // normalized 0..1
//   taps: [ { x: number, y: number }, ... ]  // normalized 0..1 (bullet holes)
// }
//
// Returns shooter-friendly fields:
// - windageDir / elevationDir (RIGHT/LEFT, UP/DOWN)
// - windageText / elevationText
// - note: "Move POIB to bull: RIGHT + DOWN"
// - delta + deltaPct

const express = require("express");
const cors = require("cors");

const app = express();

// ---- CORS (open for now; tighten later) ----
app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type"],
}));

app.use(express.json({ limit: "2mb" }));

app.get("/", (req, res) => {
  res.json({ ok: true, service: "tap-n-score-backend" });
});

app.get("/ping", (req, res) => {
  res.json({ ok: true, route: "/ping" });
});

// ---- Helpers ----
function isNum(n) {
  return typeof n === "number" && Number.isFinite(n);
}

function clamp01(v) {
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(1, v));
}

function meanPoint(points) {
  const n = points.length;
  const sum = points.reduce((acc, p) => {
    acc.x += p.x;
    acc.y += p.y;
    return acc;
  }, { x: 0, y: 0 });

  return { x: sum.x / n, y: sum.y / n };
}

function dirFromDelta(dx, dy) {
  // dx = bull.x - poib.x  (positive => move RIGHT)
  // dy = bull.y - poib.y  (positive => move UP if we define UP as positive)
  // NOTE: taps are in screen coords where y increases downward.
  // But YOU want "UP means move POIB up on paper".
  // We treat dy>0 as UP label and dy<0 as DOWN label (canonical rule you locked in).
  const windageDir = dx > 0 ? "RIGHT" : (dx < 0 ? "LEFT" : "CENTER");
  const elevationDir = dy > 0 ? "UP" : (dy < 0 ? "DOWN" : "CENTER");
  return { windageDir, elevationDir };
}

function toPct(v) {
  // normalized => percent
  return Math.round(v * 10000) / 100; // two decimals
}

app.post("/tapscore", (req, res) => {
  try {
    const body = req.body || {};

    const distanceYds = Number(body.distanceYds || 100);

    const bullTapRaw = body.bullTap;
    const tapsRaw = Array.isArray(body.taps) ? body.taps : [];

    if (!bullTapRaw || !isNum(bullTapRaw.x) || !isNum(bullTapRaw.y)) {
      return res.status(400).json({
        ok: false,
        error: "Missing bullTap {x,y} (normalized 0..1).",
      });
    }

    if (tapsRaw.length < 1) {
      return res.status(400).json({
        ok: false,
        error: "Need at least 1 bullet-hole tap (after the bull tap).",
      });
    }

    const bullTap = {
      x: clamp01(Number(bullTapRaw.x)),
      y: clamp01(Number(bullTapRaw.y)),
    };

    const taps = tapsRaw
      .filter(p => p && isNum(p.x) && isNum(p.y))
      .map(p => ({ x: clamp01(Number(p.x)), y: clamp01(Number(p.y)) }));

    if (taps.length < 1) {
      return res.status(400).json({
        ok: false,
        error: "No valid bullet-hole taps found.",
      });
    }

    // POIB = mean of bullet-hole taps
    const poib = meanPoint(taps);

    // Canonical correction vector (bull - POIB)
    const dx = bullTap.x - poib.x;
    const dy = bullTap.y - poib.y;

    const { windageDir, elevationDir } = dirFromDelta(dx, dy);

    // Normalized magnitude (unitless)
    const delta = { x: dx, y: dy };

    // Percent-of-image (easy to read)
    const deltaPct = { x: toPct(dx), y: toPct(dy) };

    // Friendly strings (no clicks yet — scale not known at backend in this phase)
    const windageText = windageDir === "CENTER"
      ? "Windage: CENTER"
      : `Windage: ${windageDir}`;

    const elevationText = elevationDir === "CENTER"
      ? "Elevation: CENTER"
      : `Elevation: ${elevationDir}`;

    const note = `Move POIB to bull: ${windageDir} + ${elevationDir}`;

    return res.json({
      ok: true,

      // echo
      distanceYds,
      tapsCount: taps.length,
      bullTap,
      poib,

      // correction
      delta,
      deltaPct,
      windageDir,
      elevationDir,
      windageText,
      elevationText,
      note,

      // future fields (safe defaults)
      clicks: null,
      score: null,
    });
  } catch (e) {
    return res.status(500).json({
      ok: false,
      error: "Server error",
      detail: String(e && e.message ? e.message : e),
    });
  }
});

// Render uses PORT
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Tap-n-Score backend listening on ${PORT}`);
});
