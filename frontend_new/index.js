// sczn3-webapp/frontend_new/index.js
// Upload page + Tap N Score capture (pilot)
//
// Stores:
//  sczn3_targetPhoto_dataUrl
//  sczn3_targetPhoto_fileName
//  sczn3_distance_yards
//  sczn3_tap_points_json   <-- NEW (array of {x,y} in NATURAL image pixels)

(function () {
  const PHOTO_KEY = "sczn3_targetPhoto_dataUrl";
  const FILE_KEY  = "sczn3_targetPhoto_fileName";
  const DIST_KEY  = "sczn3_distance_yards";
  const TAPS_KEY  = "sczn3_tap_points_json";

  function $(id){ return document.getElementById(id); }

  const fileInput     = $("targetPhoto");
  const thumb         = $("thumb");
  const thumbWrap     = $("thumbWrap");
  const tapLayer      = $("tapLayer");
  const tapTools      = $("tapTools");
  const clearTapsBtn  = $("clearTapsBtn");

  const distanceInput = $("distanceYards");
  const pressToSee    = $("pressToSee");
  const buyMoreBtn    = $("buyMoreBtn");

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

  // Map tap (client coords on displayed image) -> NATURAL image pixel coords
  function clientToNatural(e){
    if (!thumb) return null;

    const rect = thumb.getBoundingClientRect();
    const nw = thumb.naturalWidth || 1;
    const nh = thumb.naturalHeight || 1;

    // touch or mouse
    const clientX = (e.touches && e.touches[0] ? e.touches[0].clientX : e.clientX);
    const clientY = (e.touches && e.touches[0] ? e.touches[0].clientY : e.clientY);

    const x = ((clientX - rect.left) / rect.width) * nw;
    const y = ((clientY - rect.top) / rect.height) * nh;

    return { x, y, nw, nh };
  }

  // Draw taps on SVG overlay using NATURAL coords mapped to SVG viewBox
  function redrawTapLayer(){
    if (!tapLayer || !thumb) return;

    const taps = loadTaps();
    const nw = thumb.naturalWidth || 1;
    const nh = thumb.naturalHeight || 1;

    // Make SVG coordinate system match NATURAL pixels
    tapLayer.setAttribute("viewBox", `0 0 ${nw} ${nh}`);

    if (!taps.length){
      tapLayer.innerHTML = "";
      if (tapTools) tapTools.style.display = "none";
      return;
    }

    if (tapTools) tapTools.style.display = "block";

    const circles = taps.map((p) => {
      const x = Number(p.x);
      const y = Number(p.y);
      if (!Number.isFinite(x) || !Number.isFinite(y)) return "";

      // orange ring + dark center
      return `
        <g>
          <circle cx="${x}" cy="${y}" r="26" fill="rgba(255,140,0,0.35)"></circle>
          <circle cx="${x}" cy="${y}" r="8" fill="rgba(120,60,0,0.85)"></circle>
        </g>
      `;
    }).join("");

    tapLayer.innerHTML = circles;
  }

  function showThumb(dataUrl){
    if (!thumb || !thumbWrap) return;

    thumb.src = dataUrl;

    // Show wrap only after image loads (so naturalWidth exists)
    thumb.onload = () => {
      thumbWrap.style.display = "block";
      redrawTapLayer();
    };
  }

  // ---- Init ----
  (function init(){
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

  // ---- Distance save ----
  if (distanceInput){
    distanceInput.addEventListener("input", saveDistance);
    distanceInput.addEventListener("change", saveDistance);
  }

  // ---- Upload change ----
  if (fileInput){
    fileInput.addEventListener("change", async () => {
      const file = fileInput.files && fileInput.files[0];
      if (!file) return;

      if (!file.type || !file.type.startsWith("image/")){
        alert("Please choose an image file.");
        fileInput.value = "";
        setPressEnabled(false);
        return;
      }

      try{
        const dataUrl = await readFileAsDataURL(file);
        if (!dataUrl){
          alert("Could not load the photo. Please try again.");
          setPressEnabled(false);
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
      } catch (err){
        alert("Photo load failed. Please try again.");
        setPressEnabled(false);
      }
    });
  }

  // ---- Tap capture on overlay ----
  if (tapLayer){
    const onTap = (e) => {
      e.preventDefault();

      // Must have an image loaded
      if (!thumb || !thumb.naturalWidth) return;

      const pt = clientToNatural(e);
      if (!pt) return;

      const taps = loadTaps();
      taps.push({ x: pt.x, y: pt.y });
      saveTaps(taps);

      redrawTapLayer();
    };

    tapLayer.addEventListener("click", onTap);
    tapLayer.addEventListener("touchstart", onTap, { passive: false });
  }

  // ---- Clear taps ----
  if (clearTapsBtn){
    clearTapsBtn.addEventListener("click", () => {
      saveTaps([]);
      redrawTapLayer();
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
        return;
      }

      saveDistance();
      window.location.href = "./output.html";
    });
  }
})();
