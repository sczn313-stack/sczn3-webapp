// frontend_new/app.js
// UI uses backend as the source of truth for directions + 2-decimal outputs.

import { calc } from "./api.js";

function $(id) {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing #${id}`);
  return el;
}

function toNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function fmt2(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return "0.00";
  return x.toFixed(2);
}

async function runCalc() {
  const distanceYards = toNum($("distanceYards").value);
  const clickValue = toNum($("clickValue").value);
  const trueMoa = $("trueMoa").value === "on";

  const bullX = toNum($("bullX").value);
  const bullY = toNum($("bullY").value);
  const poibX = toNum($("poibX").value);
  const poibY = toNum($("poibY").value);

  const payload = {
    distanceYards,
    clickValueMoa: clickValue, // backend accepts clickValueMoa
    trueMoa,
    bull: { x: bullX, y: bullY },
    poib: { x: poibX, y: poibY },
  };

  const data = await calc(payload);

  // backend returns:
  // data.delta.dxIn, data.delta.dyIn
  // data.windage.direction, data.windage.moa, data.windage.clicks
  // data.elevation.direction, data.elevation.moa, data.elevation.clicks

  $("windageText").textContent =
    `${data.windage.direction} • ${fmt2(data.windage.clicks)} clicks • ${fmt2(data.windage.moa)} MOA`;

  $("elevationText").textContent =
    `${data.elevation.direction} • ${fmt2(data.elevation.clicks)} clicks • ${fmt2(data.elevation.moa)} MOA`;

  $("dxText").textContent = fmt2(data.delta.dxIn);
  $("dyText").textContent = fmt2(data.delta.dyIn);
}

function wire() {
  $("calcBtn").addEventListener("click", async (e) => {
    e.preventDefault();
    try {
      await runCalc();
    } catch (err) {
      alert(err?.message ? String(err.message) : "Error");
    }
  });

  // auto-run on edits
  ["distanceYards", "clickValue", "trueMoa", "bullX", "bullY", "poibX", "poibY"].forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener("change", () => runCalc().catch(() => {}));
    el.addEventListener("input", () => {
      clearTimeout(el.__t);
      el.__t = setTimeout(() => runCalc().catch(() => {}), 100);
    });
  });

  // initial run
  runCalc().catch(() => {});
}

document.addEventListener("DOMContentLoaded", wire);
