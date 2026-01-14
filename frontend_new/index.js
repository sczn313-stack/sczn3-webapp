/* frontend_new/index.js
   Enables “YOUR SCORE / SCOPE CLICKS / SHOOTING TIPS” only after a photo is selected.
   Also shows the thumbnail preview.
*/

(() => {
  const fileInput = document.getElementById("targetPhoto");
  const thumb = document.getElementById("thumb");
  const distanceInput = document.getElementById("distanceYards");
  const pressToSee = document.getElementById("pressToSee");

  let selectedFile = null;

  // --- Helpers ---
  function setPressToSeeEnabled(isEnabled) {
    if (!pressToSee) return;

    if (isEnabled) {
      pressToSee.classList.remove("disabled");
      pressToSee.setAttribute("aria-disabled", "false");
      pressToSee.style.pointerEvents = "auto";
    } else {
      pressToSee.classList.add("disabled");
      pressToSee.setAttribute("aria-disabled", "true");
      pressToSee.style.pointerEvents = "none";
    }
  }

  function showThumb(file) {
    if (!thumb) return;
    const url = URL.createObjectURL(file);
    thumb.src = url;
    thumb.style.display = "block";
  }

  function openModal(title, bodyHtml) {
    // remove old modal if present
    const old = document.getElementById("secModalOverlay");
    if (old) old.remove();

    const overlay = document.createElement("div");
    overlay.id = "secModalOverlay";
    overlay.style.position = "fixed";
    overlay.style.inset = "0";
    overlay.style.background = "rgba(0,0,0,0.55)";
    overlay.style.display = "flex";
    overlay.style.alignItems = "center";
    overlay.style.justifyContent = "center";
    overlay.style.padding = "18px";
    overlay.style.zIndex = "9999";

    const card = document.createElement("div");
    card.style.width = "min(520px, 92vw)";
    card.style.background = "#2b2b2b";
    card.style.color = "#fff";
    card.style.borderRadius = "14px";
    card.style.padding = "18px 18px 14px 18px";
    card.style.boxShadow = "0 14px 40px rgba(0,0,0,0.35)";
    card.style.textAlign = "left";

    const h = document.createElement("div");
    h.style.fontWeight = "800";
    h.style.letterSpacing = "0.4px";
    h.style.marginBottom = "10px";
    h.style.textTransform = "uppercase";
    h.textContent = title;

    const body = document.createElement("div");
    body.style.lineHeight = "1.35";
    body.style.whiteSpace = "normal";
    body.innerHTML = bodyHtml;

    const footer = document.createElement("div");
    footer.style.display = "flex";
    footer.style.justifyContent = "flex-end";
    footer.style.marginTop = "14px";

    const closeBtn = document.createElement("button");
    closeBtn.textContent = "Close";
    closeBtn.style.background = "transparent";
    closeBtn.style.border = "0";
    closeBtn.style.color = "#6aa6ff";
    closeBtn.style.fontSize = "18px";
    closeBtn.style.cursor = "pointer";

    closeBtn.addEventListener("click", () => overlay.remove());
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) overlay.remove();
    });

    footer.appendChild(closeBtn);
    card.appendChild(h);
    card.appendChild(body);
    card.appendChild(footer);
    overlay.appendChild(card);
    document.body.appendChild(overlay);
  }

  // --- Init state ---
  setPressToSeeEnabled(false);

  // --- Events ---
  if (fileInput) {
    fileInput.addEventListener("change", () => {
      const file = fileInput.files && fileInput.files[0];
      if (!file) {
        selectedFile = null;
        if (thumb) thumb.style.display = "none";
        setPressToSeeEnabled(false);
        return;
      }

      selectedFile = file;
      showThumb(file);
      setPressToSeeEnabled(true);
    });
  }

  if (pressToSee) {
    pressToSee.addEventListener("click", (e) => {
      e.preventDefault();

      // If disabled (extra safety), do nothing
      if (pressToSee.classList.contains("disabled") || !selectedFile) return;

      const dist = distanceInput ? distanceInput.value : "100";

      openModal(
        "YOUR SCORE / SCOPE CLICKS / SHOOTING TIPS",
        `
          <div style="font-weight:700; margin-bottom:8px;">Ready to analyze.</div>
          <div style="opacity:0.95;">
            <div><b>Photo:</b> ${selectedFile.name}</div>
            <div><b>Distance:</b> ${dist} yards</div>
          </div>
          <div style="margin-top:12px; opacity:0.9;">
            Next step: connect this button to your backend analyze endpoint.
          </div>
        `
      );
    });
  }
})();
