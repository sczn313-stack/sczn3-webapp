import express from "express";
import cors from "cors";
import secRouter from "./routes/sec";

const app = express();

// Keep it simple + compatible with Render + browser uploads
app.use(cors());
app.use(express.json({ limit: "2mb" }));

// Health check
app.get("/health", (_req, res) => res.json({ ok: true, service: "sczn3-sec-backend-pipe" }));

// Mount at /api  ✅ (so route file uses "/sec")
app.use("/api", secRouter);

const port = Number(process.env.PORT || 10000);
app.listen(port, () => {
  console.log(`SCZN3 backend listening on :${port}`);
});
