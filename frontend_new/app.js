// frontend_new/app.js
// Two pages:
//   - index.html (Upload SEC)
//   - output.html (Output SEC)

(function () {
  const el = (id) => document.getElementById(id);

  const STORAGE_KEY = "SEC_LAST_RESULT_V1";

  const num = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };

  function cleanDir(s) {
    return String(s || "").trim().toUpperCase();
  }

  // dx: +RIGHT / -LEFT
  // dy: +UP / -DOWN
  function dirFromSign(axis, value) {
    const v = num(value);
    if (v === 0) return "";
    if (axis === "x") return v > 0 ? "RIGHT" : "LEFT";
    return v > 0 ? "UP" : "DOWN";
  }

  // Accept multiple backend response shapes
  function extractDxDyAndDirs(apiData) {
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

    const windDir =
      apiData?.directions?.windage ??
      apiData?.direction?.windage ??
      apiData?.windage_direction ??
      apiData?.windDir ??
      apiData?.windageDir ??
      "";

    const elevDir =
      apiData?.directions?.elevation ??
      apiData?.direction?.elevation ??
      apiData?.elevation_direction ??
      apiData?.elevDir ??
      apiData?.elevationDir ??
      "";

    return {
      dx: num(dx),
      dy: num(dy),
      windDir: cleanDir(windDir),
      elevDir: cleanDir(elevDir),
    };
  }

  // Create SEC Identifier (simple, stable)
  // Example: SEC-250111-1432-7K3P
  function makeSecId() {
    const d = new Date();
    const yy = String(d.getFullYear()).slice(-2);
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const hh = String(d.getHours()).padStart(2, "0");
    const mi = String(d.getMinutes()).padStart(2, "0");
    const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
    return `SEC-${yy}${mm}${dd}-${hh}${mi}-${rand}`;
  }

  function setStatus(statusEl, msg, isErr) {
    if (!statusEl) return;
    statusEl.textContent = msg || "";
    statusEl.classList.toggle("err", !!isErr);
  }

  /* =========================
     PAGE: UPLOAD (index.html)
     ========================= */
  async function initUploadPage() {
    const fileEl = el("file");
    const yardsEl = el("yards");
    const pressBtn = el("pressBtn");
    const thumb = el("thumb");
    const status = el("status");
    const buyBtn = el("buyBtn");
    const barTop = document.querySelector(".barTop");

    if (!fileEl || !pressBtn || !yardsEl) return;

    // Clicking the top bar opens the file picker (keeps your wording on the UI)
    if (barTop) {
      barTop.style.cursor = "pointer";
      barTop.addEventListener("click", () => fileEl.click());
    }

    // Also allow clicking thumbnail area to choose file
    const thumbWrap = document.querySelector(".thumbWrap");
    if (thumbWrap) {
      thumbWrap.style.cursor = "pointer";
      thumbWrap.addEventListener("click", () => fileEl.click());
    }

    fileEl.addEventListener("change", () => {
      const f = fileEl.files && fileEl.files[0];
      if (f) {
        const u = URL.createObjectURL(f);
        thumb.src = u;
        // Don’t revoke yet; we need it on output page
        setStatus(status, "", false);
      }
    });

    // “BUY MORE TARGETS” placeholder
    if (buyBtn) {
      buyBtn.addEventListener("click", () => {
        // Pilot behavior: do nothing or open later.
        // For now: no-op.
      });
    }

    pressBtn.addEventListener("click", async () => {
      try {
        setStatus(status, "", false);

        const f = fileEl.files && fileEl.files[0];
        if (!f) {
          setStatus(status, "Pick a photo first.", true);
          fileEl.click();
          return;
        }

        const yards = Number(yardsEl.value) || 100;

        pressBtn.disabled = true;

        // Analyze
        const apiData = await window.postAnalyze(f, yards);

        // Save result for output page
        const secId = makeSecId();

        // Keep the SAME object URL so output can render it
        const objectUrl = thumb?.src || URL.createObjectURL(f);

        const payload = {
          sec_id: secId,
          yards,
          objectUrl,
          apiData
        };

        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload));

        // Go to output
        window.location.href = "./output.html";
      } catch (e) {
        setStatus(status, e?.message || String(e), true);
      } finally {
        pressBtn.disabled = false;
      }
    });
  }

  /* =========================
     PAGE: OUTPUT (output.html)
     ========================= */
  function initOutputPage() {
    const secIdEl = el("secId");
    const windDirEl = el("windDir");
    const elevDirEl = el("elevDir");
    const thumb = el("thumb");
    const status = el("status");
    const doAnother = el("doAnother");
    const buyBtn = el("buyBtn");

    // Load saved payload
    let payload = null;
    try {
      payload = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || "null");
    } catch (e) {
      payload = null;
    }

    if (!payload) {
      setStatus(status, "No SEC data found. Start over.", true);
      if (doAnother) doAnother.addEventListener("click", () => (window.location.href = "./index.html"));
      return;
    }

    const { sec_id, yards, objectUrl, apiData } = payload;

    if (secIdEl) secIdEl.textContent = sec_id || "SEC-0000";
    if (thumb && objectUrl) thumb.src = objectUrl;

    // Extract correction
    const { dx, dy, windDir, elevDir } = extractDxDyAndDirs(apiData);

    // Convert inches -> clicks (True MOA, 0.25 per click)
    const windClicks = window.clicksFromInches(Math.abs(dx), yards);
    const elevClicks = window.clicksFromInches(Math.abs(dy), yards);

    // Direction words
    const finalWindDir = windDir || dirFromSign("x", dx) || "—";
    const finalElevDir = elevDir || dirFromSign("y", dy) || "—";

    // Display exactly like your output mock: direction only in the box
    if (windDirEl) windDirEl.textContent = `${windClicks.toFixed(2)} ${finalWindDir}`.trim();
    if (elevDirEl) elevDirEl.textContent = `${elevClicks.toFixed(2)} ${finalElevDir}`.trim();

    if (buyBtn) {
      buyBtn.addEventListener("click", () => {
        // Pilot behavior: no-op for now.
      });
    }

    if (doAnother) {
      doAnother.addEventListener("click", () => {
        // Clear last result but keep nothing visible
        sessionStorage.removeItem(STORAGE_KEY);
        window.location.href = "./index.html";
      });
    }

    setStatus(status, "", false);
  }

  // Auto-detect page by DOM
  window.addEventListener("DOMContentLoaded", () => {
    if (document.body && document.querySelector(".stage-upload")) initUploadPage();
    if (document.body && document.querySelector(".stage-output")) initOutputPage();
  });
})();
