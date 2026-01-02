// frontend_new/app.js
// Rule: correction = bull - POIB
// ΔX > 0 => RIGHT, ΔX < 0 => LEFT
// ΔY > 0 => UP,    ΔY < 0 => DOWN
// Two decimals everywhere.

function toNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function to2(n) {
  return Number.isFinite(n) ? Number(n.toFixed(2)) : 0;
}

function fmt2(n) {
  return to2(n).toFixed(2);
}

function calcAxis(deltaIn, distanceYards, clickValueMOA, trueMoaOn) {
  const absIn = Math.abs(deltaIn);

  const moaAt100 = trueMoaOn ? 1.047 : 1.0; // inches per MOA at 100y
  const inchesPerMOA = moaAt100 * (distanceYards / 100);

  const moa = inchesPerMOA === 0 ? 0 : absIn / inchesPerMOA;
  const clicks = clickValueMOA === 0 ? 0 : moa / clickValueMOA;

  return { moa: to2(moa), clicks: to2(clicks) };
}

function dirX(dx) {
  if (dx > 0) return "RIGHT";
  if (dx < 0) return "LEFT";
  return "NONE";
}

function dirY(dy) {
  if (dy > 0) return "UP";
  if (dy < 0) return "DOWN";
  return "NONE";
}

function getEl(id) {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing element #${id}`);
  return el;
}

function calcAndRender() {
  const distanceYards = toNum(getEl("distanceYards").value);
  const clickValue = toNum(getEl("clickValue").value);
  const trueMoaOn = getEl("trueMoa").value === "on";

  const bullX = toNum(getEl("bullX").value);
  const bullY = toNum(getEl("bullY").value);
  const poibX = toNum(getEl("poibX").value);
  const poibY = toNum(getEl("poibY").value);

  // correction = bull - POIB
  const dx = bullX - poibX;
  const dy = bullY - poibY;

  const wind = calcAxis(dx, distanceYards, clickValue, trueMoaOn);
  const elev = calcAxis(dy, distanceYards, clickValue, trueMoaOn);

  const windText =
    `${dirX(dx)} • ${fmt2(wind.clicks)} clicks • ${fmt2(wind.moa)} MOA`;
  const elevText =
    `${dirY(dy)} • ${fmt2(elev.clicks)} clicks • ${fmt2(elev.moa)} MOA`;

  getEl("windageText").textContent = windText;
  getEl("elevationText").textContent = elevText;
  getEl("dxText").textContent = fmt2(dx);
  getEl("dyText").textContent = fmt2(dy);
}

function wire() {
  const btn = getEl("calcBtn");
  btn.addEventListener("click", (e) => {
    e.preventDefault();
    calcAndRender();
  });

  // Auto-calc when values change
  ["distanceYards", "clickValue", "trueMoa", "bullX", "bullY", "poibX", "poibY"].forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener("change", calcAndRender);
    el.addEventListener("input", () => {
      // keep it responsive but not spammy
      window.clearTimeout(el.__t);
      el.__t = window.setTimeout(calcAndRender, 80);
    });
  });

  // First render
  calcAndRender();
}

document.addEventListener("DOMContentLoaded", wire);
