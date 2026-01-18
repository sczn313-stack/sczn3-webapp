// sczn3-webapp/frontend_new/index.js (FULL FILE REPLACEMENT)
// iOS-safe: photo picker (camera + library), tap capture, and backend-safe payload storage.

(function () {
  // ===== Keys (must match receipt.js + output.js expectations) =====
  const DIST_KEY   = "sczn3_distance_yards";
  const PHOTO_KEY  = "sczn3_targetPhoto_dataUrl";
  const TAPS_KEY   = "sczn3_taps_json";
  const VENDOR_KEY = "sczn3_vendor_buy_url";

  function $(id){ return document.getElementById(id); }

  const addPhotoBtn   = $("addPhotoBtn");
  const photoInput    = $("photoInput");
  const targetImage   = $("targetImage");      // <img>
  const imageWrap     = $("targetImageWrap");  // wrapper div
  const emptyHint     = $("emptyHint");

  const distanceInput = $("distanceInput");
  const vendorInput   = $("vendorInput");

  const tapsCountEl   = $("tapsCount");
  const clearTapsBtn  = $("clearTapsBtn");
  const seeResultsBtn = $("seeResultsBtn");

  const statusLine    = $("statusLine");

  let taps = [];

  function setStatus(msg){
    if (statusLine) statusLine.textContent = String(msg || "");
  }

  function safeNum(v, fallback){
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : fallback;
  }

  function saveDistance(){
    const yards = safeNum(distanceInput?.value, 100);
    try { sessionStorage.setItem(DIST_KEY, String(yards)); } catch {}
    return yards;
  }

  function saveVendor(){
    const url = String(vendorInput?.value || "").trim();
    try { sessionStorage.setItem(VENDOR_KEY, url); } catch {}
    return url;
  }

  function updateTapCount(){
    if (tapsCountEl) tapsCountEl.textContent = String(taps.length);
  }

  function clearTapDots(){
    if (!imageWrap) return;
    imageWrap.querySelectorAll(".tapDot").forEach(d => d.remove());
  }

  function renderTapDot(x, y){
    if (!imageWrap) return;
    const dot = document.createElement("div");
    dot.className = "tapDot";
    dot.style.left = `${x}px`;
    dot.style.top  = `${y}px`;
    imageWrap.appendChild(dot);
  }

  function clearAllTaps(){
    taps = [];
    updateTapCount();
    clearTapDots();
    try { sessionStorage.removeItem(TAPS_KEY); } catch {}
    setStatus("Taps cleared.");
  }

  function hasPhotoLoaded(){
    return !!(targetImage && targetImage.src && String(targetImage.src).length > 20);
  }

  function storePhoto(dataUrl){
    try { sessionStorage.setItem(PHOTO_KEY, String(dataUrl || "")); } catch {}
  }

  function storeTaps(){
    // backend expects: tapsJson with { bull: {x,y}, holes:[{x,y}...] }
    // For Tap-n-Score demo: bull = image center, holes = taps (pixels in wrapper coords)
    if (!imageWrap) return null;

    const rect = imageWrap.getBoundingClientRect();
    const bull = { x: rect.width / 2, y: rect.height / 2 };
    const holes = taps.map(t => ({ x: t.x, y: t.y }));

    const payload = {
      bull,
      holes,
      meta: {
        units: "px",
        created_at: new Date().toISOString()
      }
    };

    try { sessionStorage.setItem(TAPS_KEY, JSON.stringify(payload)); } catch {}
    return payload;
  }

  function showPreview(dataUrl){
    if (!targetImage || !imageWrap) return;

    targetImage.src = dataUrl;
    imageWrap.style.display = "block";

    if (emptyHint) emptyHint.style.display = "none";

    // new photo => reset taps
    clearAllTaps();

    storePhoto(dataUrl);
  }

  function clearPreview(){
    if (targetImage) targetImage.src = "";
    if (imageWrap) imageWrap.style.display = "none";
    if (emptyHint) emptyHint.style.display = "block";

    clearAllTaps();
    try { sessionStorage.removeItem(PHOTO_KEY); } catch {}
  }

  // ===== Photo picker =====
  if (addPhotoBtn && photoInput){
    const openPicker = () => photoInput.click();

    addPhotoBtn.addEventListener("click", openPicker);
    addPhotoBtn.addEventListener("touchstart", openPicker, { passive: true });

    photoInput.addEventListener("change", () => {
      const file = photoInput.files && photoInput.files[0];
      if (!file){
        setStatus("No photo selected.");
        clearPreview();
        return;
      }

      if (!file.type || !file.type.startsWith("image/")){
        setStatus("That file is not an image.");
        clearPreview();
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = String(reader.result || "");
        if (!dataUrl){
          setStatus("Could not load that photo.");
          clearPreview();
          return;
        }
        showPreview(dataUrl);
        setStatus("Photo loaded. Tap bullet holes.");
      };
      reader.onerror = () => {
        setStatus("Could not read that photo.");
        clearPreview();
      };
      reader.readAsDataURL(file);
    });
  }

  // ===== Tap capture (iOS-safe) =====
  function addTapAtClient(clientX, clientY){
    if (!imageWrap) return;
    if (!hasPhotoLoaded()){
      setStatus("Add a photo first.");
      return;
    }

    const rect = imageWrap.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    // bounds
    if (x < 0 || y < 0 || x > rect.width || y > rect.height) return;

    taps.push({ x, y });
    renderTapDot(x, y);
    updateTapCount();

    storeTaps();
    setStatus(`Tap recorded. (${taps.length})`);
  }

  function onTouch(e){
    // CRITICAL for iOS: stops scroll / text selection from eating the tap
    e.preventDefault();
    const t = e.touches && e.touches[0];
    if (!t) return;
    addTapAtClient(t.clientX, t.clientY);
  }

  function onClick(e){
    addTapAtClient(e.clientX, e.clientY);
  }

  function bindTapSurface(){
    if (!imageWrap) return;

    // Ensure wrapper receives taps
    imageWrap.style.pointerEvents = "auto";

    // Remove prior listeners (safe)
    imageWrap.removeEventListener("touchstart", onTouch);
    imageWrap.removeEventListener("click", onClick);

    // Add listeners
    imageWrap.addEventListener("touchstart", onTouch, { passive: false });
    imageWrap.addEventListener("click", onClick);
  }

  // ===== Buttons =====
  if (clearTapsBtn){
    clearTapsBtn.addEventListener("click", clearAllTaps);
    clearTapsBtn.addEventListener("touchstart", (e) => { e.preventDefault(); clearAllTaps(); }, { passive: false });
  }

  if (distanceInput){
    distanceInput.addEventListener("input", saveDistance);
    distanceInput.addEventListener("change", saveDistance);
  }

  if (vendorInput){
    vendorInput.addEventListener("input", saveVendor);
    vendorInput.addEventListener("change", saveVendor);
  }

  if (seeResultsBtn){
    const goResults = (e) => {
      if (e) e.preventDefault();

      const yards = saveDistance();
      saveVendor();

      if (!hasPhotoLoaded()){
        setStatus("Add a photo first.");
        return;
      }
      if (!taps.length){
        setStatus("Tap bullet holes first (at least 1).");
        return;
      }

      // guarantee payload stored
      storeTaps();

      // Navigate to output (cache-bust for iOS)
      window.location.href = `./output.html?v=${Date.now()}`;
    };

    seeResultsBtn.addEventListener("click", goResults);
    seeResultsBtn.addEventListener("touchstart", goResults, { passive: false });
  }

  // ===== INIT =====
  (function init(){
    // Default distance
    try{
      const raw = sessionStorage.getItem(DIST_KEY);
      const n = safeNum(raw, 100);
      if (distanceInput) distanceInput.value = String(n);
    } catch {}

    // Vendor input restore
    try{
      const v = sessionStorage.getItem(VENDOR_KEY) || "";
      if (vendorInput) vendorInput.value = v;
    } catch {}

    bindTapSurface();
    updateTapCount();
    setStatus("Ready. Tap ADD PHOTO.");
  })();
})();
