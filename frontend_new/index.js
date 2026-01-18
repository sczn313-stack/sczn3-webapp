// sczn3-webapp/frontend_new/index.js  (FULL REPLACEMENT)
// Upload page + Tap N Score capture (iOS-safe menu: Choose vs Camera)
// + Zoom overlay with pinch-friendly fullscreen tap mode
//
// Stores:
//  sczn3_targetPhoto_dataUrl
//  sczn3_targetPhoto_fileName
//  sczn3_distance_yards
//  sczn3_tap_points_json   <-- array of {x,y} in NATURAL image pixels (bull first)

(function () {
  const PHOTO_KEY = "sczn3_targetPhoto_dataUrl";
  const FILE_KEY  = "sczn3_targetPhoto_fileName";
  const DIST_KEY  = "sczn3_distance_yards";
  const TAPS_KEY  = "sczn3_tap_points_json";

  function $(id){ return document.getElementById(id); }

  // ===== DOM (must match HTML) =====
  const uploadBtn          = $("uploadBtn");

  const fileLibrary        = $("targetPhotoLibrary");
  const fileCamera         = $("targetPhotoCamera");

  const pickOverlay        = $("pickOverlay");
  const pickChoose         = $("pickChoose");
  const pickCamera         = $("pickCamera");
  const pickCancel         = $("pickCancel");

  const tapStage           = $("tapStage");
  const tapCountText       = $("tapCountText");

  const thumb              = $("thumb");
  const tapLayer           = $("tapLayer");
  const clearTapsBtn       = $("clearTapsBtn");

  const zoomBtn            = $("zoomBtn");
  const zoomOverlay        = $("zoomOverlay");
  const zoomDoneBtn        = $("zoomDoneBtn");
  const zoomClearBtn       = $("zoomClearBtn");
  const zoomScroller       = $("zoomScroller");
  const zoomImg            = $("zoomImg");
  const zoomTapLayer       = $("zoomTapLayer");

  const distanceInput      = $("distanceYards");
  const pressToSee         = $("pressToSee");
  const buyMoreBtn         = $("buyMoreBtn");
  const miniStatus         = $("miniStatus");

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

  function saveDistance(){
    if (!distanceInput) return;
    const v = String(distanceInput.value || "").trim();
    if (v) sessionStorage.setItem(DIST_KEY, v);
  }

  function safeJsonParse(str){
    try { return JSON.parse(str); } catch { return null; }
  }

  function loadTaps(){
    const raw = sessionStorage.getItem(TAPS_KEY) || "";
    const arr = safeJsonParse(raw);
    return Array.isArray(arr) ? arr : [];
  }

  function saveTaps(arr){
    sessionStorage.setItem(TAPS_KEY, JSON.stringify(arr || []));
  }

  function readFileAsDataURL(file){
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("File read failed."));
      reader.onload = (e) => resolve(String(e.target && e.target.result ? e.target.result : ""));
      reader.readAsDataURL(file);
    });
  }

  // Map tap (client coords on displayed image) -> NATURAL image pixel coords
  function clientToNaturalFromImg(imgEl, e){
    if (!imgEl) return null;

    const rect = imgEl.getBoundingClientRect();
    const nw = imgEl.naturalWidth || 1;
    const nh = imgEl.naturalHeight || 1;

    const clientX = (e.touches && e.touches[0] ? e.touches[0].clientX : e.clientX);
    const clientY = (e.touches && e.touches[0] ? e.touches[0].clientY : e.clientY);

    const x = ((clientX - rect.left) / rect.width) * nw;
    const y = ((clientY - rect.top) / rect.height) * nh;

    return { x, y };
  }

  function setTapCount(n){
    if (tapCountText) tapCountText.textContent = `Taps: ${Number(n) || 0}`;
  }

  function renderTapSvg(svgEl, imgEl){
    if (!svgEl || !imgEl) return;

    const taps = loadTaps();
    setTapCount(taps.length);

    const nw = imgEl.naturalWidth || 1;
    const nh = imgEl.naturalHeight || 1;
    svgEl.setAttribute("viewBox", `0 0 ${nw} ${nh}`);

    if (!taps.length){
      svgEl.innerHTML = "";
      return;
    }

    svgEl.innerHTML = taps.map((p) => {
      const x = Number(p.x);
      const y = Number(p.y);
      if (!Number.isFinite(x) || !Number.isFinite(y)) return "";
      return `
        <g>
          <circle cx="${x}" cy="${y}" r="26" fill="rgba(255,140,0,0.35)"></circle>
          <circle cx="${x}" cy="${y}" r="8" fill="rgba(120,60,0,0.85)"></circle>
        </g>
      `;
    }).join("");
  }

  function redrawTapLayers(){
    if (thumb && tapLayer) renderTapSvg(tapLayer, thumb);
    if (zoomImg && zoomTapLayer) renderTapSvg(zoomTapLayer, zoomImg);
  }

  function showThumb(dataUrl){
    if (!thumb) return;

    if (tapStage) tapStage.style.display = "block";

    thumb.src = dataUrl;

    thumb.onload = () => {
      redrawTapLayers();
      status("Photo loaded. Tap the bull first, then holes.");
    };

    thumb.onerror = () => {
      status("ERROR: photo failed to load.");
    };
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
    input.value = ""; // iOS: selecting same photo requires clearing
  }

  async function handlePickedFileFrom(inputEl){
    const file = inputEl && inputEl.files && inputEl.files[0];

    if (!file){
      status("No file selected.");
      return;
    }

    status(`Selected: ${file.name || "photo"}`);

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

      // HARD RESET: new photo = new tap session
      saveTaps([]);
      if (tapLayer) tapLayer.innerHTML = "";
      if (zoomTapLayer) zoomTapLayer.innerHTML = "";
      setTapCount(0);

      showThumb(dataUrl);

      // prepare zoom image too
      if (zoomImg){
        zoomImg.src = dataUrl;
        zoomImg.onload = () => redrawTapLayers();
      }

      // store
      sessionStorage.setItem(PHOTO_KEY, dataUrl);
      sessionStorage.setItem(FILE_KEY, file.name || "target.jpg");

      saveDistance();
      setPressEnabled(true);
      status("Photo loaded. Tap bull first, then holes.");
    } catch (err){
      alert("Photo load failed. Please try again.");
      setPressEnabled(false);
      status(`ERROR: ${String(err && err.message ? err.message : err)}`);
    }
  }

  // ===== ZOOM OVERLAY =====
  function openZoom(){
    const dataUrl = sessionStorage.getItem(PHOTO_KEY);
    if (!dataUrl){
      alert("Upload a target photo first.");
      return;
    }
    if (zoomOverlay) zoomOverlay.style.display = "flex";
    if (zoomImg) zoomImg.src = dataUrl;

    // iOS: scroll to center-ish
    setTimeout(() => {
      if (zoomScroller) zoomScroller.scrollTop = 0;
      redrawTapLayers();
    }, 50);
  }

  function closeZoom(){
    if (zoomOverlay) zoomOverlay.style.display = "none";
    redrawTapLayers();
  }

  // ===== INIT =====
  (function init(){
    status("Ready. Tap UPLOAD.");

    const savedDist = sessionStorage.getItem(DIST_KEY);
    if (distanceInput && savedDist) distanceInput.value = savedDist;

    const buyUrl = sessionStorage.getItem("sczn3_vendor_buy_url");
    if (buyMoreBtn && buyUrl) buyMoreBtn.href = buyUrl;
    if (buyMoreBtn && buyUrl) buyMoreBtn.style.display = "inline-block";

    const savedPhoto = sessionStorage.getItem(PHOTO_KEY);
    if (savedPhoto){
      showThumb(savedPhoto);
      if (zoomImg) zoomImg.src = savedPhoto;
      setPressEnabled(true);
    } else {
      setPressEnabled(false);
      setTapCount(0);
      if (tapStage) tapStage.style.display = "none";
    }

    const taps = loadTaps();
    setTapCount(taps.length);
    redrawTapLayers();

    saveDistance();
  })();

  // ===== OPEN MENU =====
  if (uploadBtn){
    uploadBtn.addEventListener("click", (e) => {
      e.preventDefault();
      openSheet();
    });
  }

  // Close sheet if tap outside
  if (pickOverlay){
    pickOverlay.addEventListener("click", (e) => {
      if (e.target === pickOverlay) closeSheet();
    });
  }

  // ===== MENU ACTIONS =====
  if (pickCancel){
    pickCancel.addEventListener("click", () => closeSheet());
  }

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

  // ===== INPUT EVENTS =====
  function bindInput(inputEl){
    if (!inputEl) return;
    inputEl.addEventListener("change", () => handlePickedFileFrom(inputEl));
    inputEl.addEventListener("input",  () => handlePickedFileFrom(inputEl));
  }
  bindInput(fileLibrary);
  bindInput(fileCamera);

  // ===== Distance save =====
  if (distanceInput){
    distanceInput.addEventListener("input", saveDistance);
    distanceInput.addEventListener("change", saveDistance);
  }

  // ===== Tap capture (normal view) =====
  function pushTapFrom(imgEl, e){
    if (!imgEl || !imgEl.naturalWidth) return;

    const pt = clientToNaturalFromImg(imgEl, e);
    if (!pt) return;

    const taps = loadTaps();
    taps.push({ x: pt.x, y: pt.y });
    saveTaps(taps);
    redrawTapLayers();
    status(`Taps: ${taps.length}`);
  }

  if (tapLayer){
    const onTap = (e) => {
      e.preventDefault();
      pushTapFrom(thumb, e);
    };
    tapLayer.addEventListener("click", onTap);
    tapLayer.addEventListener("touchstart", onTap, { passive:false });
  }

  // ===== Tap capture (zoom overlay) =====
  if (zoomTapLayer){
    const onZoomTap = (e) => {
      e.preventDefault();
      pushTapFrom(zoomImg, e);
    };
    zoomTapLayer.addEventListener("click", onZoomTap);
    zoomTapLayer.addEventListener("touchstart", onZoomTap, { passive:false });
  }

  // ===== Clear taps =====
  function clearTaps(){
    saveTaps([]);
    if (tapLayer) tapLayer.innerHTML = "";
    if (zoomTapLayer) zoomTapLayer.innerHTML = "";
    setTapCount(0);
    status("Taps cleared.");
  }

  if (clearTapsBtn){
    clearTapsBtn.addEventListener("click", clearTaps);
  }
  if (zoomClearBtn){
    zoomClearBtn.addEventListener("click", clearTaps);
  }

  // ===== Zoom open/close =====
  if (zoomBtn){
    zoomBtn.addEventListener("click", openZoom);
  }
  if (zoomDoneBtn){
    zoomDoneBtn.addEventListener("click", closeZoom);
  }

  // ===== PRESS TO SEE =====
  if (pressToSee){
    pressToSee.addEventListener("click", (e) => {
      e.preventDefault();

      const hasPhoto = !!sessionStorage.getItem(PHOTO_KEY);
      if (!hasPhoto){
        alert("Please upload a target photo first.");
        setPressEnabled(false);
        status("ERROR: no photo in sessionStorage.");
        return;
      }

      saveDistance();
      window.location.href = "./output.html";
    });
  }
})();
