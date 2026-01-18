// sczn3-webapp/frontend_new/index.js (FULL FILE REPLACEMENT)
// iOS-safe taps: wrapper receives taps, dots render, taps saved for analyze.

(() => {
  const RESULT_KEY = "tapnscore_result";
  const PHOTO_KEY  = "sczn3_targetPhoto_dataUrl";

  const input      = document.getElementById("photoInput");
  const img        = document.getElementById("targetImage");
  const wrap       = document.getElementById("targetImageWrap");
  const hint       = document.getElementById("emptyHint");
  const tapsCount  = document.getElementById("tapsCount");
  const clearBtn   = document.getElementById("clearTapsBtn");
  const seeBtn     = document.getElementById("seeResultsBtn");
  const distInput  = document.getElementById("distanceInput");
  const vendorIn   = document.getElementById("vendorInput");

  let taps = []; // {x,y} in pixels relative to displayed image

  function setStatus(msg){
    const el = document.getElementById("statusLine");
    if (el) el.textContent = msg;
  }

  function escNum(v){
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }

  function updateCount(){
    if (tapsCount) tapsCount.textContent = String(taps.length);
  }

  function clearDots(){
    if (!wrap) return;
    wrap.querySelectorAll(".tapDot").forEach(d => d.remove());
  }

  function clearAll(){
    taps = [];
    clearDots();
    updateCount();
    setStatus("Cleared. Tap ADD PHOTO.");
  }

  function addDot(x, y){
    if (!wrap) return;
    const dot = document.createElement("div");
    dot.className = "tapDot";
    dot.style.left = `${x}px`;
    dot.style.top  = `${y}px`;
    wrap.appendChild(dot);
  }

  function getXYFromClient(clientX, clientY){
    if (!wrap) return null;
    const rect = wrap.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    if (x < 0 || y < 0 || x > rect.width || y > rect.height) return null;
    return { x, y, w: rect.width, h: rect.height };
  }

  function handleTap(clientX, clientY){
    if (!img || !img.src) {
      setStatus("Add a photo first.");
      return;
    }

    const pt = getXYFromClient(clientX, clientY);
    if (!pt) return;

    taps.push({ x: pt.x, y: pt.y });
    addDot(pt.x, pt.y);
    updateCount();
    setStatus("Photo loaded. Tap bullet holes.");
  }

  function bindTaps(){
    if (!wrap) return;

    // make absolutely sure wrapper is tappable
    wrap.style.pointerEvents = "auto";
    wrap.style.touchAction = "none";

    const onTouch = (e) => {
      // CRITICAL: without preventDefault, iOS can treat as scroll / text selection
      e.preventDefault();
      const t = e.touches && e.touches[0];
      if (!t) return;
      handleTap(t.clientX, t.clientY);
    };

    const onClick = (e) => {
      handleTap(e.clientX, e.clientY);
    };

    wrap.addEventListener("touchstart", onTouch, { passive: false });
    wrap.addEventListener("click", onClick);
  }

  function loadPhoto(file){
    if (!file){
      setStatus("No photo selected.");
      return;
    }
    if (!file.type || !file.type.startsWith("image/")){
      setStatus("That file is not an image.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || "");
      if (img) img.src = dataUrl;
      if (hint) hint.textContent = "Photo loaded. Tap bullet holes (Tap-n-Score).";
      setStatus("Photo loaded. Tap bullet holes.");
      try { sessionStorage.setItem(PHOTO_KEY, dataUrl); } catch {}
      clearAll();                 // reset taps when new photo loads
      setStatus("Photo loaded. Tap bullet holes.");
    };
    reader.onerror = () => setStatus("Could not read that photo.");
    reader.readAsDataURL(file);
  }

  async function analyze(){
    // Frontend should not crash; show calm message if missing taps
    if (!taps.length){
      setStatus("Tap at least 1 hole, then press See results.");
      return;
    }

    const distanceYards = escNum(distInput && distInput.value);
    const vendorUrl = vendorIn ? String(vendorIn.value || "").trim() : "";

    // IMPORTANT: You must have api.js providing window.sczn3Analyze (or similar).
    // We'll call a conservative function name that you can wire in api.js.
    if (typeof window.sczn3Analyze !== "function"){
      alert("Analyze function missing (api.js not loaded).");
      return;
    }

    // Normalize taps for backend: include bull/holes if your backend expects it.
    // We'll send taps + distance + vendor; api.js can transform.
    const payload = {
      distanceYards,
      vendorUrl,
      taps: taps.slice()
    };

    // iOS “Analyzing…” overlay is fine, but never leave user stranded.
    setStatus("Analyzing…");

    try{
      const result = await window.sczn3Analyze(payload);
      sessionStorage.setItem(RESULT_KEY, JSON.stringify(result));
      window.location.href = `./output.html?v=${Date.now()}`;
    } catch (err){
      console.error(err);
      setStatus("Network/server error. Try again.");
      alert("Network/server error. Try again.");
    }
  }

  // === init ===
  bindTaps();

  if (input){
    input.addEventListener("change", () => {
      const f = input.files && input.files[0];
      loadPhoto(f);
    });
  }

  if (clearBtn){
    clearBtn.addEventListener("click", clearAll);
  }

  if (seeBtn){
    seeBtn.addEventListener("click", analyze);
    seeBtn.addEventListener("touchstart", (e) => { e.preventDefault(); analyze(); }, { passive: false });
  }

  // Try restore photo (optional)
  try{
    const saved = sessionStorage.getItem(PHOTO_KEY);
    if (saved && img){
      img.src = saved;
      if (hint) hint.textContent = "Photo loaded. Tap bullet holes (Tap-n-Score).";
      setStatus("Photo loaded. Tap bullet holes.");
    }
  } catch {}

  updateCount();
})();
