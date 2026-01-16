// sczn3-webapp/frontend_new/index.js
// Input page logic (index.html):
// - Pick photo -> show thumbnail preview
// - Store photo + distance in sessionStorage
// - Enable "YOUR SCORE / SCOPE CLICKS / SHOOTING TIPS"
// - Open output.html inside the modal (iframe)

(function () {
  function $(id) {
    return document.getElementById(id);
  }

  const fileInput = $("targetPhoto");
  const thumb = $("thumb");
  const distanceInput = $("distanceYards");

  const buyMoreBtn = $("buyMoreBtn");
  const pressToSee = $("pressToSee");

  // Modal elements
  const overlay = $("secModalOverlay");
  const modalBody = $("secModalBody");
  const modalClose = $("secModalClose");

  // Storage keys (must match output.js)
  const PHOTO_KEY = "sczn3_targetPhoto_dataUrl";
  const NAME_KEY = "sczn3_targetPhoto_fileName";
  const DIST_KEY = "sczn3_distance_yards";
  const BUY_URL_KEY = "sczn3_vendor_buy_url";

  if (!fileInput || !pressToSee) return;

  // ---- Helpers ----
  function enablePressToSee() {
    pressToSee.classList.remove("disabled");
  }

  function disablePressToSee() {
    if (!pressToSee.classList.contains("disabled")) pressToSee.classList.add("disabled");
  }

  function hasPhoto() {
    return !!sessionStorage.getItem(PHOTO_KEY);
  }

  function setThumb(src) {
    if (!thumb) return;
    thumb.src = src;
    thumb.style.display = "block";
  }

  function openModal() {
    if (!overlay || !modalBody) {
      // fallback: if modal markup missing for any reason
      window.location.href = "./output.html";
      return;
    }

    // Clear previous content
    modalBody.innerHTML = "";

    // IFRAME to output.html (keeps your layout clean)
    const iframe = document.createElement("iframe");
    iframe.src = "./output.html";
    iframe.style.width = "100%";
    iframe.style.height = "72vh";
    iframe.style.border = "0";
    iframe.setAttribute("title", "SEC Output");
    modalBody.appendChild(iframe);

    overlay.style.display = "flex";
    overlay.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");
  }

  function closeModal() {
    if (!overlay || !modalBody) return;
    overlay.style.display = "none";
    overlay.setAttribute("aria-hidden", "true");
    modalBody.innerHTML = "";
    document.body.classList.remove("modal-open");
  }

  function saveDistance() {
    if (!distanceInput) return;
    const v = String(distanceInput.value || "").trim();
    if (v) sessionStorage.setItem(DIST_KEY, v);
  }

  // ---- Initialize distance storage ----
  if (distanceInput) {
    // load stored distance if present
    const stored = sessionStorage.getItem(DIST_KEY);
    if (stored && stored !== distanceInput.value) distanceInput.value = stored;

    distanceInput.addEventListener("input", saveDistance);
    distanceInput.addEventListener("change", saveDistance);
    saveDistance();
  }

  // ---- Initialize BUY MORE TARGETS link (optional) ----
  if (buyMoreBtn) {
    const buyUrl = sessionStorage.getItem(BUY_URL_KEY);
    if (buyUrl) buyMoreBtn.href = buyUrl;

    // Prevent "#" jump if no url set yet
    buyMoreBtn.addEventListener("click", (e) => {
      const href = (buyMoreBtn.getAttribute("href") || "").trim();
      if (!href || href === "#") {
        e.preventDefault();
      }
    });
  }

  // ---- On load: if photo already stored, show thumb + enable ----
  if (hasPhoto()) {
    const storedPhoto = sessionStorage.getItem(PHOTO_KEY);
    if (storedPhoto) setThumb(storedPhoto);
    enablePressToSee();
  } else {
    disablePressToSee();
  }

  // ---- File pick -> preview + store ----
  fileInput.addEventListener("change", () => {
    const file = fileInput.files && fileInput.files[0];
    if (!file) return;

    if (!file.type || !file.type.startsWith("image/")) {
      alert("Please choose an image file.");
      fileInput.value = "";
      disablePressToSee();
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e && e.target && e.target.result ? String(e.target.result) : "";
      if (!dataUrl) {
        disablePressToSee();
        return;
      }

      // show preview
      setThumb(dataUrl);

      // store for output page
      try {
        sessionStorage.setItem(PHOTO_KEY, dataUrl);
        sessionStorage.setItem(NAME_KEY, file.name || "target.jpg");
      } catch (err) {
        console.warn("sessionStorage failed:", err);
      }

      // enable results button
      enablePressToSee();

      // IMPORTANT: allow selecting the same photo again (iOS/desktop)
      fileInput.value = "";
    };

    reader.readAsDataURL(file);
  });

  // ---- Press to See -> open modal (or fallback) ----
  pressToSee.addEventListener("click", (e) => {
    e.preventDefault();

    if (!hasPhoto()) {
      alert("Please upload a target photo first.");
      return;
    }

    // ensure distance saved before showing output
    saveDistance();

    openModal();
  });

  // ---- Modal close behavior ----
  if (modalClose) {
    modalClose.addEventListener("click", (e) => {
      e.preventDefault();
      closeModal();
    });
  }

  // Click outside the modal closes it
  if (overlay) {
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) closeModal();
    });
  }

  // ESC closes it
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeModal();
  });
})();
