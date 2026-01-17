// sczn3-webapp/frontend_new/saved.js (FULL FILE)
// Lists saved sessions from localStorage.
//
// Index:  localStorage["tapnscore_saved_index"] = [{id, savedAt}, ...]
// Item:   localStorage["tapnscore_saved_<id>"]  = record JSON
//
// Open: loads record.result into sessionStorage["tapnscore_result"] and redirects to output.html

(function () {
  const INDEX_KEY   = "tapnscore_saved_index";
  const ITEM_PREFIX = "tapnscore_saved_";
  const RESULT_KEY  = "tapnscore_result";

  function esc(s){
    return String(s || "")
      .replaceAll("&","&amp;")
      .replaceAll("<","&lt;")
      .replaceAll(">","&gt;");
  }

  function $(id){ return document.getElementById(id); }

  const root = $("savedRoot") || document.body;

  function readIndex(){
    try{
      const raw = localStorage.getItem(INDEX_KEY) || "[]";
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : [];
    } catch { return []; }
  }

  function writeIndex(arr){
    try{
      localStorage.setItem(INDEX_KEY, JSON.stringify(arr || []));
      return true;
    } catch { return false; }
  }

  function readItem(id){
    try{
      const raw = localStorage.getItem(ITEM_PREFIX + id);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }

  function deleteItem(id){
    try{ localStorage.removeItem(ITEM_PREFIX + id); } catch {}
    const idx = readIndex().filter(x => x && x.id !== id);
    writeIndex(idx);
  }

  function formatLocal(iso){
    try{
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return iso || "";
      return d.toLocaleString();
    } catch { return iso || ""; }
  }

  function render(){
    const idx = readIndex();
    const items = idx
      .map(x => x && x.id ? readItem(x.id) : null)
      .filter(Boolean);

    root.innerHTML = `
      <div class="resultsWrap">
        <div class="resultsTop">
          <div class="resultsKicker">Saved</div>
          <div class="resultsTitle">Saved Sessions</div>
          <div class="resultsSub">Stored on this device.</div>
        </div>

        ${items.length ? `
          <div class="savedList">
            ${items.map(item => savedRow(item)).join("")}
          </div>

          <div class="resultsActions">
            <a class="btnPrimary" href="index.html">Start new session</a>
            <button id="clearAllBtn" class="btnSecondary" type="button">Clear all saved</button>
          </div>
        ` : `
          <div class="resultsNote">
            <div class="noteLine">No saved sessions yet.</div>
            <div class="noteLine subtle">Save from the Results screen.</div>
          </div>

          <div class="resultsActions">
            <a class="btnPrimary" href="index.html">Start new session</a>
          </div>
        `}

        <div class="resultsBottom">
          <div class="subtle">Tap-n-Score™</div>
        </div>
      </div>
    `;

    // Bind open/delete
    const openBtns = document.querySelectorAll("[data-open-id]");
    openBtns.forEach(btn => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-open-id");
        const rec = readItem(id);
        if (!rec || !rec.result){
          alert("Record missing.");
          return;
        }
        sessionStorage.setItem(RESULT_KEY, JSON.stringify(rec.result));
        window.location.href = "output.html";
      });
    });

    const delBtns = document.querySelectorAll("[data-del-id]");
    delBtns.forEach(btn => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-del-id");
        if (!id) return;
        if (!confirm("Delete this saved session?")) return;
        deleteItem(id);
        render();
      });
    });

    const clearAllBtn = document.getElementById("clearAllBtn");
    if (clearAllBtn){
      clearAllBtn.addEventListener("click", () => {
        if (!confirm("Clear ALL saved sessions on this device?")) return;
        const idx2 = readIndex();
        idx2.forEach(x => { if (x?.id) { try{ localStorage.removeItem(ITEM_PREFIX + x.id); } catch {} } });
        writeIndex([]);
        render();
      });
    }
  }

  function savedRow(item){
    const id = item.id;
    const when = formatLocal(item.savedAt);
    const dist = Number.isFinite(Number(item.distanceYards)) ? `${Number(item.distanceYards)} yds` : "";
    const score = Number.isFinite(Number(item.score)) ? `Score ${Number(item.score)}` : "";

    const wind = item.wind ? item.wind : "";
    const elev = item.elev ? item.elev : "";

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

  render();
})();
