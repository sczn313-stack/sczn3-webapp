// sczn3-webapp/frontend_new/index.js (FULL FILE REPLACEMENT)
// Upload page + Tap-N-Score capture (pinch-to-zoom friendly; no redundant custom picker)

(function () {
  const PHOTO_KEY = "sczn3_targetPhoto_dataUrl";
  const FILE_KEY  = "sczn3_targetPhoto_fileName";
  const DIST_KEY  = "sczn3_distance_yards";
  const TAPS_KEY  = "sczn3_tap_points_json";
  const VENDOR_BUY = "sczn3_vendor_buy_url";

  function $(id){ return document.getElementById(id); }

  const uploadBtn     = $("uploadBtn");
  const fileInput     = $("targetPhoto");

  const tapStage      = $("tapStage");
  const tapCountText  = $("tapCountText");

  const thumb         = $("thumb");
  const tapLayer      = $("tapLayer");
  const clearTapsBtn  = $("clearTapsBtn");

  const distanceInput = $("distanceYards");
  const pressToSee    = $("pressToSee");
  const miniStatus    = $("miniStatus");
  const buyMoreBtn    = $("buyMoreBtn");

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

  // Map tap (client coords on displayed image) -> NATURAL image pixel coords
  function clientToNatural(e){
    if (!thumb) return null;

    const rect = thumb.getBoundingClientRect();
    const nw = thumb.naturalWidth || 1;
    const nh = thumb.naturalHeight || 1;

    const t = (e.touches && e.touches[0]) ? e.touches[0] : null;
    const clientX = t ? t.clientX : e.clientX;
    const clientY = t ? t.clientY : e.clientY;

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
      status("Photo loaded. Pinch to zoom, then tap the holes.");
    };

    thumb.onerror = () => {
      status("ERROR: thumb image failed to load.");
    };
  }

  function setVendorBuyLink(){
    const url = sessionStorage.getItem(VENDOR_BUY);
    if (buyMoreBtn && url){
      buyMoreBtn.href = url;
      buyMoreBtn.style.display = "block";
    }
  }

  async function handlePickedFile(){
    const file = fileInput && fileInput.files && fileInput.files[0];

    if (!file){
      status("No file selected.");
      return;
    }

    status(`Selected: ${file.name || "photo"}`);

    if (!file.type || !file.type.startsWith("image/")){
      alert("Please choose an image file.");
      fileInput.value = "";
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
      if (tapLayer) tapLayer.setAttribute("viewBox", "0 0 100 100");
      setTapCount(0);

      showThumb(dataUrl);
      sessionStorage.setItem(PHOTO_KEY, dataUrl);
      sessionStorage.setItem(FILE_KEY, file.name || "target.jpg");

      saveDistance();
      setPressEnabled(true);
      status("Photo loaded. Pinch to zoom, then tap your holes.");
    } catch (err){
      alert("Photo load failed. Please try again.");
      setPressEnabled(false);
      status(`ERROR: ${String(err && err.message ? err.message : err)}`);
    } finally {
      // allow re-picking same photo
      if (fileInput) fileInput.value = "";
    }
  }

  // ===== INIT =====
  (function init(){
    setVendorBuyLink();
    status("Ready. Tap UPLOAD.");

    const savedDist = sessionStorage.getItem(DIST_KEY);
    if (distanceInput && savedDist) distanceInput.value = savedDist;

    const savedPhoto = sessionStorage.getItem(PHOTO_KEY);
    if (savedPhoto){
      showThumb(savedPhoto);
      setPressEnabled(true);
    } else {
      setPressEnabled(false);
      setTapCount(0);
      if (tapStage) tapStage.style.display = "none";
    }

    setTapCount(loadTaps().length);
    saveDistance();
  })();

  // ===== Upload =====
  if (uploadBtn && fileInput){
    uploadBtn.addEventListener("click", (e) => {
      e.preventDefault();
      status("Opening picker...");
      fileInput.click(); // iOS native menu
    });
  }

  if (fileInput){
    fileInput.addEventListener("change", handlePickedFile);
    fileInput.addEventListener("input", handlePickedFile);
  }

  // ===== Distance save =====
  if (distanceInput){
    distanceInput.addEventListener("input", saveDistance);
    distanceInput.addEventListener("change", saveDistance);
  }

  // ===== Tap capture (pinch-safe) =====
  if (tapLayer){
    const onTap = (e) => {
      // If two fingers: let iOS pinch/zoom do its thing
      if (e.touches && e.touches.length > 1) return;

      // For single-finger tap, prevent scroll while tapping
      if (e.touches && e.touches.length === 1) e.preventDefault();

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
