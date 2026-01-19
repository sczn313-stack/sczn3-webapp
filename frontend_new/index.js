/* ============================================================================
  Tap-N-Score — iOS Safari file picker "filename shows but file not loaded" FIX
  FULL replacement index.js

  What this does:
  - Proves this file is running (red banner)
  - Adds a debug panel
  - Fixes iOS timing bug by retry-reading input.files after the picker closes
============================================================================ */

(() => {
  // ----------------------------
  // PROOF BANNER
  // ----------------------------
  const banner = document.createElement("div");
  banner.textContent = "INDEX.JS LOADED (Tap-N-Score) — vDEBUG-2 (iOS retry fix)";
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
  // Helpers
  // ----------------------------
  function qs(sel, root = document) {
    return root.querySelector(sel);
  }
  function qsa(sel, root = document) {
    return Array.from(root.querySelectorAll(sel));
  }

  const fileInput = qs('input[type="file"]');
  const statusEl = qsa("div, p, span, h1, h2, h3, h4, h5, h6")
    .find((el) => (el.textContent || "").trim() === "Add a photo to begin.");
  const clearBtn = qsa("button").find((b) => (b.textContent || "").trim().toLowerCase() === "clear");
  const tapsLineEl = qsa("div, p, span").find((el) => (el.textContent || "").includes("Taps:"));

  // Debug UI (we inject it)
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

  function mountDebugUI() {
    if (fileInput && fileInput.parentElement) {
      fileInput.parentElement.appendChild(debugWrap);
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

  // ----------------------------
  // KEY FIX: iOS retry-read of input.files
  // ----------------------------
  async function getFileWithRetry(inputEl, delaysMs) {
    for (const d of delaysMs) {
      if (d > 0) await new Promise((r) => setTimeout(r, d));
      const f = inputEl?.files?.[0] || null;
      if (f) return f;
    }
    return null;
  }

  async function handleFileEvent(e, eventName) {
    // IMPORTANT: don't trust file availability immediately on iOS
    const inputEl = e?.target;

    let msg = `FILE EVENT: ${eventName}\n`;
    msg += `input exists: ${!!fileInput}\n`;
    msg += `statusEl found: ${!!statusEl}\n`;
    msg += `initial files length: ${inputEl?.files?.length ?? "n/a"}\n`;

    // retry schedule tuned for iOS Safari timing weirdness
    const file = await getFileWithRetry(inputEl, [0, 50, 250, 800]);

    msg += `after retry files length: ${inputEl?.files?.length ?? "n/a"}\n`;

    if (!file) {
      msg += `\nRESULT: NO FILE OBJECT AFTER RETRIES ❌\n`;
      msg += `Likely causes:\n`;
      msg += `- iOS picker returned but did not commit selection\n`;
      msg += `- another script replaced the <input type="file"> after selection\n`;
      msg += `- page navigated/re-rendered immediately after picker close\n`;
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

    // Preview (object URL)
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = URL.createObjectURL(file);
    previewImg.src = objectUrl;
    previewImg.style.display = "block";
  }

  function init() {
    mountDebugUI();

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

    // extra: show when picker is opened
    fileInput.addEventListener("click", () => {
      setDebug((debugText.textContent || "") + "\nPICKER OPENED (click)\n");
    });

    // Listen tell iOS every possible way
    fileInput.addEventListener("change", (e) => handleFileEvent(e, "change"));
    fileInput.addEventListener("input", (e) => handleFileEvent(e, "input"));

    if (clearBtn) {
      clearBtn.addEventListener("click", () => {
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
