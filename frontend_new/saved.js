// sczn3-webapp/frontend_new/saved.js (FULL FILE REPLACEMENT)
// Uses SAME storage as receipt.js:
//   localStorage: sczn3_saved_sessions_v1  (array of saved session objects)
// Re-opens by writing:
//   sessionStorage: sczn3_last_result_json

(function () {
  const LS_SAVED = "sczn3_saved_sessions_v1";
  const LAST_KEY = "sczn3_last_result_json";

  function esc(s){
    return String(s || "")
      .replaceAll("&","&amp;")
      .replaceAll("<","&lt;")
      .replaceAll(">","&gt;");
  }

  function $(id){ return document.getElementById(id); }
  const root = $("savedRoot") || document.body;

  function safeJsonParse(s){
    try { return JSON.parse(String(s || "")); } catch { return null; }
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
    } catch {
      return iso || "";
    }
  }

  function goUpload(){
    window.location.href = `./index.html?v=${Date.now()}`;
  }

  function goOutputWith(rec){
    // Write last result so output.html renders it
    const result = rec && rec.result ? rec.result : null;
    if (!result){
      alert("Saved record is missing results.");
      return;
    }
    sessionStorage.setItem(LAST_KEY, JSON.stringify(result));
    window.location.href = `./output.html?v=${Date.now()}`;
  }

  function removeAt(idx){
    const arr = loadSaved();
    arr.splice(idx, 1);
    saveSaved(arr);
    render();
  }

  function clearAll(){
    saveSaved([]);
    render();
  }

  function rowHtml(rec, i){
    const when  = formatLocal(rec.created_at || rec.savedAt || rec.when || "");
    const yards = rec.yards ? `${Number(rec.yards)} yds` : "";
    const score = rec.preview?.score ? `Score ${rec.preview.score}` : "";

    const wind  = rec.preview?.wind || "";
    const elev  = rec.preview?.elev || "";

    const meta = [yards, score].filter(Boolean).join(" • ");

    return `
      <div class="savedRow">
        <div class="savedTopLine">
          <div class="savedWhen">${esc(when || "Saved session")}</div>
          <div class="savedMeta">${esc(meta)}</div>
        </div>

        <div class="savedAdj">
          <div class="savedAdjLine"><span class="k">Windage</span> <span class="v">${esc(wind || "—")}</span></div>
          <div class="savedAdjLine"><span class="k">Elevation</span> <span class="v">${esc(elev || "—")}</span></div>
        </div>

        <div class="savedBtns">
          <button class="btnSecondary" type="button" data-open="${i}">Open</button>
          <button class="btnSecondary" type="button" data-del="${i}">Delete</button>
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

        ${items.length ? `
          <div class="savedList">
            ${items.map((rec,i) => rowHtml(rec,i)).join("")}
          </div>

          <div class="resultsActions">
            <button id="startBtn" class="btnPrimary" type="button">Start new session</button>
            <button id="clearAllBtn" class="btnSecondary" type="button">Clear all saved</button>
          </div>
        ` : `
          <div class="resultsNote">
            <div class="noteLine">No saved sessions yet.</div>
            <div class="noteLine subtle">Save from the Results screen.</div>
          </div>

          <div class="resultsActions">
            <button id="startBtn" class="btnPrimary" type="button">Start new session</button>
          </div>
        `}

        <div class="resultsBottom">
          <div class="subtle">Tap-n-Score™</div>
        </div>
      </div>
    `;

    // Start new session (iOS reliable)
    const startBtn = document.getElementById("startBtn");
    if (startBtn){
      startBtn.addEventListener("click", goUpload);
      startBtn.addEventListener("touchstart", goUpload, { passive:true });
    }

    // Open/Delete bindings
    document.querySelectorAll("[data-open]").forEach(btn => {
      const open = () => {
        const i = Number(btn.getAttribute("data-open"));
        const rec = loadSaved()[i];
        if (!rec) return;
        goOutputWith(rec);
      };
      btn.addEventListener("click", open);
      btn.addEventListener("touchstart", open, { passive:true });
    });

    document.querySelectorAll("[data-del]").forEach(btn => {
      btn.addEventListener("click", () => {
        const i = Number(btn.getAttribute("data-del"));
        if (!confirm("Delete this saved session?")) return;
        removeAt(i);
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
