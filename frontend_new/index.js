(() => {
  const $ = (id) => document.getElementById(id);

  const btnPick = $("btnPick");
  const fileInput = $("fileInput");
  const distance = $("distance");
  const thumbImg = $("thumbImg");
  const thumbEmpty = $("thumbEmpty");
  const btnGenerate = $("btnGenerate");
  const status = $("status");

  // Change this ONLY if your backend is on a different domain:
  // Example: const API_BASE = "https://YOUR-BACKEND.onrender.com";
  const API_BASE = ""; // same-origin (or leave blank to disable backend calls)

  let lastThumbDataUrl = "";
  let lastFullBlob = null;

  function setStatus(msg, kind = "") {
    status.textContent = msg || "";
    status.className = "status " + (kind ? `status_${kind}` : "");
  }

  function readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = reject;
      r.readAsDataURL(file);
    });
  }

  async function downscaleToJpegBlob(dataUrl, maxW = 1400, quality = 0.85) {
    const img = new Image();
    img.src = dataUrl;
    await new Promise((res, rej) => {
      img.onload = res;
      img.onerror = rej;
    });

    const ratio = Math.min(1, maxW / img.naturalWidth);
    const w = Math.round(img.naturalWidth * ratio);
    const h = Math.round(img.naturalHeight * ratio);

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0, w, h);

    return new Promise((resolve) => {
      canvas.toBlob((blob) => resolve(blob), "image/jpeg", quality);
    });
  }

  async function makeThumbnailDataUrl(dataUrl, maxW = 900, quality = 0.8) {
    const img = new Image();
    img.src = dataUrl;
    await new Promise((res, rej) => {
      img.onload = res;
      img.onerror = rej;
    });

    const ratio = Math.min(1, maxW / img.naturalWidth);
    const w = Math.round(img.naturalWidth * ratio);
    const h = Math.round(img.naturalHeight * ratio);

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0, w,
