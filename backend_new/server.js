// backend_new/server.js
const express = require("express");
const cors = require("cors");

const app = express();

// CORS + JSON body parsing
app.use(cors());
app.use(express.json({ limit: "2mb" }));

// Health check
app.get("/", (req, res) => {
  res.json({ ok: true, service: "sczn3-backend-new" });
});

app.get("/api/health", (req, res) => {
  res.json({ ok: true });
});

/**
 * POST /api/zero
 * Body:
 * {
 *   "yards": 100,
 *   "clickValue": 0.25,
 *   "trueMOA": true,
 *   "bull": { "x": 0, "y": 0 },
 *   "poib": { "x": -1, "y": 1 }
 * }
 *
 * Convention:
 * - X: Right is +
 * - Y: Up is +
 * Rule: delta = bull - poib  (move POIB -> Bull)
 */
app.post("/api/zero", (req, res) => {
  try {
    const yards = Number(req.body?.yards ?? 100);
    const clickValue = Number(req.body?.clickValue ?? 0.25);
    const trueMOA = Boolean(req.body?.trueMOA ?? true);

    const bullX = Number(req.body?.bull?.x ?? 0);
    const bullY = Number(req.body?.bull?.y ?? 0);

    const poibX = Number(req.body?.poib?.x ?? 0);
    const poibY = Number(req.body?.poib?.y ?? 0);

    if (!Number.isFinite(yards) || yards <= 0) {
      return res.status(400).json({ ok: false, error: "yards must be > 0" });
    }
    if (!Number.isFinite(clickValue) || clickValue <= 0) {
      return res
        .status(400)
        .json({ ok: false, error: "clickValue must be > 0" });
    }

    // inches per 1 MOA at the given distance
    const inchesPerMOAAt100 = trueMOA ? 1.047 : 1.0;
    const inchesPerMOA = inchesPerMOAAt100 * (yards / 100);

    // delta (inches)
    const dx = bullX - poibX; // + = move RIGHT
    const dy = bullY - poibY; // + = move UP

    // moa
    const moaX = dx / inchesPerMOA;
    const moaY = dy / inchesPerMOA;

    // clicks (signed)
    const clicksX = moaX / clickValue;
    const clicksY = moaY / clickValue;

    const windageDir = dx >= 0 ? "RIGHT" : "LEFT";
    const elevationDir = dy >= 0 ? "UP" : "DOWN";

    const round2 = (n) => Number(n.toFixed(2));

    return res.json({
      ok: true,
      inputs: {
        yards,
        clickValue,
        trueMOA,
        bull: { x: bullX, y: bullY },
        poib: { x: poibX, y: poibY }
      },
      delta: {
        dx_in: round2(dx),
        dy_in: round2(dy)
      },
      result: {
        windage: {
          direction: windageDir,
          moa: round2(Math.abs(moaX)),
          clicks: round2(Math.abs(clicksX))
        },
        elevation: {
          direction: elevationDir,
          moa: round2(Math.abs(moaY)),
          clicks: round2(Math.abs(clicksY))
        }
      }
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: "server error" });
  }
});

// Render uses PORT
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`SCZN3 backend_new listening on ${PORT}`);
});
