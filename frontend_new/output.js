// sczn3-webapp/frontend_new/output.js (FULL FILE REPLACEMENT)
// Calm results screen: do NOT call backend unless tapsJson has holes.
// Also routes to Receipt only when last_result exists.

(function () {
  const DIST_KEY   = "sczn3_distance_yards";
  const TAPS_KEY   = "sczn3_taps_json";
  const LAST_KEY   = "sczn3_last_result_json";
  const VENDOR_BUY = "sczn3_vendor_buy_url";

  function $(id){ return document.getElementById(id); }

  const backBtn   = $("backBtn");
  const savedBtn  = $("savedBtn");
  const receiptBtn= $("receiptBtn");

  const titleEl   = $("resultsTitle");
  const msgEl     = $("resultsMsg");
  const rawEl     = $("rawBox");

  const scoreEl   = $("scoreVal");
  const windEl    = $("windVal");
  const elevEl    = $("elevVal");
  const distEl    = $("distVal");
  const poibEl    = $("poibVal");

  const buyBtn    = $("buyMoreBtn");

  function safeJsonParse(s){
    try { return JSON.parse(String(s||"")); } catch { return null; }
  }

  function setText(el, v){
    if (!el) return;
    el.textContent = String(v ?? "");
  }

  function fmt2(n){
    const x = Number(n);
    if (!Number.isFinite(x)) return "--";
    return x.toFixed(2);
  }

  function getDistance(){
    const n = Number(sessionStorage.getItem(DIST_KEY));
    return Number.isFinite(n) && n > 0 ? n : 100;
  }

  function getTaps(){
    const obj = safeJsonParse(sessionStorage.getItem(TAPS_KEY));
    const holes = obj && Array.isArray(obj.holes) ? obj.holes : [];
    const bull  = obj && obj.bull ? obj.bull : null;
    return { obj, holes, bull };
  }

  function setVendorBuy(){
    const url = sessionStorage.getItem(VENDOR_BUY);
    if (buyBtn && url){
      buyBtn.href = url;
      buyBtn.style.display = "inline-flex";
    }
  }

  async function callBackendAnalyze(payload){
    // NOTE: adjust endpoint if yours differs
    const res = await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type":"application/json" },
      body: JSON.stringify(payload)
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
  }

  function renderCalmNeedTaps(){
    setText(titleEl, "Tap-n-Score™");
    setText(msgEl, "No taps detected yet. Go back and tap at least 1 bullet hole, then press Results again.");

    setText(scoreEl, "--");
    setText(windEl,  "--");
    setText(elevEl,  "--");
    setText(distEl,  `${getDistance()} yds`);
    setText(poibEl,  "--");

    if (rawEl) rawEl.textContent = "";
  }

  function renderResult(r){
    // expected shape:
    // r.score
    // r.clicks.windage / r.clicks.elevation
    // r.directions.windage / r.directions.elevation
    // r.poib (optional)
    const score = (typeof r.score !== "undefined") ? String(r.score) : "--";

    const cw = r?.clicks?.windage;
    const ce = r?.clicks?.elevation;
    const dw = r?.directions?.windage || "";
    const de = r?.directions?.elevation || "";

    setText(scoreEl, score);
    setText(windEl, `${fmt2(cw)} ${dw}`.trim());
    setText(elevEl, `${fmt2(ce)} ${de}`.trim());
    setText(distEl, `${getDistance()} yds`);

    // outward: POIB label
    const poib = r?.poib ?? r?.centroid ?? null;
    if (poib && typeof poib === "object"){
      const px = (poib.x ?? poib.dx ?? null);
      const py = (poib.y ?? poib.dy ?? null);
      setText(poibEl, (px!=null && py!=null) ? `${fmt2(px)}, ${fmt2(py)}` : "--");
    } else {
      setText(poibEl, "--");
    }

    setText(msgEl, "Measured results from confirmed taps.");
    if (rawEl) rawEl.textContent = JSON.stringify(r, null, 2);

    try { sessionStorage.setItem(LAST_KEY, JSON.stringify(r)); } catch {}
  }

  async function main(){
    setVendorBuy();

    const { obj, holes } = getTaps();

    // HARD GUARD: do not call backend unless holes exist
    if (!holes || holes.length < 1){
      renderCalmNeedTaps();
      return;
    }

    // If your backend expects bull+holes, we already have it in taps payload
    const payload = {
      distanceYards: getDistance(),
      tapsJson: obj
    };

    setText(msgEl, "Analyzing…");

    const out = await callBackendAnalyze(payload);

    if (!out.ok){
      // calm error (no scary screen)
      setText(msgEl, `Analyze not ready (${out.status}). Go back and confirm taps, then retry.`);
      if (rawEl) rawEl.textContent = JSON.stringify(out.data || {}, null, 2);

      setText(scoreEl, "--");
      setText(windEl,  "--");
      setText(elevEl,  "--");
      setText(distEl,  `${getDistance()} yds`);
      setText(poibEl,  "--");
      return;
    }

    renderResult(out.data || {});
  }

  // Nav
  if (backBtn){
    const go = () => (window.location.href = `./index.html?v=${Date.now()}`);
    backBtn.addEventListener("click", go);
    backBtn.addEventListener("pointerdown", go);
  }
  if (savedBtn){
    const go = () => (window.location.href = `./saved.html?v=${Date.now()}`);
    savedBtn.addEventListener("click", go);
    savedBtn.addEventListener("pointerdown", go);
  }
  if (receiptBtn){
    const go = () => {
      const last = safeJsonParse(sessionStorage.getItem(LAST_KEY));
      if (!last){
        alert("No result to receipt yet. Run Analyze first.");
        return;
      }
      window.location.href = `./receipt.html?v=${Date.now()}`;
    };
    receiptBtn.addEventListener("click", go);
    receiptBtn.addEventListener("pointerdown", go);
  }

  main();
})();
