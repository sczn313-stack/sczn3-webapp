/* frontend_new/index.js
   SEC Upload Page Logic (thumbnail + enable/disable + backend analyze call)
   + Shows Score + POIB + Directions + Clicks (True MOA)
*/

(() => {
  // =========================
  // BACKEND (Render)
  // =========================
  // NO trailing slash
  const API_BASE = "https://sczn3-backend-new.onrender.com";

  // Backend route:
  // POST {API_BASE}/api/analyze
  // multipart/form-data fields:
  // - image (file)
  // (backend expects only image; we also send distanceYards for our click calc)
  const ANALYZE_PATH = "/api/analyze";

  // Click configuration (default)
  const CLICK_MOA = 0.25; // 1/4 MOA per click
  const TRUE_MOA_IN_PER_100Y = 1.047; // inches @100y for 1 MOA

  // =========================
  // DOM
  // =========================
  const fileInput = document.getElementById("targetPhoto");
  const thumb = document.getElementById("thumb");
  const distanceInput = document.getElementById("distanceYards");

  const buyMoreBtn = document.getElementById("buyMoreBtn");
  const pressToSeeBtn = document.getElementById("pressToSee");

  // Modal
  const modalOverlay = document.getElementById("secModalOverlay");
  const modalTitle = document.getElementById("secModalTitle");
  const modalBody = document.getElementById("secModalBody");
  const modalClose = document.getElementById("secModalClose");

  // =========================
  // Helpers
  // =========================
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

  function stripHtml(html) {
    const div = document.createElement("div");
    div.innerHTML = html;
    return div.textContent || div.innerText || "";
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

  function n(v, fallback = 0) {
    const x = Number(v);
    return Number.isFinite(x) ? x : fallback;
  }

  function f2(v) {
    return Math.round(n(v) * 100) / 100;
  }

  function fmtDistanceYards() {
    const raw = distanceInput ? String(distanceInput.value || "").trim() : "";
    const d = n(raw, 100);
    return d > 0 ? d : 100;
  }

  // True MOA inches per click at distance:
  // 1 MOA @ distanceYards = 1.047 * (distanceYards/100)
  // inchesPerClick = that * clickMoa
  function inchesPerClick(distanceYards, clickMoa = CLICK_MOA) {
    const d = n(distanceYards, 100);
    return TRUE_MOA_IN_PER_100Y * (d / 100) * n(clickMoa, 0.25);
  }

  function computeClicksFromInches(deltaInches, distanceYards) {
    const ipc = inchesPerClick(distanceYards);
    if (!(ipc > 0)) return 0;
    return Math.abs(n(deltaInches, 0)) / ipc;
  }

  async function analyzeToBackend(file, distanceYards) {
    const url = `${API_BASE}${ANALYZE_PATH}`;

    const fd = new FormData();
    fd.append("image", file);
    // backend doesn't require this, but safe to include for future
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
      try {
        bodyText = await res.text();
      } catch (_) {}
      throw new Error(
        `HTTP ${res.status} ${res.statusText}\nURL tried: ${url}\n${bodyText || "(no body)"}`
      );
    }

    if (contentType.includes("application/json")) return await res.json();
    return await res.text();
  }

  function renderResultModal({ fileName, distanceYards, result }) {
    // Expect backend JSON like:
    // result.score, result.offset_in, result.poib_in {x,y}
    // result.correction_in {dx,dy}
    // result.directions {windage,elevation}
    if (typeof result !== "object" || !result) {
      openModal(
        "YOUR SCORE / SCOPE CLICKS / SHOOTING TIPS",
        `<div style="white-space:pre-wrap;">${stripHtml(String(result))}</div>`
      );
      return;
    }

    const score = f2(result.score);
    const offset_in = f2(result.offset_in);

    const poibX = f2(result?.poib_in?.x);
    const poibY = f2(result?.poib_in?.y);

    const dx = f2(result?.correction_in?.dx);
    const dy = f2(result?.correction_in?.dy);

    const windDir = String(result?.directions?.windage || "").toUpperCase();
    const elevDir = String(result?.directions?.elevation || "").toUpperCase();

    const windClicks = f2(computeClicksFromInches(dx, distanceYards));
    const elevClicks = f2(computeClicksFromInches(dy, distanceYards));

    openModal(
      "YOUR SCORE / SCOPE CLICKS / SHOOTING TIPS",
      `
        <div style="font-weight:800; margin-bottom:10px;">
          Analyze success ✅
        </div>

        <div style="opacity:.95; margin-bottom:14px;">
          <div><b>Photo:</b> ${fileName}</div>
          <div><b>Distance:</b> ${distanceYards} yards</div>
        </div>

        <div style="margin-bottom:14px;">
          <div style="font-size:20px; font-weight:800; margin-bottom:6px;">
            Score: ${score}
          </div>
          <div style="font-size:16px; font-weight:700;">
            Offset: ${offset_in} in
          </div>
          <div style="margin-top:6px; font-size:16px; font-weight:700;">
            POIB: x=${poibX}, y=${poibY} (in)
          </div>
        </div>

        <div style="padding:10px 12px; border:1px solid rgba(255,255,255,.18); border-radius:10px;">
          <div style="font-weight:800; margin-bottom:8px;">Scope Clicks (True MOA)</div>

          <div style="margin-bottom:8px;">
            <div><b>Windage:</b> ${windDir} — <b>${windClicks}</b> clicks</div>
            <div style="opacity:.85; font-size:12px;">(dx = ${dx} in)</div>
          </div>

          <div>
            <div><b>Elevation:</b> ${elevDir} — <b>${elevClicks}</b> clicks</div>
            <div style="opacity:.85; font-size:12px;">(dy = ${dy} in)</div>
          </div>

          <div style="opacity:.75; font-size:12px; margin-top:10px;">
            Assumes ${CLICK_MOA} MOA/click • 1 MOA = 1.047″ @ 100y
          </div>
        </div>
      `
    );
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

      // Thumbnail preview
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
      if (!hasFileSelected()) return;

      const file = fileInput.files[0];
      const distanceYards = fmtDistanceYards();

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
        renderResultModal({
          fileName: file ? file.name : "(none)",
          distanceYards,
          result,
        });
      } catch (err) {
        const message = err && err.message ? err.message : String(err);
        openModal(
          "YOUR SCORE / SCOPE CLICKS / SHOOTING TIPS",
          `
            <div style="color:#ffb3b3; font-weight:800; margin-bottom:10px;">
              Analyze failed
            </div>

            <div style="opacity:.95; margin-bottom:10px; white-space:pre-wrap;">
${stripHtml(message)}
            </div>

            <div style="opacity:.9; margin-top:10px;">
              <div><b>Check:</b></div>
              <ul style="margin:8px 0 0 18px;">
                <li>API_BASE is correct</li>
                <li>Backend route exists (${ANALYZE_PATH})</li>
                <li>Backend allows CORS from your frontend domain</li>
                <li>Backend expects multipart field: <b>image</b></li>
              </ul>
            </div>
          `
        );
      }
    });
  }
})();
