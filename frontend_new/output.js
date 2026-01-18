// sczn3-webapp/frontend_new/output.js (FULL FILE REPLACEMENT)
// Calm guardrails + correct payload for backend (/api/analyze).
// Never calls backend unless tapsJson includes bull + holes.

(function () {
  const DIST_KEY   = "sczn3_distance_yards";
  const PHOTO_KEY  = "sczn3_targetPhoto_dataUrl";
  const TAPS_KEY   = "sczn3_taps_json";
  const LAST_KEY   = "sczn3_last_result_json";
  const VENDOR_BUY = "sczn3_vendor_buy_url";

  const backendBase =
    sessionStorage.getItem("sczn3_backend_base") ||
    "https://sczn3-backend-new1.onrender.com";

  function $(id){ return document.getElementById(id); }
  function safeJsonParse(s){ try { return JSON.parse(String(s||"")); } catch { return null; } }

  const backBtn   = $("backBtn");
  const savedBtn  = $("savedBtn");
  const receiptBtn= $("receiptBtn");

  const inlineMsg = $("inlineMsg");
  const detailsBox= $("detailsBox");

  const buyMoreBtn= $("buyMoreBtn");

  function setMsg(msg){
    if (inlineMsg) inlineMsg.textContent = String(msg || "");
  }

  function setDetails(html){
    if (detailsBox) detailsBox.innerHTML = html || "";
  }

  function setVendorBuyLink(){
    const url = sessionStorage.getItem(VENDOR_BUY);
    if (buyMoreBtn && url){
      buyMoreBtn.href = url;
      buyMoreBtn.style.display = "inline-block";
    }
  }

  function getDistance(){
    const n = Number(sessionStorage.getItem(DIST_KEY));
    return Number.isFinite(n) && n > 0 ? n : 100;
  }

  function getTapsPayload(){
    const obj = safeJsonParse(sessionStorage.getItem(TAPS_KEY) || "");
    if (!obj || typeof obj !== "object") return null;
    return obj;
  }

  function validatePayload(p){
    // Must have bull + holes (at least 1)
    const bullOk =
      p && p.bull &&
      Number.isFinite(Number(p.bull.x)) &&
      Number.isFinite(Number(p.bull.y));

    const holesOk =
      p && Array.isArray(p.holes) && p.holes.length >= 1 &&
      p.holes.every(h => Number.isFinite(Number(h.x)) && Number.isFinite(Number(h.y)));

    return bullOk && holesOk;
  }

  function esc(s){
    return String(s || "").replace(/</g,"&lt;").replace(/>/g,"&gt;");
  }

  function renderCalmMissingState(){
    setMsg("Nothing to score yet.");
    setDetails(`
      <div class="card">
        <div class="kicker">Tap-n-Score™</div>
        <div class="title">Waiting on taps</div>
        <div class="sub">Go back, tap at least 1 bullet hole, then press Results.</div>
      </div>
    `);
  }

  function renderBackendError(statusCode, text){
    setMsg("Couldn’t score that photo.");
    setDetails(`
      <div class="card">
        <div class="kicker">Tap-n-Score™</div>
        <div class="title">Try again</div>
        <div class="sub">Go back and confirm your taps.</div>
        <div class="tinyMuted">Backend returned ${esc(statusCode)}.</div>
        ${text ? `<pre class="tinyCode">${esc(text)}</pre>` : ``}
      </div>
    `);
  }

  function renderResults(data){
    // Minimal safe render (you can expand later)
    const score = (data && (data.score ?? data.smartScore ?? data.smart_score));
    const clicks = data && (data.clicks || data.scopeClicks || data.scope_clicks) || {};
    const dirs   = data && (data.directions || data.dirs) || {};
    const poib   = (data && (data.poib ?? data.POIB)) ?? null;

    const wind = clicks.windage ?? clicks.wind ?? "--";
    const elev = clicks.elevation ?? clicks.elev ?? "--";
    const wdir = dirs.windage ?? "";
    const edir = dirs.elevation ?? "";

    setMsg("Scored.");
    setDetails(`
      <div class="card">
        <div class="kicker">Results</div>
        <div class="title">Tap-n-Score™</div>

        <div class="row"><span class="k">Score</span><span class="v">${esc(score ?? "--")}</span></div>
        <div class="row"><span class="k">Windage</span><span class="v">${esc(String(wind))} ${esc(String(wdir))}</span></div>
        <div class="row"><span class="k">Elevation</span><span class="v">${esc(String(elev))} ${esc(String(edir))}</span></div>
        <div class="row"><span class="k">Distance</span><span class="v">${esc(getDistance())} yds</span></div>
        <div class="row"><span class="k">POIB</span><span class="v">${esc(poib ?? "--")}</span></div>
      </div>
    `);
  }

  async function run(){
    setVendorBuyLink();

    const payload = getTapsPayload();
    if (!validatePayload(payload)){
      // Guardrail: DO NOT call backend
      renderCalmMissingState();
      return;
    }

    setMsg("Scoring…");

    // Build request body expected by backend
    // We send tapsJson (bull + holes) and distanceYards.
    const body = {
      mode: "tapnscore",
      distanceYards: getDistance(),
      tapsJson: payload
    };

    let res;
    try{
      res = await fetch(`${backendBase}/api/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
    } catch (e){
      renderBackendError("NETWORK", String(e && e.message ? e.message : e));
      return;
    }

    if (!res.ok){
      const txt = await res.text().catch(() => "");
      renderBackendError(res.status, txt);
      return;
    }

    const data = await res.json().catch(() => null);

    // Save for Receipt page
    try { sessionStorage.setItem(LAST_KEY, JSON.stringify(data || {})); } catch {}

    renderResults(data);
  }

  // Nav
  if (backBtn){
    backBtn.addEventListener("click", () => window.location.href = `./index.html?v=${Date.now()}`);
  }
  if (savedBtn){
    savedBtn.addEventListener("click", () => window.location.href = `./saved.html?v=${Date.now()}`);
  }
  if (receiptBtn){
    receiptBtn.addEventListener("click", () => window.location.href = `./receipt.html?v=${Date.now()}`);
  }

  run();
})();
