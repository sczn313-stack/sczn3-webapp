/* ============================================================
   server.js (FULL REPLACEMENT) — SEC-DIRECTION-LOCK-1
   Purpose:
   - Backend is the ONLY authority for direction + clicks
   - Locks screen-truth mapping:
       y increases DOWN on screen
       POIB below bull => clicks UP
       POIB above bull => clicks DOWN
       POIB left of bull => clicks RIGHT
       POIB right of bull => clicks LEFT
============================================================ */

const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors({ origin: true }));
app.use(express.json({ limit: "2mb" }));

// ---------- helpers ----------
function clamp01(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return 0;
  return Math.max(0, Math.min(1, x));
}

function normPoint(p) {
  if (!p || typeof p !== "object") return null;
  return { x: clamp01(p.x), y: clamp01(p.y) };
}

function safeArray(a) {
  return Array.isArray(a) ? a : [];
}

function meanPoint(list) {
  let sx = 0, sy = 0;
  for (const p of list) { sx += p.x; sy += p.y; }
  return { x: sx / list.length, y: sy / list.length };
}

/**
 * computeFromAnchorHits()
 * - anchor is the bull (normalized 0..1)
 * - hits are confirmed hits (normalized 0..1)
 * Returns: score, shots, clicks {up,down,left,right}
 *
 * IMPORTANT:
 * This is still a placeholder scale until your inches/mils mapping is wired,
 * but direction truth is now locked correctly.
 */
function computeFromAnchorHits(bull, hits) {
  const shots = hits.length;

  // POIB (normalized)
  const poib = meanPoint(hits);

  // offsets (normalized)
  // Positive dx means POIB is right of bull
  // Positive dy means POIB is below bull (because y grows downward on screen)
  const dx = poib.x - bull.x;
  const dy = poib.y - bull.y;

  // Placeholder "magnitude" scaling for now
  const SCALE = 40;
  const magX = Math.abs(dx) * SCALE;
  const magY = Math.abs(dy) * SCALE;

  // DIRECTION LOCK (this is the whole point):
  // POIB below bull (dy > 0) => shots low => dial UP
  // POIB above bull (dy < 0) => shots high => dial DOWN
  const clicks = {
    up:    dy > 0 ? magY : 0,
    down:  dy < 0 ? magY : 0,

    // POIB right of bull (dx > 0) => shots right => dial LEFT
    // POIB left of bull (dx < 0) => shots left => dial RIGHT
    left:  dx > 0 ? magX : 0,
    right: dx < 0 ? magX : 0,
  };

  // Placeholder score (replace later)
  const dist = Math.sqrt(dx * dx + dy * dy);
  const score = Math.max(0, Math.min(100, Math.round(100 - dist * 220)));

  return {
    score,
    shots,
    clicks: {
      up: Number(clicks.up.toFixed(2)),
      down: Number(clicks.down.toFixed(2)),
      left: Number(clicks.left.toFixed(2)),
      right: Number(clicks.right.toFixed(2)),
    }
  };
}

// ---------- routes ----------
app.get("/api/health", (req, res) => {
  res.json({ ok: true, service: "tap-n-score-backend", time: new Date().toISOString() });
});

app.get("/api/analyze", (req, res) => {
  res.status(200).send("Use POST /api/analyze with JSON body { anchor:{x,y}, hits:[{x,y}...] }");
});

app.post("/api/analyze", (req, res) => {
  try {
    const bull = normPoint(req.body?.anchor);
    const hits = safeArray(req.body?.hits).map(normPoint).filter(Boolean);

    if (!bull) return res.status(400).json({ error: "Missing/invalid anchor" });
    if (hits.length < 1) return res.status(400).json({ error: "Need at least 1 hit" });

    const sessionId = `SEC-${Math.random().toString(16).slice(2, 10).toUpperCase()}`;

    const computed = computeFromAnchorHits(bull, hits);

    res.json({
      sessionId,
      score: computed.score,
      shots: computed.shots,
      clicks: computed.clicks
    });
  } catch (e) {
    res.status(500).json({ error: "Server error", detail: String(e?.message || e) });
  }
});

// ---------- start ----------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Backend listening on", PORT));
