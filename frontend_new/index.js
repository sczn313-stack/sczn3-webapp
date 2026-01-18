// frontend_new/index.js
// Bull-first workflow: Tap #1 = bull (aim point), Tap #2+ = bullet holes.
// Fixes:
//  - Reliable "2-finger pinch = NO TAP" using active pointer tracking (iOS-safe)
//  - Green boxed See results is the ONLY results trigger
//  - Micro-slot above target: Pinch hint appears after photo loads, hides after first tap
//    Vendor CTA replaces it (if vendor link exists) when tapping begins

const photoInput    = document.getElementById("photoInput");
const targetWrap    = document.getElementById("targetWrap");
const targetImage   = document.getElementById("targetImage");
const dotsLayer     = document.getElementById("dotsLayer");
const targetInstr   = document.getElementById("targetInstr");

const tapsCountEl   = document.getElementById("tapsCount");
const clearTapsBtn  = document.getElementById("clearTapsBtn");
const distanceInput = document.getElementById("distanceInput");
const vendorInput   = document.getElementById("vendorInput");

const seeResultsHint = document.getElementById("seeResultsHint"); // button
const microSlot      = document.getElementById("microSlot");
const pinchHint      = document.getElementById("pinchHint");
const vendorBuyBtn   = document.getElementById("vendorBuyBtn");

function hasPhoto(){
  return !!(targetImage && targetImage.src);
}

function setTapsCount(n){
  if (tapsCountEl) tapsCountEl.textContent = String(n);
}

function show(el, on){
  if (!el) return;
  el.style.display = on ? "" : "none";
}

function setInstrVisible(on){ show(targetInstr, on); }
function setSeeResultsVisible(on){ show(seeResultsHint, on); }

function setMicroSlotVisible(on){ show(microSlot, on); }
function setPinchHintVisible(on){ show(pinchHint, on); }

function setVendorVisible(on){
  if (!vendorBuyBtn) return;
  vendorBuyBtn.style.display = on ? "" : "none";
}

function syncVendorLink(){
  const url = String(vendorInput?.value || "").trim();
  if (vendorBuyBtn && url){
    vendorBuyBtn.href = url;
    return true;
  }
  return false;
}

/** --- Tap state --- **/
let bullTap = null;     // {x,y} normalized 0..1
let taps = [];          // bullet holes only

/** --- Pointer tracking for pinch gate --- **/
const activePointers = new Map(); // pointerId -> {x,y,t,pointerType}
let multiTouchActive = false;

function activePointerCount(){
  return activePointers.size;
}

function clearDots(){
  if (!dotsLayer) return;
  dotsLayer.innerHTML = "";
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

function clearAll(){
  bullTap = null;
  taps = [];
  clearDots();
  setTapsCount(0);

  // UI reset
  setSeeResultsVisible(false);
  setVendorVisible(false);

  if (hasPhoto()){
    setInstrVisible(true);
    setMicroSlotVisible(true);
    setPinchHintVisible(true);      // show pinch hint after photo load
  } else {
    setInstrVisible(false);
    setMicroSlotVisible(false);
    setPinchHintVisible(false);
  }
}

/** --- Overlay sizing to image --- **/
function sizeDotsToImage(){
  if (!dotsLayer || !targetImage) return;

  const r = targetImage.getBoundingClientRect();
  dotsLayer.style.width = `${r.width}px`;
  dotsLayer.style.height = `${r.height}px`;

  dotsLayer.style.left = `50%`;
  dotsLayer.style.top = `0`;
  dotsLayer.style.transform = `translateX(-50%)`;
}

/** --- Photo load --- **/
if (photoInput){
  photoInput.addEventListener("change", () => {
    const file = photoInput.files && photoInput.files[0];

    if (!file){
      if (targetImage) targetImage.src = "";
      clearAll();
      return;
    }
    if (!file.type || !file.type.startsWith("image/")){
      alert("That file is not an image.");
      if (targetImage) targetImage.src = "";
      clearAll();
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || "");
      if (targetImage) targetImage.src = dataUrl;

      try { sessionStorage.setItem("sczn3_targetPhoto_dataUrl", dataUrl); } catch {}

      clearAll();
      setTimeout(sizeDotsToImage, 60);
    };
    reader.onerror = () => {
      alert("Could not read that photo.");
      if (targetImage) targetImage.src = "";
      clearAll();
    };
    reader.readAsDataURL(file);
  });
}

// initial state
setInstrVisible(false);
setSeeResultsVisible(false);
setMicroSlotVisible(false);
setPinchHintVisible(false);
setVendorVisible(false);

