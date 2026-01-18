// sczn3-webapp/frontend_new/saved.js (FULL FILE REPLACEMENT)
// Reads saved sessions from localStorage "sczn3_saved_sessions_v1" (array).
// Reliable iOS navigation + open/delete.

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

  function loadSaved(){
    try{
      const raw = localStorage.getItem(LS_SAVED) || "[]";
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : [];
    } catch { return []; }
  }

  function saveSaved(arr){
    try{
      localStorage.setItem(LS_SAVED, JSON.stringify(arr || []));
      return true;
    } catch { return false; }
  }

  function formatLocal(iso){
    try{
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return iso || "";
      return d.toLocaleString();
    } catch { return iso || ""; }
  }

  function two(n){
    const x = Number(n);
    return Number.isFinite(x) ? x.toFixed(2) : "--";
  }

  function goUpload(){
    window.location.href = `./index.html?v=${Date.now()}`;
  }

  function openItem(idx){
    const arr = loadSaved();
    const rec = arr[idx];
    if (!rec || !rec.result) {
      alert("Record missing.");
      return;
    }
    sessionStorage.setItem(LAST_KEY, JSON.stringify(rec.result));
    window.location.href = `./output.html?v=${Date.now()}`;
  }

  function deleteItem(idx){
    const arr = loadSaved();
    arr.splice(idx, 1);
    saveSaved(arr);
    render();
  }

  function render(){
    const arr = loadSaved();

    root.innerHTML = `
      <div class="resultsWrap">
        <div class="resultsTop">
          <div class="resultsKicker">Saved</div>
          <div class="resultsTitle">Saved Sessions</div>
          <div class="resultsSub">Stored on this device.</div>
        </div>

        ${arr.length ? `
          <div class="savedList">
            ${arr.map((item, i) => savedRow(item, i)).join("")}
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

    const startBtn = document.getElementById("startBtn");
    if (startBtn){
      startBtn.addEventListener("click", goUpload);
      startBtn.addEventListener("touchstart", goUpload, { passive: true });
    }

    const openBtns = document.querySelectorAll("[data-open]");
    openBtns.forEach((btn) => {
      const i = Number(btn.getAttribute("data-open"));
      const fn = () => openItem(i);
      btn.addEventListener("click", fn);
      btn.addEventListener("touchstart", fn, { passive: true });
    });

    const delBtns = document.querySelectorAll("[data-del]");
    delBtns.forEach((btn) => {
      const i = Number(btn.getAttribute("data-del"));
      btn.addEventListener("click", () => {
        if (!confirm("Delete this saved session?")) return;
        deleteItem(i);
      });
    });

    const clearAllBtn = document.getElementById("clearAllBtn");
    if (clearAllBtn){
      clearAllBtn.addEventListener("click", () => {
        if (!confirm("Clear ALL saved sessions on this device?")) return;
        saveSaved([]);
        render();
      });
    }
  }

  function savedRow(item, i){
    const when = formatLocal(item.created_at || item.savedAt || "");
    const dist = Number.isFinite(Number(item.yards)) ? `${Number(item.yards)} yds` : "";
    const score = (item.preview && item.preview.score) ? `Score ${item.preview.score}` : "";

    const wind = item.preview ? item.preview.wind : "";
    const elev = item.preview ? item.preview.elev : "";

    return `
      <div class="savedRow">
        <div class="savedTopLine">
          <div class="savedWhen">${esc(when)}</div>
          <div class="savedMeta">${esc([dist, score].filter(Boolean).join(" • "))}</div>
        </div>

        <div class="savedAdj">
          <div class="savedAdjLine"><span class="k">Windage</span> <span class="v">${esc(wind || "--")}</span></div>
          <div class="savedAdjLine"><span class="k">Elevation</span> <span class="v">${esc(elev || "--")}</span></div>
        </div>

        <div class="savedBtns">
          <button class="btnSecondary" type="button" data-open="${esc(i)}">Open</button>
          <button class="btnSecondary" type="button" data-del="${esc(i)}">Delete</button>
        </div>
      </div>
    `;
  }

  render();
})();
