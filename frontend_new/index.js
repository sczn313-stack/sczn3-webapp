/* ============================================================================
  Tap-N-Score — iOS Safari file picker "doesn't stick" debug-hardened index.js
  This version proves whether THIS index.js is running by showing a banner
  and prints file diagnostics on screen immediately when a file is selected.

  If you DO NOT see the red "INDEX.JS LOADED" banner:
    - You're not loading this file (wrong path/build), OR caching/service worker.
============================================================================ */

(() => {
  // ----------------------------
  // PROOF BANNER (if you don't see this, your JS isn't running)
  // ----------------------------
  const banner = document.createElement("div");
  banner.textContent = "INDEX.JS LOADED (Tap-N-Score) — vDEBUG-1";
  banner.style.position = "fixed";
  banner.style.left = "10px";
  banner.style.right = "10px";
  banner.style.bottom = "10px";
  banner.style.zIndex = "999999";
  banner.style.padding = "10px 12px";
  banner.style.borderRadius = "10px";
  banner.style.fontFamily = "system-ui, -apple-system, Segoe UI, Roboto, Arial";
  banner.style.fontSize = "14px";
  banner.style.background = "rgba(200,0,0,0.85)";
  banner.style.color = "white";
  banner.style.boxShadow = "0 10px 30px rgba(0,0,0,0.35)";
  document.addEventListener("DOMContentLoaded", () => document.body.appendChild(banner));

  // ----------------------------
  // Find elements WITHOUT relying on IDs
  // ----------------------------
  function qs(sel, root = document) {
    return root.querySelector(sel);
  }
  function qsa(sel, root = document) {
    return Array.from(root.querySelectorAll(sel));
  }

  // File input: first <input type="file">
  const fileInput = qs('input[type="file"]');

  // Distance input: best effort
  const distanceInput =
    qs('input#distance') ||
    qsa("input").find((i) => (i.placeholder || "").toLowerCase().includes("distance")) ||
    qsa("input").find((i) => (i.value || "").match(/^\d+$/) && (i.previousElementSibling?.textContent || "").toLowerCase().includes("distance"));

  // Status line: element that contains "Add a photo to begin."
  const statusEl = qsa("div, p, span, h1, h2, h3, h4, h5, h6")
    .find((el) => (el.textContent || "").trim() === "Add a photo to begin.");

  // Taps counter: element containing "Taps:"
  const tapsLineEl = qsa("div, p, span").find((el) => (el.textContent || "").includes("Taps:"));

  // Clear button: button with text "Clear"
  const clearBtn = qsa("button").find((b) => (b.textContent || "").trim().toLowerCase() === "clear");

  // Create our own preview + debug area (does not depend on your HTML)
  const debugWrap = document.createElement("div");
  debugWrap.style.marginTop = "14px";
  debugWrap.style.padding = "12px";
  debugWrap.style.borderRadius = "12px";
  debugWrap.style.background = "rgba(255,255,255,0.06)";
  debugWrap.style.border = "1px solid rgba(255,255,255,0.10)";
  debugWrap.style.backdropFilter = "blur(4px)";

  const debugText = document.createElement("div");
  debugText.style.whiteSpace = "pre-wrap";
  debugText.style.fontFamily = "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";
  debugText.style.fontSize = "12px";
  debugText.style.opacity = "0.95";
  debugText.style.color = "white";

  const previewImg = document.createElement("img");
  previewImg.style.display = "none";
  previewImg.style.maxWidth = "100%";
  previewImg.style.borderRadius = "12px";
  previewImg.style.marginTop = "10px";
  previewImg.alt = "Selected preview";

  debugWrap.appendChild(debugText);
  debugWrap.appendChild(previewImg);

  function setDebug(msg) {
    debugText.textContent = msg;
  }

  function setStatus(msg) {
    if (statusEl) statusEl.textContent = msg;
  }

  let selectedFile = null;
  let objectUrl = null;

  // Attach debug UI under the upload area:
  // Try: place it after file input, else append to body.
  function mountDebugUI() {
    if (fileInput && fileInput.parentElement) {
      // put after file input block
      const parent = fileInput.parentElement;
      parent.appendChild(debugWrap);
      return;
    }
    document.body.appendChild(debugWrap);
  }

  function clearPreview() {
    selectedFile = null;
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
      objectUrl = null;
    }
    previewImg.src = "";
    previewImg.style.display = "none";
  }

  function handleFileEvent(e, eventName) {
    const file = e?.target?.files?.[0] || null;

    // Print event diagnostics
    let msg = `FILE EVENT: ${eventName}\n`;
    msg += `input exists: ${!!fileInput}\n`;
    msg += `statusEl found: ${!!statusEl}\n`;
    msg += `files length: ${e?.target?.files?.length ?? "n/a"}\n`;

    if (!file) {
      msg += `\nRESULT: NO FILE OBJECT RECEIVED.\n`;
      msg += `This usually means:\n`;
      msg += `- iOS picker glitch, OR\n`;
      msg += `- input was replaced/re-rendered, OR\n`;
      msg += `- change event never fired on the real input.\n`;
      setDebug(msg);
      setStatus("No photo loaded. Tap Choose File again.");
      clearPreview();
      return;
    }

    selectedFile = file;

    msg += `\nRESULT: FILE RECEIVED ✅\n`;
    msg += `name: ${file.name}\n`;
    msg += `type: ${file.type}\n`;
    msg += `size: ${file.size} bytes\n`;
    msg += `lastModified: ${file.lastModified}\n`;

    setDebug(msg);
    setStatus(`Loaded: ${file.name}`);

    // Preview via object URL (fast / iOS-safe)
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = URL.createObjectURL(file);
    previewImg.src = objectUrl;
    previewImg.style.display = "block";
  }

  function init() {
    mountDebugUI();

    // Initial debug
    setDebug(
      `INIT\n` +
      `fileInput found: ${!!fileInput}\n` +
      `statusEl found: ${!!statusEl}\n` +
      `clearBtn found: ${!!clearBtn}\n` +
      `tapsLine found: ${!!tapsLineEl}\n`
    );

    if (!fileInput) {
      setStatus("ERROR: No file input found on page.");
      return;
    }

    // IMPORTANT: listen to BOTH change and input for iOS weirdness
    fileInput.addEventListener("change", (e) => handleFileEvent(e, "change"));
    fileInput.addEventListener("input", (e) => handleFileEvent(e, "input"));

    // Clear
    if (clearBtn) {
      clearBtn.addEventListener("click", () => {
        // If you clear file input value, user can re-select same photo
        fileInput.value = "";
        clearPreview();
        setStatus("Add a photo to begin.");
        setDebug("CLEARED\n");
      });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
