// sczn3-webapp/frontend_new/saved.js (FULL FILE REPLACEMENT)
// Uses localStorage: sczn3_saved_sessions_v1

(function () {
  const LS_SAVED = "sczn3_saved_sessions_v1";
  const RESULT_KEY = "sczn3_last_result_json";

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

  function goUpload(){
    window.location.href = `./index.html?v=${Date.now()}`;
  }

  function openItem(id){
    const arr = loadSaved();
    const rec = arr.find(x => x && x.id === id);
    if (!rec || !rec.result){
      alert("Record missing.");
      return;
    }
    sessionStorage.setItem(RESULT_KEY, JSON.stringify(rec.result));
    window.location.href = `./output.html?v=${Date.now()}`;
  }

  function delete
