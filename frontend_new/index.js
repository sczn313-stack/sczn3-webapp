/* ============================================================================
   Tap-N-Score — iOS Safari “file selected but not loaded” FIX
   FULL REPLACEMENT (self-healing: no required IDs)

   What it does:
   - Works even if your HTML does NOT have targetFile/photoStatus/targetPreview IDs.
   - Finds the first <input type="file" accept="image/*"> on the page.
   - Creates + injects a status line and <img> preview directly under the upload block.
   - Handles iOS Safari weirdness:
       * listens to both "change" and "input"
       * clears input.value on pointerdown so same-file reselect triggers
       * stores the File immediately (never rely on input.files later)
       * uses objectURL, with FileReader fallback

   Drop this in your main frontend JS file.
============================================================================ */

(() => {
  // ----------------------------
  // Helpers
  // ----------------------------
  const qs = (sel, root = document) => root.querySelector(sel);

  function log(...args) {
    // flip to false if you want silent
    const DEBUG = true;
    if (DEBUG) console.log("[TapNS:upload]", ...args);
  }

  // ----------------------------
  // Locate elements (NO required IDs)
  // ----------------------------
  function findFileInput() {
    // Prefer a file input that accepts images
    const inputs = Array.from(document.querySelectorAll('input[type="file"]'));
    const imgFirst =
      inputs.find((i) => (i.getAttribute("accept") || "").includes("image")) ||
      inputs[0] ||
      null;
    return imgFirst;
  }

  function findUploadBlockNearInput(fileInput) {
    if (!fileInput) return document.body;

    // Try to find a sane container: closest label/div/section/fieldset
    const container =
      fileInput.closest("section") ||
      fileInput.closest("fieldset") ||
      fileInput.closest("div") ||
      fileInput.parentElement ||
      document.body;

    return container;
  }

  // ----------------------------
  // Create UI (status + preview) if missing
  // ----------------------------
  function ensureStatusAndPreview(container) {
    // If your page already has these IDs, we'll use them.
    let statusEl = document.getElementById("photoStatus");
    let previewEl = document.getElementById("targetPreview");

    // Otherwise create them (self-healing)
    if (!statusEl) {
      statusEl = document.createElement("div");
      statusEl.id = "photoStatus";
      statusEl.style.marginTop = "12px";
      statusEl.style.padding = "10px 12px";
      statusEl.style.borderRadius = "12px";
      statusEl.style.background = "rgba(255,255,255,0.06)";
      statusEl.style.border = "1px solid rgba(255,255,255,0.10)";
      statusEl.style.color = "rgba(255,255,255,0.85)";
      statusEl.style.fontSize = "14px";
      statusEl.textContent = "Add a photo to begin.";
      container.appendChild(statusEl);
    }

    if (!previewEl) {
      previewEl = document.createElement("img");
      previewEl.id = "targetPreview";
      previewEl.alt = "Target preview";
      previewEl.style.display = "none";
      previewEl.style.marginTop = "12px";
      previewEl.style.width = "100%";
      previewEl.style.maxWidth = "980px";
      previewEl.style.borderRadius = "14px";
      previewEl.style.background = "rgba(0,0,0,0.25)";
      previewEl.style.border = "1px solid rgba(255,255,255,0.10)";

      // THIS is the "full image doesn't show" fix:
      // contain + max-height prevents cropping and keeps full photo visible.
      previewEl.style.objectFit = "contain";
      previewEl.style.maxHeight = "72vh";

      container.appendChild(previewEl);
    }

    return { statusEl, previewEl };
  }

  function setStatus(statusEl, msg) {
    if (statusEl) statusEl.textContent = msg;
  }

  function showPreview(previewEl, src) {
    if (!previewEl) return;
    previewEl.src = src;
    previewEl.style.display = "block";
  }

  function hidePreview(previewEl) {
    if (!previewEl) return;
    previewEl.src = "";
    previewEl.style.display = "none";
  }

  // ----------------------------
  // State
  // ----------------------------
  let selectedFile = null;
  let objectUrl = null;

  function cleanupObjectUrl() {
    if (objectUrl) {
      try {
        URL.revokeObjectURL(objectUrl);
      } catch (_) {}
      objectUrl = null;
    }
  }

  // ----------------------------
  // iOS-safe load pipeline
  // ----------------------------
  function loadFileToPreview(file, statusEl, previewEl) {
    selectedFile = file;

    // Try objectURL first (fast, iOS-safe in most cases)
    cleanupObjectUrl();
    try {
      objectUrl = URL.createObjectURL(file);
      showPreview(previewEl, objectUrl);
      setStatus(statusEl, `Loaded: ${file.name} (${Math.round(file.size / 1024)} KB)`);
      log("Preview via objectURL", file.name, file.type, file.size);
      return;
    } catch (err) {
      log("objectURL failed, falling back to FileReader", err);
    }

    // Fallback: FileReader (works even when objectURL is weird)
    const reader = new FileReader();
    reader.onload = () => {
      showPreview(previewEl, String(reader.result || ""));
      setStatus(statusEl, `Loaded: ${file.name}`);
      log("Preview via FileReader", file.name);
    };
    reader.onerror = () => {
      hidePreview(previewEl);
      setStatus(statusEl, "Could not read file. Try selecting again.");
      log("FileReader error");
    };
    reader.readAsDataURL(file);
  }

  function handlePick(evt, statusEl, previewEl, fileInput) {
    const file = evt?.target?.files && evt.target.files[0];

    // iOS sometimes shows a filename but files[0] is null in that instant.
    if (!file) {
      hidePreview(previewEl);
      setStatus(
        statusEl,
        "No photo loaded (iOS picker glitch). Tap Choose File and select again."
      );
      log("No file object from event. input.value:", fileInput?.value);
      return;
    }

    // Store immediately
    loadFileToPreview(file, statusEl, previewEl);
  }

  // ----------------------------
  // Boot
  // ----------------------------
  function init() {
    const fileInput = findFileInput();
    if (!fileInput) {
      console.warn("[TapNS:upload] No file input found on page.");
      return;
    }

    const container = findUploadBlockNearInput(fileInput);
    const { statusEl, previewEl } = ensureStatusAndPreview(container);

    // iOS: if user selects the same file twice, change event may not fire unless value is cleared.
    const clearValue = () => {
      try {
        fileInput.value = "";
      } catch (_) {}
    };

    // Clear value on interaction so same-file reselect triggers reliably
    fileInput.addEventListener("click", clearValue);
    fileInput.addEventListener("pointerdown", clearValue);
    fileInput.addEventListener("touchstart", clearValue, { passive: true });

    // Listen to BOTH change and input (iOS sometimes prefers one)
    fileInput.addEventListener("change", (e) => handlePick(e, statusEl, previewEl, fileInput));
    fileInput.addEventListener("input", (e) => handlePick(e, statusEl, previewEl, fileInput));

    // Initial state
    setStatus(statusEl, "Add a photo to begin.");
    hidePreview(previewEl);

    log("Uploader initialized. Found file input:", fileInput);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
