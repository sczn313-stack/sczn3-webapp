// frontend_new/src/lib/sczn3Correction.js
// Single source of truth for: deltas, direction labels, MOA, clicks, and arrow vector.
// Rule: correction = Bull - POIB
// Canvas note: Y increases downward. This function assumes your inputs use the same coordinate system.

function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function abs(n) {
  return n < 0 ? -n : n;
}

/**
 * Compute correction math and render primitives from two points.
 *
 * Inputs:
 *  - bullPx: { x, y }  (blue)
 *  - poibPx: { x, y }  (cyan)
 *  - pxPerInch: number (how many pixels represent 1 inch on this rendered image)
 *  - yards: number
 *  - moaPerClick: number (e.g., 0.25)
 *  - trueMoaInchesAt100: number (default 1.047 for True MOA)
 *
 * Output:
 *  - dxPx, dyPx (bull - poib)
 *  - windageIn, elevationIn (signed; bull - poib)
 *  - windageDir, elevationDir (RIGHT/LEFT, UP/DOWN)
 *  - windageMoa, elevationMoa
 *  - windageClicks, elevationClicks
 *  - arrow: { x1,y1,x2,y2 } ALWAYS poib -> bull
 */
export function computeSCZN3Correction({
  bullPx,
  poibPx,
  pxPerInch,
  yards,
  moaPerClick = 0.25,
  trueMoaInchesAt100 = 1.047
}) {
  if (!bullPx || !poibPx) {
    throw new Error("computeSCZN3Correction requires bullPx and poibPx.");
  }
  if (!pxPerInch || pxPerInch <= 0) {
    throw new Error("computeSCZN3Correction requires a valid pxPerInch > 0.");
  }
  if (!yards || yards <= 0) {
    throw new Error("computeSCZN3Correction requires yards > 0.");
  }
  if (!moaPerClick || moaPerClick <= 0) {
    throw new Error("computeSCZN3Correction requires moaPerClick > 0.");
  }

  // Core truth: correction = bull - poib
  const dxPx = bullPx.x - poibPx.x;
  const dyPx = bullPx.y - poibPx.y;

  // Convert to inches
  const windageIn = dxPx / pxPerInch;     // + => RIGHT, - => LEFT
  const elevationIn = dyPx / pxPerInch;   // + => DOWN,  - => UP (because canvas Y grows downward)

  // Direction labels derived from same deltas
  const windageDir = windageIn >= 0 ? "RIGHT" : "LEFT";
  const elevationDir = elevationIn >= 0 ? "DOWN" : "UP";

  // True MOA inches at distance
  const inchesPerMoaAtDistance = trueMoaInchesAt100 * (yards / 100);

  const windageMoa = abs(windageIn) / inchesPerMoaAtDistance;
  const elevationMoa = abs(elevationIn) / inchesPerMoaAtDistance;

  const windageClicks = windageMoa / moaPerClick;
  const elevationClicks = elevationMoa / moaPerClick;

  return {
    dxPx,
    dyPx,

    // Signed inches (bull - poib). These are the authoritative corrections.
    windageIn: round2(windageIn),
    elevationIn: round2(elevationIn),

    windageDir,
    elevationDir,

    // Magnitudes for display
    windageMoa: round2(windageMoa),
    elevationMoa: round2(elevationMoa),

    windageClicks: round2(windageClicks),
    elevationClicks: round2(elevationClicks),

    // Always draw POIB -> Bull (correction path)
    arrow: {
      x1: poibPx.x,
      y1: poibPx.y,
      x2: bullPx.x,
      y2: bullPx.y
    }
  };
}
