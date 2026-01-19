/* ============================================================================
  Tap-N-Score — Working index.js (iOS-safe photo load + tap capture + dots)
  FULL replacement for frontend_new/index.js

  Assumptions based on your UI:
  - There is exactly one <input type="file"> ("Choose File")
  - There is a "Taps: 0" line somewhere
  - There is a Clear button
  - There is a pill area that says "Add a photo to begin."
============================================================================ */

(() => {
  // ----------------------------
  // Helpers
  // ----------------------------
  const qs = (sel, root = document) => root.querySelector(sel);
  const qsa = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  // Core UI elements (best-effort selectors)
  const fileInput = qs('input[type="file"]');
  const clearBtn = qsa("button").find((b) => (b.textContent || "").trim().toLowerCase() === "clear");

  // The big pill that says "Add a photo to begin."
  const statusEl = qsa("div, p, span")
    .find((el) => (el.textContent || "").trim() === "Add a photo to begin.");

  // The line that contains "Taps:"
  const tapsLineEl = qsa("div, p, span")
    .find((el) => (el.textContent || "").includes("Taps:"));

  // ----------------------------
  // State
  // ----------------------------
  let selectedFile = null;
  let objectUrl = null;
  let taps = []; // { nx, ny } normalized 0..1

  // ----------------------------
  // iOS-safe file read (retry timing)
  // ----------------------------
  async function getFileWithRetry(inputEl, delaysMs) {
    for (const d of delaysMs) {
      if (d > 0) await new Promise((r) => setTimeout(r, d));
      const f = inputEl?.files?.[0] || null;
      if (f) return f;
    }
    return null;
  }

  // ----------------------------
  // Tap UI (we create our own wrapper inside the status pill area)
  // ----------------------------
  let wrapper = null;     // positioned container
  let img = null;         // preview image
  let dotsLayer = null;   // absolute overlay for dots

  function ensurePhotoUI() {
    if (!statusEl) return;

    // If already built, do nothing
    if (wrapper && img && dotsLayer) return;

    // Convert the "Add a photo..." pill into a photo/tap area
    statusEl.textContent = "";
    statusEl.style.position = "relative";
    statusEl.style.overflow = "hidden";

    wrapper = document.createElement("div");
    wrapper.style.position = "relative";
    wrapper.style.width = "100%";
    wrapper.style.minHeight = "220px"; // gives you a tappable area
    wrapper.style.borderRadius = "16px";

    img = document.createElement("img");
    img.alt = "Target preview";
    img.style.display = "none";
    img.style.width = "100%";
    img.style.height = "auto";
    img.style.borderRadius = "16px";
    img.style.userSelect = "none";
    img.style.webkitUserSelect = "none";
    img.style.touchAction = "manipulation"; // improves iOS tap feel

    dotsLayer = document.createElement("div");
    dotsLayer.style.position = "absolute";
    dotsLayer.style.left = "0";
    dotsLayer.style.top = "0";
    dotsLayer.style.right = "0";
    dotsLayer.style.bottom = "0";
    dotsLayer.style.pointerEvents = "none";

    // Placeholder text when no image
    const placeholder = document.createElement("div");
    placeholder.id = "tns_placeholder";
    placeholder.textContent = "Add a photo to begin.";
    placeholder.style.opacity = "0.85";
    placeholder.style.fontSize = "22px";
    placeholder.style.padding = "18px";

    wrapper.appendChild(placeholder);
    wrapper.appendChild(img);
    wrapper.appendChild(dotsLayer);
    statusEl.appendChild(wrapper);

    // Tap handlers (click + touch)
    const onTap = (e) => {
      if (!img || img.style.display === "none") return;

      const isTouch = e.touches && e.touches[0];
      const clientX = isTouch ? e.touches[0].clientX : e.clientX;
      const clientY = isTouch ? e.touches[0].clientY : e.clientY;

      const rect = img.getBoundingClientRect();
      const x = clientX - rect.left;
      const y = clientY - rect.top;

      if (rect.width <= 0 || rect.height <= 0) return;

      const nx = x / rect.width;
      const ny = y / rect.height;

      // Clamp
      const cnx = Math.max(0, Math.min(1, nx));
      const cny = Math.max(0, Math.min(1, ny));

      taps.push({ nx: cnx, ny: cny });
      renderDots();
      updateTapsUI();
    };

    // Attach to wrapper so user can tap anywhere on the image area
    wrapper.addEventListener("click", onTap);
    wrapper.addEventListener("touchstart", onTap, { passive: true });
  }

  function setPlaceholderVisible(isVisible) {
    if (!wrapper) return;
    const ph = qs("#tns_placeholder", wrapper);
    if (ph) ph.style.display = isVisible ? "block" : "none";
  }

  function renderDots() {
    if (!dotsLayer || !img) return;
    dotsLayer.innerHTML = "";

    // Use current rendered image size for dot placement
    const rect = img.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;

    taps.forEach((t) => {
      const dot = document.createElement("div");
      dot.style.position = "absolute";
      dot.style.left = `${t.nx * w - 6}px`;
      dot.style.top = `${t.ny * h - 6}px`;
      dot.style.width = "12px";
      dot.style.height = "12px";
      dot.style.borderRadius = "999px";
      dot.style.background = "rgba(255,255,255,0.95)";
      dot.style.border = "2px solid rgba(0,0,0,0.65)";
      dot.style.boxShadowxShadow = "0 2px 10px rgba(0,0,0,0.25)";
      dotsLayer.appendChild(dot);
    });
  }

  function updateTapsUI() {
    if (tapsLineEl) {
      // Preserve anything after Taps: if present (rare); otherwise set cleanly
      tapsLineEl.textContent = `Taps: ${taps.length}`;
    }
  }

  // Re-render dots on resize/orientation change so dot positions stay aligned
  function attachResizeRerender() {
    window.addEventListener("resize", () => {
      if (taps.length) renderDots();
    });
    window.addEventListener("orientationchange", () => {
      setTimeout(() => {
        if (taps.length) renderDots();
      }, 200);
    });
  }

  // ----------------------------
  // File load
  // ----------------------------
  async function onFilePicked(e) {
    ensurePhotoUI();

    const inputEl = e?.target;
    const file = await getFileWithRetry(inputEl, [0, 50, 250, 800]);

    if (!file) {
      // keep placeholder
      selectedFile = null;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
        objectUrl = null;
      }
      if (img) {
        img.src = "";
        img.style.display = "none";
      }
      setPlaceholderVisible(true);
      return;
    }

    selectedFile = file;

    // Reset taps when a new image is chosen
    taps = [];
    updateTapsUI();
    if (dotsLayer) dotsLayer.innerHTML = "";

    // Show image
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = URL.createObjectURL(file);

    setPlaceholderVisible(false);

    if (img) {
      img.src = objectUrl;
      img.style.display = "block";

      // Wait for layout before drawing dots (none initially, but keeps things stable)
      img.onload = () => {
        renderDots();
      };
    }
  }

  // ----------------------------
  // Clear
  // ----------------------------
  function onClear() {
    taps = [];
    updateTapsUI();

    if (dotsLayer) dotsLayer.innerHTML = "";

    if (fileInput) fileInput.value = ""; // allow re-select same photo

    selectedFile = null;

    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
      objectUrl = null;
    }

    if (img) {
      img.src = "";
      img.style.display = "none";
    }

    if (statusEl) {
      // restore placeholder if UI exists
      ensurePhotoUI();
      setPlaceholderVisible(true);
    }
  }

  // ----------------------------
  // Boot
  // ----------------------------
  function init() {
    // Always build the photo UI so the tap area exists
    ensurePhotoUI();
    updateTapsUI();
    attachResizeRerender();

    if (!fileInput) {
      console.warn("Tap-N-Score: no <input type='file'> found.");
      return;
    }

    // iOS-safe: listen to both events
    fileInput.addEventListener("change", onFilePicked);
    fileInput.addEventListener("input", onFilePicked);

    if (clearBtn) clearBtn.addEventListener("click", onClear);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
