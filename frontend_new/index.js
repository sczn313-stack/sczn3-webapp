/* index.js
   Upload SEC (input page) — MOCK MATCH
   - Only upload trigger: top-right .hdrBox
   - Hidden <input id="file"> is clicked programmatically
   - PRESS TO SEE goes to output.html after file is selected
   - Stores thumbnail + yards + backend results in sessionStorage
*/

(() => {
  const el = (id) => document.getElementById(id);
  const $ = (sel) => document.querySelector(sel);

  const fileInput = el("file");     // hidden input (display:none in HTML)
  const seeBtn = el("seeBtn");
  const statusEl = el("status");
  const yardsEl = el("yards");

  const hdrBox = $(".hdrBox");      // top-right upload box

  // --- thumbnail settings ---
  const THUMB_MAX_W = 420;
  const THUMB_QUALITY = 0.82;

  function setStatus(msg) {
    if (statusEl) statusEl.textContent = msg || "";
  }

  // Floating thumbnail preview (safe; doesn’t change layout)
  function ensureThumbPreviewEl() {
    let img = el("thumbPreview");
    if (img) return img;

    img = document.createElement("img");
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
    return img;
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

  function openPicker() {
    if (!fileInput) {
      setStatus("File input not found (id='file').");
      return;
    }
    fileInput.click();
  }

  async function onFilePicked() {
    const file = fileInput?.files?.[0];
    if (!file) {
      sessionStorage.removeItem("sczn3_thumb");
      setStatus("");
      return;
    }

    setStatus("Photo selected.");

    try {
      const thumbDataUrl = await fileToThumbDataUrl(file);
      sessionStorage.setItem("sczn3_thumb", thumbDataUrl);
      sessionStorage.setItem("sczn3_thumb_ts", String(Date.now()));

      ensureThumbPreviewEl().src = thumbDataUrl;
    } catch (e) {
      console.error(e);
      setStatus("Could not read photo. Try another picture.");
    }
  }

  async function onPressToSee() {
    const file = fileInput?.files?.[0];
    if (!file) {
      setStatus("Tap the top-right upload button first.");
      return;
    }

    const yards = Number(yardsEl?.value || 100);
    sessionStorage.setItem("sczn3_yards", String(yards));

    setStatus("Generating…");

    try {
      // Prefer your real backend function if present:
      // - window.api.uploadAndScore(file, yards)
      // - OR window.uploadAndScore(file, yards)
      let result = null;

      if (window.api && typeof window.api.uploadAndScore === "function") {
        result = await window.api.uploadAndScore(file, yards);
      } else if (typeof window.uploadAndScore === "function") {
        result = await window.uploadAndScore(file, yards);
      } else {
        // Temporary stub so you can verify navigation + layout now
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
    } catch (e) {
      console.error(e);
      setStatus("Generate failed. Check backend / network.");
    }
  }

  // ---- wire events ----
  if (hdrBox) {
    hdrBox.style.cursor = "pointer";
    hdrBox.addEventListener("click", openPicker);
  } else {
    setStatus("Top-right upload box not found (.hdrBox).");
  }

  if (fileInput) fileInput.addEventListener("change", onFilePicked);
  if (seeBtn) seeBtn.addEventListener("click", onPressToSee);

  // restore existing thumb (if user went back)
  const existingThumb = sessionStorage.getItem("sczn3_thumb");
  if (existingThumb) ensureThumbPreviewEl().src = existingThumb;

  setStatus("");
})();
