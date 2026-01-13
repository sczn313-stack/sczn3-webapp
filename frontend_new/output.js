// output.js
const els = {
  secId: document.getElementById("secId"),
  lastScore: document.getElementById("lastScore"),
  avgScore: document.getElementById("avgScore"),
  windLine: document.getElementById("windLine"),
  elevLine: document.getElementById("elevLine"),
  thumb: document.getElementById("thumb"),
  thumbMissing: document.getElementById("thumbMissing"),
  tipsBox: document.getElementById("tipsBox"),
  backBtn: document.getElementById("backBtn"),
  vendorBtn: document.getElementById("vendorBtn"),
};

function showThumb(dataUrl) {
  if (!dataUrl) {
    els.thumb.style.display = "none";
    if (els.thumbMissing) els.thumbMissing.style.display = "flex";
    return;
  }
  els.thumb.src = dataUrl;
  els.thumb.style.display = "block";
  if (els.thumbMissing) els.thumbMissing.style.display = "none";
}

// Basic mapping: adapt to your backend response shape
function renderFromResult(result) {
  // These are safe defaults if fields are missing
  const secId = result?.secId ?? result?.sec_id ?? result?.id ?? null;
  const lastScore = result?.lastScore ?? result?.score ?? "--";
  const avgScore = result?.avgScore ?? result?.avg ?? "--";
  const wind = result?.windage ?? result?.windLine ?? "--";
  const elev = result?.elevation ?? result?.elevLine ?? "--";
  const tip = result?.tip ?? result?.tips ?? "";

  if (secId) els.secId.textContent = `SEC-ID ${String(secId).padStart(3, "0")}`;
  else els.secId.textContent = "SEC-ID ---";

  els.lastScore.textContent = `Last Score: ${lastScore}`;
  els.avgScore.textContent = `Average Score: ${avgScore}`;
  els.windLine.textContent = `Windage: ${wind}`;
  els.elevLine.textContent = `Elevation: ${elev}`;
  els.tipsBox.textContent = tip ? String(tip) : "";
}

function load() {
  let payload = null;
  try {
    payload = JSON.parse(localStorage.getItem("SEC_LAST_RESULT") || "null");
  } catch {}

  if (!payload) {
    els.secId.textContent = "SEC-ID ---";
    els.lastScore.textContent = "Last Score: --";
    els.avgScore.textContent = "Average Score: --";
    els.windLine.textContent = "Windage: --";
    els.elevLine.textContent = "Elevation: --";
    els.tipsBox.textContent = "No result found. Go back and upload a target photo.";
    showThumb(null);
    return;
  }

  showThumb(payload.thumbDataUrl);
  renderFromResult(payload.result);
}

els.backBtn.addEventListener("click", () => {
  window.location.href = "./index.html";
});

els.vendorBtn.addEventListener("click", () => {
  // replace later with printer/vendor link coming from result or config
  window.open("https://example.com", "_blank", "noopener");
});

load();
