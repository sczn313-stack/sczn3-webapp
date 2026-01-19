// frontend_new/index.js
// Tap workflow + pinch zoom + disable taps during 2-finger gestures + See Results + Vendor CTA.

(() => {
  const els = {
    uploadHeroBtn: document.getElementById("uploadHeroBtn"),
    photoInput: document.getElementById("photoInput"),
    distanceYds: document.getElementById("distanceYds"),
    tapCount: document.getElementById("tapCount"),
    clearTapsBtn: document.getElementById("clearTapsBtn"),
    instructionLine: document.getElementById("instructionLine"),
    targetWrap: document.getElementById("targetWrap"),
    targetCanvas: document.getElementById("targetCanvas"),
    targetImg: document.getElementById("targetImg"),
    dotsLayer: document.getElementById("dotsLayer"),
    microSlot: document.getElementById("microSlot"),
    vendorLink: document.getElementById("vendorLink"),
    resultsBox: document.getElementById("resultsBox"),
  };

  const state = {
    imageLoaded: false,
    phase: "idle", // idle | bull | holes | ready
    bull: null, // {x,y} normalized 0..1
    holes: [], // [{x,y} normalized 0..1]
    pinchActive: false, // true while 2 fingers down
    scale: 1,
    lastTouchDist: null,
    pinchHintShown: false,
  };

  // ---------- UI helpers ----------
  function setMicroSlot(mode) {
    // mode: "empty" | "pinchHint" | "seeResults" | "vendorCTA"
    els.microSlot.innerHTML = "";

    if (mode === "pinchHint") {
      const div = document.createElement("div");
      div.className = "pinchHint";
      div.textContent = "Pinch to zoom";
      els.microSlot.appendChild(div);
      return;
    }

    if (mode === "seeResults") {
      const btn = document.createElement("button");
      btn.className = "seeResultsHint";
      btn.type = "button";
      btn.textContent = "See results";
      btn.addEventListener("click", onSeeResults);
      els.microSlot.appendChild(btn);
      return;
    }

    if (mode === "vendorCTA") {
      const a = document.createElement("a");
      a.className = "vendorBuyBtn";
      a.href = (els.vendorLink.value || "").trim() || "#";
      a.target = "_blank";
      a.rel = "noopener";
      a.innerHTML = `
        <div class="vendorIcon">🛒</div>
        <div class="vendorText">Buy more targets like this</div>
        <div class="vendorArrow">›</div>
      `;
      if (a.href === "#") {
        // no link: make it non-clickable but keep the spot
        a.addEventListener("click", (e) => e.preventDefault());
        a.style.opacity = "0.6";
      }
      els.microSlot.appendChild(a);
      return;
    }
  }

  function setInstruction(text) {
    els.instructionLine.textContent = text;
  }

  function clearDots() {
    els.dotsLayer.innerHTML = "";
  }

  function addDot(kind, normPt) {
    const rect = els.targetImg.getBoundingClientRect();
    const wrapRect = els.targetCanvas.getBoundingClientRect();

    // position relative to targetCanvas
    const px = wrapRect.left;
    const py = wrapRect.top;

    const imgLeft = rect.left - px;
    const imgTop = rect.top - py;

    const x = imgLeft + normPt.x * rect.width;
    const y = imgTop + normPt.y * rect.height;

    const dot = document.createElement("div");
    dot.className = "tapDot";
    dot.dataset.kind = kind;
    dot.style.left = `${x}px`;
    dot.style.top = `${y}px`;
    els.dotsLayer.appendChild(dot);
  }

  function refreshDots() {
    clearDots();
    if (state.bull) addDot("bull", state.bull);
    for (const h of state.holes) addDot("hole", h);
  }

  function updateTapCount() {
    const count = state.holes.length + (state.bull ? 1 : 0);
    els.tapCount.textContent = String(count);
  }

  function resetAll() {
    state.phase = "idle";
    state.bull = null;
    state.holes = [];
    state.scale = 1;
    state.lastTouchDist = null;
    state.pinchActive = false;
    state.pinchHintShown = false;

    els.targetImg.style.transform = `scale(1)`;
    clearDots();
    updateTapCount();
    setMicroSlot("empty");
    setInstruction("Add a photo to begin.");
    els.resultsBox.textContent = "{}";
  }

  // ---------- Upload ----------
  els.uploadHeroBtn.addEventListener("click", () => {
    els.photoInput.click();
  });

  els.photoInput.addEventListener("change", async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    resetAll();

    const url = URL.createObjectURL(file);
    els.targetImg.onload = () => {
      state.imageLoaded = true;
      els.targetWrap.style.display = "block";
      state.phase = "bull";
      setInstruction("Tap bull first");
      updateTapCount();
      // microSlot stays empty until first tap (then pinch hint)
      setMicroSlot("empty");
      refreshDots();
      URL.revokeObjectURL(url);
    };
    els.targetImg.src = url;
  });

  // ---------- Tap logic (click fallback for desktop) ----------
  els.targetCanvas.addEventListener("click", (evt) => {
    // Ignore click on iOS while pinch active (safety)
    if (state.pinchActive) return;
    if (!state.imageLoaded) return;
    handlePointer(evt.clientX, evt.clientY);
  });

  function handlePointer(clientX, clientY) {
    const rect = els.targetImg.getBoundingClientRect();
    if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) return;

    const nx = (clientX - rect.left) / rect.width;
    const ny = (clientY - rect.top) / rect.height;

    // After first valid tap, show pinch hint ONCE, then remove
    if (!state.pinchHintShown) {
      state.pinchHintShown = true;
      setMicroSlot("pinchHint");
      // remove hint after a short moment or after next interaction
      setTimeout(() => {
        // only remove if we haven't already advanced to results/vendor slot
        if (state.phase === "bull" || state.phase === "holes") setMicroSlot("empty");
      }, 1400);
    }

    if (state.phase === "bull") {
      state.bull = { x: nx, y: ny };
      state.phase = "holes";
      setInstruction("Tap impacts (3–7). Then press See results.");
      setMicroSlot("empty");
    } else if (state.phase === "holes") {
      state.holes.push({ x: nx, y: ny });
      if (state.holes.length >= 1) {
        state.phase = "ready";
        setMicroSlot("seeResults");
      }
    }

    refreshDots();
    updateTapCount();
  }

  // ---------- Touch + pinch zoom (disable taps while 2 fingers down) ----------
  function dist(t1, t2) {
    const dx = t2.clientX - t1.clientX;
    const dy = t2.clientY - t1.clientY;
    return Math.hypot(dx, dy);
  }

  els.targetCanvas.addEventListener("touchstart", (e) => {
    if (!state.imageLoaded) return;

    if (e.touches.length >= 2) {
      state.pinchActive = true;
      state.lastTouchDist = dist(e.touches[0], e.touches[1]);
      return;
    }

    // Single finger tap: allowed only if NOT pinchActive
    if (state.pinchActive) return;
  }, { passive: false });

  els.targetCanvas.addEventListener("touchmove", (e) => {
    if (!state.imageLoaded) return;

    if (e.touches.length >= 2) {
      e.preventDefault(); // stop page zoom/scroll
      state.pinchActive = true;

      const d = dist(e.touches[0], e.touches[1]);
      if (state.lastTouchDist != null) {
        const delta = d / state.lastTouchDist;
        state.scale = Math.min(4, Math.max(1, state.scale * delta));
        els.targetImg.style.transform = `scale(${state.scale})`;
        refreshDots();
      }
      state.lastTouchDist = d;
      return;
    }
  }, { passive: false });

  els.targetCanvas.addEventListener("touchend", (e) => {
    // if fingers drop below 2, end pinch mode AFTER a tiny delay
    // (prevents the “release finger becomes a tap” problem)
    if (e.touches.length < 2) {
      state.lastTouchDist = null;
      setTimeout(() => { state.pinchActive = false; }, 140);
    }
  }, { passive: true });

  // Convert touch tap to pointer tap when it's a real single-finger tap
  els.targetCanvas.addEventListener("touchend", (e) => {
    if (!state.imageLoaded) return;
    if (state.pinchActive) return;
    if (e.changedTouches.length !== 1) return;

    const t = e.changedTouches[0];
    handlePointer(t.clientX, t.clientY);
  }, { passive: true });

  // ---------- Clear taps ----------
  els.clearTapsBtn.addEventListener("click", () => {
    state.bull = null;
    state.holes = [];
    state.phase = state.imageLoaded ? "bull" : "idle";
    setInstruction(state.imageLoaded ? "Tap bull first" : "Add a photo to begin.");
    setMicroSlot("empty");
    refreshDots();
    updateTapCount();
  });

  // ---------- See Results ----------
  async function onSeeResults() {
    // Once pressed: progressive quietness (hide dots) + show Vendor CTA
    clearDots();
    setMicroSlot("vendorCTA");

    const payload = {
      distanceYds: Number(String(els.distanceYds.value || "100").replace(/[^\d]/g, "")) || 100,
      tapsCount: state.holes.length + (state.bull ? 1 : 0),
      bullTap: state.bull,
      holes: state.holes,
    };

    try {
      const data = await window.tapscore(payload);
      els.resultsBox.textContent = JSON.stringify(data, null, 2);
    } catch (err) {
      els.resultsBox.textContent = JSON.stringify(
        { ok: false, error: String(err?.message || err) },
        null,
        2
      );
    }
  }

  // boot
  resetAll();
})();
