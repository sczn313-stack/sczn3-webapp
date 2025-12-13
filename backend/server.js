const express = require("express");
const cors = require("cors");
const multer = require("multer");

const app = express();
const PORT = process.env.PORT || 10000;

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.json({ status: "ok", service: "SCZN3 backend" });
});

const upload = multer({ storage: multer.memoryStorage() });

app.post("/api/upload", upload.single("image"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }

  res.json({
    status: "ok",
    message: "Image received",
    filename: req.file.originalname,
    mimetype: req.file.mimetype,
    size: req.file.size
  });
});

app.post("/api/analyze", upload.single("target"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });

  // Placeholder SCZN3 logic
  res.json({
    message: "SCZN3 placeholder analysis complete.",
    filename: req.file.originalname,
    sizeBytes: req.file.size,
    clicks: { windage: "0.00", elevation: "0.00" }
  });
});

app.listen(PORT, () => {
  console.log(`SCZN3 backend listening on port ${PORT}`);
});
