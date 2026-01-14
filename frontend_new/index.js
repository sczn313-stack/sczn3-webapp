/* frontend_new/index.js
   - Shows thumbnail after photo select
   - Enables "YOUR SCORE / SCOPE CLICKS / SHOOTING TIPS" only when ready
   - On tap, uploads photo + distance to backend and displays response
*/

(() => {
  // =========================
  // CONFIG (EDIT THESE)
  // =========================
  const API_BASE = "https://YOUR-BACKEND-SERVICE.onrender.com"; // <-- CHANGE THIS
  const ANALYZE_PATH = "/analyze"; // <-- CHANGE IF YOUR BACKEND ROUTE IS DIFFERENT

  // Field names your backend expects (change if your backend uses different keys)
  const FORM_FIELD_IMAGE = "image";
  const FORM_FIELD_DISTANCE = "distanceYards";

  // =========================
  // ELEMENTS
  // =========================
  const fileInput = document.getElementById("targetPhoto");
  const thumbImg = document.getElementById("thumb");
  const uploadLabel = document.getElementById("uploadLabel");

  const distanceInput = document.getElementById("distanceYards");

  const pressToSee = document.getElementById("pressToSee");
  const buyMoreBtn = document.getElementById("buyMoreBtn");

  // Optional: status elements if you have them
  const uploadHint = document.querySelector(".uploadHint");

  // =========================
  // STATE
  // =========================
  let selectedFile = null;
  let isBusy = false;

  // =========================
  // HELPERS
  // =========================
  function setBusy(busy) {
    isBusy = busy;
    if (!pressToSee) return;

    if (busy) {
      pressToSee.classList.add("busy");
      pressToSee.setAttribute("aria-busy", "true");
      pressToSee.style.pointerEvents = "none";
      pressToSee.style.opacity = "0.75";
    } else {
      pressToSee.classList.remove("busy");
      pressToSee.removeAttribute("aria-busy");
      pressToSee.style.pointerEvents = "";
      pressToSee.style.opacity = "";
    }
  }

  function isDistanceValid() {
    const n = Number(distanceInput?.value);
    return Number.isFinite(n) && n > 0;
  }

  function updateEnabledState() {
    if (!pressToSee) return;

    const ready = !!selectedFile && isDistanceValid() && !isBusy;

    // You’re styling "disabled" via class already
    if (ready) {
      pressToSee.classList.remove("disabled");
      pressToSee.setAttribute("aria-disabled", "false");
    } else {
      pressToSee.classList.add("disabled");
      pressToSee.setAttribute("aria-disabled", "true");
    }
  }

  function showModal(title, bodyHtml) {
    // Simple modal (no dependencies). You can keep this as-is.
    const overlay = document.createElement("div");
    overlay.style.position = "fixed";
    overlay.style.left = "0";
    overlay.style.top = "0";
    overlay.style.right = "0";
    overlay.style.bottom = "0";
    overlay.style.background = "rgba(0,0,0,0.45)";
    overlay.style.display = "flex";
    overlay.style.alignItems = "center";
    overlay.style.justifyContent = "center";
    overlay.style.zIndex = "9999";
    overlay.style.padding = "20px";

    const card = document.createElement("div");
    card.style.width = "min(560px, 100%)";
    card.style.background = "#2b2b2f";
    card.style.color = "#fff";
    card.style.borderRadius = "14px";
    card.style.boxShadow = "0 10px 30px rgba(0,0,0,0.35)";
    card.style.padding = "18px 18px 14px";
    card.style.fontFamily = "system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif";

    const h = document.createElement("div");
    h.textContent = title;
    h.style.fontWeight = "800";
    h.style.letterSpacing = "0.4px";
    h.style.textTransform = "uppercase";
    h.style.marginBottom = "12px";

    const b = document.createElement("div");
    b.innerHTML = bodyHtml;
    b.style.fontSize = "16px";
    b.style.lineHeight = "1.35";
    b.style.whiteSpace = "normal";

    const footer = document.createElement("div");
    footer.style.display = "flex";
    footer.style.justifyContent = "flex-end";
    footer.style.marginTop = "16px";

    const closeBtn = document.createElement("button");
    closeBtn.textContent = "Close";
    closeBtn.style.border = "0";
    closeBtn.style.background = "transparent";
    closeBtn.style.color = "#6aa8ff";
    closeBtn.style.fontWeight = "700";
    closeBtn.style.fontSize = "18px";
    closeBtn.style.padding = "8px 6px";
    closeBtn.style.cursor = "pointer";

    closeBtn.addEventListener("click", () => overlay.remove());
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) overlay.remove();
    });

    footer.appendChild(closeBtn);
    card.appendChild(h);
    card.appendChild(b);
    card.appendChild(footer);
    overlay.appendChild(card);
    document.body.appendChild(overlay);
  }

  function safeText(v) {
    if (v === null || v === undefined) return "";
    return String(v)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function buildResultsHtml(data) {
    // We don’t assume your backend schema.
    // We try common keys; if missing, we show the raw JSON.
    const score =
      data?.score ??
      data?.smartScore ??
      data?.results?.score ??
      data?.results?.smartScore;

    const clicks =
      data?.clicks ??
      data?.scopeClicks ??
      data?.results?.clicks ??
      data?.results?.scopeClicks ??
      data?.correction;

    const tips =
      data?.tips ??
      data?.shootingTips ??
      data?.results?.tips ??
      data?.results?.shootingTips;

    const parts = [];

    if (score !== undefined) {
      parts.push(`<div><b>Score:</b> ${safeText(score)}</div>`);
    }

    if (clicks !== undefined) {
      parts.push(`<div style="margin-top:10px;"><b>Scope Clicks:</b> ${safeText(
        typeof clicks === "object" ? JSON.stringify(clicks) : clicks
      )}</div>`);
    }

    if (tips !== undefined) {
      parts.push(
        `<div style="margin-top:10px;"><b>Shooting Tips:</b><br>${safeText(
          Array.isArray(tips) ? tips.join(" • ") : tips
        )}</div>`
      );
    }

    if (parts.length === 0) {
      parts.push(
        `<div><b>Response:</b></div><pre style="margin-top:10px; background:#1f1f23; padding:10px; border-radius:10px; overflow:auto;">${safeText(
          JSON.stringify(data, null, 2)
        )}</pre>`
      );
    }

    return parts.join("");
  }

  async function callAnalyzeBackend() {
    if (!selectedFile) {
      showModal("YOUR SCORE / SCOPE CLICKS / SHOOTING TIPS", "Please select a target photo first.");
      return;
    }
    if (!isDistanceValid()) {
      showModal("YOUR SCORE / SCOPE CLICKS / SHOOTING TIPS", "Please enter a valid distance (yards).");
      return;
    }

    const url = `${API_BASE}${ANALYZE_PATH}`;

    const fd = new FormData();
    fd.append(FORM_FIELD_IMAGE, selectedFile, selectedFile.name || "target.jpg");
    fd.append(FORM_FIELD_DISTANCE, String(Number(distanceInput.value)));

    setBusy(true);
    updateEnabledState();

    try {
      const res = await fetch(url, {
        method: "POST",
        body: fd,
        // If your backend uses cookies/sessions, uncomment the next line:
        // credentials: "include",
      });

      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(`Backend error (${res.status}): ${txt || res.statusText}`);
      }

      const contentType = res.headers.get("content-type") || "";
      const data = contentType.includes("application/json")
        ? await res.json()
        : { raw: await res.text() };

      showModal("YOUR SCORE / SCOPE CLICKS / SHOOTING TIPS", buildResultsHtml(data));
    } catch (err) {
      showModal(
        "YOUR SCORE / SCOPE CLICKS / SHOOTING TIPS",
        `<div style="color:#ffd2d2;"><b>Analyze failed:</b> ${safeText(err?.message || err)}</div>
         <div style="margin-top:10px;">Check:</div>
         <ul style="margin-top:8px;">
           <li>API_BASE is correct</li>
           <li>Backend route exists (${safeText(ANALYZE_PATH)})</li>
           <li>Backend allows CORS from your frontend domain</li>
           <li>Backend expects multipart fields: ${safeText(FORM_FIELD_IMAGE)} and ${safeText(FORM_FIELD_DISTANCE)}</li>
         </ul>`
      );
    } finally {
      setBusy(false);
      updateEnabledState();
    }
  }

  // =========================
  // EVENTS
  // =========================
  if (fileInput) {
    fileInput.addEventListener("change", () => {
      const f = fileInput.files && fileInput.files[0];
      selectedFile = f || null;

      // Thumbnail
      if (thumbImg && selectedFile) {
        const url = URL.createObjectURL(selectedFile);
        thumbImg.src = url;
        thumbImg.style.display = "block";
        thumbImg.onload = () => {
          // revoke after load to avoid memory leaks
          try {
            URL.revokeObjectURL(url);
          } catch {}
        };
      }

      if (uploadHint) {
        uploadHint.textContent = selectedFile ? "Photo selected ✔" : "INSURE ALL 4 CORNERS";
      }

      updateEnabledState();
    });
  }

  if (distanceInput) {
    distanceInput.addEventListener("input", updateEnabledState);
    distanceInput.addEventListener("change", updateEnabledState);
  }

  if (pressToSee) {
    pressToSee.addEventListener("click", (e) => {
      e.preventDefault();
      // Respect the visual disabled state
      if (pressToSee.classList.contains("disabled")) return;
      callAnalyzeBackend();
    });
  }

  // Optional: Buy More Targets button stub
  if (buyMoreBtn) {
    buyMoreBtn.addEventListener("click", (e) => {
      e.preventDefault();
      // Put your printer URL here if you want it live now:
      // window.location.href = "https://YOUR-PRINTER-URL.com";
    });
  }

  // Initial state
  if (thumbImg) {
    // If HTML already has it visible, keep; otherwise hide until selection
    if (!thumbImg.src) thumbImg.style.display = "none";
  }
  updateEnabledState();
})();
