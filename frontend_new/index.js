// frontend_new/index.js
// Bull-first workflow:
//  Tap #1 = bull (aim point)
//  Tap #2+ = bullet holes
// Shows JSON OR shows the exact error in the results box.

(() => {
  const uploadHeroBtn   = document.getElementById("uploadHeroBtn");
  const photoInput      = document.getElementById("photoInput");

  const distanceInput   = document.getElementById("distanceYds");
  const tapCountEl      = document.getElementById("tapCount");
  const clearTapsBtn    = document.getElementById("clearTapsBtn");

  const microSlot       = document.getElementById("microSlot");
  const instructionLine = document.getElementById("instructionLine");

  const targetWrap      = document.getElementById("targetWrap");
  const targetCanvas    = document.getElementById("targetCanvas");
  const targetImg       = document.getElementById("targetImg");
  const dotsLayer       = document.getElementById("dotsLayer");

  const vendorLinkInput = document.getElementById("vendorLink");
  const resultsBox      = document.getElementById("resultsBox");

  const SS_PHOTO = "sczn3_targetPhoto_dataUrl";
  const SS_DIST  = "sczn3_distance_yards";
  const SS_VENDOR= "sczn3_vendor_buy_url";

  function setInstruction(msg) {
    if (instructionLine) instructionLine.textContent = String(msg || "");
  }

  function setTapCount(n) {
    if (tapCountEl) tapCountEl.textContent = String(Number(n) || 0);
  }

  function showResults(objOrText) {
    if (!resultsBox) return;
    if (typeof objOrText === "string") resultsBox.textContent = objOrText;
    else resultsBox.textContent = JSON.stringify(objOrText, null, 2);
  }

  function clearDots() {
    if (!dotsLayer) return;
    dotsLayer.innerHTML = "";
  }

  function addDot(px, py, kind) {
    if (!dotsLayer) return;
    const d = document.createElement("div");
    d.className = "tapDot";
    d.dataset.kind = kind || "hole";
    d.style.left = `${px}px`;
    d.style.top  = `${py}px`;
    dotsLayer.appendChild(d);
  }

  // ---- State ----
  let bullTap = null; // {x,y} normalized 0..1
  let taps = [];      // [{x,y} normalized]
  let suppressTapUntil = 0; // timestamp ms

  function resetSessionUI() {
    bullTap = null;
    taps = [];
    setTapCount(0);
    clearDots();
    showMicroSlotEmpty();
    setInstruction("Tap bull’s-eye (or aim point) 1st. Then tap bullet holes.");
  }

  function showMicroSlotEmpty() {
    if (!microSlot) return;
    microSlot.innerHTML = "";
  }

  function showPinchHintOnce() {
    if (!microSlot) return;
    microSlot.innerHTML = `
      <div class="pinchHint">Pinch to zoom for more accurate taps.</div>
    `;
  }

  function showSeeResultsBtn() {
    if (!microSlot) return;
    microSlot.innerHTML = `
      <button id="seeResultsBtn" class="seeResultsHint" type="button">See results</button>
    `;
    const btn = document.getElementById("seeResultsBtn");
    if (btn) {
      btn.addEventListener("click", onSeeResults);
      btn.addEventListener("touchstart", (e) => { e.preventDefault(); onSeeResults(); }, { passive:false });
    }
  }

  function showVendorCTA(url) {
    if (!microSlot) return;
    if (!url) { microSlot.innerHTML = ""; return; }
    microSlot.innerHTML = `
      <a class="vendorBuyBtn" href="${url}" target="_blank" rel="noopener">
        <div class="vendorIcon">🛒</div>
        <div class="vendorText">Buy more targets like this</div>
        <div class="vendorArrow">›</div>
      </a>
    `;
  }

  // ---- Upload wiring ----
  if (uploadHeroBtn && photoInput) {
    uploadHeroBtn.addEventListener("click", () => photoInput.click());
    uploadHeroBtn.addEventListener("touchstart", (e) => { e.preventDefault(); photoInput.click(); }, { passive:false });
  }

  function loadPhotoFile(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onerror = () => reject(new Error("FileReader failed"));
      r.onload  = () => resolve(String(r.result || ""));
      r.readAsDataURL(file);
    });
  }

  if (photoInput) {
    photoInput.addEventListener("change", async () => {
      try {
        const file = photoInput.files && photoInput.files[0];
        if (!file) return;

        const dataUrl = await loadPhotoFile(file);

        if (targetImg) targetImg.src = dataUrl;
        if (targetWrap) targetWrap.style.display = "block";

        try { sessionStorage.setItem(SS_PHOTO, dataUrl); } catch {}
        resetSessionUI();

        // do NOT show the tap instruction until photo exists (your requirement)
        setInstruction("Tap bull’s-eye (or aim point) 1st. Then tap bullet holes.");

        showPinchHintOnce();
        showResults("{}");
      } catch (err) {
        showResults(`PHOTO ERROR: ${err?.message || err}`);
        setInstruction("Add a photo to begin.");
      }
    });
  }

  // ---- Distance / Vendor persistence ----
  function readDistance() {
    const v = Number(distanceInput?.value || sessionStorage.getItem(SS_DIST) || 100);
    return Number.isFinite(v) && v > 0 ? v : 100;
  }

  function saveDistance() {
    const v = String(readDistance());
    try { sessionStorage.setItem(SS_DIST, v); } catch {}
  }

  if (distanceInput) {
    const saved = sessionStorage.getItem(SS_DIST);
    if (saved) distanceInput.value = saved;
    distanceInput.addEventListener("input", saveDistance);
    distanceInput.addEventListener("change", saveDistance);
  }

  if (vendorLinkInput) {
    const savedV = sessionStorage.getItem(SS_VENDOR);
    if (savedV) vendorLinkInput.value = savedV;
    vendorLinkInput.addEventListener("input", () => {
      try { sessionStorage.setItem(SS_VENDOR, String(vendorLinkInput.value || "").trim()); } catch {}
    });
  }

  // ---- Tap capture ----
  function shouldSuppressTapNow() {
    return Date.now() < suppressTapUntil;
  }

  function setSuppressWindow(ms) {
    suppressTapUntil = Date.now() + (ms || 0);
  }

  // Disable accidental taps during two-finger pinch:
  // - on touchstart with 2+ touches, suppress taps for 350ms
  if (targetCanvas) {
    targetCanvas.addEventListener("touchstart", (e) => {
      if (e.touches && e.touches.length >= 2) setSuppressWindow(500);
    }, { passive:true });
    targetCanvas.addEventListener("touchmove", (e) => {
      if (e.touches && e.touches.length >= 2) setSuppressWindow(500);
    }, { passive:true });
    targetCanvas.addEventListener("touchend", () => setSuppressWindow(250), { passive:true });
  }

  function registerTap(clientX, clientY) {
    if (!targetCanvas || !targetImg || !targetImg.src) return;
    if (shouldSuppressTapNow()) return;

    const rect = targetCanvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    if (x < 0 || y < 0 || x > rect.width || y > rect.height) return;

    const nx = rect.width  ? (x / rect.width) : 0;
    const ny = rect.height ? (y / rect.height) : 0;

    if (!bullTap) {
      bullTap = { x: nx, y: ny };
      addDot(x, y, "bull");
      // after first tap, keep pinch hint briefly then fade into nothing
      showMicroSlotEmpty();
      setInstruction("Now tap bullet holes.");
    } else {
      taps.push({ x: nx, y: ny });
      setTapCount(taps.length);
      addDot(x, y, "hole");
      setInstruction(`Holes: ${taps.length}. Keep tapping or see results.`);
      // show See Results as soon as we have bull + at least 1 hole
      if (taps.length >= 1) showSeeResultsBtn();
    }
  }

  if (targetCanvas) {
    targetCanvas.addEventListener("pointerdown", (e) => {
      // prevent text selection / weirdness
      e.preventDefault();
      registerTap(e.clientX, e.clientY);
    });

    // Safety: prevent "ghost click" after pinch by suppressing briefly
    targetCanvas.addEventListener("gesturestart", () => setSuppressWindow(800), { passive:true });
  }

  // ---- Clear taps ----
  function clearAll() {
    bullTap = null;
    taps = [];
    setTapCount(0);
    clearDots();
    showMicroSlotEmpty();
    setInstruction(targetImg && targetImg.src ? "Tap bull’s-eye (or aim point) 1st. Then tap bullet holes." : "Add a photo to begin.");
    showResults("{}");
  }

  if (clearTapsBtn) {
    clearTapsBtn.addEventListener("click", clearAll);
  }

  // ---- Results ----
  async function onSeeResults() {
    try {
      if (!targetImg || !targetImg.src) throw new Error("Add a photo first.");
      if (!bullTap) throw new Error("Tap the bull’s-eye (aim point) first.");
      if (taps.length < 1) throw new Error("Tap at least 1 bullet hole.");

      saveDistance();

      const payload = {
        distanceYds: readDistance(),
        bullTap,
        taps,
        vendorLink: String(vendorLinkInput?.value || "").trim() || null
      };

      showResults({ status: "Posting to backend…", payload });

      if (typeof window.tapscore !== "function") {
        throw new Error("tapscore() missing. api.js not loaded or cached old.");
      }

      const out = await window.tapscore(payload);

      showResults(out);

      // After results: hide instruction line (your request)
      setInstruction("");

      // After results: show vendor CTA in micro-slot
      const v = payload.vendorLink || sessionStorage.getItem(SS_VENDOR) || "";
      showVendorCTA(v);
    } catch (err) {
      showResults(`ERROR: ${err?.message || err}`);
    }
  }

  // ---- Init ----
  (function init() {
    // No “status” in upper left anymore — per your instruction.
    setInstruction("Add a photo to begin.");
    showResults("{}");
    showMicroSlotEmpty();

    // Restore photo if present
    const savedPhoto = sessionStorage.getItem(SS_PHOTO);
    if (savedPhoto && targetImg) {
      targetImg.src = savedPhoto;
      if (targetWrap) targetWrap.style.display = "block";
      resetSessionUI();
      showPinchHintOnce();
    } else {
      if (targetWrap) targetWrap.style.display = "none";
    }
  })();
})();