/** --- Tap capture --- **/
function onTap(clientX, clientY){
  if (!hasPhoto() || !targetImage) return;

  const imgRect = targetImage.getBoundingClientRect();
  const x = clientX - imgRect.left;
  const y = clientY - imgRect.top;

  if (x < 0 || y < 0 || x > imgRect.width || y > imgRect.height) return;

  const nx = imgRect.width ? (x / imgRect.width) : 0;
  const ny = imgRect.height ? (y / imgRect.height) : 0;

  // progressive quietness trigger (first ever tap)
  if (bullTap === null && taps.length === 0){
    setInstrVisible(false);

    // When green appears, pinch hint should go away
    setMicroSlotVisible(true);
    setPinchHintVisible(false);

    setSeeResultsVisible(true);

    // Vendor CTA should pop in here (if link exists)
    if (syncVendorLink()){
      setVendorVisible(true);
    } else {
      setVendorVisible(false);
    }
  }

  if (!bullTap){
    bullTap = { x: nx, y: ny };
    addDotAt(x, y, "bull");
  } else {
    taps.push({ x: nx, y: ny });
    setTapsCount(taps.length);
    addDotAt(x, y, "hole");
  }
}

/** --- Pointer handlers (pinch gate) --- **/
function pointerKey(e){
  return String(e.pointerId);
}

function markMultiTouch(){
  multiTouchActive = (activePointerCount() >= 2);
}

function onPointerDown(e){
  // track
  activePointers.set(pointerKey(e), { x:e.clientX, y:e.clientY, t:Date.now(), pointerType:e.pointerType });
  markMultiTouch();
}

function onPointerMove(e){
  if (!activePointers.has(pointerKey(e))) return;
  const p = activePointers.get(pointerKey(e));
  p.x = e.clientX; p.y = e.clientY;
  markMultiTouch();
}

function onPointerUpOrCancel(e){
  activePointers.delete(pointerKey(e));
  markMultiTouch();

  // When pinch ends, we keep gate closed until all fingers are up
  if (activePointerCount() === 0){
    multiTouchActive = false;
  }
}

function onPointerTap(e){
  // If 2+ pointers down OR pinch recently active, do nothing.
  if (multiTouchActive || activePointerCount() >= 2) return;

  // only primary pointer for touch
  if (e.isPrimary === false) return;

  // ignore non-left mouse
  if (e.pointerType === "mouse" && e.button !== 0) return;

  onTap(e.clientX, e.clientY);
}

if (targetWrap){
  // Capture phase helps reliability on iOS
  targetWrap.addEventListener("pointerdown", onPointerDown, true);
  targetWrap.addEventListener("pointermove", onPointerMove, true);
  targetWrap.addEventListener("pointerup", onPointerUpOrCancel, true);
  targetWrap.addEventListener("pointercancel", onPointerUpOrCancel, true);

  // Tap handler (no preventDefault, so pinch zoom stays natural)
  targetWrap.addEventListener("pointerdown", onPointerTap, false);
}

/** --- Clear taps --- **/
if (clearTapsBtn){
  clearTapsBtn.addEventListener("click", () => clearAll());
}

/** --- Vendor link changes --- **/
if (vendorInput){
  vendorInput.addEventListener("input", () => {
    const ok = syncVendorLink();
    const tappingStarted = (bullTap !== null) || (taps.length > 0);

    // Only show vendor after tapping begins (when green box exists)
    setVendorVisible(ok && tappingStarted);
    setMicroSlotVisible(tappingStarted || !!hasPhoto());
  });
}

/** --- Results --- **/
async function doResults(){
  try{
    if (!hasPhoto()) { alert("Upload a target photo first."); return; }
    if (!bullTap)    { alert("Tap the Bullseye / Aim Point first (Tap 1)."); return; }
    if (taps.length < 1){ alert("Tap at least 1 bullet hole after the Bullseye."); return; }

    const distanceYds = Number(distanceInput?.value || 100);
    const vendorLink  = String(vendorInput?.value || "").trim();

    const payload = { distanceYds, vendorLink, bullTap, taps, imageDataUrl: null };

    if (typeof window.tapscore !== "function") {
      throw new Error("Analyze function missing (api.js not loaded).");
    }

    const out = await window.tapscore(payload);

    const box = document.getElementById("resultsBox");
    const pre = document.getElementById("resultsPre");
    if (pre) pre.textContent = JSON.stringify(out, null, 2);
    if (box) box.style.display = "block";

  } catch(err){
    alert(err?.message || "Network/server error. Try again.");
  }
}

if (seeResultsHint){
  seeResultsHint.addEventListener("click", doResults);
}

// keep overlay aligned on rotation/resize
window.addEventListener("resize", () => setTimeout(sizeDotsToImage, 60));
