/* frontend_new/index.js
   SEC Upload Page Logic (thumbnail + enable/disable + backend analyze call)
*/

(() => {
  // =========================
  // STEP 1: SET YOUR BACKEND
  // =========================
  // Replace with your Render backend service URL (NO trailing slash)
  // Example: "https://sczn3-sec-backend.onrender.com"
  const API_BASE = "https://YOUR-BACKEND.onrender.com";

  // Backend route expected:
  // POST {API_BASE}/analyze
  // multipart/form-data fields:
  // - image (file)
  // - distanceYards (string/number)

  // =========================
  // DOM
  // =========================
  const fileInput = document.getElementById("targetPhoto");
  const uploadLabel = document.getElementById("uploadLabel");
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
  function hasFileSelected() {
    return fileInput && fileInput.files && fileInput.files.length > 0;
  }

  function setPressToSeeEnabled(isEnabled) {
    if (!pressToSeeBtn) return;

    if (isEnabled) {
      pressToSeeBtn.classList.remove("disabled");
      pressToSeeBtn.setAttribute("aria-disabled", "false");
      pressToSeeBtn.style.pointerEvents = "auto";
    } else {
      pressToSeeBtn.classList.add("disabled");
      pressToSeeBtn.setAttribute("aria-disabled", "true");
      pressToSeeBtn.style.pointerEvents = "none";
    }
  }

  function openModal(title, htmlBody) {
    if (!modalOverlay) {
      // fallback
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

  function stripHtml(html) {
    const div = document.createElement("div");
    div.innerHTML = html;
    return div.textContent || div.innerText || "";
  }

  function fmt(v) {
    return String(v ?? "").trim();
  }

  async function analyzeToBackend(file, distanceYards) {
    const url = `${API_BASE}/analyze`;

    const fd = new FormData();
    fd.append("image", file);
    fd.append("distanceYards", String(distanceYards));

    let res;
    try {
      res = await fetch(url, {
        method: "POST",
        body: fd,
        // NOTE: do NOT set Content-Type for FormData (browser sets boundary)
      });
    } catch (err) {
      const msg = err && err.message ? err.message : String(err);
      throw new Error(`Load failed\nURL tried: ${url}\n${msg}`);
    }

    const contentType = res.headers.get("content-type") || "";

    if (!res.ok) {
      let bodyText = "";
      try {
        bodyText = await res.text();
      } catch (_) {}
      throw new Error(
        `HTTP ${res.status} ${res.statusText}\nURL tried: ${url}\n${bodyText || "(no body)"}`
      );
    }

    // Try JSON first, fall back to text
    if (contentType.includes("application/json")) {
      return await res.json();
    }
    return await res.text();
  }

  // =========================
  // Init state
  // =========================
  setPressToSeeEnabled(false);

  // =========================
  // Events
  // =========================
  if (modalClose) modalClose.addEventListener("click", closeModal);
  if (modalOverlay) {
    modalOverlay.addEventListener("click", (e) => {
      // click outside the modal content closes
      if (e.target === modalOverlay) closeModal();
    });
  }

  if (buyMoreBtn) {
    buyMoreBtn.addEventListener("click", (e) => {
      e.preventDefault();
      // TODO: replace with your printer/manufacturer URL when ready
      // window.location.href = "https://YOUR-PRINTER-SITE.com";
      openModal("BUY MORE TARGETS", "<div>Coming soon.</div>");
    });
  }

  if (fileInput) {
    fileInput.addEventListener("change", () => {
      if (!hasFileSelected()) {
        if (thumb) {
          thumb.style.display = "none";
          thumb.removeAttribute("src");
        }
        setPressToSeeEnabled(false);
        return;
      }

      const file = fileInput.files[0];

      // Thumbnail preview
      if (thumb) {
        const objUrl = URL.createObjectURL(file);
        thumb.src = objUrl;
        thumb.style.display = "block";
        thumb.onload = () => {
          // Release memory
          URL.revokeObjectURL(objUrl);
        };
      }

      setPressToSeeEnabled(true);
    });
  }

  // Main button: analyze
  if (pressToSeeBtn) {
    pressToSeeBtn.addEventListener("click", async (e) => {
      e.preventDefault();

      // guard
      if (!hasFileSelected()) return;

      const file = fileInput.files[0];
      const distanceYards = fmt(distanceInput ? distanceInput.value : "100") || "100";

      // Show "working" modal
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

        // Show success (placeholder rendering)
        // You can replace this with your real SEC rendering once backend returns final data.
        openModal(
          "YOUR SCORE / SCOPE CLICKS / SHOOTING TIPS",
          `
            <div style="margin-bottom:12px;"><b>Analyze success ✅</b></div>
            <div style="opacity:.9; margin-bottom:10px;">
              <div><b>Photo:</b> ${file ? file.name : "(none)"}</div>
              <div><b>Distance:</b> ${distanceYards} yards</div>
            </div>
            <div style="white-space:pre-wrap; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace; font-size: 12px; line-height: 1.35;">
${typeof result === "string" ? result : JSON.stringify(result, null, 2)}
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
                <li>Backend route exists (/analyze)</li>
                <li>Backend allows CORS from your frontend domain</li>
                <li>Backend expects multipart fields: <b>image</b> and <b>distanceYards</b></li>
              </ul>
            </div>
          `
        );
      }
    });
  }
})();
