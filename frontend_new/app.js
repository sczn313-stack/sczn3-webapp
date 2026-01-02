function to2(n) {
  return Number.isFinite(n) ? Number(n.toFixed(2)) : 0.0;
}

function $(id) {
  return document.getElementById(id);
}

function readNum(id) {
  const v = Number($(id).value);
  return Number.isFinite(v) ? v : 0;
}

function setText(id, text) {
  $(id).textContent = text;
}

async function checkApi() {
  // API_BASE is defined in api.js
  setText("apiBase", `Backend: ${API_BASE}`);

  try {
    const r = await fetch(`${API_BASE}/health`, { cache: "no-store" });
    if (!r.ok) throw new Error(`health failed ${r.status}`);
    const data = await r.json();
    if (data && data.ok === true) {
      setText("apiStatus", "CONNECTED ✅");
    } else {
      setText("apiStatus", "CONNECTED (unexpected payload) ⚠️");
    }
  } catch (e) {
    setText("apiStatus", `NOT CONNECTED ❌  (${String(e.message || e)})`);
  }
}

async function runCalc() {
  const distanceYards = Number($("distanceYards").value);
  const clickValueMoa = readNum("clickValueMoa");
  const trueMoa = $("trueMoa").value === "true";

  const bullX = readNum("bullX");
  const bullY = readNum("bullY");

  const poibX = readNum("poibX");
  const poibY = readNum("poibY");

  const payload = {
    distanceYards,
    clickValueMoa,
    trueMoa,
    bull: { x: bullX, y: bullY },
    poib: { x: poibX, y: poibY }
  };

  const data = await postCalc(payload);

  setText(
    "windageLine",
    `${data.windage.direction} • ${to2(data.windage.clicks)} clicks • ${to2(
      data.windage.moa
    )} MOA`
  );

  setText(
    "elevationLine",
    `${data.elevation.direction} • ${to2(data.elevation.clicks)} clicks • ${to2(
      data.elevation.moa
    )} MOA`
  );

  setText("dxLine", `${to2(data.deltas.dxIn)}`);
  setText("dyLine", `${to2(data.deltas.dyIn)}`);
}

function wire() {
  $("calcBtn").addEventListener("click", async () => {
    try {
      $("errorBox").textContent = "";
      await runCalc();
    } catch (e) {
      $("errorBox").textContent = String(e.message || e);
    }
  });

  // Auto-recalc when settings change
  [
    "distanceYards",
    "clickValueMoa",
    "trueMoa",
    "bullX",
    "bullY",
    "poibX",
    "poibY"
  ].forEach((id) => {
    $(id).addEventListener("change", () => $("calcBtn").click());
  });

  // API status + first calc
  checkApi();
  $("calcBtn").click();
}

document.addEventListener("DOMContentLoaded", wire);
