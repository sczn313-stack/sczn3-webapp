// sczn3-webapp/frontend_new/receipt.js (NEW FILE)
// Receipt builder BEFORE saving.
// Save to localStorage + Export to clipboard/file.

(function () {
  const DIST_KEY   = "sczn3_distance_yards";
  const LAST_KEY   = "sczn3_last_result_json";
  const PHOTO_KEY  = "sczn3_targetPhoto_dataUrl";
  const VENDOR_BUY = "sczn3_vendor_buy_url";

  const LS_SAVED = "sczn3_saved_sessions_v1";

  function $(id){ return document.getElementById(id); }

  const backBtn  = $("backBtn");
  const savedBtn = $("savedBtn");
  const saveBtn  = $("saveBtn");
  const exportBtn= $("exportBtn");

  const miniStatus = $("miniStatus");
  const buyMoreBtn = $("buyMoreBtn");

  const scopeInput = $("scopeInput");
  const ammoInput  = $("ammoInput");
  const gunInput   = $("gunInput");
  const yardsInput = $("yardsInput");
  const notesInput = $("notesInput");

  const previewBox = $("previewBox");

  function status(msg){
    if (miniStatus) miniStatus.textContent = String(msg || "");
  }

  function safeJsonParse(s){
    try { return JSON.parse(String(s || "")); } catch { return null; }
  }

  function nowIso(){ return new Date().toISOString(); }
  function shortId(){ return Math.random().toString(16).slice(2, 8).toUpperCase(); }

  function getDistance(){
    const v = sessionStorage.getItem(DIST_KEY);
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : 100;
  }

  function getLastResult(){
    const raw = sessionStorage.getItem(LAST_KEY) || "";
    const obj = safeJsonParse(raw);
    return obj && typeof obj === "object" ? obj : null;
  }

  function setVendorBuyLink(){
    const url = sessionStorage.getItem(VENDOR_BUY);
    if (buyMoreBtn && url){
      buyMoreBtn.href = url;
      buyMoreBtn.style.display = "inline-block";
    }
  }

  function loadSaved(){
    const raw = localStorage.getItem(LS_SAVED) || "[]";
    const arr = safeJsonParse(raw);
    return Array.isArray(arr) ? arr : [];
  }

  function saveSaved(arr){
    localStorage.setItem(LS_SAVED, JSON.stringify(arr || []));
  }

  function esc(s){
    return String(s || "").replace(/</g,"&lt;").replace(/>/g,"&gt;");
  }

  function buildModel(){
    const last = getLastResult();

    const clicksWind = last?.clicks?.windage ?? "--";
    const clicksElev = last?.clicks?.elevation ?? "--";
    const dirWind    = last?.directions?.windage ?? "";
    const dirElev    = last?.directions?.elevation ?? "";
    const score      = (last && typeof last.score !== "undefined") ? String(last.score) : "--";

    return {
      id: shortId(),
      created_at: nowIso(),
      scope: String(scopeInput?.value || "").trim(),
      ammo:  String(ammoInput?.value || "").trim(),
      gun:   String(gunInput?.value || "").trim(),
      yards: Number(yardsInput?.value || getDistance()),
      notes: String(notesInput?.value || "").trim(),

      result: last,
      photoDataUrl: sessionStorage.getItem(PHOTO_KEY) || "",

      preview: {
        score,
        wind: `${clicksWind} ${dirWind}`.trim(),
        elev: `${clicksElev} ${dirElev}`.trim()
      }
    };
  }

  function renderPreview(){
    const m = buildModel();
    if (!previewBox) return;

    previewBox.innerHTML = `
      <div class="receiptLine"><span class="k">Score</span><span class="v">${esc(m.preview.score)}</span></div>
      <div class="receiptLine"><span class="k">Windage</span><span class="v">${esc(m.preview.wind)}</span></div>
      <div class="receiptLine"><span class="k">Elevation</span><span class="v">${esc(m.preview.elev)}</span></div>

      <div class="hr"></div>

      <div class="receiptLine"><span class="k">Distance</span><span class="v">${esc(m.yards)} yds</span></div>
      <div class="receiptLine"><span class="k">Scope</span><span class="v">${esc(m.scope || "—")}</span></div>
      <div class="receiptLine"><span class="k">Ammo</span><span class="v">${esc(m.ammo || "—")}</span></div>
      <div class="receiptLine"><span class="k">Gun</span><span class="v">${esc(m.gun || "—")}</span></div>

      ${m.notes ? `<div class="notesBox">${esc(m.notes)}</div>` : ``}

      <div class="tinyMuted">Receipt ID: ${esc(m.id)} • ${esc(m.created_at)}</div>
    `;
  }

  function ensureLast(){
    if (!getLastResult()){
      status("No results found. Go back and run a session.");
      return false;
    }
    return true;
  }

  function doSave(){
    if (!ensureLast()) return;

    const model = buildModel();
    const arr = loadSaved();
    arr.unshift(model);
    saveSaved(arr);

    status("Saved. Opening Saved Sessions…");
    window.location.href = "./saved.html";
  }

  async function doExport(){
    if (!ensureLast()) return;

    const m = buildModel();
    const text =
`Tap-n-Score™ Receipt
ID: ${m.id}
Time: ${m.created_at}

Distance: ${m.yards} yds
Scope: ${m.scope || "—"}
Ammo: ${m.ammo || "—"}
Gun: ${m.gun || "—"}

Score: ${m.preview.score}
Windage: ${m.preview.wind}
Elevation: ${m.preview.elev}

Notes: ${m.notes || "—"}
`;

    try{
      await navigator.clipboard.writeText(text);
      status("Receipt copied to clipboard.");
      alert("Receipt copied to clipboard.");
      return;
    } catch {
      try{
        const blob = new Blob([text], { type:"text/plain;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `Tap-n-Score_Receipt_${m.id}.txt`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        status("Receipt exported as a file.");
      } catch {
        status("Export failed.");
        alert("Export failed on this device/browser.");
      }
    }
  }

  // ===== INIT =====
  (function init(){
    setVendorBuyLink();

    if (yardsInput) yardsInput.value = String(getDistance());

    const onChange = () => renderPreview();
    [scopeInput, ammoInput, gunInput, yardsInput, notesInput].forEach((el) => {
      if (!el) return;
      el.addEventListener("input", onChange);
      el.addEventListener("change", onChange);
    });

    renderPreview();

    if (!ensureLast()){
      status("No results found. Go back and run a session.");
    } else {
      status("Add setup details, then Save or Export.");
    }
  })();

  if (backBtn) backBtn.addEventListener("click", () => window.location.href = "./output.html");
  if (savedBtn) savedBtn.addEventListener("click", () => window.location.href = "./saved.html");

  if (saveBtn) saveBtn.addEventListener("click", doSave);
  if (exportBtn) exportBtn.addEventListener("click", doExport);
})();
