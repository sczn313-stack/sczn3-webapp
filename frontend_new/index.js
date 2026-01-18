// sczn3-webapp/frontend_new/index.js (FULL REPLACEMENT)
// Upload page + Tap-n-Score capture (Bull first, then Holes)
// iOS-safe menu: Choose vs Camera
//
// Stores:
//  sczn3_targetPhoto_dataUrl
//  sczn3_targetPhoto_fileName
//  sczn3_distance_yards
//  sczn3_tap_bull_json      <-- {x,y} natural pixels
//  sczn3_tap_holes_json     <-- array of {x,y} natural pixels
//  sczn3_taps_json          <-- { bull:{x,y}, holes:[...] }

(function () {
  const PHOTO_KEY = "sczn3_targetPhoto_dataUrl";
  const FILE_KEY  = "sczn3_targetPhoto_fileName";
  const DIST_KEY  = "sczn3_distance_yards";

  const BULL_KEY  = "sczn3_tap_bull_json";
  const HOLES_KEY = "sczn3_tap_holes_json";
  const TAPS_KEY  = "sczn3_taps_json";

  const VENDOR_BUY = "sczn3_vendor_buy_url";

  function $(id){ return document.getElementById(id); }

  const uploadBtn     = $("uploadBtn");
  const fileLibrary   = $("targetPhotoLibrary");
  const fileCamera    = $("targetPhotoCamera");

  const pickOverlay   = $("pickOverlay");
  const pickChoose    = $("pickChoose");
  const pickCamera    = $("pickCamera");
  const pickCancel    = $("pickCancel");

  const tapStage      = $("tapStage");
  const tapCountText  = $("tapCountText");

  const thumb         = $("thumb");
  const tapLayer      = $("tapLayer");

  const clearTapsBtn  = $("clearTapsBtn");
  const setBullBtn    = $("setBullBtn");

  const distanceInput = $("distanceYards");
  const pressToSee    = $("pressToSee");
  const miniStatus    = $("miniStatus");
  const buyMoreBtn    = $("buyMoreBtn");

  let mode = "bull"; // "bull" or "holes"

  function status(msg){
    if (!miniStatus) return;
    miniStatus.textContent = String(msg || "");
  }

  function setPressEnabled(enabled){
    if (!pressToSee) return;
    if (enabled){
      pressToSee.classList.remove("disabled");
      pressToSee.style.pointerEvents = "auto";
      pressToSee.style.opacity = "1";
    } else {
      pressToSee.classList.add("disabled");
      pressToSee.style.pointerEvents = "none";
      pressToSee.style.opacity = "0.7";
    }
  }

  function safeJsonParse(str){
    try { return JSON.parse(str); } catch { return null; }
  }

  function saveDistance(){
    if (!distanceInput) return;
    const v = String(distanceInput.value || "").trim();
    if (v) sessionStorage.setItem(DIST_KEY, v);
  }

  function readBull(){
    const raw = sessionStorage.getItem(BULL_KEY) || "";
    const obj = safeJsonParse(raw);
    return obj && Number.isFinite(Number(obj.x)) && Number.isFinite(Number(obj.y)) ? obj : null;
  }

  function readHoles(){
    const raw = sessionStorage.getItem(HOLES_KEY) || "[]";
    const arr = safeJsonParse(raw);
    return Array.isArray(arr) ? arr.filter(p => p && Number.isFinite(Number(p.x)) && Number.isFinite(Number(p.y))) : [];
  }

  function writeBull(pt){
    sessionStorage.setItem(BULL_KEY, JSON.stringify(pt || null));
  }

  function writeHoles(arr){
    sessionStorage.setItem(HOLES_KEY, JSON.stringify(arr || []));
  }

  function writeCombined(){
    const bull = readBull();
    const holes = readHoles();
    const taps = { bull: bull || null, holes };
    sessionStorage.setItem(TAPS_KEY, JSON.stringify(taps));
  }

  function setVendorBuyLink(){
    const url = sessionStorage.getItem(VENDOR_BUY);
    if (buyMoreBtn && url){
      buyMoreBtn.href = url;
      buyMoreBtn.style.display = "block";
    }
  }

  function openSheet(){
    if (!pickOverlay) return;
    pickOverlay.style.display = "flex";
  }

  function closeSheet(){
    if (!pickOverlay) return;
    pickOverlay.style.display = "none";
  }

  function resetInput(input){
    if (!input) return;
    input.value = "";
  }

  function readFileAsDataURL(file){
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("File read failed."));
      reader.onload = (e) => resolve(String(e.target && e.target.result ? e.target.result : ""));
      reader.readAsDataURL(file);
    });
  }

  // client coords -> NATURAL image pixel coords
  function clientToNatural(e){
    if (!thumb) return null;

    const rect = thumb.getBoundingClientRect();
    const nw = thumb.naturalWidth || 1;
    const nh = thumb.naturalHeight || 1;

    const clientX = (e.touches && e.touches[0] ? e.touches[0].clientX : e.clientX);
    const clientY = (e.touches && e.touches[0] ? e.touches[0].clientY : e.clientY);

    const x = ((clientX - rect.left) / rect.width) * nw;
    const y = ((clientY - rect.top) / rect.height) * nh;

    return { x, y };
  }

  function setTapCountUI(){
    const bull = readBull();
    const holes = readHoles();
    if (tapCountText){
      tapCountText.textContent = `Bull: ${bull ? "set" : "not set"} • Holes: ${holes.length}`;
    }
  }

  function redrawTapLayer(){
    if (!tapLayer || !thumb) return;

    const bull = readBull();
    const holes = readHoles();

    const nw = thumb.naturalWidth || 1;
    const nh = thumb.naturalHeight || 1;
    tapLayer.setAttribute("viewBox", `0 0 ${nw} ${nh}`);

    const bullMarkup = bull ? `
      <g>
        <circle cx="${Number(bull.x)}" cy="${Number(bull.y)}" r="28" fill="rgba(0,160,255,0.20)"></circle>
        <circle cx="${Number(bull.x)}" cy="${Number(bull.y)}" r="10" fill="rgba(0,160,255,0.85)"></circle>
      </g>
    ` : "";

    const holesMarkup = (holes || []).map((p) => `
      <g>
        <circle cx="${Number(p.x)}" cy="${Number(p.y)}" r="26" fill="rgba(255,140,0,0.35)"></circle>
        <circle cx="${Number(p.x)}" cy="${Number(p.y)}" r="8" fill="rgba(120,60,0,0.85)"></circle>
      </g>
    `).join("");

    tapLayer.innerHTML = bullMarkup + holesMarkup;

    setTapCountUI();

    // Enable results only if we have bull + at least 1 hole
    const ok = !!bull && holes.length >= 1;
    setPressEnabled(ok);
  }

  function hardResetTapSession(){
    writeBull(null);
    writeHoles([]);
    writeCombined();
    mode = "bull";
    if (tapLayer) tapLayer.innerHTML = "";
    setTapCountUI();
    setPressEnabled(false);
  }

  function showThumb(dataUrl){
    if (!thumb) return;

    if (tapStage) tapStage.style.display = "block";

    thumb.src = dataUrl;

    thumb.onload = () => {
      redrawTapLayer();
      status(mode === "bull"
        ? "Photo loaded. Tap the BULL first."
        : "Photo loaded. Tap the holes.");
    };

    thumb.onerror = () => {
      status("ERROR: thumb image failed to load.");
    };
  }

  async function handlePickedFileFrom(inputEl){
    const file = inputEl && inputEl.files && inputEl.files[0];

    if (!file){
      status("No file selected.");
      return;
    }

    if (!file.type || !file.type.startsWith("image/")){
      alert("Please choose an image file.");
      resetInput(inputEl);
      setPressEnabled(false);
      status("ERROR: Not an image.");
      return;
    }

    try{
      const dataUrl = await readFileAsDataURL(file);
      if (!dataUrl){
        alert("Could not load the photo. Please try again.");
        setPressEnabled(false);
        status("ERROR: dataUrl empty.");
        return;
      }

      // HARD RESET: new photo = new bull/holes session
      hardResetTapSession();

      showThumb(dataUrl);
      sessionStorage.setItem(PHOTO_KEY, dataUrl);
      sessionStorage.setItem(FILE_KEY, file.name || "target.jpg");

      saveDistance();
      status("Photo loaded. Tap the BULL first.");
    } catch (err){
      alert("Photo load failed. Please try again.");
      setPressEnabled(false);
      status(`ERROR: ${String(err && err.message ? err.message : err)}`);
    }
  }

  // ===== INIT =====
  (function init(){
    setVendorBuyLink();

    const savedDist = sessionStorage.getItem(DIST_KEY);
    if (distanceInput && savedDist) distanceInput.value = savedDist;

    const savedPhoto = sessionStorage.getItem(PHOTO_KEY);
    if (savedPhoto){
      if (tapStage) tapStage.style.display = "block";
      showThumb(savedPhoto);
      status("Photo loaded. Tap the BULL first (or tap Set bull).");
    } else {
      if (tapStage) tapStage.style.display = "none";
      setPressEnabled(false);
      setTapCountUI();
    }

    saveDistance();
  })();

  // ===== OPEN MENU =====
  if (uploadBtn){
    uploadBtn.addEventListener("click", (e) => {
      e.preventDefault();
      openSheet();
    });
  }

  // Close sheet if tapping outside
  if (pickOverlay){
    pickOverlay.addEventListener("click", (e) => {
      if (e.target === pickOverlay) closeSheet();
    });
  }

  if (pickCancel) pickCancel.addEventListener("click", () => closeSheet());

  if (pickChoose && fileLibrary){
    pickChoose.addEventListener("click", () => {
      closeSheet();
      resetInput(fileLibrary);
      status("Opening library/files picker...");
      fileLibrary.click();
    });
  }

  if (pickCamera && fileCamera){
    pickCamera.addEventListener("click", () => {
      closeSheet();
      resetInput(fileCamera);
      status("Opening camera...");
      fileCamera.click();
    });
  }

  function bindInput(inputEl){
    if (!inputEl) return;
    inputEl.addEventListener("change", () => handlePickedFileFrom(inputEl));
    inputEl.addEventListener("input",  () => handlePickedFileFrom(inputEl));
  }
  bindInput(fileLibrary);
  bindInput(fileCamera);

  // Distance save
  if (distanceInput){
    distanceInput.addEventListener("input", saveDistance);
    distanceInput.addEventListener("change", saveDistance);
  }

  // Set bull button (forces next tap to be bull)
  if (setBullBtn){
    setBullBtn.addEventListener("click", () => {
      mode = "bull";
      status("Tap the BULL now.");
    });
  }

  // Tap capture on SVG overlay
  if (tapLayer){
    const onTap = (e) => {
      e.preventDefault();
      if (!thumb || !thumb.naturalWidth) return;

      const pt = clientToNatural(e);
      if (!pt) return;

      if (mode === "bull"){
        writeBull({ x: pt.x, y: pt.y });
        mode = "holes";
        status("Bull set. Now tap the holes.");
      } else {
        const holes = readHoles();
        holes.push({ x: pt.x, y: pt.y });
        writeHoles(holes);
        status(`Holes: ${holes.length}`);
      }

      writeCombined();
      redrawTapLayer();
    };

    tapLayer.addEventListener("click", onTap);
    tapLayer.addEventListener("touchstart", onTap, { passive: false });
  }

  // Clear taps
  if (clearTapsBtn){
    clearTapsBtn.addEventListener("click", () => {
      hardResetTapSession();
      status("Cleared. Tap the BULL first.");
      redrawTapLayer();
    });
  }

  // PRESS TO SEE
  if (pressToSee){
    const go = (e) => {
      e.preventDefault();

      const hasPhoto = !!sessionStorage.getItem(PHOTO_KEY);
      if (!hasPhoto){
        alert("Please upload a target photo first.");
        setPressEnabled(false);
        status("ERROR: no photo in sessionStorage.");
        return;
      }

      const bull = readBull();
      const holes = readHoles();
      if (!bull || holes.length < 1){
        alert("Tap the bull first, then tap at least 1 hole.");
        status("Need bull + holes.");
        return;
      }

      saveDistance();
      window.location.href = "./output.html";
    };

    pressToSee.addEventListener("click", go);
    pressToSee.addEventListener("touchstart", go, { passive: false });
  }
})();
