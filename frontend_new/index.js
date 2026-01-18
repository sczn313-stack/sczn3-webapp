// frontend_new/index.js
// One hero upload button + bull-first workflow + green See Results (only trigger)
// Multi-touch (pinch) will NOT create taps.

const uploadHeroBtn = document.getElementById("uploadHeroBtn");
const photoInput    = document.getElementById("photoInput");
const uploadSub     = document.getElementById("uploadSub");

const targetImage   = document.getElementById("targetImage");
const targetCanvas  = document.getElementById("targetCanvas");
const dotsLayer     = document.getElementById("dotsLayer");

const tapRuleLine   = document.getElementById("tapRuleLine");
const emptyHint     = document.getElementById("emptyHint");

const tapsCountEl   = document.getElementById("tapsCount");
const clearTapsBtn  = document.getElementById("clearTapsBtn");

const distanceInput = document.getElementById("distanceInput");
const vendorInput   = document.getElementById("vendorInput");

const microSlot     = document.getElementById("microSlot");
const pinchHint     = document.getElementById("pinchHint");
const vendorCta     = document.getElementById("vendorCta");

const seeResultsRow = document.getElementById("seeResultsRow");
const seeResultsBtn = document.getElementById("seeResultsHint");

const resultsBox    = document.getElementById("resultsBox");
const resultsText   = document.getElementById("resultsText");
const backBtn       = document.getElementById("backBtn");

function setTapsCount(n){
  if (tapsCountEl) tapsCountEl.textContent = String(n);
}

function isValidUrl(s){
  try{
    const u = new URL(String(s || "").trim());
    return u.protocol === "http:" || u.protocol === "https:";
  }catch{ return false; }
}

function showMicroSlot(){
  if (microSlot) microSlot.style.display = "flex";
}
function hideMicroSlot(){
  if (microSlot) microSlot.style.display = "none";
  if (pinchHint) pinchHint.style.display = "none";
  if (vendorCta) vendorCta.style.display = "none";
}
function showPinchHint(){
  showMicroSlot();
  if (pinchHint) pinchHint.style.display = "block";
  if (vendorCta) vendorCta.style.display = "none";
}
function hidePinchHint(){
  if (pinchHint) pinchHint.style.display = "none";
  // Keep microslot if vendor CTA should show
}
function updateVendorCtaVisibility(){
  const link = String(vendorInput?.value || "").trim();
  if (!seeResultsRow || seeResultsRow.style.display === "none") {
    if (vendorCta) vendorCta.style.display = "none";
    return;
  }
  if (isValidUrl(link)) {
    showMicroSlot();
    if (pinchHint) pinchHint.style.display = "none";
    vendorCta.href = link;
    vendorCta.style.display = "flex";
  } else {
    if (vendorCta) vendorCta.style.display = "none";
  }
}

function showTapRuleLine(){
  if (tapRuleLine) tapRuleLine.style.display = "block";
}
function hideTapRuleLine(){
  if (tapRuleLine) tapRuleLine.style.display = "none";
}

function showSeeResults(){
  if (seeResultsRow) seeResultsRow.style.display = "block";
  updateVendorCtaVisibility();
}
function hideSeeResults(){
  if (seeResultsRow) seeResultsRow.style.display = "none";
  updateVendorCtaVisibility();
}

function clearDots(){
  if (!dotsLayer) return;
  dotsLayer.querySelectorAll(".tapDot").forEach(d => d.remove());
}

function addDot(nx, ny, kind){
  if (!dotsLayer) return;
  const dot = document.createElement("div");
  dot.className = "tapDot";
  dot.dataset.kind = kind || "hole";
  dot.style.left = `${nx * 100}%`;
  dot.style.top  = `${ny * 100}%`;
  dotsLayer.appendChild(dot);
}

function showPreview(dataUrl){
  if (!targetImage) return;
  targetImage.src = dataUrl;
  targetImage.style.display = "block";
  if (emptyHint) emptyHint.style.display = "none";
}

function clearPreview(){
  if (targetImage) {
    targetImage.src = "";
    targetImage.style.display = "none";
  }
  if (emptyHint) emptyHint.style.display = "block";
}

/** --- Tap state --- **/
let bullTap = null; // {x,y} normalized to image box
let taps = [];      // holes only

// For pinch/multi-touch guard
const activePointers = new Map(); // pointerId -> {x,y}
let multiTouchActive = false;

// For tap-vs-drag filtering
let downInfo = null; // {pointerId, x, y, time}
const TAP_MOVE_PX = 10;

function resetTapState(){
  bullTap = null;
  taps = [];
  setTapsCount(0);
  clearDots();
  hideSeeResults();
  hideMicroSlot();
  // Tap rule line should remain visible if photo loaded; we control separately.
}

function afterPhotoLoaded(){
  resetTapState();
  showTapRuleLine();
  showPinchHint();         // show once, then hide after first tap
  hideSeeResults();
  updateVendorCtaVisibility();
}

function isPhotoLoaded(){
  return !!(targetImage && targetImage.src);
}

function updateReadyUI(){
  // Show green see results only when bull is set and at least 1 hole
  if (bullTap && taps.length >= 1) showSeeResults();
  else hideSeeResults();

  // Vendor CTA depends on See Results + valid link
  updateVendorCtaVisibility();
}

