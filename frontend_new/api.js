/* ============================================================================
   Tap-N-Score — iOS Safari “file selected but not loaded” FIX (FULL REPLACEMENT)
   Drop-in replacement for your frontend JS (e.g., frontend_new/index.js)

   REQUIREMENTS (IDs in your HTML):
     <input  id="targetFile" type="file" accept="image/*" />
     <div    id="photoStatus"></div>          // text like "Add a photo to begin."
     <img    id="targetPreview" />            // preview of selected image
     <input  id="distance" />                 // distance input
     <span   id="tapsCount"></span>           // shows tap count
     <button id="clearBtn"></button>          // clears taps + resets
     <input  id="vendorLink" />               // optional vendor link input

   OPTIONAL (if you have a tap overlay/canvas):
     <div id="tapLayer"></div> OR <canvas id="tapCanvas"></canvas>

   iOS Safari hardening:
   - Listen to BOTH 'change' and 'input' (iOS sometimes prefers input)
   - Clear file input value BEFORE picker opens (allows selecting same image again)
   - Store file immediately; never rely on input.files later
============================================================================ */

(() => {
  // ----------------------------
  // DOM helpers
  // ----------------------------
  const $ = (id) => document.getElementById(id);

  const elFile = $("targetFile");
  const elStatus = $("photoStatus");
  const elPreview = $("targetPreview");
  const elDistance = $("distance");
  const elTapsCount = $("tapsCount");
  const elClear = $("clearBtn");
  const elVendor = $("vendorLink");

  // Tap layer (optional). If you use something else, adjust setTapHandlers().
  const elTapLayer = $("tapLayer");
  const elCanvas = $("tapCanvas");

  // ----------------------------
  // State
  // ----------------------------
  let selectedFile = null;
  let selectedObjectUrl = null;
  let taps = [];

  // ----------------------------
  // UI
  // ----------------------------
  function setStatus(msg) {
    if (elStatus) elStatus.textContent = msg;
  }

  function setTapsCount() {
    if (elTapsCount) elTapsCount.textContent = String(taps.length);
  }

  function showPreview(url) {
    if (!elPreview) return;
    elPreview.src = url;
    elPreview.style.display = "block";
  }

  function hidePreview() {
    if (!elPreview) return;
    elPreview.src = "";
    elPreview.style.display = "none";
  }

  // ----------------------------
  // Core: iOS-safe file selection
  // ----------------------------
  function clearObjectUrl() {
    if (selectedObjectUrl) {
      try { URL.revokeObjectURL(selectedObjectUrl); } catch (_) {}
      selectedObjectUrl = null;
    }
  }

  function resetImageState(msg) {
    selectedFile = null;
    clearObjectUrl();
    hidePreview();
    taps = [];
    setTapsCount();
    clearTapMarkers();
    if (msg) setStatus(msg);
  }

  function onFilePickedFromEvent(e) {
    const file = e?.target?.files && e.target.files[0];

    // iOS Safari glitch: name appears but file object can be missing
    if (!file) {
      resetImageState("No photo loaded. Tap Choose File again (iOS picker can glitch).");
      return;
    }

    // Store immediately — NEVER rely on elFile.files later
    selectedFile = file;

    // Create a preview URL (fast + iOS friendly)
    clearObjectUrl();
    selectedObjectUrl = URL.createObjectURL(file);

    showPreview(selectedObjectUrl);
    setStatus(`Loaded: ${file.name}`);

    // Reset taps whenever a new image is selected
    taps = [];
    setTapsCount();
    clearTapMarkers();
  }

  function onFileChange(e) {
    onFilePickedFromEvent(e);
  }

  // iOS sometimes prefers 'input' over 'change'
  function onFileInput(e) {
    onFilePickedFromEvent(e);
  }

  // IMPORTANT: allow selecting the SAME image again by clearing BEFORE picker opens
  function armReselectSameFileFix() {
    if (!elFile) return;

    // pointerdown works across mouse/touch; capture ensures it runs early
    const clearValue = () => {
      // clearing here enables same-file reselection to fire events
      elFile.value = "";
    };

    elFile.addEventListener("pointerdown", clearValue, { capture: true });
    elFile.addEventListener("touchstart", clearValue, { capture: true, passive: true });
    elFile.addEventListener("mousedown", clearValue, { capture: true });
    elFile.addEventListener("click", clearValue, { capture: true });
  }

  // ----------------------------
  // Tap capture (generic)
  // ----------------------------
  function clearTapMarkers() {
    if (elCanvas && elCanvas.getContext) {
      const ctx = elCanvas.getContext("2d");
      if (ctx) ctx.clearRect(0, 0, elCanvas.width, elCanvas.height);
    }
    if (elTapLayer) elTapLayer.innerHTML = "";
  }

  function addTapMarker(clientX, clientY) {
    if (!elPreview) return;

    const rect = elPreview.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    // Store normalized coords (0..1)
    const nx = rect.width ? x / rect.width
