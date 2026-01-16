// sczn3-webapp/backend_new/server.js
const express = require("express");
const cors = require("cors");
const multer = require("multer");

const app = express();

// ---- CORS ----
// Allow your Render static site(s). Add more origins if needed.
const ALLOWED_ORIGINS = [
  "https://sczn3-frontend-new.onrender.com",
  "https://sczn3-frontend-new1.onrender.com",
  "http://localhost:3000",
  "http://localhost:5173"
];

app.use(cors({
  origin: function (origin, cb) {
    // allow non-browser clients/no origin
    if (!origin) return cb(null, true);

    if (ALLOWED_ORIGINS.includes(origin)) return cb(null, true);

    // If you want to temporarily allow all while testing, uncomment:
    // return cb(null, true);

    return cb(new Error("CORS blocked for origin: " + origin));
  }
}));

app.use(express.json({ limit: "2mb" }));

// ---- Health route so the root URL is not "Cannot GET /" ----
app.get("/", (req, res) => {
  res.status(200).send("SCZN3 backend is live");
});

// ---- Multer: memory upload ----
const upload = multer({ storage: multer.memoryStorage() });

// ---- API ----
// NOTE: This endpoint currently only validates receipt of the image.
// You can drop your real analysis logic inside where indicated.
app.post("/api/analyze", upload.single("image"), async (req, res) => {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ error: "No image uploaded. Field name must be 'image'." });
    }

    // ================================
    // TODO: INSERT YOUR REAL ANALYSIS
    // ================================
    // Expected return shape for the frontend:
    // {
    //   correction_in: { dx: <inches>, dy: <inches> },
    //   directions: { windage: "LEFT/RIGHT", elevation: "UP/DOWN" }
    // }
    //
    // For now, return a clear placeholder so you can confirm connectivity.
    return res.status(200).json({
      ok: true,
      note: "Backend reached. Replace placeholder with real analyze logic.",
      correction_in: null,
      directions: null
    });
  } catch (err) {
    return res.status(500).json({ error: "Server error", details: String(err && err.message ? err.message : err) });
  }
});

// Optional: show friendly message on GET /api/analyze
app.get("/api/analyze", (req, res) => {
  res.status(405).send("Use POST /api/analyze");
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log("Backend listening on", PORT);
});
