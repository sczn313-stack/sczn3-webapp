// sczn3-webapp/frontend_new/output.js (FULL REPLACEMENT)
// Receipt-style results renderer for Tap-n-Score
//
// Reads: sessionStorage["tapnscore_result"]
// Expects backend_new payload shape:
//  ok, clicks{windage,elevation}, directions{windage,elevation},
//  correction_in{dx,dy}, score, tip, mode, build, distanceYards, moaPerClick

(function () {
  const RESULT_KEY = "tapnscore_result";

  function esc(s){
    return String(s || "")
      .replaceAll("&","&amp;")
      .replaceAll("<","&lt;")
      .replaceAll(">","&gt;");
  }

  function $(id){ return document.getElementById(id); }

  const out = $("out") || document.body;

  const raw = sessionStorage.getItem(RESULT_KEY);
  if (!raw){
    out.innerHTML = `
      <div class="resultsWrap">
        <div class="resultsTop">
          <div class="resultsKicker">Results</div>
          <div class="resultsTitle">No result found</div>
        </div>

        <div class="resultsActions">
          <a class="btnPrimary" href="index.html">Start next session</a>
        </div>
      </div>
    `;
    return;
  }

  let r = null;
  try { r = JSON.parse(raw); } catch { r = null; }

  if (!r || r.ok !== true){
    out.innerHTML = `
      <div class="resultsWrap">
        <div class="resultsTop">
          <div class="resultsKicker">Results</div>
          <div class="resultsTitle">Invalid result payload</div>
          <div class="resultsSub">Please run a new session.</div>
        </div>

        <div class="resultsActions">
          <a class="btnPrimary" href="index.html">Start next session</a>
        </div>
      </div>
    `;
    return;
  }

  const windDir = r?.directions?.windage || "";
  const elevDir = r?.directions?.elevation || "";
  const windClicks = r?.clicks?.windage || "0.00";
  const elevClicks = r?.clicks?.elevation || "0.00";

  const dx = r?.correction_in?.dx;
  const dy = r?.correction_in?.dy;

  const hasDx = Number.isFinite(Number(dx));
  const hasDy = Number.isFinite(Number(dy));

  const score = Number.isFinite(Number(r.score)) ? String(r.score) : "";

  const distance = Number.isFinite(Number(r.distanceYards)) ? String(r.distanceYards) : "";
  const moaPerClick = Number.isFinite(Number(r.moaPerClick)) ? String(r.moaPerClick) : "";

  const mode = r.mode ? esc(r.mode) : "";
  const tip = r.tip ? esc(r.tip) : "";

  // “Impact Summary” lines: simple, calm, factual
  const impactLines = [
    "Pattern detected",
    "POIB calculated",
    "Correction measured"
  ];

  out.innerHTML = `
    <div class="resultsWrap">

      <div class="resultsTop">
        <div class="resultsKicker">Results</div>
        <div class="resultsTitle">Measured Outcome</div>
        <div class="resultsSub">After-Shot Intelligence™ from confirmed hits.</div>
      </div>

      <div class="receiptCard">
        <div class="receiptHeader">
          <div class="receiptTitle">Impact Summary</div>
          ${score ? `<div class="receiptBadge">Score ${esc(score)}</div>` : ``}
        </div>

        <div class="receiptList">
          ${impactLines.map(s => `<div class="receiptItem">• ${esc(s)}</div>`).join("")}
        </div>

        <div class="receiptDivider"></div>

        <div class="receiptTitle">Recommended Adjustment</div>

        <div class="adjGrid">
          <div class="adjRow">
            <div class="adjLabel">Windage</div>
            <div class="adjValue">${esc(windClicks)} clicks</div>
            <div class="adjDir">${esc(windDir)}</div>
          </div>

          <div class="adjRow">
            <div class="adjLabel">Elevation</div>
            <div class="adjValue">${esc(elevClicks)} clicks</div>
            <div class="adjDir">${esc(elevDir)}</div>
          </div>
        </div>

        ${(hasDx || hasDy) ? `
          <div class="receiptMeta">
            <div><span class="metaKey">Correction (in):</span>
              ${hasDx ? `dx ${esc(Number(dx).toFixed(2))}` : ``}
              ${(hasDx && hasDy) ? ` • ` : ``}
              ${hasDy ? `dy ${esc(Number(dy).toFixed(2))}` : ``}
            </div>
          </div>
        ` : ``}

        <div class="receiptFooter">
          <div class="receiptSig">After-Shot Intelligence™</div>
          ${(distance || moaPerClick) ? `
            <div class="receiptTiny">
              ${distance ? `Distance ${esc(distance)} yds` : ``}
              ${(distance && moaPerClick) ? ` • ` : ``}
              ${moaPerClick ? `MOA/Click ${esc(moaPerClick)}` : ``}
            </div>
          ` : ``}
        </div>
      </div>

      ${(tip || mode) ? `
        <div class="resultsNote">
          ${tip ? `<div class="noteLine">${tip}</div>` : ``}
          ${mode ? `<div class="noteLine subtle">Mode: ${mode}</div>` : ``}
        </div>
      ` : ``}

      <div class="resultsActions">
        <a class="btnPrimary" href="index.html">Start next session</a>

        <button id="saveBtn" class="btnSecondary" type="button">Save this result</button>

        <button id="exportBtn" class="btnSecondary" type="button">Export receipt</button>
      </div>

      <div class="resultsBottom">
        <div class="subtle">Tap-n-Score™</div>
      </div>

    </div>
  `;

  // Save: store the receipt HTML + result JSON (simple local save)
  const saveBtn = document.getElementById("saveBtn");
  if (saveBtn){
    saveBtn.addEventListener("click", () => {
      const stamp = new Date();
      const key = `tapnscore_saved_${stamp.getTime()}`;
      const payload = { savedAt: stamp.toISOString(), result: r };
      try{
        localStorage.setItem(key, JSON.stringify(payload));
        alert("Saved.");
      } catch {
        alert("Save failed (storage full).");
      }
    });
  }

  // Export: creates a downloadable HTML “receipt” file (no server needed)
  const exportBtn = document.getElementById("exportBtn");
  if (exportBtn){
    exportBtn.addEventListener("click", () => {
      const html = `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Tap-n-Score Receipt</title>
<style>${exportCss()}</style></head>
<body>${document.querySelector(".receiptCard")?.outerHTML || ""}</body></html>`;

      const blob = new Blob([html], { type: "text/html" });
      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = "tap-n-score-receipt.html";
      document.body.appendChild(a);
      a.click();
      a.remove();

      setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
  }

  function exportCss(){
    // Minimal standalone styling for the receipt
    return `
      body{margin:0;padding:18px;background:#0b0b0c;color:#f4f4f5;font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;}
      .receiptCard{border:1px solid rgba(255,255,255,0.14);background:rgba(255,255,255,0.05);border-radius:14px;padding:16px;max-width:560px;margin:0 auto;}
      .receiptHeader{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:10px;}
      .receiptTitle{font-size:16px;font-weight:650;}
      .receiptBadge{font-size:12px;padding:6px 10px;border:1px solid rgba(255,255,255,0.18);border-radius:999px;opacity:0.9;}
      .receiptList{opacity:0.85;font-size:14px;line-height:1.55;margin-bottom:10px;}
      .receiptDivider{height:1px;background:rgba(255,255,255,0.14);margin:12px 0;}
      .adjGrid{display:flex;flex-direction:column;gap:10px;margin-top:10px;}
      .adjRow{display:grid;grid-template-columns:1fr 1fr auto;gap:10px;align-items:baseline;}
      .adjLabel{opacity:0.75;font-size:13px;}
      .adjValue{font-weight:650;}
      .adjDir{opacity:0.9;}
      .receiptMeta{margin-top:10px;opacity:0.75;font-size:13px;}
      .receiptFooter{margin-top:12px;display:flex;flex-direction:column;gap:6px;}
      .receiptSig{font-size:14px;font-weight:650;opacity:0.92;}
      .receiptTiny{font-size:12px;opacity:0.7;}
      .metaKey{opacity:0.8;}
    `;
  }
})();
