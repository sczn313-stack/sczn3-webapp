// sczn3-webapp/frontend_new/saved.js (FULL FILE REPLACEMENT)
// Reads localStorage: sczn3_saved_sessions_v1 (array)
// Opens a saved session by loading its "result" into sessionStorage: sczn3_last_result_json
// iOS-safe navigation: cache-bust on href changes

(function () {
  const LS_SAVED = "sczn3_saved_sessions_v1";
  const SS_LAST  = "sczn3_last_result_json";
  const SS_DIST  = "sczn3_distance_yards";
  const SS_PHOTO = "sczn3_targetPhoto_dataUrl";

  function esc(s){
    return String(s || "")
      .replaceAll("&","&amp;")
      .replaceAll("<","&lt;")
      .replaceAll(">","&gt;");
  }

  function safeJsonParse(s){
    try { return JSON.parse(String(s || "")); } catch { return null; }
  }

  function loadArr(){
    const raw = localStorage.getItem(LS_SAVED) || "[]";
    const arr = safeJsonParse(raw);
    return Array.isArray(arr) ? arr : [];
  }

  function saveArr(arr){
    localStorage.setItem(LS_SAVED, JSON.stringify(arr || []));
  }

  function formatLocal(iso){
    try{
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return iso || "";
      return d.toLocaleString();
    } catch { return iso || ""; }
  }

  function go(url){
    window.location.href = `${url}?v=${Date.now()}`;
  }

  function render(){
    const root = document.getElementById("savedRoot") || document.body;
    const items = loadArr();

    root.innerHTML = `
      <div class="resultsWrap">
        <div class="resultsTop">
          <div class="resultsKicker">Saved</div>
          <div class="resultsTitle">Saved Sessions</div>
          <div class="resultsSub">Stored on this device.</div>
        </div>

        ${items.length ? `
          <div class="savedList">
            ${items.map(row).join("")}
          </div>

          <div class="resultsActions">
            <button id="startBtn" class="btnPrimary" type="button">Start new session</button>
            <button id="clearAllBtn" class="btnSecondary" type="button">Clear all saved</button>
          </div>
        ` : `
          <div class="resultsNote">
            <div class="noteLine">No saved sessions yet.</div>
            <div class="noteLine subtle">Save from the Results or Receipt screen.</div>
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
      const goUpload = () => go("./index.html");
      startBtn.addEventListener("click", goUpload);
      startBtn.addEventListener("touchstart", goUpload, { passive: true });
    }

    const clearAllBtn = document.getElementById("clearAllBtn");
    if (clearAllBtn){
      clearAllBtn.addEventListener("click", () => {
        if (!confirm("Clear ALL saved sessions on this device?")) return;
        saveArr([]);
        render();
      });
    }

    // Open / Delete handlers
    document.querySelectorAll("[data-open-id]").forEach(btn => {
      const open = () => {
        const id = btn.getAttribute("data-open-id");
        const rec = loadArr().find(x => x && x.id === id);
        if (!rec || !rec.result){
          alert("Record missing.");
          return;
        }
        // Restore last result and distance for continuity
        sessionStorage.setItem(SS_LAST, JSON.stringify(rec.result));
        if (rec.yards) sessionStorage.setItem(SS_DIST, String(rec.yards));
        if (rec.photoDataUrl) sessionStorage.setItem(SS_PHOTO, String(rec.photoDataUrl));
        go("./output.html");
      };
      btn.addEventListener("click", open);
      btn.addEventListener("touchstart", open, { passive: true });
    });

    document.querySelectorAll("[data-del-id]").forEach(btn => {
      const del = () => {
        const id = btn.getAttribute("data-del-id");
        if (!id) return;
        if (!confirm("Delete this saved session?")) return;
        const next = loadArr().filter(x => x && x.id !== id);
        saveArr(next);
        render();
      };
      btn.addEventListener("click", del);
    });
  }

  function row(item){
    const when  = formatLocal(item.created_at || item.savedAt || "");
    const dist  = item.yards ? `${Number(item.yards)} yds` : "";
    const score = item.preview?.score ? `Score ${item.preview.score}` : "";
    const wind  = item.preview?.wind || "";
    const elev  = item.preview?.elev || "";

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
          <button class="btnSecondary" type="button" data-open-id="${esc(item.id)}">Open</button>
          <button class="btnSecondary" type="button" data-del-id="${esc(item.id)}">Delete</button>
        </div>
      </div>
    `;
  }

  render();
})();
