// frontend_new/index.js
// Bull-first workflow: Tap #1 = bull (aim point), Tap #2+ = bullet holes.

const uploadHeroBtn = document.getElementById("uploadHeroBtn");
const photoInput    = document.getElementById("photoInput");

const targetImage   = document.getElementById("targetImage");
const imageWrap     = document.getElementById("targetImageWrap");
const dotsLayer     = document.getElementById("dotsLayer");

const tapsCountEl   = document.getElementById("tapsCount");
const clearTapsBtn  = document.getElementById("clearTapsBtn");

const distanceInput = document.getElementById("distanceInput");
const vendorInput   = document.getElementById("vendorInput");

// We are NOT using the top status line anymore
function setStatus(_) { /* intentionally blank */ }

function setTapsCount(n){
  if (tapsCountEl) tapsCountEl.textContent = String(n);
}

function showPreview(dataUrl){
  if (!targetImage) return;
  targetImage.src = dataUrl;
  if (imageWrap) imageWrap.style.display = "block";
}

function clearPreview(){
  if (targetImage) targetImage.src = "";
  if (imageWrap) imageWrap.style.display = "none";
}

function clearDots(){
  if (dotsLayer) dotsLayer.innerHTML = "";
}

function addDotAt(px, py, kind){
  if (!dotsLayer) return;
  const dot = document.createElement("div");
  dot.className = "tapDot";
  dot.dataset.kind = kind || "hole";
  dot.style.left = `${px}px`;
  dot.style.top  = `${py}px`;
  dotsLayer.appendChild(dot);
}

/** --- Tap state --- **/
let bullTap = null;   // {x,y} normalized 0..1
let taps = [];        // bullet holes only (normalized)

/** Anchor line text (only show after photo exists) **/
function updateAnchorLine(){
  const anchor = document.getElementById("anchorLine");
  if (!anchor) return;

  const hasPhoto = !!(targetImage && targetImage.src);
  if (!hasPhoto){
    anchor.textContent = ""; // hidden until a target exists
    return;
  }

  // Your exact wording
  anchor.textContent = "Tap Bullseye or Aim Point 1st — then tap Bullet holes.";
}

function clearAll(){
  bullTap = null;
  taps = [];
  clearDots();
  setTapsCount(0);
  updateAnchorLine();
}

/** --- HERO button opens ONE input --- **/
if (uploadHeroBtn && photoInput){
  uploadHeroBtn.addEventListener("click", () => {
    photoInput.click(); // iPhone chooser should show Camera / Photo Library / Browse (Files)
  });
}

/** --- Photo load --- **/
if (photoInput){
  photoInput.addEventListener("change", () => {
    const file = photoInput.files && photoInput.files[0];

    if (!file){
      clearPreview();
      clearAll();
      return;
    }
    if (!file.type || !file.type.startsWith("image/")){
      clearPreview();
      clearAll();
      alert("That file is not an image.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || "");
      showPreview(dataUrl);

      // store for refresh if you want
      try { sessionStorage.setItem("sczn3_targetPhoto_dataUrl", dataUrl); } catch {}

      clearAll();
      updateAnchorLine();
    };
    reader.onerror = () => {
      clearPreview();
      clearAll();
      alert("Could not read that photo.");
    };
    reader.readAsDataURL(file);
  });
}

/** --- Tap capture --- **/
function onTap(clientX, clientY){
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
  } else {
    taps.push({ x: nx, y: ny });
    setTapsCount(taps.length);
    addDotAt(x, y, "hole");
  }

  // if you want: after first tap, we could show pinch hint (you mentioned this)
}

/**
 * ✅ Prevent accidental tap while pinching:
 * - If 2+ fingers touch, we "lock" taps briefly.
 * - We only accept a tap from a SINGLE pointer sequence.
 */
let multiTouchLock = false;
let lockTimer = null;

function lockTapsBriefly(ms){
  multiTouchLock = true;
  if (lockTimer) clearTimeout(lockTimer);
  lockTimer = setTimeout(() => { multiTouchLock = false; }, ms);
}

if (imageWrap){
  imageWrap.style.position = "relative";

  // Detect 2-finger touch and lock taps
  imageWrap.addEventListener("touchstart", (e) => {
    if (e.touches && e.touches.length > 1){
      lockTapsBriefly(350);
    }
  }, { passive: true });

  imageWrap.addEventListener("touchmove", (e) => {
    if (e.touches && e.touches.length > 1){
      lockTapsBriefly(350);
    }
  }, { passive: true });

  // Pointer-based tap capture
  imageWrap.addEventListener("pointerdown", (e) => {
    // If a pinch just happened, ignore this "first tap"
    if (multiTouchLock) return;

    // Only accept primary pointer
    if (e.isPrimary === false) return;

    e.preventDefault();
    onTap(e.clientX, e.clientY);
  });
}

/** --- Clear taps --- **/
if (clearTapsBtn){
  clearTapsBtn.addEventListener("click", () => clearAll());
}

/** --- Results (still raw JSON for now) --- **/
async function doResults(){
  try{
    if (!targetImage || !targetImage.src) {
      alert("Add a photo first.");
      return;
    }
    if (!bullTap) {
      alert("Tap the bullseye (aim point) first.");
      return;
    }
    if (taps.length < 1) {
      alert("Tap at least 1 bullet hole after the bull.");
      return;
    }

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

    // Show raw output in Results card
    const box = document.getElementById("resultsBox");
    const txt = document.getElementById("resultsText");
    if (txt) txt.textContent = JSON.stringify(out, null, 2);
    if (box) box.style.display = "block";

  } catch(err){
    const msg = (err && err.message) ? err.message : "Network/server error. Try again.";
    alert(msg);
  }
}

// We are NOT using a bottom "See results" button if you removed it.
// If you kept one, wire it here:
const seeResultsBtn = document.getElementById("seeResultsBtn");
if (seeResultsBtn){
  seeResultsBtn.addEventListener("click", doResults);
}

// Initial state
clearPreview();
clearAll();
updateAnchorLine();
