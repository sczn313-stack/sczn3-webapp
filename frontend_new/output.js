// sczn3-webapp/frontend_new/output.js (FULL FILE REPLACEMENT)
// Results page: reads last payload, calls backend, renders cleanly.

(() => {
  const DIST_KEY   = "sczn3_distance_yards";
  const PAYLOAD_KEY= "sczn3_last_analyze_payload";
  const LAST_KEY   = "sczn3_last_result_json";

  function $(id){ return document.getElementById(id); }

  const scoreEl = $("scoreVal");
  const windEl  = $("windVal");
  const elevEl  = $("elevVal");
  const distEl  = $("distVal");
  const poibEl  = $("poibVal");
  const msgEl   = $("msgLine");

  const backBtn   = $("backBtn");
  const savedBtn  = $("savedBtn");
  const receiptBtn= $("receiptBtn");
  const retryBtn  = $("retryBtn"); // optional button if you add it

  function setMsg(s){
    if (msgEl) msgEl.textContent = String(s || "");
  }

  function setVals({score="--", wind="--", elev="--", dist="--", poib="--"}){
    if (scoreEl) scoreEl.textContent = score;
    if (windEl)  windEl.textContent  = wind;
    if (elevEl)  elevEl.textContent  = elev;
    if (distEl)  distEl.textContent  = dist;
    if (poibEl)  poibEl.textContent  = poib;
  }

  function safeJsonParse(s){
    try { return JSON.parse(String(s || "")); } catch { return null; }
  }

  function getSession(k){
    try { return sessionStorage.getItem(k) || ""; } catch { return ""; }
  }

  function setSession(k,v){
    try { sessionStorage.setItem(k, String(v || "")); } catch {}
  }

  function getDistance(){
    const v = Number(getSession(DIST_KEY));
    return Number.isFinite(v) && v > 0 ? v : 100;
  }

  function formatClicks(val, dir){
    const v = (val === null || typeof val === "undefined") ? "--" : String(val);
    const d = dir ? String(dir) : "";
    return `${v} ${d}`.trim();
  }

  function buildDisplayFromResult(res){
    const score = (res && typeof res.score !== "undefined") ? String(res.score) : "--";

    const wind = formatClicks(res?.clicks?.windage, res?.directions?.windage);
    const elev = formatClicks(res?.clicks?.elevation, res?.directions?.elevation);

    const poib = (res?.poib && typeof res.poib === "object")
      ? `${res.poib.x ?? "--"}, ${res.poib.y ?? "--"}`
      : "--";

    return { score, wind, elev, poib };
  }

  async function runAnalyze(){
    const payloadRaw = getSession(PAYLOAD_KEY);
    const payload = safeJsonParse(payloadRaw);

    // If we don’t have a payload, show calm message and stop.
    if (!payload || typeof payload !== "object"){
      setMsg("No input found. Go back and run a session.");
      setVals({ dist: `${getDistance()} yds` });
      return;
    }

    setMsg("Analyzing…");
    setVals({ dist: `${getDistance()} yds` });

    const r = await window.Sczn3Api.analyzeTapNScore(payload);

    if (!r || !r.ok){
      const msg = r?.error?.message || "Network/server error. Try again.";
      setMsg(msg);
      setVals({ dist: `${getDistance()} yds` });
      return;
    }

    const data = r.data;

    // Save for Receipt + Saved pages
    setSession(LAST_KEY, JSON.stringify(data || {}));

    const disp = buildDisplayFromResult(data || {});
    setVals({
      score: disp.score,
      wind: disp.wind,
      elev: disp.elev,
      dist: `${getDistance()} yds`,
      poib: disp.poib
    });

    setMsg("Done.");
  }

  // Buttons
  if (backBtn) backBtn.addEventListener("click", () => window.location.href = "./index.html");
  if (savedBtn) savedBtn.addEventListener("click", () => window.location.href = "./saved.html");
  if (receiptBtn) receiptBtn.addEventListener("click", () => window.location.href = "./receipt.html");
  if (retryBtn) retryBtn.addEventListener("click", runAnalyze);

  runAnalyze();
})();
