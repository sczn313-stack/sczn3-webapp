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

   This file:
   - Fixes iOS “filename shows but no file actually received” by:
     (1) handling change reliably
     (2) storing file immediately (never rely on input.files later)
     (3) generating preview via objectURL (fast + iOS-safe)
   - Prevents accidental resets by NOT recreating the file input.
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
  /** taps in image pixel space or normalized space (your choice) */
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
  function onFileChange(e) {
    const file = e?.target?.files && e.target.files[0];

    // iOS Safari glitch: name appears but file object can be missing
    if (!file) {
      selectedFile = null;
      if (selectedObjectUrl) {
        URL.revokeObjectURL(selectedObjectUrl);
        selectedObjectUrl = null;
      }
      hidePreview();
      setStatus("No photo loaded. Tap Choose File again (iOS picker can glitch).");
      return;
    }

    // Store immediately — NEVER rely on elFile.files later
    selectedFile = file;

    // Create a preview URL (fast + iOS friendly)
    if (selectedObjectUrl) URL.revokeObjectURL(selectedObjectUrl);
    selectedObjectUrl = URL.createObjectURL(file);

    showPreview(selectedObjectUrl);
    setStatus(`Loaded: ${file.name}`);

    // Reset taps whenever a new image is selected (optional; you can remove this)
    taps = [];
    setTapsCount();

    // If you draw markers on a layer/canvas, clear them here
    clearTapMarkers();
  }

  // ----------------------------
  // Tap capture (generic)
  // ----------------------------
  function clearTapMarkers() {
    // If you use a canvas, clear it:
    if (elCanvas && elCanvas.getContext) {
      const ctx = elCanvas.getContext("2d");
      if (ctx) ctx.clearRect(0, 0, elCanvas.width, elCanvas.height);
    }

    // If you use DOM dots inside tapLayer, clear them:
    if (elTapLayer) elTapLayer.innerHTML = "";
  }

  function addTapMarker(clientX, clientY) {
    // If you have a tap layer, place a dot at tap position relative to preview.
    // This is purely UI. Your backend coords can be computed separately.
    if (!elPreview) return;

    const rect = elPreview.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    // Store normalized coords (0..1), which is robust across screen sizes:
    const nx = rect.width ? x / rect.width : 0;
    const ny = rect.height ? y / rect.height : 0;

    taps.push({ nx, ny });
    setTapsCount();

    // Draw marker (DOM)
    if (elTapLayer) {
      // Make sure tapLayer is positioned over the preview in CSS (absolute overlay).
      const dot = document.createElement("div");
      dot.style.position = "absolute";
      dot.style.left = `${x - 6}px`;
      dot.style.top = `${y - 6}px`;
      dot.style.width = "12px";
      dot.style.height = "12px";
      dot.style.borderRadius = "999px";
      dot.style.background = "rgba(255,255,255,0.9)";
      dot.style.border = "2px solid rgba(0,0,0,0.6)";
      dot.style.pointerEvents = "none";
      elTapLayer.appendChild(dot);
    } else if (elCanvas && elCanvas.getContext) {
      // Canvas marker fallback (assumes canvas matches preview size)
      const ctx = elCanvas.getContext("2d");
      if (ctx) {
        const cx = nx * elCanvas.width;
        const cy = ny * elCanvas.height;
        ctx.beginPath();
        ctx.arc(cx, cy, 6, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255,255,255,0.9)";
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = "rgba(0,0,0,0.6)";
        ctx.stroke();
      }
    }
  }

  function onTap(e) {
    // Only allow tapping after an image is truly loaded
    if (!selectedFile || !selectedObjectUrl) {
      setStatus("Add a photo to begin.");
      return;
    }

    // Support touch + mouse
    const isTouch = e.touches && e.touches[0];
    const clientX = isTouch ? e.touches[0].clientX : e.clientX;
    const clientY = isTouch ? e.touches[0].clientY : e.clientY;

    addTapMarker(clientX, clientY);
  }

  function setTapHandlers() {
    // If you already attach taps to something else, move these listeners there.
    // Best target for taps is the preview image itself.
    if (elPreview) {
      // touchstart prevents the “300ms delay” feel on some iOS versions
      elPreview.addEventListener("touchstart", onTap, { passive: true });
      elPreview.addEventListener("click", onTap);
    }

    // If you instead use an overlay layer:
    if (elTapLayer) {
      elTapLayer.addEventListener("touchstart", onTap, { passive: true });
      elTapLayer.addEventListener("click", onTap);
    }

    // If you use a canvas:
    if (elCanvas) {
      elCanvas.addEventListener("touchstart", onTap, { passive: true });
      elCanvas.addEventListener("click", onTap);
    }
  }

  // ----------------------------
  // Clear button
  // ----------------------------
  function onClear() {
    taps = [];
    setTapsCount();
    clearTapMarkers();

    // IMPORTANT: do NOT replace/recreate the file input element.
    // If you want to allow re-selecting the same file, you can clear the value:
    if (elFile) elFile.value = "";

    selectedFile = null;

    if (selectedObjectUrl) {
      URL.revokeObjectURL(selectedObjectUrl);
      selectedObjectUrl = null;
    }

    hidePreview();
    setStatus("Add a photo to begin.");
  }

  // ----------------------------
  // Boot
  // ----------------------------
  function init() {
    // Initial UI
    setTapsCount();
    if (elPreview) elPreview.style.display = "none";
    if (!elStatus?.textContent) setStatus("Add a photo to begin.");

    // Default distance (optional)
    if (elDistance && !elDistance.value) elDistance.value = "100";

    // Wire events
    if (!elFile) {
      console.warn("Missing #targetFile input. File loading will not work.");
    } else {
      // iOS-safe: handle change immediately and store file
      elFile.addEventListener("change", onFileChange);
    }

    if (elClear) elClear.addEventListener("click", onClear);

    setTapHandlers();

    // Optional: basic vendor link sanitation (no breaking input, just trims)
    if (elVendor) {
      elVendor.addEventListener("blur", () => {
        elVendor.value = (elVendor.value || "").trim();
      });
    }
  }

  // Run after DOM ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
