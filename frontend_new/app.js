// frontend_new/app.js
// Wires:
// - Analyze button: uploads image -> fills POIB -> runs calc
// - Calculate button: runs backend calc
// Output always comes from backend (direction locked, 2 decimals)

import { calc, analyzeImage } from "./api.js";

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

function setStatus(msg) {
  const s = document.getElementById("analyzeStatus");
  if (s) s.value = msg;
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
    clickValueMoa: clickValue,
    trueMoa,
    bull: { x: bullX, y: bullY },
    poib: { x: poibX, y: poibY },
  };

  const data = await calc(payload);

  $("windageText").textContent =
    `${data.windage.direction} • ${fmt2(data.windage.clicks)} clicks • ${fmt2(data.windage.moa)} MOA`;

  $("elevationText").textContent =
    `${data.elevation.direction} • ${fmt2(data.elevation.clicks)} clicks • ${fmt2(data.elevation.moa)} MOA`;

  $("dxText").textContent = fmt2(data.delta.dxIn);
  $("dyText").textContent = fmt2(data.delta.dyIn);
}

async function runAnalyze() {
  const file = $("imageFile")?.files?.[0];
  if (!file) {
    setStatus("Select an image first");
    return;
  }

  setStatus("Uploading...");
  try {
    setStatus("Analyzing...");
    const data = await analyzeImage(file);

    // Analyzer returns bull at (0,0) and POIB offsets in inches (Right+/Up+)
    $("bullX").value = fmt2(data?.bull?.x ?? 0);
    $("bullY").value = fmt2(data?.bull?.y ?? 0);
    $("poibX").value = fmt2(data?.poib?.x ?? 0);
    $("poibY").value = fmt2(data?.poib?.y ?? 0);

    setStatus("Analyze OK");
    await runCalc();
  } catch (err) {
    setStatus(err?.message ? String(err.message) : "Analyze failed");
  }
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

  $("analyzeBtn").addEventListener("click", async (e) => {
    e.preventDefault();
    await runAnalyze();
  });

  // Auto-calc when values change
  ["distanceYards", "clickValue", "trueMoa", "bullX", "bullY", "poibX", "poibY"].forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener("change", () => runCalc().catch(() => {}));
    el.addEventListener("input", () => {
      clearTimeout(el.__t);
      el.__t = setTimeout(() => runCalc().catch(() => {}), 120);
    });
  });

  // Initial calc
  runCalc().catch(() => {});
}

document.addEventListener("DOMContentLoaded", wire);