/** --- Upload wiring --- **/
function openPicker(){
  // Must be called inside a user gesture (button click)
  if (!photoInput) return;
  photoInput.value = ""; // allow re-select same file
  photoInput.click();
}

if (uploadHeroBtn){
  uploadHeroBtn.addEventListener("click", () => {
    openPicker();
  });
}

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
      showPreview(dataUrl);

      try { sessionStorage.setItem("sczn3_targetPhoto_dataUrl", dataUrl); } catch {}
      afterPhotoLoaded();
    };
    reader.onerror = () => alert("Could not read that photo.");
    reader.readAsDataURL(file);
  });
}

/** --- Tap capture (single-finger only) --- **/
function getImageNormalizedXY(clientX, clientY){
  if (!targetImage) return null;
  const rect = targetImage.getBoundingClientRect();
  const x = clientX - rect.left;
  const y = clientY - rect.top;
  if (x < 0 || y < 0 || x > rect.width || y > rect.height) return null;
  return {
    nx: rect.width ? x / rect.width : 0,
    ny: rect.height ? y / rect.height : 0,
  };
}

function onSingleTap(nx, ny){
  if (!isPhotoLoaded()) return;

  // First tap = bull, rest = holes
  if (!bullTap){
    bullTap = { x: nx, y: ny };
    addDot(nx, ny, "bull");
    // You wanted the pinch hint to disappear after first tap:
    hidePinchHint();
  } else {
    taps.push({ x: nx, y: ny });
    setTapsCount(taps.length);
    addDot(nx, ny, "hole");
  }

  updateReadyUI();
}

// Pointer events: do NOT preventDefault (keeps pinch zoom native)
if (targetCanvas){
  targetCanvas.addEventListener("pointerdown", (e) => {
    if (!isPhotoLoaded()) return;

    activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    // If 2+ touches active, we are pinching/zooming -> block tap creation
    if (activePointers.size >= 2) {
      multiTouchActive = true;
      downInfo = null;
      return;
    }

    // Only consider primary touch for tap
    downInfo = { pointerId: e.pointerId, x: e.clientX, y: e.clientY, time: Date.now() };
  }, { passive: true });

  targetCanvas.addEventListener("pointermove", (e) => {
    if (!activePointers.has(e.pointerId)) return;
    activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (activePointers.size >= 2) {
      multiTouchActive = true;
      downInfo = null;
      return;
    }
  }, { passive: true });

  targetCanvas.addEventListener("pointerup", (e) => {
    // Update pointer set first
    activePointers.delete(e.pointerId);

    // If we were multi-touching, do NOT create taps
    if (multiTouchActive) {
      if (activePointers.size === 0) multiTouchActive = false;
      downInfo = null;
      return;
    }

    if (!downInfo || downInfo.pointerId !== e.pointerId) return;

    const dx = Math.abs(e.clientX - downInfo.x);
    const dy = Math.abs(e.clientY - downInfo.y);
    if (dx > TAP_MOVE_PX || dy > TAP_MOVE_PX) {
      downInfo = null;
      return;
    }

    const pt = getImageNormalizedXY(e.clientX, e.clientY);
    if (!pt) { downInfo = null; return; }

    onSingleTap(pt.nx, pt.ny);
    downInfo = null;
  }, { passive: true });

  targetCanvas.addEventListener("pointercancel", (e) => {
    activePointers.delete(e.pointerId);
    if (activePointers.size === 0) multiTouchActive = false;
    downInfo = null;
  }, { passive: true });
}

/** --- Clear taps --- **/
if (clearTapsBtn){
  clearTapsBtn.addEventListener("click", () => {
    resetTapState();
    // Keep tap rule line visible if photo is loaded
    if (isPhotoLoaded()) showTapRuleLine();
    // Show pinch hint again because we’re restarting
    if (isPhotoLoaded()) showPinchHint();
  });
}

/** --- Vendor input updates CTA visibility --- **/
if (vendorInput){
  vendorInput.addEventListener("input", () => updateVendorCtaVisibility());
}

/** --- Results (triggered ONLY by the green button) --- **/
async function doResults(){
  if (!isPhotoLoaded()) return;

  if (!bullTap) {
    alert("Tap the bull’s-eye (aim point) first.");
    return;
  }
  if (taps.length < 1) {
    alert("Tap at least 1 bullet hole.");
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
    alert("Analyze function missing (api.js not loaded).");
    return;
  }

  try{
    const out = await window.tapscore(payload);

    if (resultsText) resultsText.textContent = JSON.stringify(out, null, 2);
    if (resultsBox) resultsBox.style.display = "block";

    // When results are shown, vendor CTA should still be in the microSlot (above)
    updateVendorCtaVisibility();
  }catch(err){
    const msg = (err && err.message) ? err.message : "Network/server error. Try again.";
    alert(msg);
  }
}

if (seeResultsBtn){
  seeResultsBtn.addEventListener("click", doResults);
}

if (backBtn){
  backBtn.addEventListener("click", () => {
    if (resultsBox) resultsBox.style.display = "none";
  });
}

/** --- Initial state --- **/
clearPreview();
hideTapRuleLine();
hideSeeResults();
hideMicroSlot();
setTapsCount(0);

// Optional: restore last photo on refresh
try{
  const saved = sessionStorage.getItem("sczn3_targetPhoto_dataUrl");
  if (saved) {
    showPreview(saved);
    afterPhotoLoaded();
  }
}catch{}
