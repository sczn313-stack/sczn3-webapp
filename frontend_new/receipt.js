// sczn3-webapp/frontend_new/receipt.js  (NEW FILE)
// Receipt Builder (before save) + Export
//
// Saves into localStorage:
//  sczn3_saved_sessions_v1  => array newest-first
//
// Pulls from sessionStorage (set by output.js):
//  sczn3_last_result_json
//  sczn3_distance_yards
//  sczn3_targetPhoto_dataUrl
//  sczn3_vendor_buy_url

(function () {
  const LS_SAVED = "sczn3_saved_sessions_v1";

  const PHOTO_KEY = "sczn3_targetPhoto_dataUrl";
  const DIST_KEY  = "sczn3_distance_yards";
  const LAST_KEY  = "sczn3_last_result_json";

  const VENDOR_BUY = "sczn3_vendor_buy_url";

  function $(id){ return document.getElementById(id); }

  const backBtn        = $("backBtn");
  const startNewBtn    = $("startNewBtn");
  const saveSessionBtn = $("saveSessionBtn");
  const exportBtn      = $("exportBtn");
  const miniStatus     = $("miniStatus");

  const scopeInput = $("scopeInput");
  const ammoInput  = $("ammoInput");
  const gunInput   = $("gunInput");
  const yardsInput = $("yardsInput");
  const notesInput = $("notesInput");

  const receiptPreview = $("receiptPreview");
  const buyMoreBtn = $("buyMoreBtn");

  function status(msg){
    if (!miniStatus) return;
    miniStatus.textContent = String(msg || "");
  }

  function safeJsonParse(s){
    try { return JSON.parse(String(s || "")); } catch { return null; }
  }

  function nowIso(){
    return new Date().toISOString();
  }

  function shortId(){
    return Math.random().toString(16).slice(2, 8).toUpperCase();
  }

  function loadSaved(){
    const raw = localStorage.getItem(LS_SAVED) || "[]";
    const arr = safeJsonParse(raw);
    return Array.isArray(arr) ? arr : [];
  }

  function saveSaved(arr){
    localStorage.setItem(LS_SAVED, JSON.stringify(arr || []));
  }

  function getLastResult(){
    const raw = sessionStorage.getItem(LAST_KEY) || "";
    const obj = safeJsonParse(raw);
    return obj && typeof obj === "object" ? obj : null;
  }

  function getDistance(){
    const v = sessionStorage.getItem(DIST_KEY);
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : 100;
  }

  function setVendorBuyLink(){
    const url = sessionStorage.getItem(VENDOR_BUY);
    if (buyMoreBtn && url){
      buyMoreBtn.href = url;
      buyMoreBtn.style.display = "inline-block";
    }
  }

  function buildPreviewModel(){
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

      // result payload
      result: last,
      // image (optional)
      photoDataUrl: sessionStorage.getItem(PHOTO_KEY) || "",

      // easy-to-render fields
      preview: {
        wind: `${clicksWind} ${dirWind}`.trim(),
        elev: `${clicksElev} ${dirElev}`.trim(),
        score
      }
    };
  }

  function renderPreview(){
    if (!receiptPreview) return;
    const m = buildPreviewModel();

    const safe = (s) => String(s || "").replace(/</g, "&lt;").replace(/>/g, "&gt;");

    receiptPreview.innerHTML = `
      <div class="receiptLine"><span class="k">Score</span><span class="v">${safe(m.preview.score)}</span></div>
      <div class="receiptLine"><span class="k">Windage</span><span class="v">${safe(m.preview.wind)}</span></div>
      <div class="receiptLine"><span class="k">Elevation</span><span class="v">${safe(m.preview.elev)}</span></div>

      <div class="hr"></div>

      <div class="receiptLine"><span class="k">Distance</span><span class="v">${safe(m.yards)} yds</span></div>
      <div class="receiptLine"><span class="k">Scope</span><span class="v">${safe(m.scope || "—")}</span></div>
      <div class="receiptLine"><span class="k">Ammo</span><span class="v">${safe(m.ammo || "—")}</span></div>
      <div class="receiptLine"><span class="k">Gun</span><span class="v">${safe(m.gun || "—")}</span></div>

      ${m.notes ? `<div class="notesBox">${safe(m.notes)}</div>` : ``}

      <div class="tinyMuted">Receipt ID: ${safe(m.id)} • ${safe(m.created_at)}</div>
    `;
  }

  function ensureLastResultExists(){
    const last = getLastResult();
    if (!last){
      status("No results found. Go back and run a session first.");
      return false;
    }
    return true;
  }

  function saveSession(){
    if (!ensureLastResultExists()) return;

    const model = buildPreviewModel();
    const arr = loadSaved();

    // newest first
    arr.unshift(model);
    saveSaved(arr);

    status("Saved. Opening Saved Sessions…");
    window.location.href = "./saved.html";
  }

  async function exportReceipt(){
    if (!ensureLastResultExists()) return;

    const model = buildPreviewModel();

    // Simple export: JSON + a text summary (copy/share friendly)
    const text =
`Tap-n-Score™ Receipt
ID: ${model.id}
Time: ${model.created_at}

Distance: ${model.yards} yds
Scope: ${model.scope || "—"}
Ammo: ${model.ammo || "—"}
Gun: ${model.gun || "—"}

Score: ${model.preview.score}
Windage: ${model.preview.wind}
Elevation: ${model.preview.elev}

Notes: ${model.notes || "—"}
`;

    // Try clipboard first (iOS Safari sometimes blocks; still safe)
    try{
      await navigator.clipboard.writeText(text);
      status("Receipt copied to clipboard.");
      alert("Receipt copied to clipboard.");
      return;
    } catch {
      // fallback: download as .txt
      try{
        const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `Tap-n-Score_Receipt_${model.id}.txt`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        status("Receipt exported as a file.");
      } catch (err){
        status("Export failed.");
        alert("Export failed on this device/browser.");
      }
    }
  }

  // ===== INIT =====
  (function init(){
    setVendorBuyLink();

    // Prefill yards from session
    if (yardsInput){
      yardsInput.value = String(getDistance());
    }

    // Live preview
    const onChange = () => renderPreview();
    [scopeInput, ammoInput, gunInput, yardsInput, notesInput].forEach((el) => {
      if (!el) return;
      el.addEventListener("input", onChange);
      el.addEventListener("change", onChange);
    });

    renderPreview();

    if (!ensureLastResultExists()){
      // still render, but warn
      status("No results found. Go back and run a session first.");
    } else {
      status("Add your setup details, then Save or Export.");
    }
  })();

  // ===== NAV =====
  if (backBtn){
    backBtn.addEventListener("click", () => {
      window.location.href = "./output.html";
    });
  }

  if (startNewBtn){
    startNewBtn.addEventListener("click", () => {
      window.location.href = "./index.html";
    });
  }

  // ===== ACTIONS =====
  if (saveSessionBtn){
    saveSessionBtn.addEventListener("click", saveSession);
  }

  if (exportBtn){
    exportBtn.addEventListener("click", exportReceipt);
  }
})();
