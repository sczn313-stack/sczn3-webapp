// Tap-n-Score™ frontend_new/index.js
(() => {
  const uploadHeroBtn = document.getElementById("uploadHeroBtn");
  const cameraInput = document.getElementById("cameraInput");
  const libraryInput = document.getElementById("libraryInput");
  const filesInput = document.getElementById("filesInput");

  const sheetMask = document.getElementById("sheetMask");
  const sheet = document.getElementById("sheet");
  const pickLibrary = document.getElementById("pickLibrary");
  const pickCamera = document.getElementById("pickCamera");
  const pickFiles = document.getElementById("pickFiles");
  const cancelSheet = document.getElementById("cancelSheet");

  const targetCanvas = document.getElementById("targetCanvas");
  const targetImg = document.getElementById("targetImg");
  const dotsLayer = document.getElementById("dotsLayer");

  const distanceYds = document.getElementById("distanceYds");
  const tapsCountEl = document.getElementById("tapsCount");
  const clearTapsBtn = document.getElementById("clearTapsBtn");
  const photoStatus = document.getElementById("photoStatus");

  const seeResultsBtn = document.getElementById("seeResultsBtn");
  const resultsCard = document.getElementById("resultsCard");
  const resultsPretty = document.getElementById("resultsPretty");
  const receiptRaw = document.getElementById("receiptRaw");
  const backBtn = document.getElementById("backBtn");
  const saveBtn = document.getElementById("saveBtn");
  const receiptBtn = document.getElementById("receiptBtn");

  let taps = []; // {xPct,yPct, kind:"hole"|"bull"}
  let hasPhoto = false;

  // --- Pinch guard (ignore taps when 2 fingers are down)
  let activePointers = new Set();
  let isPinching = false;
  let pinchCooldownUntil = 0;

  function nowMs() { return Date.now(); }

  function openSheet() {
    sheetMask.style.display = "block";
    sheet.style.display = "block";
    sheetMask.setAttribute("aria-hidden", "false");
    sheet.setAttribute("aria-hidden", "false");
  }
  function closeSheet() {
    sheetMask.style.display = "none";
    sheet.style.display = "none";
    sheetMask.setAttribute("aria-hidden", "true");
    sheet.setAttribute("aria-hidden", "true");
  }

  uploadHeroBtn.addEventListener("click", openSheet);
  sheetMask.addEventListener("click", closeSheet);
  cancelSheet.addEventListener("click", closeSheet);

  pickCamera.addEventListener("click", () => { closeSheet(); cameraInput.click(); });
  pickLibrary.addEventListener("click", () => { closeSheet(); libraryInput.click(); });
  pickFiles.addEventListener("click", () => { closeSheet(); filesInput.click(); });

  function handleFile(file) {
    if (!file) return;
    const url = URL.createObjectURL(file);
    targetImg.src = url;
    targetImg.style.display = "block";
    hasPhoto = true;
    photoStatus.textContent = "Tap bull first, then tap each bullet hole. Pinch to zoom anytime.";
    clearDots();
    taps = [];
    updateTapCount();
  }

  cameraInput.addEventListener("change", (e) => handleFile(e.target.files && e.target.files[0]));
  libraryInput.addEventListener("change", (e) => handleFile(e.target.files && e.target.files[0]));
  filesInput.addEventListener("change", (e) => handleFile(e.target.files && e.target.files[0]));

  function updateTapCount() {
    tapsCountEl.textContent = String(taps.filter(t => t.kind === "hole").length);
  }

  clearTapsBtn.addEventListener("click", () => {
    taps = [];
    clearDots();
    updateTapCount();
  });

  function clearDots() {
    while (dotsLayer.firstChild) dotsLayer.removeChild(dotsLayer.firstChild);
  }

  function addDot(xPct, yPct, kind) {
    const dot = document.createElement("div");
    dot.className = "tapDot";
    dot.dataset.kind = kind;
    dot.style.left = (xPct * 100).toFixed(3) + "%";
    dot.style.top  = (yPct * 100).toFixed(3) + "%";
    dotsLayer.appendChild(dot);
  }

  function getRelativePctFromEvent(clientX, clientY) {
    const rect = targetImg.getBoundingClientRect();
    const x = (clientX - rect.left) / rect.width;
    const y = (clientY - rect.top) / rect.height;
    return { x: clamp01(x), y: clamp01(y) };
  }
  function clamp01(v) { return Math.max(0, Math.min(1, v)); }

  // Pointer tracking for pinch
  targetCanvas.addEventListener("pointerdown", (e) => {
    if (e.pointerType !== "touch") return;
    activePointers.add(e.pointerId);
    if (activePointers.size >= 2) {
      isPinching = true;
    }
  }, { passive: true });

  targetCanvas.addEventListener("pointerup", (e) => {
    if (e.pointerType !== "touch") return;
    activePointers.delete(e.pointerId);
    if (activePointers.size < 2 && isPinching) {
      isPinching = false;
      pinchCooldownUntil = nowMs() + 250; // ignore the "first tap" after pinch
    }
  }, { passive: true });

  targetCanvas.addEventListener("pointercancel", (e) => {
    if (e.pointerType !== "touch") return;
    activePointers.delete(e.pointerId);
    if (activePointers.size < 2) {
      isPinching = false;
      pinchCooldownUntil = nowMs() + 250;
    }
  }, { passive: true });

  // Tap handler (single-finger only)
  targetCanvas.addEventListener("click", (e) => {
    if (!hasPhoto) return;

    // Ignore taps while pinching or right after pinching
    if (isPinching || nowMs() < pinchCooldownUntil) return;

    // Must click on image area
    const rect = targetImg.getBoundingClientRect();
    if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) return;

    const { x, y } = getRelativePctFromEvent(e.clientX, e.clientY);

    const hasBull = taps.some(t => t.kind === "bull");
    if (!hasBull) {
      taps.push({ xPct: x, yPct: y, kind: "bull" });
      addDot(x, y, "bull");
      return;
    }

    taps.push({ xPct: x, yPct: y, kind: "hole" });
    addDot(x, y, "hole");
    updateTapCount();
  });

  // Results UI
  function buildBackendPayload() {
    const bull = taps.find(t => t.kind === "bull");
    const holes = taps.filter(t => t.kind === "hole");
    return {
      distanceYds: Number(distanceYds.value || 100),
      bullTap: bull ? { x: bull.xPct, y: bull.yPct } : null,
      holeTaps: holes.map(h => ({ x: h.xPct, y: h.yPct }))
    };
  }

  async function callBackend() {
    // TODO: set this to your real endpoint
    // Example: const url = "https://YOUR-BACKEND.onrender.com/tapscore";
    const url = "/tapscore";

    const payload = buildBackendPayload();

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const t = await res.text().catch(() => "");
      throw new Error(`Backend error (${res.status}): ${t || "no body"}`);
    }
    return res.json();
  }

  function renderShooterResults(data) {
    // Friendly summary (still keep raw receipt option)
    // Expecting data like: { ok, distanceYds, tapsCount, bullTap, poib, delta, windage, elevation, score }
    const ok = data && data.ok === true;

    const w = (data && data.windage) ? String(data.windage) : "--";
    const el = (data && data.elevation) ? String(data.elevation) : "--";
    const score = (data && data.score) ? String(data.score) : "--";

    resultsPretty.innerHTML = `
      <div class="subtle"><span class="strong">Status:</span> ${ok ? "VERIFIED" : "CHECK INPUT"}</div>
      <div class="subtle mt12"><span class="strong">Windage:</span> ${w}</div>
      <div class="subtle"><span class="strong">Elevation:</span> ${el}</div>
      <div class="subtle"><span class="strong">Score:</span> ${score}</div>
    `;

    receiptRaw.textContent = JSON.stringify(data, null, 2);
  }

  seeResultsBtn.addEventListener("click", async () => {
    // Minimum requirements
    const bull = taps.find(t => t.kind === "bull");
    const holes = taps.filter(t => t.kind === "hole");
    if (!bull || holes.length < 1) {
      alert("Tap the bull first, then tap at least 1 bullet hole.");
      return;
    }

    seeResultsBtn.disabled = true;
    seeResultsBtn.textContent = "Working...";
    try {
      const data = await callBackend();
      resultsCard.style.display = "block";
      renderShooterResults(data);
      receiptRaw.style.display = "none";
    } catch (err) {
      alert(err.message || String(err));
    } finally {
      seeResultsBtn.disabled = false;
      seeResultsBtn.textContent = "See results";
    }
  });

  backBtn.addEventListener("click", () => {
    resultsCard.style.display = "none";
  });

  saveBtn.addEventListener("click", () => {
    // placeholder: you can wire this to localStorage or a backend later
    alert("Saved (stub).");
  });

  receiptBtn.addEventListener("click", () => {
    receiptRaw.style.display = (receiptRaw.style.display === "none") ? "block" : "none";
  });
})();
