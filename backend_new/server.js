// backend_new/server.js (DROP THIS WHERE YOU CURRENTLY SET dx/dy)
// Assumes "bull" (aim point) is the IMAGE CENTER for now.
// IMPORTANT: This returns dx/dy in *pixels* unless you later convert to inches.
// For now, it proves the parser + direction pipeline.

const { taps, reason: tapsReason } = parseTapsFromReq(req);
const poib = computePOIB(taps);

// Default stub (no taps => 0/0)
let dx = 0.0;
let dy = 0.0;

let poib_px = null;
let bull_px = null;

if (poib && meta.width && meta.height) {
  // Bull = image center (temporary until you plug in real target geometry)
  const bullX = meta.width / 2;
  const bullY = meta.height / 2;

  // correction = bull - POIB  (right/up are positive)
  dx = bullX - poib.x;
  dy = poib.y - bullY; // invert Y so "up" is positive

  poib_px = { x: Number(poib.x.toFixed(2)), y: Number(poib.y.toFixed(2)), n: poib.n };
  bull_px = { x: Number(bullX.toFixed(2)), y: Number(bullY.toFixed(2)) };
}

// (Optional) include debug so you can SEE it in output tip/debugBox
const debugTapInfo = {
  tapsCount: taps.length,
  tapsReason,
  poib_px,
  bull_px
};
