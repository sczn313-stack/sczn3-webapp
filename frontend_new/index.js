// sczn3-webapp/frontend_new/index.js  (FULL REPLACEMENT)
// iOS-native picker ONLY (no custom sheet) + Tap-N-Score + Zoom overlay

(function () {
  const PHOTO_KEY = "sczn3_targetPhoto_dataUrl";
  const FILE_KEY  = "sczn3_targetPhoto_fileName";
  const DIST_KEY  = "sczn3_distance_yards";
  const TAPS_KEY  = "sczn3_tap_points_json";

  function $(id){ return document.getElementById(id); }

  const uploadBtn     = $("uploadBtn");
  const photoInput    = $("targetPhotoInput");

  const tapStage      = $("tapStage");
  const tapCountText  = $("tapCountText");
  const thumb         = $("thumb");
  const tapLayer      = $("tapLayer");
  const clearTapsBtn  = $("clearTapsBtn");

  const zoomBtn       = $("zoomBtn");
  const zoomOverlay   = $("zoomOverlay");
  const zoomDoneBtn   = $("zoomDoneBtn");
  const zoomClearBtn  = $("zoomClearBtn");
  const zoomScroller  = $("zoomScroller");
  const zoomImg       = $("zoomImg");
  const zoomTapLayer  = $("zoomTapLayer");

  const distanceInput = $("distanceYards");
  const pressToSee    = $("pressToSee");
  const buyMoreBtn    = $("buyMoreBtn");
  const miniStatus    = $("miniStatus");

  function status(msg){
    if (miniStatus) miniStatus.textContent = String(msg || "");
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

  function showPhoto(dataUrl){
    if (tapStage) tapStage.style.display = "block";

    if (thumb){
      thumb.src = dataUrl;
      thumb.onload = () => {
        redrawTapLayers();
        status("Photo loaded. Tap bull first, then holes.");
      };
      thumb.onerror = () => status("ERROR: photo failed to load.");
    }

    if (zoomImg){
      zoomImg.src = dataUrl;
      zoomImg.onload = () => redrawTapLayers();
    }
  }

  function resetInput(){
    if (photoInput) photoInput.value = "";
  }

  async function handlePickedFile(){
    const file = photoInput && photoInput.files && photoInput.files[0];
    if (!file){
      status("No file selected.");
      return;
    }

    if (!file.type || !file.type.startsWith("image/")){
      alert("Please choose an image file.");
      resetInput();
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

      // HARD RESET taps on new photo
      saveTaps([]);
      if (tapLayer) tapLayer.innerHTML = "";
      if (zoomTapLayer) zoomTapLayer.innerHTML = "";
      setTapCount(0);

      showPhoto(dataUrl);

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

  // ===== ZOOM =====
  function openZoom(){
    const dataUrl = sessionStorage.getItem(PHOTO_KEY);
    if (!dataUrl){
      alert("Upload a target photo first.");
      return;
    }
    if (zoomOverlay) zoomOverlay.style.display = "flex";
    if (zoomImg) zoomImg.src = dataUrl;

    setTimeout(() => {
      if (zoomScroller) zoomScroller.scrollTop = 0;
      redrawTapLayers();
    }, 50);
  }

  function closeZoom(){
    if (zoomOverlay) zoomOverlay.style.display = "none";
    redrawTapLayers();
  }

  // ===== Tap capture =====
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

  // Normal view taps
  if (tapLayer){
    const onTap = (e) => { e.preventDefault(); pushTapFrom(thumb, e); };
    tapLayer.addEventListener("click", onTap);
    tapLayer.addEventListener("touchstart", onTap, { passive:false });
  }

  // Zoom view taps
  if (zoomTapLayer){
    const onZoomTap = (e) => { e.preventDefault(); pushTapFrom(zoomImg, e); };
    zoomTapLayer.addEventListener("click", onZoomTap);
    zoomTapLayer.addEventListener("touchstart", onZoomTap, { passive:false });
  }

  function clearTaps(){
    saveTaps([]);
    if (tapLayer) tapLayer.innerHTML = "";
    if (zoomTapLayer) zoomTapLayer.innerHTML = "";
    setTapCount(0);
    status("Taps cleared.");
  }

  if (clearTapsBtn) clearTapsBtn.addEventListener("click", clearTaps);
  if (zoomClearBtn) zoomClearBtn.addEventListener("click", clearTaps);

  if (zoomBtn) zoomBtn.addEventListener("click", openZoom);
  if (zoomDoneBtn) zoomDoneBtn.addEventListener("click", closeZoom);

  // ===== Upload button -> iOS native picker =====
  if (uploadBtn && photoInput){
    uploadBtn.addEventListener("click", (e) => {
      e.preventDefault();
      resetInput();
      status("Opening photo picker…");
      photoInput.click(); // iOS shows Library + Take Photo automatically
    });
  }

  if (photoInput){
    photoInput.addEventListener("change", handlePickedFile);
    photoInput.addEventListener("input", handlePickedFile);
  }

  // ===== Distance save =====
  if (distanceInput){
    distanceInput.addEventListener("input", saveDistance);
    distanceInput.addEventListener("change", saveDistance);
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

  // ===== INIT =====
  (function init(){
    status("Ready. Tap UPLOAD.");

    const savedDist = sessionStorage.getItem(DIST_KEY);
    if (distanceInput && savedDist) distanceInput.value = savedDist;

    const buyUrl = sessionStorage.getItem("sczn3_vendor_buy_url");
    if (buyMoreBtn && buyUrl){
      buyMoreBtn.href = buyUrl;
      buyMoreBtn.style.display = "inline-block";
    }

    const savedPhoto = sessionStorage.getItem(PHOTO_KEY);
    if (savedPhoto){
      showPhoto(savedPhoto);
      setPressEnabled(true);
    } else {
      setPressEnabled(false);
      setTapCount(0);
      if (tapStage) tapStage.style.display = "none";
    }

    setTapCount(loadTaps().length);
    redrawTapLayers();
  })();
})();
