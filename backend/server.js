import express from "express";
import multer from "multer";
import sharp from "sharp";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

async function normalizeImageBuffer(inputBuffer) {
  return await sharp(inputBuffer)
    .rotate()              // applies EXIF rotation/flip
    .toColourspace("rgb")
    .jpeg({ quality: 95 }) // keep pixels consistent
    .toBuffer();
}

router.post("/api/sec", upload.single("image"), async (req, res) => {
  try {
    if (!req.file?.buffer) {
      return res.status(400).json({ ok: false, error: "Missing multipart field: image" });
    }

    const distanceYards = Number(req.body.distanceYards ?? 100);
    const clickValueMoa = Number(req.body.clickValueMoa ?? 0.25);
    const targetSizeInches = Number(req.body.targetSizeInches ?? 11);

    // THIS IS THE FIX
    const imgBuffer = await normalizeImageBuffer(req.file.buffer);

    // --- call your existing pipeline here ---
    // Example:
    // const result = await computeFromImageBuffer(imgBuffer, { distanceYards, clickValueMoa, targetSizeInches });

    // TEMP stub if you need it compiling immediately:
    const result = { note: "Replace this with your real compute function", bytes: imgBuffer.length };

    return res.json({
      ok: true,
      received: {
        field: "image",
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
        bytes: req.file.size,
      },
      sec: { distanceYards, clickValueMoa, targetSizeInches },
      computeStatus: "COMPUTED_FROM_IMAGE",
      result,
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err?.message || err) });
  }
});

export default router;
