// sczn3-webapp/frontend_new/saved.js (FULL FILE REPLACEMENT)
// Uses the SAME storage schema as receipt.js:
//   localStorage: sczn3_saved_sessions_v1  (array)
//   sessionStorage: sczn3_last_result_json (to open in output.html)

(function () {
  const LS_SAVED = "sczn3_saved_sessions_v1";
  const SS_LAST  = "sczn3_last_result_json";

  function $(id){ return document.getElementById(id); }

  function esc(s){
    return String(s || "")
      .replaceAll("&","&amp;")
      .replaceAll("<","&lt;")
      .replaceAll(">","&gt;");
  }

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
    } catch { return iso || ""; }
  }

  function goUpload(){
    window.location.href = `./index.html?v=${Date.now()}`;
  }

  function render(){
    const root = $("savedRoot") || document.body;
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
            ${items.map(row).join("")}
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
      startBtn.addEventListener("touchstart", goUpload, { passive:true });
    }

    const openBtns = document.querySelectorAll("[data-open]");
    openBtns.forEach(btn => {
      const open = () => {
        const i = Number(btn.getAttribute("data-open"));
        const item = items[i];
        if (!item || !item.result){
          alert("Saved record missing.");
          return;
        }
        sessionStorage.setItem(SS_LAST, JSON.stringify(item.result));
        window.location.href = `./output.html?v=${Date.now()}`;
      };
      btn.addEventListener("click", open);
      btn.addEventListener("touchstart", open, { passive:true });
    });

    const delBtns = document.querySelectorAll("[data-del]");
    delBtns.forEach(btn => {
      btn.addEventListener("click", () => {
        const i = Number(btn.getAttribute("data-del"));
        if (!Number.isFinite(i)) return;
        if (!confirm("Delete this saved session?")) return;
        items.splice(i, 1);
        saveSaved(items);
        render();
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

  function row(item){
    const when  = formatLocal(item.created_at || item.savedAt || "");
    const dist  = item.yards ? `${Number(item.yards)} yds` : "";
    const score = item.preview?.score ? `Score ${item.preview.score}` : "";

    const wind = item.preview?.wind ? item.preview.wind : "";
    const elev = item.preview?.elev ? item.preview.elev : "";

    const scope = item.scope ? `Scope: ${item.scope}` : "";
    const ammo  = item.ammo  ? `Ammo: ${item.ammo}` : "";
    const gun   = item.gun   ? `Gun: ${item.gun}` : "";

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

        <div class="tinyMuted" style="margin-top:8px;">
          ${esc([scope, ammo, gun].filter(Boolean).join(" • ") || "—")}
        </div>

        <div class="savedBtns">
          <button class="btnSecondary" type="button" data-open="${esc(String(loadSaved().indexOf(item)))}">Open</button>
          <button class="btnSecondary" type="button" data-del="${esc(String(loadSaved().indexOf(item)))}">Delete</button>
        </div>
      </div>
    `;
  }

  // NOTE: iOS-friendly: render immediately and keep navigation cache-busted.
  render();
})();
