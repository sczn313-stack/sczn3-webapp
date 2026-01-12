// frontend_new/index.js

(function () {
  const el = (id) => document.getElementById(id);

  const fileEl = el("file");
  const yardsEl = el("yards");
  const seeBtn = el("seeBtn");
  const status = el("status");
  const vendorBtn = el("vendorBtn");

  function setStatus(msg, isError = false) {
    status.textContent = msg || "";
    status.classList.toggle("err", !!isError);
  }

  function setBusy(b) {
    seeBtn.disabled = !!b;
    seeBtn.textContent = b ? "PRESS TO SEE..." : "PRESS TO SEE";
  }

  // Placeholder vendor link (you can set per-printer later)
  vendorBtn.addEventListener("click", (e) => {
    if (vendorBtn.getAttribute("href") === "#") e.preventDefault();
  });

  async function fileToDataURL(file) {
    return new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(String(fr.result || ""));
      fr.onerror = () => reject(new Error("File read failed"));
      fr.readAsDataURL(file);
    });
  }

  // Robust dx/dy extraction (supports multiple response shapes)
  function extractDxDy(apiData) {
    const dx =
      apiData?.correction_in?.dx ??
      apiData?.correctionIn?.dx ??
      apiData?.correction_inches?.dx ??
      apiData?.correction?.dx ??
      apiData?.delta_in?.dx ??
      apiData?.dx ??
      apiData?.windage_in ??
      apiData?.wind_in ??
      0;

    const dy =
      apiData?.correction_in?.dy ??
      apiData?.correctionIn?.dy ??
      apiData?.correction_inches?.dy ??
      apiData?.correction?.dy ??
      apiData?.delta_in?.dy ??
      apiData?.dy ??
      apiData?.elevation_in ??
      apiData?.elev_in ??
      0;

    return { dx: Number(dx) || 0, dy: Number(dy) || 0 };
  }

  // dx: +RIGHT / -LEFT
  // dy: +UP / -DOWN
  function dirFromSign(axis, value) {
    const v = Number(value) || 0;
    if (v === 0) return "";
    if (axis === "x") return v > 0 ? "RIGHT" : "LEFT";
    return v > 0 ? "UP" : "DOWN";
  }

  // SEC-ID counter (3-digit padded)
  function nextSecId() {
    const key = "SEC_ID_COUNTER";
    const n = Number(localStorage.getItem(key) || "0") + 1;
    localStorage.setItem(key, String(n));
    return String(n).padStart(3, "0");
  }

  // Offset-only scoring (pilot): smallest offset = best
  // Score = clamp(100 - offsetInches * 10, 0..100)
  function computeScore(dx, dy) {
    const offset = Math.sqrt(dx * dx + dy * dy);
    let score = 100 - offset * 10;
    if (score < 0) score = 0;
    if (score > 100) score = 100;
    return Math.round(score * 100) / 100;
  }

  async function onPressToSee() {
    try {
      setStatus("");

      const f = fileEl.files && fileEl.files[0];
      if (!f) {
        setStatus("Pick a photo first.", true);
        return;
      }

      const yards = Number(yardsEl.value) || 100;

      setBusy(true);

      // 1) Call backend
      const apiData = await window.SEC_API.postAnalyze(f, yards);

      // 2) Extract dx/dy
      const { dx, dy } = extractDxDy(apiData);

      // 3) Convert inches -> clicks
      const windClicks = window.SEC_API.clicksFromInches(Math.abs(dx), yards);
      const elevClicks = window.SEC_API.clicksFromInches(Math.abs(dy), yards);

      // 4) Directions (derived from sign)
      const windDir = dirFromSign("x", dx) || "LEFT";
      const elevDir = dirFromSign("y", dy) || "UP";

      // 5) Score (offset-only pilot)
      const score = computeScore(dx, dy);

      // 6) Thumbnail (dataURL so it survives page switch)
      const thumbDataUrl = await fileToDataURL(f);

      // 7) SEC-ID
      const secId = nextSecId();

      // 8) Store payload for output.html
      const payload = {
        secId,
        yards,
        dx,
        dy,
        windClicks,
        elevClicks,
        windDir,
        elevDir,
        score,
        thumbDataUrl,
        // vendor placeholders (set later per printer)
        vendorUrl: "#",
        vendorLogoText: "Vendor logo",
      };

      sessionStorage.setItem("SEC_PAYLOAD", JSON.stringify(payload));
      window.location.href = "./output.html";
    } catch (err) {
      setStatus(String(err && err.message ? err.message : err), true);
    } finally {
      setBusy(false);
    }
  }

  seeBtn.addEventListener("click", onPressToSee);

  // start
  setStatus("");
})();
