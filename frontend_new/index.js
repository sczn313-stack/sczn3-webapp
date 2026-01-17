// sczn3-webapp/frontend_new/index.js
// Upload page + Tap N Score capture (pilot) — iOS-safe picker menu
//
// Stores:
//  sczn3_targetPhoto_dataUrl
//  sczn3_targetPhoto_fileName
//  sczn3_distance_yards
//  sczn3_tap_points_json   <-- array of {x,y} in NATURAL image pixels

(function () {
  const PHOTO_KEY = "sczn3_targetPhoto_dataUrl";
  const FILE_KEY  = "sczn3_targetPhoto_fileName";
  const DIST_KEY  = "sczn3_distance_yards";
  const TAPS_KEY  = "sczn3_tap_points_json";

  function $(id){ return document.getElementById(id); }

  // UI
  const uploadBtn     = $("uploadBtn");
  const fileLibrary   = $("targetPhotoLibrary");
  const fileCamera    = $("targetPhotoCamera");

  const pickOverlay   = $("pickOverlay");
  const pickChoose    = $("pickChoose");
  const pickCameraBtn = $("pickCamera");
  const pickCancel    = $("pickCancel");

  const thumb         = $("thumb");
  const thumbWrap     = $("thumbWrap");
  const tapLayer      = $("tapLayer");
  const tapTools      = $("tapTools");
  const clearTapsBtn  = $("clearTapsBtn");

  const distanceInput = $("distanceYards");
  const pressToSee    = $("pressToSee");
  const buyMoreBtn    = $("buyMoreBtn");
  const miniStatus    = $("miniStatus");

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

  function readFileAsDataURL(file){
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("File read failed."));
      reader.onload = (e) => resolve(String(e.target && e.target.result ? e.target.result : ""));
      reader.readAsDataURL(file);
    });
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

  function openPicker(){
    if (!pickOverlay) {
      // fallback: open library input if overlay missing
      if (fileLibrary) {
        fileLibrary.value = "";
        status("Opening photo picker...");
        fileLibrary.click();
      }
      return;
    }
    pickOverlay.style.display = "flex";
  }

  function closePicker(){
    if (!pickOverlay) return;
    pickOverlay.style.display = "none";
  }

  // Map tap (client coords on displayed image) -> NATURAL image pixel coords
  function clientToNatural(e){
    if (!thumb) return null;

    const rect = thumb.getBoundingClientRect();
    const nw = thumb.naturalWidth || 1;
    const nh = thumb.naturalHeight || 1;

    const clientX = (e.touches && e.touches[0] ? e.touches[0].clientX : e.clientX);
    const clientY = (e.touches && e.touches[0] ? e.touches[0].clientY : e.clientY);

    const x = ((clientX - rect.left) / rect.width) * nw;
    const y = ((clientY - rect.top) / rect.height) * nh;

    return { x, y, nw, nh };
  }

  function redrawTapLayer(){
    if (!tapLayer || !thumb) return;

    const taps = loadTaps();
    const nw = thumb.naturalWidth || 1;
    const nh = thumb.naturalHeight || 1;

    tapLayer.setAttribute("viewBox", `0 0 ${nw} ${nh}`);

    if (!taps.length){
      tapLayer.innerHTML = "";
      if (tapTools) tapTools.style.display = "none";
      return;
    }

    if (tapTools) tapTools.style.display = "block";

    tapLayer.innerHTML = taps.map((p) => {
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

  function showThumb(dataUrl){
    if (!thumb || !thumbWrap) return;

    thumb.src = dataUrl;

    thumb.onload = () => {
      thumbWrap.style.display = "block";
      redrawTapLayer();
      status("Photo loaded. Tap the holes (Tap N Score).");
    };

    thumb.onerror = () => {
      status("ERROR: thumb image failed to load.");
    };
  }

  async function handlePickedFileFrom(inputEl, sourceLabel){
    const file = inputEl && inputEl.files && inputEl.files[0];

    if (!file){
      status("No file selected.");
      return;
    }

    status(`Selected (${sourceLabel}): ${file.name || "photo"} (${file.type || "unknown"})`);

    if (!file.type || !file.type.startsWith("image/")){
      alert("Please choose an image file.");
      inputEl.value = "";
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

      // new photo = reset taps
      saveTaps([]);

      // show + store
      showThumb(dataUrl);
      sessionStorage.setItem(PHOTO_KEY, dataUrl);
      sessionStorage.setItem(FILE_KEY, file.name || "target.jpg");

      saveDistance();
      setPressEnabled(true);
      closePicker();
    } catch (err){
      alert("Photo load failed. Please try again.");
      setPressEnabled(false);
      status(`ERROR: ${String(err && err.message ? err.message : err)}`);
    }
  }

  // ---- Init ----
  (function init(){
    status("Ready. Press UPLOAD.");

    const savedDist = sessionStorage.getItem(DIST_KEY);
    if (distanceInput && savedDist) distanceInput.value = savedDist;

    const buyUrl = sessionStorage.getItem("sczn3_vendor_buy_url");
    if (buyMoreBtn && buyUrl) buyMoreBtn.href = buyUrl;

    const savedPhoto = sessionStorage.getItem(PHOTO_KEY);
    if (savedPhoto){
      showThumb(savedPhoto);
      setPressEnabled(true);
    } else {
      setPressEnabled(false);
    }

    saveDistance();
  })();

  // ---- Upload button opens our menu ----
  if (uploadBtn){
    uploadBtn.addEventListener("click", (e) => {
      e.preventDefault();
      openPicker();
    });
  }

  // ---- Picker sheet buttons ----
  if (pickOverlay){
    // tap outside sheet to close
    pickOverlay.addEventListener("click", (e) => {
      if (e.target === pickOverlay) closePicker();
    });
  }

  if (pickCancel){
    pickCancel.addEventListener("click", () => closePicker());
  }

  if (pickChoose && fileLibrary){
    pickChoose.addEventListener("click", () => {
      // CRITICAL: clear so iOS fires event even if same photo chosen
      fileLibrary.value = "";
      status("Opening Library / Files...");
      fileLibrary.click();
    });
  }

  if (pickCameraBtn && fileCamera){
    pickCameraBtn.addEventListener("click", () => {
      // CRITICAL: clear so iOS fires event even if same photo chosen
      fileCamera.value = "";
      status("Opening Camera...");
      fileCamera.click();
    });
  }

  // iOS sometimes fires "input" more reliably than "change"
  if (fileLibrary){
    fileLibrary.addEventListener("change", () => handlePickedFileFrom(fileLibrary, "library"));
    fileLibrary.addEventListener("input",  () => handlePickedFileFrom(fileLibrary, "library"));
  }

  if (fileCamera){
    fileCamera.addEventListener("change", () => handlePickedFileFrom(fileCamera, "camera"));
    fileCamera.addEventListener("input",  () => handlePickedFileFrom(fileCamera, "camera"));
  }

  // ---- Distance save ----
  if (distanceInput){
    distanceInput.addEventListener("input", saveDistance);
    distanceInput.addEventListener("change", saveDistance);
  }

  // ---- Tap capture on overlay ----
  if (tapLayer){
    const onTap = (e) => {
      e.preventDefault();
      if (!thumb || !thumb.naturalWidth) return;

      const pt = clientToNatural(e);
      if (!pt) return;

      const taps = loadTaps();
      taps.push({ x: pt.x, y: pt.y });
      saveTaps(taps);

      redrawTapLayer();
      status(`Taps: ${taps.length}`);
    };

    tapLayer.addEventListener("click", onTap);
    tapLayer.addEventListener("touchstart", onTap, { passive: false });
  }

  // ---- Clear taps ----
  if (clearTapsBtn){
    clearTapsBtn.addEventListener("click", () => {
      saveTaps([]);
      redrawTapLayer();
      status("Taps cleared.");
    });
  }

  // ---- PRESS TO SEE -> output.html ----
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
