// frontend_new/app.js
import { analyzeImage } from "./api.js";

const $ = (id) => document.getElementById(id);

function toNum(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function fmt2(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return "0.00";
  return x.toFixed(2);
}

function inchPerMoa(distanceYds, trueMoaOn) {
  // True MOA = 1.047" at 100y
  // Shooter MOA = 1.00" at 100y
  const base = trueMoaOn ? 1.047 : 1.0;
  return base * (distanceYds / 100);
}

function dirLR(dx) {
  if (dx > 0) return "RIGHT";
  if (dx < 0) return "LEFT";
  return "NONE";
}

function dirUD(dy) {
  if (dy > 0) return "UP";
  if (dy < 0) return "DOWN";
  return "NONE";
}

function renderResult({ dx, dy, moaX, moaY, clicksX, clicksY }) {
  const windDir = dirLR(dx);
  const elevDir = dirUD(dy);

  const absClicksX = Math.abs(clicksX);
  const absClicksY = Math.abs(clicksY);
  const absMoaX = Math.abs(moaX);
  const absMoaY = Math.abs(moaY);

  const result = `
    <div class="resultRow">
      <div class="k">Windage</div>
      <div class="v">${windDir} • ${fmt2(absClicksX)} clicks • ${fmt2(absMoaX)} MOA</div>
    </div>

    <div class="resultRow">
      <div class="k">Elevation</div>
      <div class="v">${elevDir} • ${fmt2(absClicksY)} clicks • ${fmt2(absMoaY)} MOA</div>
    </div>

    <div class="small">
      ΔX (in): ${fmt2(dx)} • ΔY (in): ${fmt2(dy)}
    </div>
  `;

  $("result").innerHTML = result;
}

function calculate() {
  const distance = toNum($("distance").value, 100);
  const clickValue = toNum($("clickValue").value, 0.25);
  const trueMoaOn = ($("trueMoa").value || "on").toLowerCase() === "on";

  const bullX = toNum($("bullX").value, 0);
  const bullY = toNum($("bullY").value, 0);

  const poibX = toNum($("poibX").value, 0);
  const poibY = toNum($("poibY").value, 0);

  // Rule: correction = bull − POIB
  const dx = bullX - poibX;
  const dy = bullY - poibY;

  const ipm = inchPerMoa(distance, trueMoaOn);

  const moaX = ipm === 0 ? 0 : dx / ipm;
  const moaY = ipm === 0 ? 0 : dy / ipm;

  const clicksX = clickValue === 0 ? 0 : moaX / clickValue;
  const clicksY = clickValue === 0 ? 0 : moaY / clickValue;

  renderResult({ dx, dy, moaX, moaY, clicksX, clicksY });
}

function setStatus(msg) {
  const el = $("analyzeStatus");
  if (el) el.value = msg;
}

function applyAnalyzePayload(data) {
  // Flexible mapping: accept a few common shapes.
  const bx =
    data?.bullX ?? data?.bull?.x ?? data?.bull?.X ?? data?.bull?.[0] ?? null;
  const by =
    data?.bullY ?? data?.bull?.y ?? data?.bull?.Y ?? data?.bull?.[1] ?? null;

  const px =
    data?.poibX ?? data?.poib?.x ?? data?.poib?.X ?? data?.poib?.[0] ?? null;
  const py =
    data?.poibY ?? data?.poib?.y ?? data?.poib?.Y ?? data?.poib?.[1] ?? null;

  if (bx !== null) $("bullX").value = fmt2(toNum(bx, 0));
  if (by !== null) $("bullY").value = fmt2(toNum(by, 0));
  if (px !== null) $("poibX").value = fmt2(toNum(px, 0));
  if (py !== null) $("poibY").value = fmt2(toNum(py, 0));

  // Optional: if backend returns distance/clickValue/trueMoa
  if (data?.distanceYds != null) $("distance").value = String(toNum(data.distanceYds, 100));
  if (data?.clickValue != null) $("clickValue").value = String(toNum(data.clickValue, 0.25));
  if (data?.trueMoa != null) $("trueMoa").value = String(data.trueMoa).toLowerCase() === "on" ? "on" : "off";
}

async function onAnalyze() {
  const fileInput = $("imageFile");
  const file = fileInput?.files?.[0];

  if (!file) {
    setStatus("Select an image first");
    return;
  }

  setStatus("Uploading / analyzing...");

  try {
    const data = await analyzeImage(file);

    // If backend returns recognizable fields, populate inputs
    applyAnalyzePayload(data);

    // Always re-calc after apply
    calculate();

    setStatus("Analyze OK");
  } catch (err) {
    const msg = err?.message ? String(err.message) : "Analyze failed";
    setStatus(msg);
  }
}

function wire() {
  const calcBtn = $("calcBtn");
  if (calcBtn) calcBtn.addEventListener("click", calculate);

  const analyzeBtn = $("analyzeBtn");
  if (analyzeBtn) analyzeBtn.addEventListener("click", onAnalyze);

  // Auto-calc once on load
  calculate();
}

wire();
