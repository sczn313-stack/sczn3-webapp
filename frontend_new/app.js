// ===============================
// SCZN3 Results (canonical)
// correction = bull − group (move POIB/group to bull)
// dx > 0 => RIGHT, dx < 0 => LEFT
// dy > 0 => UP,    dy < 0 => DOWN
// NOTE: if your dy was previously defined as (groupY - bullY),
//       you MUST use the dy_in computed below (bullY - groupY) to avoid flipped elevation.
// ===============================

// Inputs you already have in your app.js:
// groupPx = { x: ..., y: ... }   // your detected group/POIB center in pixels
// bullPx  = { x: ..., y: ... }   // your bull/aimpoint in pixels
// pxPerIn = ...                  // pixels-per-inch estimate

const dx_in_signed = (bullPx.x - groupPx.x) / pxPerIn;
const dy_in_signed = (bullPx.y - groupPx.y) / pxPerIn;

// Directions (canonical)
const windageDirection = dx_in_signed >= 0 ? "RIGHT" : "LEFT";
const elevationDirection = dy_in_signed >= 0 ? "UP" : "DOWN";

// Magnitudes (always positive for display)
const dx_in = Math.abs(dx_in_signed);
const dy_in = Math.abs(dy_in_signed);

// If you also display MOA, keep your existing conversion.
// (If you already have windageMOA / elevationMOA computed elsewhere, leave it there.)

// Render/update your Results UI using these exact variables:
updateResultText({
  windageDirection,
  elevationDirection,
  dx_in,
  dy_in
});
