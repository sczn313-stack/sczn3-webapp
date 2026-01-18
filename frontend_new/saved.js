// sczn3-webapp/frontend_new/saved.js (FULL REPLACEMENT)
// Lists saved sessions from localStorage (sczn3_saved_sessions_v1)
// iOS-safe navigation + cache-bust.

(function () {
  const LS_SAVED  = "sczn3_saved_sessions_v1";
  const LAST_KEY  = "sczn3_last_result_json";
  const DIST_KEY  = "sczn3_distance_yards";
  const VENDOR_BUY= "sczn3_vendor_buy_url";

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

  function loadAll(){
    const raw = localStorage.getItem(LS_SAVED) || "[]";
    const arr = safeJsonParse(raw);
    return Array.isArray(arr) ? arr : [];
  }

  function saveAll(arr){
    localStorage.setItem(LS_SAVED, JSON.stringify(arr || []));
  }

  function formatLocal(iso){
    try{
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return iso || "";
      return d.toLocaleString();
    } catch { return iso || ""; }
  }

  function fmt2(x){
    const n = Number(x);
    if (!Number.isFinite(n)) return "--";
    return n.toFixed(2);
  }

  function go(url){
    window.location.href = url + (url.includes("?") ? "&" : "?") + "v=" + Date.now();
  }

  function render(){
    const items = loadAll();

    const buyUrl = sessionStorage.getItem(VENDOR_BUY) || "";

    root.innerHTML = `
      <div class="wrap">
        <div class="card">
          <div class="kicker">SAVED</div>
          <div class="title">Saved Sessions</div>
          <div class="status">Stored on this device.</div>

          ${items.length ? `
            <div class="savedList">
              ${items.map((item, idx) => savedRow(item, idx)).join("")}
            </div>

            <div class="btnRow">
              <button id="startBtn" class="btnPrimary" type="button">Start new session</button>
              <button id="clearAllBtn" class="btnSecondary" type="button">Clear all</button>
            </div>
          ` : `
            <div class="resultsNote">
              <div class="noteLine">No saved sessions yet.</div>
              <div class="noteLine subtle">Save from the Receipt screen.</div>
            </div>

            <div class="btnRow">
              <button id="startBtn" class="btnPrimary" type="button">Start new session</button>
            </div>
          `}

          ${buyUrl ? `
            <div class="vendorRow">
              <a class="btnSecondary fullWidth" href="${esc(buyUrl)}">Buy more targets</a>
            </div>
          ` : ``}
        </div>
      </div>
    `;

    const startBtn = document.getElementById("startBtn");
    if (startBtn){
      const fn = () => go("./index.html");
      startBtn.addEventListener("click", fn);
      startBtn.addEventListener("touchstart", fn, { passive:true });
    }

    const clearAllBtn = document.getElementById("clearAllBtn");
    if (clearAllBtn){
      clearAllBtn.addEventListener("click", () => {
        if (!confirm("Clear ALL saved sessions on this device?")) return;
        saveAll([]);
        render();
      });
    }

    // Open
    document.querySelectorAll("[data-open-idx]").forEach(btn => {
      const open = () => {
        const i = Number(btn.getAttribute("data-open-idx"));
        const all = loadAll();
        const item = all[i];
        if (!item || !item.result){
          alert("Record missing.");
          return;
        }
        sessionStorage.setItem(LAST_KEY, JSON.stringify(item.result));
        if (item.yards) sessionStorage.setItem(DIST_KEY, String(item.yards));
        go("./output.html");
      };
      btn.addEventListener("click", open);
      btn.addEventListener("touchstart", open, { passive:true });
    });

    // Delete
    document.querySelectorAll("[data-del-idx]").forEach(btn => {
      btn.addEventListener("click", () => {
        const i = Number(btn.getAttribute("data-del-idx"));
        if (!confirm("Delete this saved session?")) return;
        const all = loadAll();
        all.splice(i, 1);
        saveAll(all);
        render();
      });
    });
  }

  function savedRow(item, idx){
    const when = formatLocal(item.created_at || "");
    const dist = Number.isFinite(Number(item.yards)) ? `${Number(item.yards)} yds` : "";
    const score = item.preview && item.preview.score ? `Score ${item.preview.score}` : "";

    const wind = item.preview && item.preview.wind ? item.preview.wind : "";
    const elev = item.preview && item.preview.elev ? item.preview.elev : "";

    return `
      <div class="savedRow">
        <div class="savedTopLine">
          <div class="savedWhen">${esc(when)}</div>
          <div class="savedMeta">${esc([dist, score].filter(Boolean).join(" • "))}</div>
        </div>

        <div class="savedAdj">
          <div class="savedAdjLine
