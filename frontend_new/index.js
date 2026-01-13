// frontend_new/index.js
// Upload SEC logic (Upload page)
//
// What this file does:
// 1) iOS-safe upload button behavior (button click -> file input click)
// 2) Shows thumbnail preview
// 3) Stores target photo + yards in sessionStorage
// 4) PRESS TO SEE routes to output.html

(function () {
  const el = (id) => document.getElementById(id);

  // Elements from index.html
  const yardsEl = el("yards");
  const uploadBtn = el("uploadBtn");
  const fileInput = el("file");
  const seeBtn = el("seeBtn");
  const statusEl = el("status");
  const thumbEl = el("thumb");

  // -----------------------
  // Helpers
  // -----------------------
  function setStatus(msg, isErr = false) {
    if (!statusEl) return;
    statusEl.textContent = msg || "";
    statusEl.classList.toggle("err", !!isErr);
  }

  function n(v, fallback = 0) {
    const x = Number(v);
    return Number.isFinite(x) ? x : fallback;
  }

  function getYards() {
    const y = n(yardsEl && yardsEl.value, 100);
    return y > 0 ? y : 100;
  }

  function fileToDataURL(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result || ""));
      r.onerror = () => reject(new Error("File read failed"));
      r.readAsDataURL(file);
    });
  }

  // -----------------------
  // State
  // -----------------------
  let selectedFile = null;

  // -----------------------
  // Wire upload button (iOS-safe)
  // -----------------------
  if (uploadBtn && fileInput) {
    uploadBtn.addEventListener("click", () => {
      // iOS requires the picker to open inside a direct user gesture
      fileInput.click();
    });
  }

  // -----------------------
  // When file changes, show thumbnail + store in sessionStorage
  // -----------------------
  if (fileInput) {
    fileInput.addEventListener("change", async () => {
      try {
        setStatus("");

        const file = fileInput.files && fileInput.files[0];
        if (!file) {
          selectedFile = null;
          if (thumbEl) {
            thumbEl.removeAttribute("src");
            thumbEl.style.display = "none";
          }
          return;
        }

        selectedFile = file;

        // Thumbnail preview
        if (thumbEl) {
          thumbEl.src = URL.createObjectURL(file);
          thumbEl.style.display = "block";
        }

        // Persist for output page (store base64 so output page can render same image)
        const dataUrl = await fileToDataURL(file);
        sessionStorage.setItem("SEC_TARGET_DATAURL", dataUrl);
        sessionStorage.setItem("SEC_YARDS", String(getYards()));

        // Clear any previous output values (fresh run)
        sessionStorage.removeItem("SEC_RESULT_JSON");
        sessionStorage.removeItem("SEC_LAST_SCORE");
        sessionStorage.removeItem("SEC_AVG_SCORE");
        sessionStorage.removeItem("SEC_WIND_LINE");
        sessionStorage.removeItem("SEC_ELEV_LINE");
        sessionStorage.removeItem("SEC_TIP");

        setStatus("Photo loaded. Press PRESS TO SEE.");
      } catch (err) {
        setStatus(String(err && err.message ? err.message : err), true);
      }
    });
  }

  // -----------------------
  // Keep yards in sessionStorage whenever changed
  // -----------------------
  if (yardsEl) {
    yardsEl.addEventListener("input", () => {
      sessionStorage.setItem("SEC_YARDS", String(getYards()));
    });
    // Initialize stored value
    sessionStorage.setItem("SEC_YARDS", String(getYards()));
  }

  // -----------------------
  // PRESS TO SEE: validate + go to output page
  // -----------------------
  if (seeBtn) {
    seeBtn.addEventListener("click", () => {
      setStatus("");

      const hasImage =
        !!sessionStorage.getItem("SEC_TARGET_DATAURL") ||
        (fileInput && fileInput.files && fileInput.files.length > 0);

      if (!hasImage) {
        setStatus("Upload target photo first.", true);
        return;
      }

      // ensure yards stored
      sessionStorage.setItem("SEC_YARDS", String(getYards()));

      // go to output page
      window.location.href = "./output.html";
    });
  }

  // -----------------------
  // Init
  // -----------------------
  setStatus("");
})();
