/* frontend_new/index.js
   SEC Upload Page Logic
   - Thumbnail preview
   - Enable/disable "YOUR SCORE / SCOPE CLICKS / SHOOTING TIPS"
   - POST to Render backend:  {API_BASE}/api/analyze  (multipart: image)
   - Displays: score, offset, POIB, correction directions, and click counts (True MOA)
*/

(() => {
  // =========================
  // BACKEND (Render)
  // =========================
  // NO trailing slash
  const API_BASE = "https://sczn3-backend-new.onrender.com";

  // Backend route:
  // POST {API_BASE}/api/analyze
  // multipart/form-data:
  //   - image (file)
  // (We also send distanceYards as extra field; backend may ignore it, which is fine.)

  // =========================
  // DOM
  // =========================
  const fileInput = document.getElementById("targetPhoto");
  const uploadLabel = document.getElementById("uploadLabel");
  const thumb = document.getElementById("thumb");
  const distanceInput = document.getElementById("distanceYards");

  const buyMoreBtn = document.getElementById("buyMoreBtn");
  const pressToSeeBtn = document.getElementById("pressToSee");

  // Modal (must exist in HTML)
  const modalOverlay = document.getElementById("secModalOverlay");
  const modalTitle = document.getElementById("secModalTitle");
  const modalBody = document.getElementById("secModalBody");
  const modalClose = document.getElementById("secModalClose");

  // =========================
  // Guard (if IDs don’t match)
  // =========================
  if (!fileInput || !pressToSeeBtn) {
    console.warn(
      "[SEC] Missing required elements. Check IDs: targetPhoto, pressToSee"
    );
  }

  // =========================
  // Helpers
  // =========================
  const f2 = (v) => Math.round(Number(v) * 100) / 100;

  function fmt(v) {
    return String(v ?? "").trim();
  }

  function stripHtml(html) {
    const div = document.createElement("div");
    div.innerHTML = html;
    return div.textContent || div.innerText || "";
  }

  function hasFileSelected() {
    return !!(fileInput && fileInput.files && fileInput.files.length > 0);
  }

  function setPressToSeeEnabled(isEnabled) {
    if (!pressToSeeBtn) return;

    // Works whether it’s a <button> or <a>
    if (isEnabled) {
      pressToSeeBtn.classList.remove("disabled");
      pressToSeeBtn.setAttribute("aria-disabled", "false");
      pressToSeeBtn.style.pointerEvents = "auto";
      if ("disabled" in pressToSeeBtn) pressToSeeBtn.disabled = false;
      pressToSeeBtn.style.opacity = "";
      pressToSeeBtn.style.filter = "";
    } else {
      pressToSeeBtn.classList.add("disabled");
      pressToSeeBtn.setAttribute("aria-disabled", "true");
      pressToSeeBtn.style.pointerEvents = "none";
      if ("disabled" in pressToSeeBtn) pressToSeeBtn.disabled = true;
      // in case CSS isn’t applied
      pressToSeeBtn.style.opacity = "0.35";
      pressToSeeBtn.style.filter = "grayscale(35%)";
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

  async function analyzeToBackend(file, distanceYards) {
    const url = `${API_BASE}/api/analyze`;

    const fd = new FormData();
    fd.append("image", file);
    fd.append("distanceYards", String(distanceYards)); // extra field (safe)

    let res;
    try {
      res = await fetch(url, {
        method: "POST",
        body: fd,
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
        `HTTP ${res.status}\nURL tried: ${url}\n${bodyText || "(no body)"}`
      );
    }

    if (contentType.includes("application/json")) return await res.json();
    return await res.text();
  }

  function computeClicksFromCorrection(dx_in, dy_in, yards) {
    // True MOA: 1 MOA = 1.047" at 100y
    const inchPerMOA100 = 1.047;
    const moaPerClick = 0.25; // default
    const inchesPerClick = inchPerMOA100 * (Number(yards) / 100) * moaPerClick;

    const windDir = dx_in >= 0 ? "RIGHT" : "LEFT";
    const elevDir = dy_in >= 0 ? "UP" : "DOWN";

    const windClicks = Math.abs(dx_in) / inchesPerClick;
    const elevClicks = Math.abs(dy_in) / inchesPerClick;

    return {
      inchesPerClick,
      windDir,
      elevDir,
      windClicks,
      elevClicks,
    };
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
      if (e.target === modalOverlay) closeModal();
    });
  }

  if (buyMoreBtn) {
    buyMoreBtn.addEventListener("click", (e) => {
      e.preventDefault();
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

      // Thumbnail
      if (thumb) {
        const objUrl = URL.createObjectURL(file);
        thumb.src = objUrl;
        thumb.style.display = "block";
        thumb.onload = () => URL.revokeObjectURL(objUrl);
      }

      setPressToSeeEnabled(true);
    });
  }

  if (pressToSeeBtn) {
    pressToSeeBtn.addEventListener("click", async (e) => {
      e.preventDefault();

      if (!hasFileSelected()) {
        setPressToSeeEnabled(false);
        return;
      }

      const file = fileInput.files[0];
      const distanceYards = fmt(distanceInput ? distanceInput.value : "100") || "100";

      // Working modal
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

        // Backend expected JSON
        const ok = !!result && typeof result === "object" && result.ok === true;

        if (!ok) {
          openModal(
            "YOUR SCORE / SCOPE CLICKS / SHOOTING TIPS",
            `
              <div style="color:#ffb3b3; font-weight:700; margin-bottom:10px;">Analyze failed</div>
              <div style="white-space:pre-wrap; opacity:.95;">${stripHtml(
                typeof result === "string" ? result : JSON.stringify(result, null, 2)
              )}</div>
            `
          );
          return;
        }

        // Pull values
        const score = Number(result.score);
        const offset = Number(result.offset_in);

        const poibX = Number(result?.poib_in?.x ?? 0);
        const poibY = Number(result?.poib_in?.y ?? 0);

        // Prefer backend correction/directions (padlocked), else compute (bull=0,0)
        let dx = Number(result?.correction_in?.dx);
        let dy = Number(result?.correction_in?.dy);
        let windDir = result?.directions?.windage;
        let elevDir = result?.directions?.elevation;

        if (!Number.isFinite(dx) || !Number.isFinite(dy)) {
          dx = 0 - poibX;
          dy = 0 - poibY;
        }
        if (!windDir) windDir = dx >= 0 ? "RIGHT" : "LEFT";
        if (!elevDir) elevDir = dy >= 0 ? "UP" : "DOWN";

        const clickObj = computeClicksFromCorrection(dx, dy, Number(distanceYards));

        openModal(
          "YOUR SCORE / SCOPE CLICKS / SHOOTING TIPS",
          `
            <div style="margin-bottom:10px;"><b>Analyze success ✅</b></div>

            <div style="opacity:.95; margin-bottom:10px;">
              <div><b>Photo:</b> ${file ? file.name : "(none)"}</div>
              <div><b>Distance:</b> ${distanceYards} yards</div>
            </div>

            <div style="font-size:18px; font-weight:800; margin:14px 0 6px 0;">
              Score: ${Number.isFinite(score) ? f2(score) : "(n/a)"}
            </div>

            <div style="opacity:.95; margin-bottom:10px;">
              <div><b>Offset:</b> ${Number.isFinite(offset) ? f2(offset) : "(n/a)"} in</div>
              <div><b>POIB:</b> x=${f2(poibX)}, y=${f2(poibY)} (in)</div>
            </div>

            <hr style="border:none; border-top:1px solid rgba(0,0,0,.12); margin:12px 0;" />

            <div style="opacity:.95; margin-bottom:8px;">
              <div><b>Correction (in):</b> wind ${f2(Math.abs(dx))} ${windDir}, elev ${f2(Math.abs(dy))} ${elevDir}</div>
              <div><b>Clicks (0.25 MOA, True MOA):</b> ${windDir} ${f2(clickObj.windClicks)} clicks, ${elevDir} ${f2(clickObj.elevClicks)} clicks</div>
            </div>

            <div style="opacity:.7; font-size:12px;">
              (Assumes 0.25 MOA/click and 1.047" per MOA at 100y)
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
                <li>API_BASE is exactly: <b>${API_BASE}</b></li>
                <li>Backend route exists: <b>/api/analyze</b></li>
                <li>Backend is live: try <b>${API_BASE}/api/health</b></li>
                <li>CORS allows your frontend domain</li>
                <li>Multipart field name is <b>image</b></li>
              </ul>
            </div>
          `
        );
      }
    });
  }
})();
