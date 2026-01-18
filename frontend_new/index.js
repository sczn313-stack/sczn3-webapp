// sczn3-webapp/frontend_new/index.js (FULL FILE REPLACEMENT)
// iOS-safe tap capture + always creates tapsJson { bull, holes } so backend never gets NO_INPUT.

(() => {
  // ===== Storage keys (match receipt.js usage where applicable) =====
  const DIST_KEY   = "sczn3_distance_yards";
  const PHOTO_KEY  = "sczn3_targetPhoto_dataUrl";
  const VENDOR_BUY = "sczn3_vendor_buy_url";

  // taps payload for backend
  const TAPS_KEY   = "sczn3_taps_json";

  // last result for receipt/saved flows
  const LAST_KEY   = "sczn3_last_result_json";

  // ===== DOM =====
  const photoInput   = document.getElementById("photoInput");
  const distanceEl   = document.getElementById("distanceInput");
  const vendorEl     = document.getElementById("vendorInput");

  const wrap         = document.getElementById("targetImageWrap");
  const img          = document.getElementById("targetImage");

  const tapsCountEl  = document.getElementById("tapsCount");
  const clearBtn     = document.getElementById("clearTapsBtn");
  const seeBtn       = document.getElementById("seeResultsBtn");

  const statusLine   = document.getElementById("statusLine");
  const emptyHint    = document.getElementById("emptyHint");

  function status(msg){
    if (statusLine) statusLine.textContent = String(msg || "");
  }

  function safeNum(v, fallback){
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : fallback;
  }

  function setSS(key, val){ try { sessionStorage.setItem(key, val); } catch {} }
  function getSS(key){ try { return sessionStorage.getItem(key); } catch { return null; } }

  // ===== Tap state =====
  let taps = []; // [{x,y}] in IMAGE PIXELS (natural image coordinate space)

  function updateCount(){
    if (tapsCountEl) tapsCountEl.textContent = String(taps.length);
  }

  function clearDots(){
    if (!wrap) return;
    wrap.querySelectorAll(".tapDot").forEach(n => n.remove());
  }

  function addDot(displayX, displayY){
    if (!wrap) return;
    const dot = document.createElement("div");
    dot.className = "tapDot";
    dot.style.left = `${displayX}px`;
    dot.style.top  = `${displayY}px`;
    wrap.appendChild(dot);
  }

  function getDisplayRect(){
    if (!wrap) return null;
    return wrap.getBoundingClientRect();
  }

  // Convert a tap in DISPLAY pixels -> IMAGE pixels (natural image space)
  function displayToImageXY(displayX, displayY){
    if (!img) return null;

    const dispW = img.clientWidth || 1;
    const dispH = img.clientHeight || 1;

    // natural size (fallback to display if not available yet)
    const natW = img.naturalWidth  || dispW;
    const natH = img.naturalHeight || dispH;

    const scaleX = natW / dispW;
    const scaleY = natH / dispH;

    return {
      x: displayX * scaleX,
      y: displayY * scaleY,
      natW,
      natH
    };
  }

  function ensurePhotoLoaded(){
    const src = img && img.src ? String(img.src) : "";
    if (!src) {
      status("Add a photo first.");
      return false;
    }
    return true;
  }

  function handleTapClient(clientX, clientY){
    if (!ensurePhotoLoaded()) return;

    const rect = getDisplayRect();
    if (!rect) return;

    // tap position inside wrapper in DISPLAY px
    const dx = clientX - rect.left;
    const dy = clientY - rect.top;

    // bounds check
    if (dx < 0 || dy < 0 || dx > rect.width || dy > rect.height) return;

    // Dot in DISPLAY space
    addDot(dx, dy);

    // Store tap in IMAGE space
    const imgXY = displayToImageXY(dx, dy);
    if (!imgXY) return;

    taps.push({ x: imgXY.x, y: imgXY.y });
    updateCount();

    // Save tapsJson every tap
    persistTapsJson(imgXY.natW, imgXY.natH);

    status(`Taps: ${taps.length}. Keep tapping holes, then press See results.`);
  }

  function persistTapsJson(natW, natH){
    // Bull = center of the image (simple, stable default)
    const bull = { x: natW / 2, y: natH / 2 };

    const payload = {
      bull,
      holes: taps.slice(),
      image: { width: natW, height: natH }
    };

    setSS(TAPS_KEY, JSON.stringify(payload));
  }

  function clearTaps(){
    taps = [];
    updateCount();
    clearDots();
    setSS(TAPS_KEY, "");
    status("Cleared. Tap holes again.");
  }

  // ===== iOS-safe event binding =====
  function bindTapEvents(){
    if (!wrap) return;

    // Critical for iOS: prevent scroll/zoom gesture interference on tap area
    wrap.style.touchAction = "none";

    // Pointer events (best)
    const onPointerDown = (e) => {
      // Only primary touch / pen / mouse
      if (e && typeof e.preventDefault === "function") e.preventDefault();
      handleTapClient(e.clientX, e.clientY);
    };

    // Touch fallback (some iOS cases)
    const onTouchStart = (e) => {
      // MUST be non-passive for preventDefault to work
      if (e && typeof e.preventDefault === "function") e.preventDefault();
      const t = e.touches && e.touches[0];
      if (!t) return;
      handleTapClient(t.clientX, t.clientY);
    };

    // Click fallback (desktop)
    const onClick = (e) => {
      handleTapClient(e.clientX, e.clientY);
    };

    // Clear any old listeners by cloning node (hard reset)
    const parent = wrap.parentNode;
    if (parent) {
      const clone = wrap.cloneNode(true);
      parent.replaceChild(clone, wrap);
    }

    // Re-fetch wrap after clone replacement
    const newWrap = document.getElementById("targetImageWrap");
    if (!newWrap) return;

    // Bind listeners
    newWrap.addEventListener("pointerdown", onPointerDown, { passive: false });
    newWrap.addEventListener("touchstart", onTouchStart, { passive: false });
    newWrap.addEventListener("click", onClick);
  }

  // ===== Photo loader =====
  function wirePhotoInput(){
    if (!photoInput || !img) return;

    photoInput.addEventListener("change", () => {
      const f = photoInput.files && photoInput.files[0];
      if (!f) return;

      const r = new FileReader();
      r.onload = () => {
        const dataUrl = String(r.result || "");
        img.src = dataUrl;
        setSS(PHOTO_KEY, dataUrl);

        // reset taps on new photo
        clearTaps();

        if (emptyHint) emptyHint.textContent = "Photo loaded. Tap bullet holes (Tap-n-Score).";
        status("Photo loaded. Tap bullet holes.");
      };
      r.readAsDataURL(f);
    });
  }

  // ===== Distance + vendor =====
  function wireInputs(){
    if (distanceEl) {
      // load from prior session if exists
      const prior = getSS(DIST_KEY);
      if (prior) distanceEl.value = String(safeNum(prior, 100));

      distanceEl.addEventListener("input", () => {
        const yards = safeNum(distanceEl.value, 100);
        setSS(DIST_KEY, String(yards));
      });
    }

    if (vendorEl) {
      const prior = getSS(VENDOR_BUY);
      if (prior) vendorEl.value = prior;

      vendorEl.addEventListener("input", () => {
        const url = String(vendorEl.value || "").trim();
        if (url) setSS(VENDOR_BUY, url);
      });
    }
  }

  // ===== Results navigation (do NOT call backend if no taps) =====
  function wireButtons(){
    if (clearBtn) clearBtn.addEventListener("click", clearTaps);

    if (seeBtn) {
      const go = () => {
        if (!ensurePhotoLoaded()) return;

        if (!taps.length) {
          status("Tap at least 1 bullet hole before results.");
          return;
        }

        // Persist final tapsJson based on current image
        const natW = img.naturalWidth || img.clientWidth || 1;
        const natH = img.naturalHeight || img.clientHeight || 1;
        persistTapsJson(natW, natH);

        // optional: clear last result so old results never show
        setSS(LAST_KEY, "");

        // go to output page (output.js should call backend using tapsJson)
        window.location.href = `./output.html?v=${Date.now()}`;
      };

      seeBtn.addEventListener("click", go);
      seeBtn.addEventListener("touchstart", go, { passive: true });
    }
  }

  // ===== INIT =====
  function init(){
    wirePhotoInput();
    wireInputs();
    wireButtons();
    bindTapEvents();

    updateCount();

    // If a photo already in session storage (rare), restore it
    const priorPhoto = getSS(PHOTO_KEY);
    if (priorPhoto && img && !img.src) img.src = priorPhoto;

    status("Ready. Tap ADD PHOTO.");
  }

  init();
})();
