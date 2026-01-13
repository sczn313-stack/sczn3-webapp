/* index.js
   Input page logic:
   - show thumbnail preview immediately after file pick
   - store a small thumbnail in sessionStorage for output.html
   - keep your existing upload/press-to-see flow
*/

(() => {
  // ====== CONFIG ======
  const THUMB_MAX_W = 420;     // thumbnail width (px)
  const THUMB_QUALITY = 0.82;  // jpeg quality

  // ====== ELEMENTS ======
  const fileInput = document.getElementById("file");
  const seeBtn = document.getElementById("seeBtn");
  const statusEl = document.getElementById("status");
  const yardsEl = document.getElementById("yards");
  const vendorBtn = document.getElementById("vendorBtn");

  // Optional: if you add an <img id="thumbPreview"> somewhere, we'll use it.
  // If you don't have it, we will create a floating preview in the corner (no CSS dependency).
  let thumbPreview = document.getElementById("thumbPreview");

  function setStatus(msg) {
    if (statusEl) statusEl.textContent = msg || "";
  }

  function ensureThumbPreviewEl() {
    if (thumbPreview) return thumbPreview;

    // Create a simple preview that won't break your layout.
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
    // Load file into an <img>, then draw scaled to canvas and export jpeg dataURL
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

      // Use jpeg for broad compatibility
      return canvas.toDataURL("image/jpeg", THUMB_QUALITY);
    } finally {
      URL.revokeObjectURL(imgUrl);
    }
  }

  async function handleFilePicked() {
    setStatus("");
    const file = fileInput?.files?.[0];
    if (!file) {
      sessionStorage.removeItem("sczn3_thumb");
      sessionStorage.removeItem("sczn3_thumb_mime");
      return;
    }

    // Generate and store thumbnail for output page
    setStatus("Preparing thumbnail…");
    try {
      const thumbDataUrl = await fileToThumbDataUrl(file);

      sessionStorage.setItem("sczn3_thumb", thumbDataUrl);
      sessionStorage.setItem("sczn3_thumb_mime", "image/jpeg");
      sessionStorage.setItem("sczn3_thumb_ts", String(Date.now()));

      // Show preview immediately
      const img = ensureThumbPreviewEl();
      img.src = thumbDataUrl;

      setStatus("Photo selected.");
    } catch (err) {
      console.error(err);
      setStatus("Could not read photo. Try a different picture.");
    }
  }

  // ====== YOUR EXISTING UPLOAD FLOW HOOK ======
  async function handlePressToSee() {
    const file = fileInput?.files?.[0];
    if (!file) {
      setStatus("Pick a photo first.");
      return;
    }

    // Keep the yards value for output page
    const yards = Number(yardsEl?.value || 100);
    sessionStorage.setItem("sczn3_yards", String(yards));

    setStatus("Uploading…");

    try {
      // ---- If your api.js already has something like api.uploadAndScore(file, yards), call it here.
      // I’m using a safe pattern: prefer window.api.uploadAndScore if present,
      // otherwise just simulate and go to output.html (so thumbnail passing can be verified right now).

      let result = null;

      if (window.api && typeof window.api.uploadAndScore === "function") {
        result = await window.api.uploadAndScore(file, yards);
      } else if (window.uploadAndScore && typeof window.uploadAndScore === "function") {
        // alternate if you exposed it differently
        result = await window.uploadAndScore(file, yards);
      } else {
        // no backend hook yet — simulate minimal output so you can verify output.html fills
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

      // Store output fields for output.html
      sessionStorage.setItem("sczn3_secId", result?.secId || "");
      sessionStorage.setItem("sczn3_lastScore", result?.lastScore || "");
      sessionStorage.setItem("sczn3_avgScore", result?.avgScore || "");
      sessionStorage.setItem("sczn3_windLine", result?.windLine || "");
      sessionStorage.setItem("sczn3_elevLine", result?.elevLine || "");
      sessionStorage.setItem("sczn3_tips", result?.tips || "");
      sessionStorage.setItem("sczn3_vendorUrl", result?.vendorUrl || "#");

      setStatus("Done.");
      window.location.href = "./output.html";
    } catch (err) {
      console.error(err);
      setStatus("Upload failed. Check backend / network.");
    }
  }

  // ====== INIT ======
  if (fileInput) fileInput.addEventListener("change", handleFilePicked);
  if (seeBtn) seeBtn.addEventListener("click", handlePressToSee);

  // Keep vendor button harmless on input page (optional)
  if (vendorBtn) {
    vendorBtn.addEventListener("click", (e) => {
      const url = sessionStorage.getItem("sczn3_vendorUrl") || "#";
      if (!url || url === "#") {
        e.preventDefault();
        setStatus("Vendor link not set yet.");
      }
    });
  }

  // If a thumb already exists in session (coming back), show it
  const existingThumb = sessionStorage.getItem("sczn3_thumb");
  if (existingThumb) {
    const img = ensureThumbPreviewEl();
    img.src = existingThumb;
  }
})();
