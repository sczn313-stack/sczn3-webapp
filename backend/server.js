// backend/server.js
import express from "express";
import cors from "cors";
import multer from "multer";
import sharp from "sharp";

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

app.use(cors());
app.use(express.json({ limit: "2mb" }));

app.get("/health", (_req, res) => res.json({ ok: true, service: "sczn3-sec-backend" }));

async function normalizeImageBuffer(inputBuffer) {
  // Critical for iPhone/Safari: applies EXIF rotation/flip so pixels match what you SEE
  return await sharp(inputBuffer).rotate().toBuffer();
}

function inchesPerClick(distanceYards, clickValueMoa) {
  // True MOA: 1 MOA = 1.047" at 100 yards
  return (distanceYards / 100) * 1.047 * clickValueMoa;
}

// POIB here is an OFFSET from the bull (0,0): +x = right, +y = up
// Your standard: correction = bull - POIB  => correction = -POIB
function clicksFromPoibOffset(poibInches, distanceYards, clickValueMoa) {
  const ipc = inchesPerClick(distanceYards, clickValueMoa);

  const windage = (-poibInches.x) / ipc;     // +x (right) -> LEFT (negative)
  const elevation = (-poibInches.y) / ipc;   // +y (up)    -> DOWN (negative)

  return {
    windage: Number(windage.toFixed(2)),
    elevation: Number(elevation.toFixed(2)),
  };
}

function dialLabels(clicksSigned) {
  const w = clicksSigned.windage;
  const e = clicksSigned.elevation;

  return {
    windage:
      w < 0 ? `LEFT ${Math.abs(w).toFixed(2)} clicks` :
      w > 0 ? `RIGHT ${Math.abs(w).toFixed(2)} clicks` :
      "CENTER 0.00 clicks",
    elevation:
      e < 0 ? `DOWN ${Math.abs(e).toFixed(2)} clicks` :
      e > 0 ? `UP ${Math.abs(e).toFixed(2)} clicks` :
      "CENTER 0.00 clicks",
  };
}

// Replace this with your real detector that returns POIB offset in inches.
// MUST return: { x: number, y: number } where +x=right, +y=up
async function computePoibFromImageBuffer(_imgBuffer, _targetSizeInches) {
  // TEMP stub so server runs immediately (replace with your real pipeline)
  return { x: 0, y: 0 };
}

app.post("/api/sec", upload.single("image"), async (req, res) => {
  try {
    if (!req.file?.buffer) {
      return res.status(400).json({ ok: false, error: "Missing multipart field: image" });
    }

    const distanceYards = Number(req.body.distanceYards ?? 100);
    const clickValueMoa = Number(req.body.clickValueMoa ?? 0.25);
    const targetSizeInches = Number(req.body.targetSizeInches ?? 11);

    const imgBuffer = await normalizeImageBuffer(req.file.buffer);

    // Your pipeline should compute POIB OFFSET from bull (0,0), in inches.
    const poibInches = await computePoibFromImageBuffer(imgBuffer, targetSizeInches);

    // FIXED: windage sign and elevation sign come from correction = -POIB
    const clicksSigned = clicksFromPoibOffset(poibInches, distanceYards, clickValueMoa);
    const dial = dialLabels(clicksSigned);

    return res.json({
      ok: true,
      service: "sczn3-sec-backend",
      received: {
        field: "image",
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
        bytes: req.file.size,
      },
      sec: { distanceYards, clickValueMoa, targetSizeInches },
      computeStatus: "COMPUTED_FROM_IMAGE",
      poibInches,
      clicksSigned,
      dial,
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err?.message || err) });
  }
});

const port = Number(process.env.PORT || 10000);
app.listen(port, () => console.log(`Listening on ${port}`));
