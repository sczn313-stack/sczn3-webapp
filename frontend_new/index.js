// sczn3-webapp/frontend_new/index.js  (FULL REPLACEMENT)
// Upload page + Tap N Score capture (iOS-safe menu: Choose vs Camera)
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

  const RESULT_KEY = "tapnscore_result";

  function $(id){ return document.getElementById(id); }

  // ===== DOM (must match your HTML) =====
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
  const thumbWrap          = $("thumbWrap");
  const tapLayer           = $("tapLayer");
  const clearTapsBtn       = $("clearTapsBtn");

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

  function setTapCount(n){
    if (tapCountText) tapCountText.textContent = `Taps: ${Number(n) || 0}`;
  }

  function redrawTapLayer(){
    if (!tapLayer || !thumb) return;

    const taps = loadTaps();
    setTapCount(taps.length);

    const nw = thumb.naturalWidth || 1;
    const nh = thumb.naturalHeight || 1;
    tapLayer.setAttribute("viewBox", `0 0 ${nw} ${nh}`);

    if (!taps.length){
      tapLayer.innerHTML = "";
      return;
    }

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
    if (!thumb) return;

    if (tapStage) tapStage.style.display = "block";

    thumb.src = dataUrl;

    thumb.onload = () => {
      redrawTapLayer();
      status("Photo loaded. Tap bull first, then tap holes.");
    };

    thumb.onerror = () => {
      status("ERROR: thumb image failed to load.");
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
    // iOS: selecting the same photo won't fire change unless we clear value
    input.value = "";
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

      // ===== HARD RESET: new photo = new tap session (kills “ghost” taps forever) =====
      saveTaps([]);
      if (tapLayer) tapLayer.innerHTML = "";
      if (tapLayer) tapLayer.setAttribute("viewBox", "0 0 100 100");
      setTapCount(0);

      // clear last result whenever a new photo is chosen
      sessionStorage.removeItem(RESULT_KEY);

      // show + store
      showThumb(dataUrl);
      sessionStorage.setItem(PHOTO_KEY, dataUrl);
      sessionStorage.setItem(FILE_KEY, file.name || "target.jpg");

      saveDistance();
      setPressEnabled(true);
      status("Photo loaded. Tap bull first, then tap holes.");
    } catch (err){
      alert("Photo load failed. Please try again.");
      setPressEnabled(false);
      status(`ERROR: ${String(err && err.message ? err.message : err)}`);
    }
  }

  // helper: DataURL -> File (for multipart upload)
  async function dataUrlToFile(dataUrl, filename){
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    return new File([blob], filename, { type: blob.type || "image/jpeg" });
  }

  // ===== INIT =====
  (function init(){
    status("Ready. Tap UPLOAD.");

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
      setTapCount(0);
      if (tapStage) tapStage.style.display = "none";
    }

    // ensure taps UI reflects storage on load
    const taps = loadTaps();
    setTapCount(taps.length);

    saveDistance();
  })();

  // ===== OPEN MENU =====
  if (uploadBtn){
    uploadBtn.addEventListener("click", (e) => {
      e.preventDefault();
      openSheet();
    });
  }

  // Close sheet if you tap outside
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
  // iOS sometimes fires "input" more reliably than "change"
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

  // ===== Tap capture =====
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

  // ===== Clear taps =====
  if (clearTapsBtn){
    clearTapsBtn.addEventListener("click", () => {
      saveTaps([]);
      if (tapLayer) tapLayer.innerHTML = "";
      setTapCount(0);
      status("Taps cleared.");
    });
  }

  // ===== PRESS TO SEE (NOW IT ANALYZES FIRST) =====
  if (pressToSee){
    pressToSee.addEventListener("click", async (e) => {
      e.preventDefault();

      const savedPhoto = sessionStorage.getItem(PHOTO_KEY);
      const fileName = sessionStorage.getItem(FILE_KEY) || "target.jpg";

      if (!savedPhoto){
        alert("Please upload a target photo first.");
        setPressEnabled(false);
        status("ERROR: no photo in sessionStorage.");
        return;
      }

      const taps = loadTaps();
      if (!Array.isArray(taps) || taps.length < 2){
        alert("Tap bull first, then tap at least one hole.");
        status("ERROR: need bull + at least one hole.");
        return;
      }

      saveDistance();

      const distanceYards = Number(sessionStorage.getItem(DIST_KEY) || (distanceInput ? distanceInput.value : "") || 100);
      if (!Number.isFinite(distanceYards) || distanceYards <= 0){
        alert("Please enter a valid distance in yards.");
        status("ERROR: invalid distance.");
        return;
      }

      const nw = (thumb && thumb.naturalWidth) ? thumb.naturalWidth : 0;
      const nh = (thumb && thumb.naturalHeight) ? thumb.naturalHeight : 0;

      try{
        setPressEnabled(false);
        status("After-Shot Intelligence™");

        const file = await dataUrlToFile(savedPhoto, fileName);

        // Call backend_new Tap-N-Score mode
        const data = await window.SEC_API.analyzeTapNScore({
          file,
          distanceYards,
          taps,
          nw,
          nh,
          moaPerClick: 0.25,
          targetWIn: 8.5,
          targetHIn: 11
        });

        sessionStorage.setItem(RESULT_KEY, JSON.stringify(data));
        window.location.href = "./output.html";
      } catch (err){
        setPressEnabled(true);
        alert(String(err && err.message ? err.message : err));
        status(`ERROR: ${String(err && err.message ? err.message : err)}`);
      }
    });
  }
})();
