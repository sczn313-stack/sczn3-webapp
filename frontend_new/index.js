// frontend_new/index.js
// Tap workflow + pinch zoom + disable taps during 2-finger gestures + See Results + Vendor CTA
// ✅ Backend payload EXACT match:
//   { distanceYds, bullTap:{x,y}, taps:[{x,y},...] }

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
    bull: null,    // {x,y} normalized 0..1
    taps: [],      // bullet-hole taps [{x,y}] normalized 0..1

    pinchActive: false,  // true while 2 fingers down
    scale: 1,
    lastTouchDist: null,

    pinchHintShown: false,

    // iOS: prevent touch -> click double-fire
    lastTouchTapAt: 0,
    ignoreClickUntil: 0,
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
    for (const p of state.taps) addDot("hole", p);
  }

  function updateTapCount() {
    const count = state.taps.length + (state.bull ? 1 : 0);
    els.tapCount.textContent = String(count);
  }

  function resetAll() {
    state.phase = "idle";
    state.bull = null;
    state.taps = [];

    state.scale = 1;
    state.lastTouchDist = null;
    state.pinchActive = false;

    state.pinchHintShown = false;

    state.lastTouchTapAt = 0;
    state.ignoreClickUntil = 0;

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

  els.photoInput.addEventListener("change", (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    resetAll();

    const url = URL.createObjectURL(file);
    els.targetImg.onload = () => {
      state.imageLoaded = true;
      els.targetWrap.style.display = "block";

      state.phase = "bull";
      setInstruction("Tap bull first");
      setMicroSlot("empty");

      updateTapCount();
      refreshDots();
      URL.revokeObjectURL(url);
    };
    els.targetImg.src = url;
  });

  // ---------- Pointer / tap handler ----------
  function handlePointer(clientX, clientY) {
    if (!state.imageLoaded) return;
    if (state.pinchActive) return;

    const rect = els.targetImg.getBoundingClientRect();
    if (
      clientX < rect.left || clientX > rect.right ||
      clientY < rect.top  || clientY > rect.bottom
    ) return;

    const nx = (clientX - rect.left) / rect.width;
    const ny = (clientY - rect.top) / rect.height;

    // Show pinch hint once (after first valid tap)
    if (!state.pinchHintShown) {
      state.pinchHintShown = true;
      setMicroSlot("pinchHint");
      setTimeout(() => {
        if (state.phase === "bull" || state.phase === "holes") setMicroSlot("empty");
      }, 1400);
    }

    if (state.phase === "bull") {
      state.bull = { x: nx, y: ny };
      state.phase = "holes";
      setInstruction("Tap impacts (3–7). Then press See results.");
      setMicroSlot("empty");
    } else if (state.phase === "holes") {
      state.taps.push({ x: nx, y: ny });

      // as soon as we have 1 hole, show the green See Results button
      if (state.taps.length >= 1) {
        state.phase = "ready";
        setMicroSlot("seeResults");
      }
    } else if (state.phase === "ready") {
      // keep collecting holes if they tap more (still ready)
      state.taps.push({ x: nx, y: ny });
    }

    refreshDots();
    updateTapCount();
  }

  // ---------- Desktop / click fallback ----------
  els.targetCanvas.addEventListener("click", (evt) => {
    // iOS can generate click after touch — ignore for a short window
    if (Date.now() < state.ignoreClickUntil) return;

    if (!state.imageLoaded) return;
    if (state.pinchActive) return;

    handlePointer(evt.clientX, evt.clientY);
  });

  // ---------- Touch + pinch zoom ----------
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
  }, { passive: false });

  els.targetCanvas.addEventListener("touchmove", (e) => {
    if (!state.imageLoaded) return;

    if (e.touches.length >= 2) {
      e.preventDefault(); // prevent page zoom/scroll
      state.pinchActive = true;

      const d = dist(e.touches[0], e.touches[1]);
      if (state.lastTouchDist != null) {
        const delta = d / state.lastTouchDist;
        state.scale = Math.min(4, Math.max(1, state.scale * delta));
        els.targetImg.style.transform = `scale(${state.scale})`;
        refreshDots();
      }
      state.lastTouchDist = d;
    }
  }, { passive: false });

  els.targetCanvas.addEventListener("touchend", (e) => {
    if (!state.imageLoaded) return;

    // If fingers drop below 2, end pinch mode AFTER a tiny delay
    // (prevents pinch release creating a tap)
    if (e.touches.length < 2) {
      state.lastTouchDist = null;
      setTimeout(() => { state.pinchActive = false; }, 140);
    }

    // Convert a real single-finger tap into our handler
    if (state.pinchActive) return;
    if (e.changedTouches.length !== 1) return;

    const now = Date.now();
    state.lastTouchTapAt = now;
    state.ignoreClickUntil = now + 600; // block the follow-up click event

    const t = e.changedTouches[0];
    handlePointer(t.clientX, t.clientY);
  }, { passive: true });

  // ---------- Clear taps ----------
  els.clearTapsBtn.addEventListener("click", () => {
    state.bull = null;
    state.taps = [];
    state.phase = state.imageLoaded ? "bull" : "idle";

    setInstruction(state.imageLoaded ? "Tap bull first" : "Add a photo to begin.");
    setMicroSlot("empty");
    refreshDots();
    updateTapCount();
  });

  // ---------- See Results (ONLY trigger) ----------
  async function onSeeResults() {
    if (!state.bull) {
      els.resultsBox.textContent = JSON.stringify({ ok:false, error:"Missing bullTap." }, null, 2);
      return;
    }
    if (state.taps.length < 1) {
      els.resultsBox.textContent = JSON.stringify({ ok:false, error:"Need at least 1 bullet-hole tap." }, null, 2);
      return;
    }

    // Progressive silence: hide dots + swap slot to vendor CTA
    clearDots();
    setMicroSlot("vendorCTA");

    const distanceYds =
      Number(String(els.distanceYds.value || "100").replace(/[^\d]/g, "")) || 100;

    // ✅ EXACT backend shape:
    const payload = {
      distanceYds,
      bullTap: state.bull,
      taps: state.taps
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
