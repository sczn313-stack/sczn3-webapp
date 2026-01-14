/* frontend_new/index.js
   SEC Upload Page Logic (thumbnail + enable/disable + backend analyze call)
*/

(() => {
  // =========================
  // BACKEND (NO trailing slash)
  // =========================
  const API_BASE = "https://sczn3-backend-new.onrender.com";

  // =========================
  // DOM
  // =========================
  const fileInput = document.getElementById("targetPhoto");
  const thumb = document.getElementById("thumb");
  const distanceInput = document.getElementById("distanceYards");
  const buyMoreBtn = document.getElementById("buyMoreBtn");
  const pressToSeeBtn = document.getElementById("pressToSee");

  // Modal (created in HTML)
  const modalOverlay = document.getElementById("secModalOverlay");
  const modalTitle = document.getElementById("secModalTitle");
  const modalBody = document.getElementById("secModalBody");
  const modalClose = document.getElementById("secModalClose");

  // =========================
  // Helpers
  // =========================
  function stripHtml(html) {
    const div = document.createElement("div");
    div.innerHTML = html;
    return div.textContent || div.innerText || "";
  }

  function fmt(v) {
    return String(v ?? "").trim();
  }

  function hasFileSelected() {
    return !!(fileInput && fileInput.files && fileInput.files.length > 0);
  }

  function setPressToSeeEnabled(isEnabled) {
    if (!pressToSeeBtn) return;

    if (isEnabled) {
      pressToSeeBtn.classList.remove("disabled");
      pressToSeeBtn.setAttribute("aria-disabled", "false");
      pressToSeeBtn.style.pointerEvents = "auto";
      pressToSeeBtn.style.opacity = "1";
    } else {
      pressToSeeBtn.classList.add("disabled");
      pressToSeeBtn.setAttribute("aria-disabled", "true");
      pressToSeeBtn.style.pointerEvents = "none";
      pressToSeeBtn.style.opacity = "0.45";
    }
  }

  function openModal(title, htmlBody) {
    if (!modalOverlay) {
      alert(`${title}\n\n${stripHtml(htmlBody)}`);
      return;
    }
    if (modalTitle) modalTitle.textContent = title;
    if (modalBody) modalBody.innerHTML = htmlBody;

    modalOverlay.style.display = "flex";
    modalOverlay.setAttribute("aria-hidden", "false");
  }

  function closeModal() {
    if (!modalOverlay) return;
    modalOverlay.style.display = "none";
    modalOverlay.setAttribute("aria-hidden", "true");
  }

  function refreshFromFileInput() {
    // If no file, hide thumb + disable
    if (!hasFileSelected()) {
      if (thumb) {
        thumb.style.display = "none";
        thumb.removeAttribute("src");
      }
      setPressToSeeEnabled(false);
      return;
    }

    const file = fileInput.files[0];

    // Show thumbnail
    if (thumb) {
      const objUrl = URL.createObjectURL(file);
      thumb.src = objUrl;
      thumb.style.display = "block";
      thumb.onload = () => URL.revokeObjectURL(objUrl);
    }

    // Enable main button
    setPressToSeeEnabled(true);
  }

  async function analyzeToBackend(file, distanceYards) {
    // IMPORTANT: backend route is /api/analyze (not /analyze)
    const url = `${API_BASE}/api/analyze`;

    const fd = new FormData();
    fd.append("image", file);
    fd.append("distanceYards", String(distanceYards));

    let res;
    try {
      res = await fetch(url, { method: "POST", body: fd });
    } catch (err) {
      const msg = err && err.message ? err.message : String(err);
      throw new Error(`Load failed\nURL tried: ${url}\n${msg}`);
    }

    const contentType = res.headers.get("content-type") || "";

    if (!res.ok) {
      let bodyText = "";
      try { bodyText = await res.text(); } catch (_) {}
      throw new Error(`HTTP ${res.status} ${res.statusText}\nURL tried: ${url}\n${bodyText || "(no body)"}`);
    }

    if (contentType.includes("application/json")) return await res.json();
    return await res.text();
  }

  // =========================
  // Init
  // =========================
  // If JS isn’t wiring correctly, tell you immediately.
  if (!fileInput || !pressToSeeBtn) {
    openModal(
      "SEC SETUP ERROR",
      `<div>Missing required elements.</div>
       <div style="margin-top:10px; opacity:.9;">
         Need: <b>#targetPhoto</b> and <b>#pressToSee</b> in your HTML.
       </div>`
    );
    return;
  }

  setPressToSeeEnabled(false);

  // =========================
  // Events
  // =========================
  if (modalClose) modalClose.addEventListener("click", closeModal);
  if (modalOverlay) {
    modalOverlay.addEventListener("click", (e) => {
      if (e.target === modalOverlay) closeModal();
    });
  }

  if (buyMoreBtn) {
    buyMoreBtn.addEventListener("click", (e) => {
      e.preventDefault();
      openModal("BUY MORE TARGETS", "<div>Coming soon.</div>");
    });
  }

  // iPhone reliability:
  // - listen to BOTH change + input
  // - reset value on click so selecting the same photo still fires change
  fileInput.addEventListener("click", () => {
    fileInput.value = "";
    setPressToSeeEnabled(false);
    if (thumb) {
      thumb.style.display = "none";
      thumb.removeAttribute("src");
    }
  });

  fileInput.addEventListener("change", refreshFromFileInput);
  fileInput.addEventListener("input", refreshFromFileInput);

  // Main button: analyze
  pressToSeeBtn.addEventListener("click", async (e) => {
    e.preventDefault();

    if (!hasFileSelected()) {
      openModal("UPLOAD REQUIRED", "<div>Please select a target photo first.</div>");
      return;
    }

    const file = fileInput.files[0];
    const distanceYards = fmt(distanceInput ? distanceInput.value : "100") || "100";

    openModal(
      "YOUR SCORE / SCOPE CLICKS / SHOOTING TIPS",
      `
        <div style="margin-bottom:12px;">Analyzing…</div>
        <div style="opacity:.9;">
          <div><b>Photo:</b> ${file ? file.name : "(none)"}</div>
          <div><b>Distance:</b> ${distanceYards} yards</div>
        </div>
      `
    );

    try {
      const result = await analyzeToBackend(file, distanceYards);

      // Show key outputs (no raw JSON dump)
      const score = (result && typeof result === "object") ? result.score : null;

      const poibX = result?.poib_in?.x;
      const poibY = result?.poib_in?.y;

      const dx = result?.correction_in?.dx;
      const dy = result?.correction_in?.dy;

      const windDir = result?.directions?.windage;
      const elevDir = result?.directions?.elevation;

      const offsetIn = result?.offset_in;

      openModal(
        "YOUR SCORE / SCOPE CLICKS / SHOOTING TIPS",
        `
          <div style="margin-bottom:14px;"><b>Analyze success ✅</b></div>

          <div style="opacity:.95; margin-bottom:12px;">
            <div><b>Photo:</b> ${file ? file.name : "(none)"}</div>
            <div><b>Distance:</b> ${distanceYards} yards</div>
          </div>

          <div style="border:1px solid rgba(255,255,255,.18); border-radius:12px; padding:12px; margin-bottom:12px;">
            <div style="font-weight:800; font-size:18px; margin-bottom:6px;">
              Score: ${score ?? "—"}
            </div>
            <div style="opacity:.92;">
              <div><b>Offset:</b> ${offsetIn ?? "—"} in</div>
              <div><b>POIB:</b> x=${poibX ?? "—"}, y=${poibY ?? "—"} (in)</div>
            </div>
          </div>

          <div style="border:1px solid rgba(255,255,255,.18); border-radius:12px; padding:12px;">
            <div style="font-weight:800; margin-bottom:6px;">Correction (bull − POIB)</div>
            <div style="opacity:.92;">
              <div><b>Windage:</b> ${windDir ?? "—"} (${dx ?? "—"} in)</div>
              <div><b>Elevation:</b> ${elevDir ?? "—"} (${dy ?? "—"} in)</div>
            </div>
          </div>
        `
      );
    } catch (err) {
      const message = err && err.message ? err.message : String(err);

      openModal(
        "YOUR SCORE / SCOPE CLICKS / SHOOTING TIPS",
        `
          <div style="color:#ffb3b3; font-weight:700; margin-bottom:10px;">
            Analyze failed:
            <span style="font-weight:600; color:#ffd0d0;">${stripHtml(message).split("\n")[0]}</span>
          </div>

          <div style="opacity:.95; margin-bottom:10px; white-space:pre-wrap;">
${stripHtml(message)}
          </div>

          <div style="opacity:.9; margin-top:10px;">
            <div><b>Check:</b></div>
            <ul style="margin:8px 0 0 18px;">
              <li>API_BASE is correct</li>
              <li>Backend route exists (<b>/api/analyze</b>)</li>
              <li>Backend allows CORS from your frontend domain</li>
              <li>Backend expects multipart field: <b>image</b></li>
            </ul>
          </div>
        `
      );
    }
  });
})();
