/* index.js (LOCKED UI ROUTE)
   - ONLY active upload trigger = top-right header bar
   - center upload label is VISIBLE but DISABLED (no click)
   - PRESS TO SEE sends to output.html after file selected
   - thumbnail preview stored in sessionStorage
*/

(() => {
  // ====== CONFIG ======
  const THUMB_MAX_W = 420;
  const THUMB_QUALITY = 0.82;

  // ====== HELPERS ======
  const $ = (sel) => document.querySelector(sel);
  const el = (id) => document.getElementById(id);

  const fileInput = el("file");         // hidden <input type=file>
  const seeBtn = el("seeBtn");
  const statusEl = el("status");
  const yardsEl = el("yards");

  // Top-right header upload box:
  const topRightUploadBox = $(".hdrBox");

  // Center upload label:
  const centerUploadLabel = $(".fileBtn");

  let thumbPreview = el("thumbPreview"); // optional if you add it later

  function setStatus(msg) {
    if (statusEl) statusEl.textContent = msg || "";
  }

  function ensureThumbPreviewEl() {
    if (thumbPreview) return thumbPreview;

    // Safe floating preview (doesn't disturb layout)
    const img = document.createElement("img");
    img.id = "thumbPreview";
    img.alt = "TARGET THUMBNAIL";
    img.style.position = "fixed";
    img.style.right = "16px";
    img.style.bottom = "16px";
    img.style.width = "140px";
    img.style.height = "auto";
    img.style.border = "2px solid rgba(0,0,0,0.2)";
    img.style.background = "#fff";
    img.style.boxShadow = "0 8px 20px rgba(0,0,0,0.25)";
    img.style.borderRadius = "6px";
    img.style.zIndex = "9999";
    document.body.appendChild(img);

    thumbPreview = img;
    return thumbPreview;
  }

  async function fileToThumbDataUrl(file) {
    const imgUrl = URL.createObjectURL(file);
    try {
      const img = await new Promise((resolve, reject) => {
        const i = new Image();
        i.onload = () => resolve(i);
        i.onerror = reject;
        i.src = imgUrl;
      });

      const scale = Math.min(1, THUMB_MAX_W / img.naturalWidth);
      const w = Math.max(1, Math.round(img.naturalWidth * scale));
      const h = Math.max(1, Math.round(img.naturalHeight * scale));

      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;

      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, w, h);

      return canvas.toDataURL("image/jpeg", THUMB_QUALITY);
    } finally {
      URL.revokeObjectURL(imgUrl);
    }
  }

  async function handleFilePicked() {
    const file = fileInput?.files?.[0];
    if (!file) {
      sessionStorage.removeItem("sczn3_thumb");
      return;
    }

    setStatus("Photo selected.");

    try {
      const thumbDataUrl = await fileToThumbDataUrl(file);
      sessionStorage.setItem("sczn3_thumb", thumbDataUrl);
      sessionStorage.setItem("sczn3_thumb_ts", String(Date.now()));

      const img = ensureThumbPreviewEl();
      img.src = thumbDataUrl;
    } catch (err) {
      console.error(err);
      setStatus("Could not read photo. Try another picture.");
    }
  }

  // ====== ONLY ACTIVE UPLOAD TRIGGER ======
  function openFilePicker() {
    if (!fileInput) return;
    fileInput.click();
  }

  // Make top-right hdrBox clickable upload trigger
  if (topRightUploadBox) {
    topRightUploadBox.style.cursor = "pointer";
    topRightUploadBox.addEventListener("click", openFilePicker);
  }

  // Disable center upload label (keep visible)
  if (centerUploadLabel) {
    // Remove default "for=file" behavior and block clicks
    centerUploadLabel.removeAttribute("for");
    centerUploadLabel.style.cursor = "not-allowed";
    centerUploadLabel.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      setStatus("Use the top-right upload button.");
    });
  }

  // File input change
  if (fileInput) fileInput.addEventListener("change", handleFilePicked);

  // ====== PRESS TO SEE ======
  async function handlePressToSee() {
    const file = fileInput?.files?.[0];
    if (!file) {
      setStatus("Tap the top-right upload button first.");
      return;
    }

    const yards = Number(yardsEl?.value || 100);
    sessionStorage.setItem("sczn3_yards", String(yards));

    setStatus("Generating…");

    try {
      // Prefer real backend hook if present
      let result = null;

      if (window.api && typeof window.api.uploadAndScore === "function") {
        result = await window.api.uploadAndScore(file, yards);
      } else if (window.uploadAndScore && typeof window.uploadAndScore === "function") {
        result = await window.uploadAndScore(file, yards);
      } else {
        // temporary stub to verify flow
        result = {
          secId: `SEC-ID ${String(Math.floor(Math.random() * 900) + 100).padStart(3, "0")}`,
          lastScore: "Last Score: 0",
          avgScore: "Avg Score: 0",
          windLine: "WINDAGE: —",
          elevLine: "ELEVATION: —",
          tips: "TIP: (backend not connected yet)",
          vendorUrl: "#",
        };
      }

      sessionStorage.setItem("sczn3_secId", result?.secId || "");
      sessionStorage.setItem("sczn3_lastScore", result?.lastScore || "");
      sessionStorage.setItem("sczn3_avgScore", result?.avgScore || "");
      sessionStorage.setItem("sczn3_windLine", result?.windLine || "");
      sessionStorage.setItem("sczn3_elevLine", result?.elevLine || "");
      sessionStorage.setItem("sczn3_tips", result?.tips || "");
      sessionStorage.setItem("sczn3_vendorUrl", result?.vendorUrl || "#");

      window.location.href = "./output.html";
    } catch (err) {
      console.error(err);
      setStatus("Generate failed. Check backend / network.");
    }
  }

  if (seeBtn) seeBtn.addEventListener("click", handlePressToSee);

  // Restore existing thumb if present
  const existingThumb = sessionStorage.getItem("sczn3_thumb");
  if (existingThumb) {
    const img = ensureThumbPreviewEl();
    img.src = existingThumb;
  }

  setStatus("");
})();
