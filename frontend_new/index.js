// frontend_new/index.js  (FULL REPLACEMENT)
// Bull-first workflow: Tap #1 = bull (aim point), Tap #2+ = bullet holes.
// Shows JSON in #resultsBox every time (success or failure).
// Also: disables tap capture while two-finger gesture is active (pinch/zoom).

(() => {
  // ===== DOM =====
  const uploadHeroBtn  = document.getElementById("uploadHeroBtn");
  const photoInput     = document.getElementById("photoInput");

  const distanceInput  = document.getElementById("distanceYds");
  const tapCountEl     = document.getElementById("tapCount");
  const clearTapsBtn   = document.getElementById("clearTapsBtn");

  const instructionLine= document.getElementById("instructionLine");
  const microSlot      = document.getElementById("microSlot");

  const targetWrap     = document.getElementById("targetWrap");
  const targetCanvas   = document.getElementById("targetCanvas");
  const targetImg      = document.getElementById("targetImg");
  const dotsLayer      = document.getElementById("dotsLayer");

  const vendorLinkInput= document.getElementById("vendorLink");
  const resultsBox     = document.getElementById("resultsBox");

  // ===== State =====
  let bullTap = null;          // {x,y} normalized 0..1
  let holeTaps = [];           // [{x,y}...]
  let tapsEnabled = true;      // gets disabled during two-finger pinch
  let pinchHintShown = false;  // show once after first tap
  let seeResultsVisible = false;

  function setTapCount(n) {
    if (tapCountEl) tapCountEl.textContent = String(Number(n) || 0);
  }

  function showWrap(show) {
    if (!targetWrap) return;
    targetWrap.style.display = show ? "block" : "none";
  }

  function setInstruction(msg) {
    if (!instructionLine) return;
    instructionLine.textContent = String(msg || "");
  }

  function setResults(objOrText) {
    if (!resultsBox) return;
    if (typeof objOrText === "string") {
      resultsBox.textContent = objOrText;
    } else {
      resultsBox.textContent = JSON.stringify(objOrText, null, 2);
    }
  }

  function clearDots() {
    if (!dotsLayer) return;
    dotsLayer.innerHTML = "";
  }

  function addDot(nx, ny, kind) {
    if (!dotsLayer || !targetCanvas) return;
    const rect = targetCanvas.getBoundingClientRect();
    const px = nx * rect.width;
    const py = ny * rect.height;

    const dot = document.createElement("div");
    dot.className = "tapDot";
    dot.dataset.kind = kind || "hole";
    dot.style.left = `${px}px`;
    dot.style.top  = `${py}px`;
    dotsLayer.appendChild(dot);
  }

  function hardResetTaps() {
    bullTap = null;
    holeTaps = [];
    setTapCount(0);
    clearDots();
    pinchHintShown = false;
    seeResultsVisible = false;
    renderMicroSlot();
  }

  function hasPhoto() {
    return !!(targetImg && targetImg.src);
  }

  function showPhoto(dataUrl) {
    if (!targetImg) return;
    targetImg.src = dataUrl;
    showWrap(true);
  }

  // ===== Micro-slot UI =====
  function renderMicroSlot() {
    if (!microSlot) return;

    // nothing until photo loaded
    if (!hasPhoto()) {
      microSlot.innerHTML = "";
      return;
    }

    // After first tap, briefly show pinch hint ONCE
    if (!pinchHintShown && bullTap) {
      microSlot.innerHTML = `
        <div class="pinchHint">Pinch to zoom for accurate taps.</div>
      `;
      return;
    }

    // If enough taps, show green See Results box
    const canSeeResults = !!bullTap && holeTaps.length >= 1;
    if (canSeeResults && !seeResultsVisible) {
      seeResultsVisible = true;
    }

    if (seeResultsVisible && canSeeResults) {
      microSlot.innerHTML = `
        <button id="seeResultsHintBtn" class="seeResultsHint" type="button">See results</button>
      `;
      const btn = document.getElementById("seeResultsHintBtn");
      if (btn) btn.addEventListener("click", runTapScore);
      return;
    }

    // Otherwise keep empty (clean)
    microSlot.innerHTML = "";
  }

  // Vendor CTA (appears AFTER See Results)
  function renderVendorCTAIfAny() {
    if (!microSlot) return;
    const url = String(vendorLinkInput?.value || "").trim();
    if (!url) {
      microSlot.innerHTML = "";
      return;
    }
    microSlot.innerHTML = `
      <a class="vendorBuyBtn" href="${url}" target="_blank" rel="noopener">
        <div class="vendorIcon">🛒</div>
        <div class="vendorText">Buy more targets like this</div>
        <div class="vendorArrow">›</div>
      </a>
    `;
  }

  // ===== Upload wiring =====
  function openPicker() {
    if (!photoInput) return;
    // iOS: selecting same file won't fire change unless cleared
    photoInput.value = "";
    photoInput.click();
  }

  if (uploadHeroBtn) {
    uploadHeroBtn.addEventListener("click", openPicker);
    uploadHeroBtn.addEventListener("touchstart", openPicker, { passive: true });
  }

  if (photoInput) {
    photoInput.addEventListener("change", () => {
      const file = photoInput.files && photoInput.files[0];
      if (!file) return;

      if (!file.type || !file.type.startsWith("image/")) {
        setInstruction("That file is not an image.");
        return;
      }

      const r = new FileReader();
      r.onload = () => {
        const dataUrl = String(r.result || "");
        showPhoto(dataUrl);

        try { sessionStorage.setItem("sczn3_targetPhoto_dataUrl", dataUrl); } catch {}
        hardResetTaps();

        // Only show the hardcoded instruction when photo exists
        setInstruction("Tap Bullseye or Aim Point 1st — then tap Bullet holes.");

        // keep results box clean but alive
        setResults({ ok: true, note: "Photo loaded. Start tapping." });
      };
      r.onerror = () => {
        setInstruction("Could not read that photo.");
        setResults("Photo read failed.");
      };
      r.readAsDataURL(file);
    });
  }

  // ===== Two-finger pinch guard =====
  // Disable taps during multi-touch gesture so pinch doesn't create taps.
  function disableTapsForGesture() { tapsEnabled = false; }
  function enableTapsAfterGesture() { tapsEnabled = true; }

  if (targetCanvas) {
    targetCanvas.addEventListener("touchstart", (e) => {
      if (e.touches && e.touches.length >= 2) disableTapsForGesture();
    }, { passive: true });

    targetCanvas.addEventListener("touchmove", (e) => {
      if (e.touches && e.touches.length >= 2) disableTapsForGesture();
    }, { passive: true });

    targetCanvas.addEventListener("touchend", (e) => {
      if (!e.touches || e.touches.length < 2) enableTapsAfterGesture();
    }, { passive: true });

    targetCanvas.addEventListener("touchcancel", () => enableTapsAfterGesture(), { passive: true });
  }

  // ===== Tap capture (pointer) =====
  function onPointerTap(clientX, clientY) {
    if (!tapsEnabled) return;
    if (!targetCanvas || !targetImg || !targetImg.src) return;

    const rect = targetCanvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    if (x < 0 || y < 0 || x > rect.width || y > rect.height) return;

    const nx = rect.width ? (x / rect.width) : 0;
    const ny = rect.height ? (y / rect.height) : 0;

    if (!bullTap) {
      bullTap = { x: nx, y: ny };
      addDot(nx, ny, "bull");

      // show pinch hint once, then next render clears it
      pinchHintShown = false;
      renderMicroSlot();
      // after 1st tap, allow hint to appear then disappear on next tap
    } else {
      holeTaps.push({ x: nx, y: ny });
      setTapCount(holeTaps.length);
      addDot(nx, ny, "hole");

      // after first hole tap, pinch hint is considered shown
      if (bullTap && !pinchHintShown) pinchHintShown = true;
      renderMicroSlot();
    }
  }

  if (targetCanvas) {
    targetCanvas.addEventListener("pointerdown", (e) => {
      // If multi-touch is happening, ignore
      if (!tapsEnabled) return;

      e.preventDefault();
      onPointerTap(e.clientX, e.clientY);
    });
  }

  // ===== Clear taps =====
  if (clearTapsBtn) {
    clearTapsBtn.addEventListener("click", () => {
      hardResetTaps();
      if (hasPhoto()) {
        setInstruction("Tap Bullseye or Aim Point 1st — then tap Bullet holes.");
      } else {
        setInstruction("Add a photo to begin.");
      }
      setResults({ ok: true, note: "Taps cleared." });
    });
  }

  // ===== Run scoring (writes JSON ALWAYS) =====
  async function runTapScore() {
    try {
      if (!hasPhoto()) {
        alert("Upload a target photo first.");
        return;
      }
      if (!bullTap) {
        alert("Tap Bullseye or Aim Point 1st.");
        return;
      }
      if (holeTaps.length < 1) {
        alert("Then tap Bullet holes.");
        return;
      }

      const distanceYds = Number(distanceInput?.value || 100);
      const vendorLink = String(vendorLinkInput?.value || "").trim();

      const payload = {
        distanceYds,
        bullTap,
        taps: holeTaps,
        vendorLink
      };

      setResults({ ok: true, sending: payload, backend: window.tapscoreBase ? window.tapscoreBase() : "" });

      if (typeof window.tapscore !== "function") {
        throw new Error("window.tapscore missing (api.js not loaded).");
      }

      const out = await window.tapscore(payload);

      // Always show JSON
      setResults(out);

      // After results: swap micro-slot to vendor CTA (if provided)
      renderVendorCTAIfAny();

    } catch (err) {
      const msg = String(err?.message || err || "Unknown error");
      setResults({ ok: false, error: msg });
      alert(msg);
    }
  }

  // ===== Init =====
  (function init() {
    // Don’t show the “tap bull first” line until a photo exists
    setInstruction("Add a photo to begin.");
    showWrap(false);
    setTapCount(0);
    setResults({ ok: true, note: "Frontend loaded." });
    renderMicroSlot();

    // Optional: quick backend ping
    if (typeof window.tapscorePing === "function") {
      window.tapscorePing()
        .then((r) => {
          // Keep it minimal—just prove connectivity
          setResults({ ok: true, backend: r });
        })
        .catch((e) => {
          setResults({ ok: false, backendPing: "failed", error: String(e?.message || e) });
        });
    }
  })();

})();
