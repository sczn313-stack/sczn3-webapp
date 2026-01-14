/* frontend_new/index.js
   Vanilla JS (iOS-safe) for:
   - Upload button (label -> hidden file input)
   - Thumbnail preview after selecting a photo
   - Distance input validation (keeps it editable)
   - Enable "PRESS TO SEE" only after a valid photo is selected
*/

(() => {
  "use strict";

  // ---------- helpers ----------
  const $ = (id) => document.getElementById(id);

  function setPressToSeeEnabled(enabled) {
    const btn = $("pressToSee");
    if (!btn) return;

    if (enabled) {
      btn.classList.remove("disabled");
      btn.style.pointerEvents = "auto";
      btn.style.opacity = "1";
      btn.setAttribute("aria-disabled", "false");
    } else {
      btn.classList.add("disabled");
      btn.style.pointerEvents = "none";
      btn.style.opacity = "0.6";
      btn.setAttribute("aria-disabled", "true");
    }
  }

  function sanitizeDistance(raw) {
    // Keep user typing fluid; only sanitize on blur/change
    const n = Number(String(raw ?? "").trim());
    if (!Number.isFinite(n)) return 100;
    const rounded = Math.round(n);
    return Math.max(1, rounded);
  }

  function showThumbFromFile(file) {
    const thumb = $("thumb");
    if (!thumb) return;

    if (!file) {
      thumb.removeAttribute("src");
      thumb.style.display = "none";
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    thumb.onload = () => {
      // Release memory after image loads
      URL.revokeObjectURL(objectUrl);
    };
    thumb.src = objectUrl;
    thumb.style.display = "block";
  }

  // ---------- elements ----------
  const fileInput = $("targetPhoto");
  const uploadLabel = $("uploadLabel");
  const distanceInput = $("distanceYards");
  const buyMoreBtn = $("buyMoreBtn");
  const pressToSeeBtn = $("pressToSee");

  // ---------- state ----------
  let selectedFile = null;

  // ---------- init ----------
  setPressToSeeEnabled(false);

  // Ensure label reliably opens file picker even on iOS (label-for is usually enough,
  // but this makes it extra consistent in odd webviews).
  if (uploadLabel && fileInput) {
    uploadLabel.addEventListener("click", (e) => {
      // If label-for works, this is redundant; if not, it saves the day.
      // Prevent double triggers in some browsers by not calling preventDefault unless needed.
      try {
        fileInput.click();
      } catch (_) {
        // ignore
      }
    });
  }

  // Handle file selection + preview
  if (fileInput) {
    fileInput.addEventListener("change", () => {
      const file = fileInput.files && fileInput.files[0] ? fileInput.files[0] : null;

      if (!file) {
        selectedFile = null;
        showThumbFromFile(null);
        setPressToSeeEnabled(false);
        return;
      }

      // Basic type guard
      if (!file.type || !file.type.startsWith("image/")) {
        selectedFile = null;
        showThumbFromFile(null);
        setPressToSeeEnabled(false);
        alert("Please choose an image file.");
        return;
      }

      selectedFile = file;
      showThumbFromFile(file);
      setPressToSeeEnabled(true);
    });
  }

  // Distance input: keep editable, sanitize only on blur/change
  if (distanceInput) {
    distanceInput.addEventListener("blur", () => {
      distanceInput.value = String(sanitizeDistance(distanceInput.value));
    });

    distanceInput.addEventListener("change", () => {
      distanceInput.value = String(sanitizeDistance(distanceInput.value));
    });
  }

  // BUY MORE TARGETS — set your real destination here
  if (buyMoreBtn) {
    buyMoreBtn.addEventListener("click", (e) => {
      e.preventDefault();

      // TODO: Replace this URL with the printer/manufacturer page or dynamic partner URL.
      // Example:
      // window.location.href = "https://example.com/buy-more-targets";
      alert("Buy More Targets link not set yet.");
    });
  }

  // PRESS TO SEE — this is where your upload/analyze flow plugs in
  if (pressToSeeBtn) {
    pressToSeeBtn.addEventListener("click", async (e) => {
      e.preventDefault();

      if (!selectedFile) {
        setPressToSeeEnabled(false);
        alert("Upload a target photo first.");
        return;
      }

      const distanceYards = sanitizeDistance(distanceInput ? distanceInput.value : 100);

      // If you already have a backend endpoint, wire it here.
      // This placeholder keeps the UI behavior stable without guessing your API.
      //
      // Example pattern (ONLY if you have an endpoint):
      // const form = new FormData();
      // form.append("image", selectedFile);
      // form.append("distanceYards", String(distanceYards));
      // const res = await fetch("YOUR_BACKEND_URL/analyze", { method: "POST", body: form });
      // const data = await res.json();
      // window.location.href = `/result.html?id=${encodeURIComponent(data.id)}`;

      alert(
        `Ready to analyze.\n\nPhoto: ${selectedFile.name}\nDistance: ${distanceYards} yards\n\nNext step: connect this button to your backend analyze endpoint.`
      );
    });
  }
})();
