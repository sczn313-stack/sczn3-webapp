// frontend_new/index.js
// Bull-first workflow: Tap #1 = bull (aim point), Tap #2+ = bullet holes.
// NOTE: No top-left instruction/status text anymore (we hardcoded the Target line).

const photoInput  = document.getElementById("photoInput");

const targetImage = document.getElementById("targetImage");
const imageWrap   = document.getElementById("targetImageWrap");
const dotsLayer   = document.getElementById("dotsLayer");

const tapsCountEl   = document.getElementById("tapsCount");
const clearTapsBtn  = document.getElementById("clearTapsBtn");
const seeResultsBtn = document.getElementById("seeResultsBtn");
const distanceInput = document.getElementById("distanceInput");
const vendorInput   = document.getElementById("vendorInput");

function setTapsCount(n){
  if (tapsCountEl) tapsCountEl.textContent = String(n);
}

function hasPhoto(){
  return !!(targetImage && targetImage.src);
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
    };
    reader.onerror = () => {
      alert("Could not read that photo.");
      if (targetImage) targetImage.src = "";
      clearAll();
    };
    reader.readAsDataURL(file);
  });
}

/** --- Tap capture --- **/
function onTap(clientX, clientY){
  if (!imageWrap || !hasPhoto()) return;

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
}

if (imageWrap){
  imageWrap.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    onTap(e.clientX, e.clientY);
  });
}

/** --- Clear taps --- **/
if (clearTapsBtn){
  clearTapsBtn.addEventListener("click", () => clearAll());
}

/** --- Results --- **/
async function doResults(){
  try{
    if (!hasPhoto()) {
      alert("Upload a target photo first.");
      return;
    }
    if (!bullTap) {
      alert("Tap the bull’s-eye first (Tap 1).");
      return;
    }
    if (taps.length < 1) {
      alert("Tap at least 1 bullet hole after the bull.");
      return;
    }

    const distanceYds = Number(distanceInput?.value || 100);
    const vendorLink  = String(vendorInput?.value || "").trim();

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

    const box = document.getElementById("resultsBox");
    const pre = document.getElementById("resultsPre");
    if (pre) pre.textContent = JSON.stringify(out, null, 2);
    if (box) box.style.display = "block";

  } catch(err){
    const msg = (err && err.message) ? err.message : "Network/server error. Try again.";
    alert(msg);
  }
}

if (seeResultsBtn){
  seeResultsBtn.addEventListener("click", doResults);
}
