// sczn3-webapp/frontend_new/output.js (FULL FILE REPLACEMENT)
// Calm guardrails: do NOT call backend unless we have valid tapsJson (bull + holes).

(function () {
  const DIST_KEY   = "sczn3_distance_yards";
  const TAPS_KEY   = "sczn3_taps_json";
  const LAST_KEY   = "sczn3_last_result_json";
  const VENDOR_BUY = "sczn3_vendor_buy_url";

  function $(id){ return document.getElementById(id); }

  const backBtn    = $("backBtn");
  const savedBtn   = $("savedBtn");
  const receiptBtn = $("receiptBtn");

  const statusBox  = $("statusBox") || $("resultsError") || $("resultsTop");
  const scoreEl    = $("scoreVal");
  const windEl     = $("windVal");
  const elevEl     = $("elevVal");
  const distEl     = $("distVal");
  const poibEl     = $("poibVal");

  function setInline(msg){
    if (statusBox){
      statusBox.textContent = String(msg || "");
      statusBox.style.opacity = "0.9";
    } else {
      alert(String(msg || ""));
    }
  }

  function safeJsonParse(s){
    try { return JSON.parse(String(s || "")); } catch { return null; }
  }

  function setText(el, v){
    if (!el) return;
    el.textContent = String(v ?? "");
  }

  function getDistance(){
    const n = Number(sessionStorage.getItem(DIST_KEY));
    return Number.isFinite(n) && n > 0 ? n : 100;
  }

  function getTapsPayload(){
    const raw = sessionStorage.getItem(TAPS_KEY) || "";
    const obj = safeJsonParse(raw);
    return obj && typeof obj === "object" ? obj : null;
  }

  function hasValidTaps(obj){
    if (!obj) return false;
    const bullOk = obj.bull && Number.isFinite(obj.bull.x) && Number.isFinite(obj.bull.y);
    const holesOk = Array.isArray(obj.holes) && obj.holes.length > 0
      && obj.holes.every(h => h && Number.isFinite(h.x) && Number.isFinite(h.y));
    return !!(bullOk && holesOk);
  }

  async function callBackend(){
    const distanceYards = getDistance();
    const tapsPayload = getTapsPayload();

    // HARD GUARD: no backend call unless valid
    if (!hasValidTaps(tapsPayload)){
      setInline("Tap bullet holes first. Then press See results.");
      setText(scoreEl, "--");
      setText(windEl, "--");
      setText(elevEl, "--");
      setText(distEl, `${distanceYards} yds`);
      setText(poibEl, "--");
      return;
    }

    setInline("Analyzing…");

    // This assumes api.js exposes a function like analyzeTapNScore(payload)
    // If your api.js uses a different name, paste it and I’ll match it.
    try{
      const res = await (window.apiAnalyze
        ? window.apiAnalyze({ distanceYards, tapsJson: tapsPayload })
        : fetch("/api/analyze", {
            method: "POST",
            headers: { "Content-Type":"application/json" },
            body: JSON.stringify({ distanceYards, tapsJson: tapsPayload })
          }).then(r => r.json())
      );

      // Store last result for receipt/saved
      try { sessionStorage.setItem(LAST_KEY, JSON.stringify(res || {})); } catch {}

      if (!res || res.ok === false){
        setInline("Could not analyze this photo. Try retapping your holes.");
        setText(scoreEl, "--");
        setText(windEl, "--");
        setText(elevEl, "--");
        setText(distEl, `${distanceYards} yds`);
        setText(poibEl, "--");
        return;
      }

      // Render minimal fields safely
      setInline("Done.");

      const score = (typeof res.score !== "undefined") ? res.score : "--";
      const wind  = res?.clicks?.windage ?? "--";
      const elev  = res?.clicks?.elevation ?? "--";
      const wdir  = res?.directions?.windage ?? "";
      const edir  = res?.directions?.elevation ?? "";
      const poib  = res?.poib ?? "--";

      setText(scoreEl, score);
      setText(windEl, `${wind} ${wdir}`.trim());
      setText(elevEl, `${elev} ${edir}`.trim());
      setText(distEl, `${distanceYards} yds`);
      setText(poibEl, poib);

    } catch (err){
      setInline("Network or server error. Try again.");
      setText(scoreEl, "--");
      setText(windEl, "--");
      setText(elevEl, "--");
      setText(distEl, `${distanceYards} yds`);
      setText(poibEl, "--");
    }
  }

  // Nav
  if (backBtn) backBtn.addEventListener("click", () => window.location.href = "./index.html?v=" + Date.now());
  if (savedBtn) savedBtn.addEventListener("click", () => window.location.href = "./saved.html?v=" + Date.now());
  if (receiptBtn) receiptBtn.addEventListener("click", () => window.location.href = "./receipt.html?v=" + Date.now());

  callBackend();
})();
