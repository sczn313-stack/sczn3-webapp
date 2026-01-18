// sczn3-webapp/frontend_new/output.js (FULL FILE REPLACEMENT)
// Fender rule: NEVER call backend unless tapsJson has bull + >=1 holes.
// Calm inline message instead of scary failure.
// Keeps sessionStorage keys compatible with receipt.js.

(function () {
  const SS_LAST   = "sczn3_last_result_json";
  const SS_DIST   = "sczn3_distance_yards";
  const SS_TAPS   = "sczn3_taps_json";     // expected: { bull:{x,y}, holes:[{x,y}...] }
  const SS_VENDOR = "sczn3_vendor_buy_url";

  function $(id){ return document.getElementById(id); }
  function safeJsonParse(s){ try{ return JSON.parse(String(s||"")); } catch { return null; } }

  const statusEl = $("statusLine") || $("miniStatus") || null;

  function status(msg){
    if (statusEl) statusEl.textContent = String(msg || "");
  }

  function go(url){
    window.location.href = `${url}?v=${Date.now()}`;
  }

  function getDistance(){
    const n = Number(sessionStorage.getItem(SS_DIST));
    return Number.isFinite(n) && n > 0 ? n : 100;
  }

  function getTaps(){
    const obj = safeJsonParse(sessionStorage.getItem(SS_TAPS) || "");
    return obj && typeof obj === "object" ? obj : null;
  }

  function hasValidTaps(t){
    const bullOk = !!(t && t.bull && Number.isFinite(Number(t.bull.x)) && Number.isFinite(Number(t.bull.y)));
    const holesOk = !!(t && Array.isArray(t.holes) && t.holes.length >= 1);
    return bullOk && holesOk;
  }

  function setVendorBuyLink(){
    const url = sessionStorage.getItem(SS_VENDOR);
    const a = $("buyMoreBtn");
    if (a && url){
      a.href = url;
      a.style.display = "inline-flex";
    }
  }

  function renderResultCard(result){
    // Minimal, tolerant rendering (won’t explode if result shape changes)
    const scoreEl = $("scoreVal");
    const windEl  = $("windVal");
    const elevEl  = $("elevVal");
    const distEl  = $("distVal");
    const poibEl  = $("poibVal");
    const rawEl   = $("rawJson");

    if (distEl) distEl.textContent = `${getDistance()} yds`;

    if (!result){
      if (scoreEl) scoreEl.textContent = "--";
      if (windEl)  windEl.textContent  = "--";
      if (elevEl)  elevEl.textContent  = "--";
      if (poibEl)  poibEl.textContent  = "--";
      if (rawEl)   rawEl.textContent   = "";
      return;
    }

    const score = (typeof result.score !== "undefined") ? String(result.score) : "--";

    const wClicks = result?.clicks?.windage ?? "--";
    const eClicks = result?.clicks?.elevation ?? "--";
    const wDir    = result?.directions?.windage ?? "";
    const eDir    = result?.directions?.elevation ?? "";

    const wind = `${wClicks} ${wDir}`.trim() || "--";
    const elev = `${eClicks} ${eDir}`.trim() || "--";

    const poib = (result?.poib && typeof result.poib === "object")
      ? `x ${result.poib.x ?? "--"}, y ${result.poib.y ?? "--"}`
      : (result?.poib ?? "--");

    if (scoreEl) scoreEl.textContent = score;
    if (windEl)  windEl.textContent  = wind;
    if (elevEl)  elevEl.textContent  = elev;
    if (poibEl)  poibEl.textContent  = String(poib);

    if (rawEl) rawEl.textContent = JSON.stringify(result, null, 2);
  }

  async function callBackendAnalyze(payload){
    // Uses existing helper if present, otherwise fetch().
    // This keeps compatibility with whatever api.js you already have.
    if (typeof window.apiPostJson === "function"){
      return await window.apiPostJson("/analyze", payload);
    }

    const base = window.API_BASE || window.SCZN3_API_BASE || sessionStorage.getItem("sczn3_api_base") || "";
    const url = base ? `${base.replace(/\/$/,"")}/analyze` : "./analyze";

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type":"application/json" },
      body: JSON.stringify(payload),
    });

    const text = await res.text();
    let data = null;
    try { data = JSON.parse(text); } catch { data = { ok:false, error:{ code:"BAD_JSON", message:text } }; }

    if (!res.ok){
      const err = data || { ok:false, error:{ code:"HTTP_"+res.status, message:"Backend error" } };
      err._httpStatus = res.status;
      throw err;
    }
    return data;
  }

  async function analyzeIfReady(){
    setVendorBuyLink();

    const taps = getTaps();

    // ===== FENDER: DO NOT CALL BACKEND =====
    if (!hasValidTaps(taps)){
      status("Tap the bull first, then tap at least one hole. Then press Results again.");
      // Also render last known results if present (so the screen never feels “broken”)
      const last = safeJsonParse(sessionStorage.getItem(SS_LAST) || "");
      renderResultCard(last && typeof last === "object" ? last : null);
      return;
    }

    status("Analyzing…");

    const payload = {
      distanceYards: getDistance(),
      tapsJson: taps
    };

    try{
      const result = await callBackendAnalyze(payload);

      // Store as “last result” for Receipt + Saved flows (receipt.js expects this)
      sessionStorage.setItem(SS_LAST, JSON.stringify(result));

      status("Done.");
      renderResultCard(result);
    } catch (e){
      // Calm message, no scary dump
      status("Couldn’t analyze that one. Confirm bull + holes and try again.");
      const last = safeJsonParse(sessionStorage.getItem(SS_LAST) || "");
      renderResultCard(last && typeof last === "object" ? last : null);
    }
  }

  // Buttons
  function bindNav(){
    const backBtn    = $("backBtn");
    const savedBtn   = $("savedBtn");
    const receiptBtn = $("receiptBtn");

    if (backBtn){
      const goBack = () => go("./index.html");
      backBtn.addEventListener("click", goBack);
      backBtn.addEventListener("touchstart", goBack, { passive:true });
    }

    if (savedBtn){
      const goSaved = () => go("./saved.html");
      savedBtn.addEventListener("click", goSaved);
      savedBtn.addEventListener("touchstart", goSaved, { passive:true });
    }

    if (receiptBtn){
      const goReceipt = () => go("./receipt.html");
      receiptBtn.addEventListener("click", goReceipt);
      receiptBtn.addEventListener("touchstart", goReceipt, { passive:true });
    }
  }

  (function init(){
    bindNav();
    analyzeIfReady();
  })();
})();
