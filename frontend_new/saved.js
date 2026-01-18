// sczn3-webapp/frontend_new/saved.js (FULL FILE REPLACEMENT)
// Uses the SAME storage schema as receipt.js:
//   localStorage: sczn3_saved_sessions_v1  (array)
//   sessionStorage: sczn3_last_result_json (to open in output.html)
// Reliable iOS navigation + no “dead button” behavior.

(function () {
  const LS_SAVED = "sczn3_saved_sessions_v1";
  const SS_LAST  = "sczn3_last_result_json";
  const VENDOR_BUY = "sczn3_vendor_buy_url";

  function $(id){ return document.getElementById(id); }

  const root = $("savedRoot") || document.body;

  function safeJsonParse(s){
    try { return JSON.parse(String(s || "")); } catch { return null; }
  }

  function esc(s){
    return String(s || "")
      .replaceAll("&","&amp;")
      .replaceAll("<","&lt;")
      .replaceAll(">","&gt;");
  }

  function loadSaved(){
    const raw = localStorage.getItem(LS_SAVED) || "[]";
    const arr = safeJsonParse(raw);
    return Array.isArray(arr) ? arr : [];
  }

  function saveSaved(arr){
    localStorage.setItem(LS_SAVED, JSON.stringify(arr || []));
  }

  function formatLocal(iso){
    try{
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return iso || "";
      return d.toLocaleString();
    } catch { return iso || ""; }
  }

  function goUpload(){
    window.location.href = `./index.html?v=${Date.now()}`;
  }

  function openItemById(id){
    const items = loadSaved();
    const item = items.find(x => x && x.id === id);
    if (!item || !item.result){
      alert("Saved record is missing.");
      return;
    }
    sessionStorage.setItem(SS_LAST, JSON.stringify(item.result));
    window.location.href = `./output.html?v=${Date.now()}`;
  }

  function deleteItemById(id){
    const items = loadSaved().filter(x => x && x.id !== id);
    saveSaved(items);
    render();
  }

  function clearAll(){
    saveSaved([]);
    render();
  }

  function setVendorBuyLink(){
    const url = sessionStorage.getItem(VENDOR_BUY);
    const buy = $("buyMoreBtn");
    if (buy && url){
      buy.href = url;
      buy.style.display = "inline-block";
    }
  }

  function row(item){
    const id = item.id || "";
    const when = formatLocal(item.created_at || item.savedAt || "");
    const dist = item.yards ? `${Number(item.yards)} yds` : (item.distanceYards ? `${Number(item.distanceYards)} yds` : "");
    const score =
      (item.preview && item.preview.score && item.preview.score !== "--")
        ? `Score ${item.preview.score}`
        : (Number.isFinite(Number(item.score)) ? `Score ${Number(item.score)}` : "");

    // Prefer receipt preview strings
    const wind = item.preview?.wind || item.wind || "";
    const elev = item.preview?.elev || item.elev || "";

    return `
      <div class="savedRow">
        <div class="savedTopLine">
          <div class="savedWhen">${esc(when)}</div>
          <div class="savedMeta">${esc([dist, score].filter(Boolean).join(" • "))}</div>
        </div>

        <div class="savedAdj">
          <div class="savedAdjLine"><span class="k">Windage</span> <span class="v">${esc(wind)}</span></div>
          <div class="savedAdjLine"><span class="k">Elevation</span> <span class="v">${esc(elev)}</span></div>
        </div>

        <div class="savedBtns">
          <button class="btnSecondary" type="button" data-open-id="${esc(id)}">Open</button>
          <button class="btnSecondary" type="button" data-del-id="${esc(id)}">Delete</button>
        </div>
      </div>
    `;
  }

  function render(){
    const items = loadSaved();

    root.innerHTML = `
      <div class="resultsWrap">
        <div class="resultsTop">
          <div class="resultsKicker">Saved</div>
          <div class="resultsTitle">Saved Sessions</div>
          <div class="resultsSub">Stored on this device.</div>
        </div>

        <div class="resultsActions" style="margin-bottom:12px;">
          <button id="startBtn" class="btnPrimary" type="button">Start new session</button>
          <a id="buyMoreBtn" class="btnSecondary" href="#" target="_blank" rel="noopener" style="display:none; text-align:center;">
            Buy more targets
          </a>
        </div>

        ${items.length ? `
          <div class="savedList">
            ${items.map(row).join("")}
          </div>

          <div class="resultsActions">
            <button id="clearAllBtn" class="btnSecondary" type="button">Clear all saved</button>
          </div>
        ` : `
          <div class="resultsNote">
            <div class="noteLine">No saved sessions yet.</div>
            <div class="noteLine subtle">Save from the Receipt screen.</div>
          </div>
        `}

        <div class="resultsBottom">
          <div class="subtle">Tap-n-Score™</div>
        </div>
      </div>
    `;

    setVendorBuyLink();

    const startBtn = document.getElementById("startBtn");
    if (startBtn){
      startBtn.addEventListener("click", goUpload);
      startBtn.addEventListener("touchstart", goUpload, { passive: true });
    }

    const openBtns = document.querySelectorAll("[data-open-id]");
    openBtns.forEach(btn => {
      const handler = () => openItemById(btn.getAttribute("data-open-id"));
      btn.addEventListener("click", handler);
      btn.addEventListener("touchstart", handler, { passive: true });
    });

    const delBtns = document.querySelectorAll("[data-del-id]");
    delBtns.forEach(btn => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-del-id");
        if (!id) return;
        if (!confirm("Delete this saved session?")) return;
        deleteItemById(id);
      });
    });

    const clearAllBtn = document.getElementById("clearAllBtn");
    if (clearAllBtn){
      clearAllBtn.addEventListener("click", () => {
        if (!confirm("Clear ALL saved sessions on this device?")) return;
        clearAll();
      });
    }
  }

  render();
})();
