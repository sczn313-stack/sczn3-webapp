// backend_new/server.js
const express = require("express");
const cors = require("cors");

const app = express();

// ---- middleware ----
app.use(cors({ origin: "*" }));
app.use(express.json({ limit: "2mb" }));

// ---- helpers ----
function round2(n) {
  return Math.round(n * 100) / 100;
}
function dirX(dx) {
  if (dx > 0) return "RIGHT";
  if (dx < 0) return "LEFT";
  return "CENTER";
}
function dirY(dy) {
  if (dy > 0) return "UP";
  if (dy < 0) return "DOWN";
  return "CENTER";
}

/**
 * True MOA:
 * 1 MOA = 1.047" at 100y
 * At Y yards: inches_per_moa = 1.047 * (Y/100)
 * If trueMoa OFF, use 1.000" at 100y (shooter MOA)
 */
function inchesPerMOA(yards, trueMoa) {
  const base = trueMoa ? 1.047 : 1.0;
  return base * (yards / 100);
}

// ---- routes ----
app.get("/", (req, res) => {
  res.type("text").send(
    "SCZN3 backend is live. Try GET /api/health or POST /api/calc"
  );
});

app.get("/api/health", (req, res) => {
  res.json({ ok: true, service: "sczn3-backend-new" });
});

app.post("/api/calc", (req, res) => {
  try {
    const {
      yards = 100,
      clickValue = 0.25,
      trueMoa = true,
      bullX = 0,
      bullY = 0,
      poibX = 0,
      poibY = 0,
    } = req.body || {};

    const Y = Number(yards);
    const CV = Number(clickValue);
    const TM = Boolean(trueMoa);

    const bX = Number(bullX);
    const bY = Number(bullY);
    const pX = Number(poibX);
    const pY = Number(poibY);

    if (!Number.isFinite(Y) || Y <= 0) {
      return res.status(400).json({ error: "yards must be > 0" });
    }
    if (!Number.isFinite(CV) || CV <= 0) {
      return res.status(400).json({ error: "clickValue must be > 0" });
    }
    for (const v of [bX, bY, pX, pY]) {
      if (!Number.isFinite(v)) {
        return res.status(400).json({ error: "inputs must be numbers" });
      }
    }

    // Canonical SCZN3 direction rule:
    // correction = bull − POIB
    const dx = bX - pX; // Right +   (move POIB to bull)
    const dy = bY - pY; // Up +      (move POIB to bull)

    const ipm = inchesPerMOA(Y, TM); // inches per 1 MOA at Y yards

    const moaX = dx / ipm;
    const moaY = dy / ipm;

    const clicksX = moaX / CV;
    const clicksY = moaY / CV;

    const out = {
      settings: {
        yards: round2(Y),
        clickValue: round2(CV),
        trueMoa: TM,
        inchesPerMOA: round2(ipm),
      },
      inputs: {
        bullX: round2(bX),
        bullY: round2(bY),
        poibX: round2(pX),
        poibY: round2(pY),
      },
      delta: {
        dxIn: round2(dx),
        dyIn: round2(dy),
        windageDir: dirX(dx),
        elevationDir: dirY(dy),
      },
      output: {
        windageMOA: round2(Math.abs(moaX)),
        elevationMOA: round2(Math.abs(moaY)),
        windageClicks: round2(Math.abs(clicksX)),
        elevationClicks: round2(Math.abs(clicksY)),
      },
    };

    return res.json(out);
  } catch (e) {
    return res.status(500).json({ error: "server error", details: String(e) });
  }
});

// ---- start ----
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`SCZN3 backend_new listening on ${PORT}`);
});
