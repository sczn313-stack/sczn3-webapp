// frontend_new/index.js
// Bull-first workflow: Tap #1 = bull (aim point), Tap #2+ = bullet holes.

const photoInput = document.getElementById("photoInput");
const targetImage = document.getElementById("targetImage");       // <img>
const imageWrap   = document.getElementById("targetImageWrap");   // wrapper div
const tapsCountEl = document.getElementById("tapsCount");
const clearTapsBtn = document.getElementById("clearTapsBtn");
const seeResultsBtn = document.getElementById("seeResultsBtn");
const distanceInput = document.getElementById("distanceInput");
const vendorInput = document.getElementById("vendorInput");

function setStatus(msg){
  const el = document.getElementById("statusLine");
  if (el) el.textContent = msg;
}

function setTapsCount(n){
  if (tapsCountEl) tapsCountEl.textContent = String(n);
}

function showPreview(dataUrl){
  if (!targetImage) return;
  targetImage.src = dataUrl;
  if (imageWrap) imageWrap.style.display = "block";
  const hint = document.getElementById("emptyHint");
  if (hint) hint.style.display = "block";
}

function clearPreview(){
  if (targetImage) targetImage.src = "";
  if (imageWrap) imageWrap.style.display = "none";
}

/** --- Tap state --- **/
let bullTap = null;     // {x,y} normalized 0..1
let taps = [];          // bullet holes only (normalized)

function instruction(){
  if (!targetImage || !targetImage.src) {
    setStatus("Ready. Tap ADD PHOTO.");
    return;
  }
  if (!bullTap) setStatus("Tap 1: Tap the bull’s-eye (aim point) FIRST.");
  else if (taps.length === 0) setStatus("Now tap bullet holes (your shots).");
  else setStatus(`Holes: ${taps.length}. Keep tapping holes, then See results.`);
}

function clearDots(){
  const dots = document.querySelectorAll(".tapDot");
  dots.forEach(d => d.remove());
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
  clearDots();
  setTapsCount(0);
  instruction();
}

/** --- Photo load --- **/
if (photoInput){
  photoInput.addEventListener("change", () => {
    const file = photoInput.files && photoInput.files[0];
    if (!file){
      setStatus("No photo selected.");
      clearPreview();
      clearAll();
      return;
    }
    if (!file.type || !file.type.startsWith("image/")){
      setStatus("That file is not an image.");
      clearPreview();
      clearAll();
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || "");
      showPreview(dataUrl);
      try { sessionStorage.setItem("sczn3_targetPhoto_dataUrl", dataUrl); } catch {}
      clearAll();
      instruction();
    };
    reader.onerror = () => {
      setStatus("Could not read that photo.");
      clearPreview();
      clearAll();
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
  instruction();
}

// Pointer events (mouse + touch)
if (imageWrap){
  imageWrap.style.position = "relative";
  imageWrap.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    onTap(e.clientX, e.clientY);
  }, { passive: false });
}

/** --- Clear taps --- **/
if (clearTapsBtn){
  clearTapsBtn.addEventListener("click", () => clearAll());
}

/** --- Results --- **/
async function doResults(){
  try{
    if (!targetImage || !targetImage.src) {
      alert("Add a photo first.");
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
    const vendorLink = String(vendorInput?.value || "").trim();

    const payload = {
      distanceYds,
      vendorLink,
      bullTap,
      taps,
      imageDataUrl: null
    };

    setStatus("Analyzing...");
    if (typeof window.tapscore !== "function") {
      throw new Error("Analyze function missing (api.js not loaded).");
    }

    const out = await window.tapscore(payload);

    const box = document.getElementById("resultsBox");
    const pre = document.getElementById("resultsPre");
    if (pre) pre.textContent = JSON.stringify(out, null, 2);
    if (box) box.style.display = "block";

    setStatus("Done.");
  } catch(err){
    const msg = (err && err.message) ? err.message : "Network/server error. Try again.";
    setStatus("Ready.");
    alert(msg);
  }
}

if (seeResultsBtn){
  seeResultsBtn.addEventListener("click", doResults);
}

instruction();
