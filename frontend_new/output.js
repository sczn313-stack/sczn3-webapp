// sczn3-webapp/frontend_new/output.js (FULL FILE REPLACEMENT)
// NEVER uses alert(). Always writes status into #statusBox.

(function () {
  const DIST_KEY = "sczn3_distance_yards";
  const TAPS_KEY = "sczn3_taps_json";
  const LAST_KEY = "sczn3_last_result_json";

  function $(id){ return document.getElementById(id); }

  const statusBox = $("statusBox");

  const scoreEl = $("scoreVal");
  const windEl  = $("windVal");
  const elevEl  = $("elevVal");
  const distEl  = $("distVal");
  const poibEl  = $("poibVal");

  const backBtn    = $("backBtn");
  const savedBtn   = $("savedBtn");
  const receiptBtn = $("receiptBtn");

  function setText(el, v){
    if (!el) return;
    el.textContent = String(v ?? "");
  }

  function setStatus(msg){
    if (!statusBox) return;
    statusBox.textContent = String(msg || "");
  }

  function safeJsonParse(s){
    try { return JSON.parse(String(s || "")); } catch { return null; }
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
    const bullOk =
      obj.bull &&
      Number.isFinite(obj.bull.x) &&
      Number.isFinite(obj.bull.y);

    const holesOk =
      Array.isArray(obj.holes) &&
      obj.holes.length > 0 &&
      obj.holes.every(h => h && Number.isFinite(h.x) && Number.isFinite(h.y));

    return !!(bullOk && holesOk);
  }

  async function analyze(){
    const distanceYards = getDistance();
    setText(distEl, `${distanceYards} yds`);

    const tapsPayload = getTapsPayload();

    // GUARD: do not call backend without valid taps
    if (!hasValidTaps(tapsPayload)){
      setStatus("Tap bullet holes first. Then press See results.");
      setText(scoreEl, "--");
      setText(windEl, "--");
      setText(elevEl, "--");
      setText(poibEl, "--");
      return;
    }

    setStatus("Analyzing…");

    try {
      // Prefer a wrapper if api.js defines it; else fallback to /api/analyze
      const res = await (window.apiAnalyze
        ? window.apiAnalyze({ distanceYards, tapsJson: tapsPayload })
        : fetch("/api/analyze", {
            method: "POST",
            headers: { "Content-Type":"application/json" },
            body: JSON.stringify({ distanceYards, tapsJson: tapsPayload })
          }).then(r => r.json())
      );

      try { sessionStorage.setItem(LAST_KEY, JSON.stringify(res || {})); } catch {}

      if (!res || res.ok === false){
        setStatus("Analyze failed. Try retapping your holes.");
        setText(scoreEl, "--");
        setText(windEl, "--");
        setText(elevEl, "--");
        setText(poibEl, "--");
        return;
      }

      setStatus("Done.");

      const score = (typeof res.score !== "undefined") ? res.score : "--";
      const wind  = res?.clicks?.windage ?? "--";
      const elev  = res?.clicks?.elevation ?? "--";
      const wdir  = res?.directions?.windage ?? "";
      const edir  = res?.directions?.elevation ?? "";
      const poib  = res?.poib ?? "--";

      setText(scoreEl, score);
      setText(windEl, `${wind} ${wdir}`.trim());
      setText(elevEl, `${elev} ${edir}`.trim());
      setText(poibEl, poib);

    } catch (e){
      setStatus("Network/server error. Try again.");
      setText(scoreEl, "--");
      setText(windEl, "--");
      setText(elevEl, "--");
      setText(poibEl, "--");
    }
  }

  // Nav (cache-bust for iOS)
  if (backBtn) backBtn.addEventListener("click", () => window.location.href = "./index.html?v=" + Date.now());
  if (savedBtn) savedBtn.addEventListener("click", () => window.location.href = "./saved.html?v=" + Date.now());
  if (receiptBtn) receiptBtn.addEventListener("click", () => window.location.href = "./receipt.html?v=" + Date.now());

  analyze();
})();
