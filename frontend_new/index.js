// frontend_new/index.js
// Bull-first workflow: Tap #1 = bull (aim point), Tap #2+ = bullet holes.
// Changes:
//  - Remove zoom/fit button entirely (less distraction)
//  - Allow natural pinch zoom by NOT calling preventDefault() on taps
//  - Instruction line shows only after photo loads, hides once tapping begins
//  - Green boxed "See results" appears quietly after tapping begins
//  - Vendor CTA appears after tapping begins IF vendor link exists

const photoInput   = document.getElementById("photoInput");
const targetWrap   = document.getElementById("targetWrap");
const targetImage  = document.getElementById("targetImage");
const dotsLayer    = document.getElementById("dotsLayer");
const targetInstr  = document.getElementById("targetInstr");

const tapsCountEl   = document.getElementById("tapsCount");
const clearTapsBtn  = document.getElementById("clearTapsBtn");
const seeResultsBtn = document.getElementById("seeResultsBtn");
const distanceInput = document.getElementById("distanceInput");
const vendorInput   = document.getElementById("vendorInput");

const seeResultsHint = document.getElementById("seeResultsHint");
const vendorCta      = document.getElementById("vendorCta");
const vendorBuyBtn   = document.getElementById("vendorBuyBtn");

function hasPhoto(){
  return !!(targetImage && targetImage.src);
}

function setTapsCount(n){
  if (tapsCountEl) tapsCountEl.textContent = String(n);
}

function setInstrVisible(on){
  if (!targetInstr) return;
  targetInstr.style.display = on ? "block" : "none";
}

function setSeeResultsHint(on){
  if (!seeResultsHint) return;
  seeResultsHint.style.display = on ? "inline-flex" : "none";
}

function setVendorCtaVisible(on){
  if (!vendorCta) return;
  vendorCta.style.display = on ? "block" : "none";
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
let taps = [];          // bullet holes only (normalized)

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

  // reset progressive UI
  if (hasPhoto()){
    setInstrVisible(true);
  } else {
    setInstrVisible(false);
  }
  setSeeResultsHint(false);
  setVendorCtaVisible(false);
}

/** --- Overlay sizing to image --- **/
function sizeDotsToImage(){
  if (!dotsLayer || !targetImage) return;

  const r = targetImage.getBoundingClientRect();
  dotsLayer.style.width = `${r.width}px`;
  dotsLayer.style.height = `${r.height}px`;

  // center the overlay to match centered image
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
      setInstrVisible(false);
      clearAll();
      return;
    }
    if (!file.type || !file.type.startsWith("image/")){
      alert("That file is not an image.");
      if (targetImage) targetImage.src = "";
      setInstrVisible(false);
      clearAll();
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || "");
      if (targetImage) targetImage.src = dataUrl;

      try { sessionStorage.setItem("sczn3_targetPhoto_dataUrl", dataUrl); } catch {}

      clearAll();
      setInstrVisible(true);

      // wait for render then size overlay
      setTimeout(sizeDotsToImage, 50);
    };
    reader.onerror = () => {
      alert("Could not read that photo.");
      if (targetImage) targetImage.src = "";
      setInstrVisible(false);
      clearAll();
    };
    reader.readAsDataURL(file);
  });
}

// start hidden
setInstrVisible(false);
setSeeResultsHint(false);
setVendorCtaVisible(false);

/** --- Tap capture (relative to displayed image rect) --- **/
function onTap(clientX, clientY){
  if (!hasPhoto() || !targetImage) return;

  const imgRect = targetImage.getBoundingClientRect();
  const x = clientX - imgRect.left;
  const y = clientY - imgRect.top;

  if (x < 0 || y < 0 || x > imgRect.width || y > imgRect.height) return;

  const nx = imgRect.width ? (x / imgRect.width) : 0;
  const ny = imgRect.height ? (y / imgRect.height) : 0;

  // progressive quietness: once tapping begins, hide instruction + show green hint
  if (bullTap === null && taps.length === 0){
    setInstrVisible(false);
    setSeeResultsHint(true);

    // vendor CTA appears if link exists
    if (syncVendorLink()) setVendorCtaVisible(true);
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

if (targetWrap){
  // ✅ No preventDefault here = allows natural pinch zoom on iOS
  targetWrap.addEventListener("pointerdown", (e) => {
    onTap(e.clientX, e.clientY);
  });
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
    setVendorCtaVisible(ok && tappingStarted);
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

if (seeResultsBtn){
  seeResultsBtn.addEventListener("click", doResults);
}

// keep overlay aligned on rotation/resize
window.addEventListener("resize", () => setTimeout(sizeDotsToImage, 50));
