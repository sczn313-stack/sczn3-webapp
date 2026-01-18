import express from "express";
import cors from "cors";

const app = express();

// --- CORS (iOS-safe) ---
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type"],
  })
);
app.options("*", cors());

// --- Body parser (raise if needed) ---
app.use(express.json({ limit: "2mb" })); // keep small; don't send full photo

// --- Health route (for testing) ---
app.get("/health", (req, res) => {
  res.status(200).json({ ok: true, service: "sczn3-backend-new1" });
});
