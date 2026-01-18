// sczn3-webapp/frontend_new/index.js (FULL FILE REPLACEMENT)
// Bull-first tap model, then holes.
// Stores: sessionStorage sczn3_taps_json = { bull:{x,y}, holes:[{x,y}...] }
// Fender: Results button refuses to navigate unless bull+>=1 holes.
// Pinch zoom works because we do NOT block default touch behaviors.

(function () {
  const SS_DIST   = "sczn3_distance_yards";
  const SS_TAPS   = "sczn3_taps_json";
  const SS_PHOTO  = "sczn3_targetPhoto_dataUrl";
  const SS_VENDOR = "sczn3_vendor_buy_url";

  function $(id){ return document.getElementById(id); }

  const uploadBtn     = $("uploadBtn");
  const fileInput     = $("fileInput");
  const distanceInput = $("distanceInput");
  const vendorUrlInput= $("vendorUrlInput");

  const targetImg     = $("targetImg");
  const canvas        = $("tapCanvas");
  const imgWrap       = $("imgWrap");

  const clearBtn      = $("clearBtn");
  const resultsBtn    = $("resultsBtn");
  const tapCount      = $("tapCount");
  const miniStatus    = $("miniStatus");
  const tapHelp       = $("tapHelp");

  const ctx = canvas.getContext("2d");

  function status(msg){
    if (miniStatus) miniStatus.textContent = String(msg || "");
  }

  function help(stepTitle, text){
    if (!tapHelp) return;
    const t = tapHelp.querySelector(".tapHelpTitle");
    const b = tapHelp.querySelector(".tapHelpText");
    if (t) t.textContent = stepTitle;
    if (b) b.textContent = text;
  }

  function setDistance(){
    const n = Number(distanceInput?.value);
    const val = Number.isFinite(n) && n > 0 ? n : 100;
    sessionStorage.setItem(SS_DIST, String(val));
  }

  function setVendor(){
    const v = String(vendorUrlInput?.value || "").trim();
    if (v) sessionStorage.setItem(SS_VENDOR, v);
    else sessionStorage.removeItem(SS_VENDOR);
  }

  function loadDistance(){
    const n = Number(sessionStorage.getItem(SS_DIST));
    if (distanceInput) distanceInput.value = String((Number.isFinite(n) && n>0) ? n : 100);
  }

  function loadVendor(){
    const v = sessionStorage.getItem(SS_VENDOR) || "";
    if (vendorUrlInput) vendorUrlInput.value = v;
  }

  function clearTaps(){
    sessionStorage.removeItem(SS_TAPS);
    draw();
    updateUI();
    help("Step 1", "Tap the bull (center) once.");
  }

  function getModel(){
    const raw = sessionStorage.getItem(SS_TAPS) || "";
    try{
      const obj = JSON.parse(raw);
      if (!obj || typeof obj !== "object") return { bull:null, holes:[] };
      return {
        bull: obj.bull || null,
        holes: Array.isArray(obj.holes) ? obj.holes : []
      };
    } catch {
      return { bull:null, holes:[] };
    }
  }

  function saveModel(m){
    sessionStorage.setItem(SS_TAPS, JSON.stringify(m));
  }

  function updateUI(){
    const m = getModel();
    const total = (m.bull ? 1 : 0) + (m.holes?.length || 0);
    if (tapCount) tapCount.textContent = `Taps: ${total}`;

    if (!m.bull){
      help("Step 1", "Tap the bull (center) once.");
    } else if ((m.holes?.length || 0) < 1){
      help("Step 2", "Now tap at least one hole.");
    } else {
      help("Ready", "Press to see results.");
    }
  }

  function fitCanvas(){
    const r = imgWrap.getBoundingClientRect();
    canvas.width  = Math.max(1, Math.floor(r.width));
    canvas.height = Math.max(1, Math.floor(r.height));
    canvas.style.width  = r.width + "px";
    canvas.style.height = r.height + "px";
  }

  function draw(){
    fitCanvas();
    ctx.clearRect(0,0,canvas.width,canvas.height);

    const m = getModel();

    // Draw bull (green-ish via alpha white; we don’t hardcode colors elsewhere, but this is a marker)
    if (m.bull){
      drawDot(m.bull.x, m.bull.y, 10, 0.9);
      drawRing(m.bull.x, m.bull.y, 18, 0.5);
    }

    // Draw holes
    (m.holes || []).forEach(p => {
      drawDot(p.x, p.y, 8, 0.75);
    });
  }

  function drawDot(x, y, r, a){
    ctx.save();
    ctx.globalAlpha = a;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI*2);
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.fill();
    ctx.restore();
  }

  function drawRing(x, y, r, a){
    ctx.save();
    ctx.globalAlpha = a;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI*2);
    ctx.strokeStyle = "rgba(255,255,255,0.9)";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }

  function getPointFromEvent(ev){
    const rect = canvas.getBoundingClientRect();
    const pt = (ev.touches && ev.touches[0]) ? ev.touches[0] : ev;
    const x = pt.clientX - rect.left;
    const y = pt.clientY - rect.top;
    return { x, y };
  }

  function onTap(ev){
    // IMPORTANT: do NOT preventDefault; allow pinch zoom.
    const p = getPointFromEvent(ev);
    const m = getModel();

    if (!m.bull){
      m.bull = p;
      saveModel(m);
      status("Bull set. Now tap holes.");
    } else {
      m.holes = m.holes || [];
      m.holes.push(p);
      saveModel(m);
      status("Hole added.");
    }

    draw();
    updateUI();
  }

  function canGoResults(){
    const m = getModel();
    return !!(m.bull && Array.isArray(m.holes) && m.holes.length >= 1);
  }

  function goResults(){
    if (!canGoResults()){
      status("Tap the bull first, then at least one hole.");
      updateUI();
      return;
    }
    setDistance();
    setVendor();
    window.location.href = `./output.html?v=${Date.now()}`;
  }

  function onFile(file){
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || "");
      sessionStorage.setItem(SS_PHOTO, dataUrl);

      targetImg.onload = () => {
        status("Photo loaded. Tap the bull (center), then tap holes.");
        clearTaps(); // resets instructions + model + draw
        draw();
        updateUI();
      };
      targetImg.src = dataUrl;
    };
    reader.readAsDataURL(file);
  }

  function init(){
    loadDistance();
    loadVendor();

    const lastPhoto = sessionStorage.getItem(SS_PHOTO);
    if (lastPhoto && targetImg){
      targetImg.onload = () => { draw(); updateUI(); };
      targetImg.src = lastPhoto;
      status("Photo loaded. Tap the bull (center), then tap holes.");
    } else {
      status("Ready. Tap UPLOAD.");
    }

    // Bind
    if (uploadBtn){
      const openPicker = () => fileInput.click();
      uploadBtn.addEventListener("click", openPicker);
      uploadBtn.addEventListener("touchstart", openPicker, { passive:true });
    }

    if (fileInput){
      fileInput.addEventListener("change", (e) => {
        const f = e.target.files && e.target.files[0];
        onFile(f);
      });
    }

    if (distanceInput){
      distanceInput.addEventListener("input", setDistance);
      distanceInput.addEventListener("change", setDistance);
    }

    if (vendorUrlInput){
      vendorUrlInput.addEventListener("input", setVendor);
      vendorUrlInput.addEventListener("change", setVendor);
    }

    if (clearBtn){
      clearBtn.addEventListener("click", clearTaps);
      clearBtn.addEventListener("touchstart", clearTaps, { passive:true });
    }

    if (resultsBtn){
      resultsBtn.addEventListener("click", goResults);
      resultsBtn.addEventListener("touchstart", goResults, { passive:true });
    }

    // Tap handlers on canvas
    canvas.addEventListener("click", onTap);
    canvas.addEventListener("touchstart", onTap, { passive:true });

    // Resize safety
    window.addEventListener("resize", () => { draw(); });

    updateUI();
  }

  init();
})();
