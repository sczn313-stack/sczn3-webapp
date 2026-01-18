// sczn3-webapp/frontend_new/index.js (FULL FILE REPLACEMENT)
// iOS-safe: pointer events + guaranteed visible dots + debug line

(() => {
  const SS_PHOTO = "sczn3_targetPhoto_dataUrl";

  const statusLine   = document.getElementById("statusLine");
  const photoInput   = document.getElementById("photoInput");
  const targetImage  = document.getElementById("targetImage");
  const imageWrap    = document.getElementById("targetImageWrap");
  const tapsCountEl  = document.getElementById("tapsCount");
  const clearBtn     = document.getElementById("clearTapsBtn");
  const emptyHint    = document.getElementById("emptyHint");

  let taps = [];

  function setStatus(msg) {
    if (statusLine) statusLine.textContent = msg;
  }

  function updateCount() {
    if (tapsCountEl) tapsCountEl.textContent = String(taps.length);
  }

  function clearDots() {
    if (!imageWrap) return;
    imageWrap.querySelectorAll(".tapDot").forEach(d => d.remove());
  }

  function addDot(x, y) {
    if (!imageWrap) return;
    const dot = document.createElement("div");
    dot.className = "tapDot";
    dot.style.left = `${x}px`;
    dot.style.top  = `${y}px`;
    imageWrap.appendChild(dot);
  }

  function clearAllTaps() {
    taps = [];
    clearDots();
    updateCount();
    setStatus("Taps cleared. Tap bullet holes.");
  }

  function showPreview(dataUrl) {
    if (!targetImage) return;
    targetImage.src = dataUrl;

    if (emptyHint) emptyHint.textContent = "Photo loaded. Tap bullet holes (Tap-n-Score).";
    setStatus("Photo loaded. Tap bullet holes.");
  }

  // ===== PHOTO LOAD (single owner) =====
  if (photoInput) {
    photoInput.addEventListener("change", () => {
      const f = photoInput.files && photoInput.files[0];
      if (!f) {
        setStatus("No photo selected.");
        return;
      }
      if (!f.type || !f.type.startsWith("image/")) {
        setStatus("That file is not an image.");
        return;
      }

      const r = new FileReader();
      r.onload = () => {
        const dataUrl = String(r.result || "");
        try { sessionStorage.setItem(SS_PHOTO, dataUrl); } catch {}
        showPreview(dataUrl);
        clearAllTaps();
      };
      r.onerror = () => setStatus("Could not read that photo.");
      r.readAsDataURL(f);
    });
  }

  // ===== TAP CAPTURE (pointer events) =====
  function bindTapEvents() {
    if (!imageWrap) {
      setStatus("Missing #targetImageWrap in HTML.");
      return;
    }

    // Make wrapper the tap surface
    imageWrap.style.position = "relative";
    imageWrap.style.touchAction = "none";
    imageWrap.style.webkitUserSelect = "none";
    imageWrap.style.userSelect = "none";

    const getXY = (clientX, clientY) => {
      const rect = imageWrap.getBoundingClientRect();
      const x = clientX - rect.left;
      const y = clientY - rect.top;
      if (x < 0 || y < 0 || x > rect.width || y > rect.height) return null;
      return { x, y, rect };
    };

    const onPointerDown = (e) => {
      // if no photo loaded, ignore
      if (!targetImage || !targetImage.src) {
        setStatus("Add a photo first.");
        return;
      }

      e.preventDefault();

      const p = getXY(e.clientX, e.clientY);
      if (!p) return;

      taps.push({ x: p.x, y: p.y });

      // BIG visible dot + debug
      addDot(p.x, p.y);
      updateCount();
      setStatus(`Tap ${taps.length}: x=${p.x.toFixed(1)} y=${p.y.toFixed(1)} (wrap ${p.rect.width.toFixed(0)}×${p.rect.height.toFixed(0)})`);
    };

    // Remove any old listeners by cloning the node (clean reset)
    const fresh = imageWrap.cloneNode(true);
    imageWrap.parentNode.replaceChild(fresh, imageWrap);

    // Re-acquire references after replace
    const newWrap = document.getElementById("targetImageWrap");
    if (!newWrap) return;

    // Ensure image is inside (it is in your HTML)
    newWrap.addEventListener("pointerdown", onPointerDown, { passive: false });
  }

  bindTapEvents();

  if (clearBtn) {
    clearBtn.addEventListener("click", clearAllTaps);
    clearBtn.addEventListener("touchstart", (e) => { e.preventDefault(); clearAllTaps(); }, { passive: false });
  }

  updateCount();
  setStatus("Ready. Tap ADD PHOTO.");
})();
