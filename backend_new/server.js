'use strict';

const express = require('express');
const cors = require('cors');

const app = express();

/**
 * CORS
 * - If you set FRONTEND_ORIGIN on Render (recommended), we'll lock to it.
 * - Otherwise we allow all origins.
 */
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || '*';
app.use(
  cors({
    origin: FRONTEND_ORIGIN === '*' ? true : FRONTEND_ORIGIN,
  })
);

app.use(express.json({ limit: '1mb' }));

// -------------------- Helpers --------------------
function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function dirFromSignedDelta(delta, posLabel, negLabel) {
  if (delta > 0) return posLabel;
  if (delta < 0) return negLabel;
  return 'NONE';
}

/**
 * True MOA inches per MOA at distance:
 * - True: 1.047" at 100y
 * - Shooter MOA: 1.000" at 100y
 */
function inchesPerMoa(distanceYards, trueMoaOn) {
  const base = trueMoaOn ? 1.047 : 1.0;
  return base * (distanceYards / 100.0);
}

// -------------------- Routes --------------------
// Fix "Cannot GET /"
app.get('/', (req, res) => {
  res.type('text').send(
`SCZN3 backend_new is running.

Endpoints:
GET  /health
POST /api/calc

POST /api/calc JSON body example:
{
  "distanceYards": 50,
  "clickValueMoa": 0.25,
  "trueMoa": true,
  "bull": {"x": 0, "y": 0},
  "poib": {"x": -1, "y": 1}
}`
  );
});

app.get('/health', (req, res) => {
  res.json({ ok: true, service: 'sczn3-backend-new' });
});

/**
 * Calculates clicks to move POIB -> Bull using rule: bull - POIB
 * X: Right + ; Y: Up +
 */
app.post('/api/calc', (req, res) => {
  try {
    const distanceYards = Number(req.body?.distanceYards ?? 100);
    const clickValueMoa = Number(req.body?.clickValueMoa ?? 0.25);
    const trueMoa = Boolean(req.body?.trueMoa ?? true);

    const bullX = Number(req.body?.bull?.x ?? 0);
    const bullY = Number(req.body?.bull?.y ?? 0);
    const poibX = Number(req.body?.poib?.x ?? 0);
    const poibY = Number(req.body?.poib?.y ?? 0);

    // Core rule: correction = bull - POIB
    const dx = bullX - poibX; // + = RIGHT
    const dy = bullY - poibY; // + = UP

    const ipm = inchesPerMoa(distanceYards, trueMoa);

    const windageDir = dirFromSignedDelta(dx, 'RIGHT', 'LEFT');
    const elevDir = dirFromSignedDelta(dy, 'UP', 'DOWN');

    const windageMoa = round2(Math.abs(dx) / ipm);
    const elevMoa = round2(Math.abs(dy) / ipm);

    const windageClicks = round2(windageMoa / clickValueMoa);
    const elevClicks = round2(elevMoa / clickValueMoa);

    res.json({
      inputs: {
        distanceYards,
        clickValueMoa,
        trueMoa,
        bull: { x: round2(bullX), y: round2(bullY) },
        poib: { x: round2(poibX), y: round2(poibY) },
      },
      deltas: {
        dx: round2(dx),
        dy: round2(dy),
      },
      windage: {
        direction: windageDir,
        moa: windageMoa,
        clicks: windageClicks,
      },
      elevation: {
        direction: elevDir,
        moa: elevMoa,
        clicks: elevClicks,
      },
    });
  } catch (e) {
    res.status(400).json({ ok: false, error: String(e?.message ?? e) });
  }
});

// -------------------- Start --------------------
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`SCZN3 backend_new listening on port ${PORT}`);
});
