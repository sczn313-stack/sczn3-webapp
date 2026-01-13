// output.js
(function () {
  const secIdEl = document.getElementById("secId");
  const lastScoreEl = document.getElementById("lastScore");
  const avgScoreEl = document.getElementById("avgScore");
  const windLineEl = document.getElementById("windLine");
  const elevLineEl = document.getElementById("elevLine");
  const tipsBoxEl = document.getElementById("tipsBox");
  const thumbEl = document.getElementById("thumb");

  const backBtn = document.getElementById("backBtn");
  const vendorBtn = document.getElementById("vendorBtn");

  // Load stored result
  const raw = localStorage.getItem("sec_last_result");
  const result = raw ? JSON.parse(raw) : null;

  // Thumbnail
  const thumbDataUrl = localStorage.getItem("sec_last_thumb");
  if (thumbDataUrl) thumbEl.src = thumbDataUrl;

  // Render
  const secId = (result && (result.secId || result.sec_id || result.id)) || "—";
  secIdEl.textContent = `SEC-ID ${String(secId).toUpperCase()}`;

  // These field names are flexible—map whatever your backend returns:
  const lastScore = result?.lastScore ?? result?.score ?? "—";
  const avgScore = result?.avgScore ?? result?.avg ?? "—";

  // Wind/Elev lines should already be correct if your backend math is fixed
  const wind = result?.wind ?? result?.windage ?? result?.windLine ?? "—";
  const elev = result?.elev ?? result?.elevation ?? result?.elevLine ?? "—";

  lastScoreEl.textContent = `LAST SCORE: ${lastScore}`;
  avgScoreEl.textContent = `AVG SCORE: ${avgScore}`;

  windLineEl.textContent = `WINDAGE: ${wind}`;
  elevLineEl.textContent = `ELEVATION: ${elev}`;

  const tips = result?.tip ?? result?.tips ?? "TIP: —";
  tipsBoxEl.textContent = tips;

  // Buttons
  backBtn.addEventListener("click", () => {
    window.location.href = "./index.html";
  });

  vendorBtn.addEventListener("click", () => {
    // set your vendor URL here (or from result.vendorUrl)
    const url = result?.vendorUrl || "https://example.com";
    window.open(url, "_blank", "noopener");
  });
})();
