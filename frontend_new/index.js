// sczn3-webapp/frontend_new/index.js (FULL FILE REPLACEMENT)
// Upload + Tap screen.
// Creates tapsJson (bull + holes) and stores it in sessionStorage for output.js.

(function () {
  // Keys shared across pages
  const DIST_KEY  = "sczn3_distance_yards";
  const PHOTO_KEY = "sczn3_targetPhoto_dataUrl";
  const FILE_KEY  = "sczn3_target_file_cachebust"; // just for navigation bust
  const TAPS_KEY  = "sczn3_taps_json";

  // Minimal taps required before analyze
  const MIN_TAPS = 1; // set to 3 if you want: 3–5 shot cluster logic

  // --- Element lookup (works even if IDs vary slightly) ---
  function byId(id) { return document.getElementById(id); }

  const uploadBtn   = byId("uploadBtn")   || byId("pickBtn")    || byId("upload");
  const fileInput   = byId("fileInput")   || byId("imageInput") || byId("image");
  const distanceInp = byId("distanceYards") || byId("distanceInput") || byId("distance");
  const clearBtn    = byId("clearTapsBtn") || byId("clearBtn");
  const tapsLabel   = byId("tapsCount")   || byId("tapsLabel");
  const resultsBtn  = byId("resultsBtn")  || byId("analyzeBtn") || byId("pressResultsBtn");
  const statusEl    = byId("miniStatus")  || byId("status")     || byId("inlineStatus");

  // The image element you tap on
  const targetImg =
    byId("targetImg") ||
    byId("previewImg") ||
    document.querySelector("img#target") ||
    document.querySelector("img");

  function status(msg) {
    if (statusEl) statusEl.textContent = String(msg || "");
  }

  function safeJsonParse(s){
    try { return JSON.parse(String(s || "")); } catch { return null; }
  }

  function setDistance(n){
    const v = Number(n);
    const yards = Number.isFinite(v) && v > 0 ? v : 100;
    sessionStorage.setItem(DIST_KEY, String(yards));
    if (distanceInp) distanceInp.value = String(yards);
  }

  function getDistance(){
    const n = Number(sessionStorage.getItem(DIST_KEY));
    return Number.isFinite(n) && n > 0 ? n : 100;
  }

  // --- Taps state ---
  let holes = []; // [{x:0-1, y:0-1}]
  function bull() {
    // For now: bull = center of image (simple + stable)
    return { x: 0.5, y: 0.5 };
  }

  function updateTapsUI(){
    if (tapsLabel) tapsLabel.textContent = String(holes.length);
    sessionStorage.setItem(TAPS_KEY, JSON.stringify({ bull: bull(), holes: holes.slice(0) }));
  }

  function clearTaps(){
    holes = [];
    updateTapsUI();
    status("Cleared. Tap the holes.");
  }

  function normalizeTap(evt, imgEl){
    const r = imgEl.getBoundingClientRect();
    const clientX = evt.touches && evt.touches[0] ? evt.touches[0].clientX : evt.clientX;
    const clientY = evt.touches && evt.touches[0] ? evt.touches[0].clientY : evt.clientY;

    const x = (clientX - r.left) / r.width;
    const y = (clientY - r.top) / r.height;

    // clamp
    const nx = Math.max(0, Math.min(1, x));
    const ny = Math.max(0, Math.min(1, y));
    return { x: nx, y: ny };
  }

  function handleTap(evt){
    if (!targetImg) return;
    // Don’t scroll/zoom when tapping the target
    if (evt.cancelable) evt.preventDefault();

    const p = normalizeTap(evt, targetImg);
    holes.push(p);
    updateTapsUI();
    status(`Tapped: ${holes.length}`);
  }

  // --- Photo handling ---
  async function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result || ""));
      r.onerror = () => reject(new Error("FileReader failed."));
      r.readAsDataURL(file);
    });
  }

  async function onPickedFile(file){
    if (!file) return;

    const dataUrl = await fileToDataUrl(file);
    sessionStorage.setItem(PHOTO_KEY, dataUrl);

    // show image if possible
    if (targetImg) targetImg.src = dataUrl;

    // Reset taps for a new photo
    holes = [];
    updateTapsUI();

    status("Photo loaded. Tap the holes (Tap-n-Score).");
  }

  function openPicker(){
    if (!fileInput) {
      alert("Missing file input on this page.");
      return;
    }
    fileInput.click();
  }

  function goResults(){
    // Guard: must have a photo
    const photo = sessionStorage.getItem(PHOTO_KEY) || "";
    if (!photo){
      status("Add a target photo first.");
      return;
    }

    // Guard: must have taps
    if (holes.length < MIN_TAPS){
      status(`Tap at least ${MIN_TAPS} hole${MIN_TAPS === 1 ? "" : "s"} before results.`);
      return;
    }

    // Ensure tapsJson saved
    sessionStorage.setItem(TAPS_KEY, JSON.stringify({ bull: bull(), holes: holes.slice(0) }));

    // iOS cache-bust navigation
    sessionStorage.setItem(FILE_KEY, String(Date.now()));
    window.location.href = `./output.html?v=${Date.now()}`;
  }

  // --- INIT ---
  (function init(){
    setDistance(getDistance());
    updateTapsUI();

    // distance changes
    if (distanceInp){
      distanceInp.addEventListener("input", () => setDistance(distanceInp.value));
      distanceInp.addEventListener("change", () => setDistance(distanceInp.value));
    }

    // upload picker
    if (uploadBtn){
      uploadBtn.addEventListener("click", openPicker);
      uploadBtn.addEventListener("touchstart", openPicker, { passive: true });
    }

    if (fileInput){
      fileInput.addEventListener("change", async () => {
        const file = fileInput.files && fileInput.files[0] ? fileInput.files[0] : null;
        if (!file) return;
        await onPickedFile(file);
      });
    }

    // taps on image
    if (targetImg){
      targetImg.style.touchAction = "manipulation"; // allow pinch zoom generally, but taps register cleanly
      targetImg.addEventListener("click", handleTap);
      targetImg.addEventListener("touchstart", handleTap, { passive: false });
    }

    // clear taps
    if (clearBtn){
      clearBtn.addEventListener("click", clearTaps);
      clearBtn.addEventListener("touchstart", clearTaps, { passive: true });
    }

    // results button
    if (resultsBtn){
      resultsBtn.addEventListener("click", goResults);
      resultsBtn.addEventListener("touchstart", goResults, { passive: true });
    }

    // restore photo if present
    const photo = sessionStorage.getItem(PHOTO_KEY);
    if (photo && targetImg){
      targetImg.src = photo;
      status("Photo loaded. Tap the holes (Tap-n-Score).");
    } else {
      status("Ready. Tap UPLOAD.");
    }
  })();
})();
