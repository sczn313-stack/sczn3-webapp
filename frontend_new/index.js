// frontend_new/index.js
// Bull-first workflow:
// Tap #1 = bull (aim point), Tap #2+ = bullet holes.
// IMPORTANT: Disable taps during 2-finger pinch.

const photoInput     = document.getElementById("photoInput");
const targetImage    = document.getElementById("targetImage");
const imageWrap      = document.getElementById("targetImageWrap");
const tapsCountEl    = document.getElementById("tapsCount");
const clearTapsBtn   = document.getElementById("clearTapsBtn");
const distanceInput  = document.getElementById("distanceInput");
const vendorInput    = document.getElementById("vendorInput");

const anchorLine     = document.getElementById("anchorLine");
const seeResultsWrap = document.getElementById("seeResultsWrap");
const seeResultsHint = document.getElementById("seeResultsHint");

const microSlot      = document.getElementById("microSlot");
const pinchHintEl    = document.getElementById("pinchHint");
const vendorCta      = document.getElementById("vendorCta");

const resultsBox     = document.getElementById("resultsBox");
const resultsText    = document.getElementById("resultsText");

function setTapsCount(n){
  if (tapsCountEl) tapsCountEl.textContent = String(n);
}

/** --- Tap state --- **/
let bullTap = null;   // {x,y} normalized
let taps = [];        // holes only
let pinchActive = false;

/** show/hide UI pieces based on state */
function updateUI(){
  const hasPhoto = !!(targetImage && targetImage.src);

  // Target area visibility
  if (imageWrap) imageWrap.style.display = hasPhoto ? "block" : "none";

  // Anchor line: only after photo
  if (anchorLine){
    if (hasPhoto){
      anchorLine.style.display = "block";
      // remove word "Target" per your request:
      anchorLine.textContent = "Tap bull’s-eye / aim point 1st — then tap bullet holes.";
    } else {
      anchorLine.style.display = "none";
      anchorLine.textContent = "";
    }
  }

  // Green See Results: only after photo AND at least 1 hole AND bull exists
  const canSeeResults = hasPhoto && bullTap && taps.length >= 1;
  if (seeResultsWrap) seeResultsWrap.style.display = canSeeResults ? "block" : "none";

  // Micro-slot appears only once tapping begins (hasPhoto + at least bullTap)
  const showMicro = hasPhoto && !!bullTap;
  if (microSlot) microSlot.style.display = showMicro ? "flex" : "none";
}

function clearDots(){
  document.querySelectorAll(".tapDot").forEach(d => d.remove());
}

function addDotAt(px, py, kind){
  if (!imageWrap) return;
  const dot = document.createElement("div");
  dot.className = "tapDot";
  dot.dataset.kind = kind || "hole";
  dot.style.left = `${px}px`;
  dot.style.top = `${py}px`;
  imageWrap.appendChild(dot);
}

function clearAll(){
  bullTap = null;
  taps = [];
  pinchActive = false;
  clearDots();
  setTapsCount(0);

  // hide results + vendor CTA
  if (resultsBox) resultsBox.style.display = "none";
  if (resultsText) resultsText.textContent = "";
  if (vendorCta) vendorCta.style.display = "none";
  if (pinchHintEl) pinchHintEl.style.display = "none";

  updateUI();
}

/** --- Photo load --- **/
if (photoInput){
  photoInput.addEventListener("change", () => {
    const file = photoInput.files && photoInput.files[0];
    if (!file) return;

    if (!file.type || !file.type.startsWith("image/")){
      alert("That file is not an image.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || "");
      if (targetImage) targetImage.src = dataUrl;

      try { sessionStorage.setItem("sczn3_targetPhoto_dataUrl", dataUrl); } catch {}

      clearAll();      // resets taps + results
      updateUI();      // shows anchor + target
    };
    reader.readAsDataURL(file);
  });
}

/** --- Pinch detection (2-finger = disable tap capture) --- **/
function setPinchActive(val){
  pinchActive = !!val;
}

// Touch events are the most reliable signal for “two fingers”
if (imageWrap){
  imageWrap.addEventListener("touchstart", (e) => {
    if (e.touches && e.touches.length >= 2) setPinchActive(true);
  }, { passive: true });

  imageWrap.addEventListener("touchend", (e) => {
    // if fewer than 2 touches remain, pinch ends
    if (!e.touches || e.touches.length < 2) setPinchActive(false);
  }, { passive: true });

  imageWrap.addEventListener("touchcancel", () => setPinchActive(false), { passive: true });
}

/** --- Tap capture (pointer) --- **/
function onTap(clientX, clientY){
  if (pinchActive) return; // ✅ block taps while 2 fingers are on screen
  if (!imageWrap || !targetImage || !targetImage.src) return;

  const rect = imageWrap.getBoundingClientRect();
  const x = clientX - rect.left;
  const y = clientY - rect.top;

  if (x < 0 || y < 0 || x > rect.width || y > rect.height) return;

  const nx = rect.width ? (x / rect.width) : 0;
  const ny = rect.height ? (y / rect.height) : 0;

  if (!bullTap){
    bullTap = { x: nx, y: ny };
    addDotAt(x, y, "bull");

    // Show pinch hint briefly after first tap, then go away (clean UI)
    if (microSlot) microSlot.style.display = "flex";
    if (pinchHintEl){
      pinchHintEl.style.display = "block";
      window.setTimeout(() => {
        // only hide if vendor CTA hasn't replaced the slot visually
        if (pinchHintEl) pinchHintEl.style.display = "none";
      }, 2200);
    }
  } else {
    taps.push({ x: nx, y: ny });
    setTapsCount(taps.length);
    addDotAt(x, y, "hole");
  }

  updateUI();
}

// Pointer handler for mouse + touch
if (imageWrap){
  imageWrap.style.position = "relative";
  imageWrap.addEventListener("pointerdown", (e) => {
    // If iOS pinch is happening, touch handlers set pinchActive true.
    // This prevents those accidental taps.
    e.preventDefault();
    onTap(e.clientX, e.clientY);
  });
}

/** --- Clear taps --- **/
if (clearTapsBtn){
  clearTapsBtn.addEventListener("click", () => clearAll());
}

/** --- Results (triggered by green box) --- **/
async function doResults(){
  try{
    if (!targetImage || !targetImage.src) return;
    if (!bullTap) return;
    if (taps.length < 1) return;

    const distanceYds = Number(distanceInput?.value || 100);
    const vendorLink = String(vendorInput?.value || "").trim();

    const payload = {
      distanceYds,
      vendorLink,
      bullTap,
      taps,
      imageDataUrl: null
    };

    if (typeof window.tapscore !== "function") {
      throw new Error("Analyze function missing (api.js not loaded).");
    }

    const out = await window.tapscore(payload);

    // show results (raw for now)
    if (resultsText) resultsText.textContent = JSON.stringify(out, null, 2);
    if (resultsBox) resultsBox.style.display = "block";

    // Vendor CTA appears after results (your “progressive quietness” behavior)
    if (vendorLink){
      if (microSlot) microSlot.style.display = "flex";
      if (vendorCta){
        vendorCta.href = vendorLink;
        vendorCta.style.display = "flex";
      }
    }
  } catch(err){
    const msg = (err && err.message) ? err.message : "Network/server error. Try again.";
    alert(msg);
  }
}

function wireSeeResults(){
  if (!seeResultsHint) return;

  // click
  seeResultsHint.addEventListener("click", doResults);

  // keyboard accessibility
  seeResultsHint.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      doResults();
    }
  });
}
wireSeeResults();

/** init */
updateUI();
