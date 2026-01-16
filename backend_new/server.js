// backend_new/server.js (FULL REPLACEMENT)  ✅ NO JIMP. Tap-based correction_in + directions.
const express = require("express");
const cors = require("cors");
const multer = require("multer");

const app = express();

// ---- CORS (safe for pilot) ----
app.use(cors());
app.use(express.json({ limit: "2mb" }));

// ---- Multer (accept image, but we don’t need it yet) ----
const upload = multer({ storage: multer.memoryStorage() });

// ---- Health check ----
app.get("/", (req, res) => {
  res.type("text").send("SCZN3 backend_new OK");
});

// Optional: show useful message if someone hits analyze with GET
app.get("/api/analyze", (req, res) => {
  res.status(405).json({ ok:false, error:"Use POST /api/analyze" });
});

/**
 * POST /api/analyze
 * Accepts multipart/form-data:
 * - image: file (optional for now)
 * - taps: JSON string [{x,y}, ...]  (REQUIRED for pilot)
 * - distanceYards: number (optional)
 *
 * Returns:
 * - correction_in: { dx, dy }  (bull - POIB), inches (pilot scale)
 * - directions: { windage, elevation } where dx>0 => RIGHT, dx<0 => LEFT; dy>0 => DOWN, dy<0 => UP
 */
app.post("/api/analyze", upload.single("image"), async (req, res) => {
  try {
    const tapsRaw = req.body?.taps || "[]";
    let taps;
    try { taps = JSON.parse(tapsRaw); } catch { taps = []; }

    if (!Array.isArray(taps) || taps.length === 0) {
      return res.json({
        ok: true,
        note: "Backend reached. Provide taps to compute correction_in.",
        correction_in: null,
        directions: null
      });
    }

    // Try to infer image size:
    // - If image was sent: we can’t decode without an image lib, so we accept optional width/height later.
    // - For now we use a stable pilot canvas size (works for direction + click pipeline).
    const W = Number(req.body?.imageWidth || 1000);
    const H = Number(req.body?.imageHeight || 1000);

    // Bull = center (pilot)
    const bullX = W / 2;
    const bullY = H / 2;

    // POIB = mean of tap points
    let sx = 0, sy = 0;
    for (const p of taps) { sx += Number(p.x || 0); sy += Number(p.y || 0); }
    const poibX = sx / taps.length;
    const poibY = sy / taps.length;

    // correction in pixels (bull - POIB)
    const dx_px = bullX - poibX;
    const dy_px = bullY - poibY;

    // Pilot scale: inches per pixel (default 0.01 => 100px = 1 inch)
    const inchPerPixel = Number(process.env.INCH_PER_PIXEL || 0.01);

    const dx_in = dx_px * inchPerPixel;
    const dy_in = dy_px * inchPerPixel;

    // Directions for scope adjustment to move POIB to bull
    const windage = dx_in > 0 ? "RIGHT" : (dx_in < 0 ? "LEFT" : "");
    // y grows DOWN; if dy_in < 0 => bull is ABOVE POIB => need UP
    const elevation = dy_in > 0 ? "DOWN" : (dy_in < 0 ? "UP" : "");

    return res.json({
      ok: true,
      note: "Tap-based analyze (pilot). correction_in uses a fixed inch-per-pixel scale.",
      poib_px: { x: Number(poibX.toFixed(2)), y: Number(poibY.toFixed(2)) },
      bull_px: { x: Number(bullX.toFixed(2)), y: Number(bullY.toFixed(2)) },
      correction_in: { dx: Number(dx_in.toFixed(2)), dy: Number(dy_in.toFixed(2)) },
      directions: { windage, elevation }
    });
  } catch (e) {
    return res.status(500).json({ ok:false, error: String(e?.message || e) });
  }
});

// ---- Start ----
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`SCZN3 backend_new listening on ${PORT}`);
});
