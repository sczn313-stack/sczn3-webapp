/* frontend_new/index.js
   SEC Upload Page Logic
   - Thumbnail preview
   - Client-side resize/compress BEFORE upload (fixes iPhone huge-photo stalls)
   - Backend analyze call with timeout (no infinite "Analyzing…")
   - Scope Profiles (MOA/MIL, click value)
   - True MOA support (1 MOA = 1.047" @ 100y)
   - Clean SEC output + Confirm Zero + Next 5-shot challenge
   - Modal overlay + background scroll lock
*/

(() => {
  // =========================
  // CONFIG
  // =========================
  const API_BASE = "https://sczn3-backend-new.onrender.com";

  // Client-side image prep (key fix)
  const MAX_EDGE_PX = 1600;     // long-edge cap
  const JPEG_QUALITY = 0.82;    // 0..1
  const ANALYZE_TIMEOUT_MS = 25000;

  // =========================
  // DOM
  // =========================
  const fileInput = document.getElementById("targetPhoto");
  const uploadLabel = document.getElementById("uploadLabel");
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
    return fileInput && fileInput.files && fileInput.files.length > 0;
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
      pressToSeeBtn.style.opacity = ".45";
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

    document.body.classList.add("modal-open");

    modalOverlay.style.display = "flex";
    modalOverlay.setAttribute("aria-hidden", "false");
  }

  function closeModal() {
    if (!modalOverlay) return;

    modalOverlay.style.display = "none";
    modalOverlay.setAttribute("aria-hidden", "true");

    document.body.classList.remove("modal-open");
  }

  function fmt(v) {
    return String(v ?? "").trim();
  }

  function n(v, fallback = 0) {
    const x = Number(v);
    return Number.isFinite(x) ? x : fallback;
  }

  function f2(v) {
    const x = n(v, 0);
    return Math.round(x * 100) / 100;
  }

  function bytesToMB(bytes) {
    return Math.round((bytes / (1024 * 1024)) * 100) / 100;
  }

  // =========================
  // Client-side resize/compress (THE FIX)
  // =========================
  function loadImageFromFile(file) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);

      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve(img);
      };
      img.onerror = (e) => {
        URL.revokeObjectURL(url);
        reject(new Error("Could not load image"));
      };

      img.src = url;
    });
  }

  function canvasToBlob(canvas, type, quality) {
    return new Promise((resolve) => {
      canvas.toBlob((blob) => resolve(blob), type, quality);
    });
  }

  async function prepareUploadBlob(originalFile) {
    // If it's already small, still normalize to JPEG for consistent backend behavior
    const img = await loadImageFromFile(originalFile);

    const w0 = img.naturalWidth || img.width;
    const h0 = img.naturalHeight || img.height;

    let w = w0;
    let h = h0;

    const maxEdge = Math.max(w0, h0);
    if (maxEdge > MAX_EDGE_PX) {
      const scale = MAX_EDGE_PX / maxEdge;
      w = Math.round(w0 * scale);
      h = Math.round(h0 * scale);
    }

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;

    const ctx = canvas.getContext("2d", { alpha: false });
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, 0, 0, w, h);

    // Always output JPEG (fast decode, smaller)
    const blob = await canvasToBlob(canvas, "image/jpeg", JPEG_QUALITY);
    if (!blob) throw new Error("Image compression failed");

    return {
      blob,
      outName: (originalFile.name || "target").replace(/\.[^.]+$/, "") + ".jpg",
      origW: w0,
      origH: h0,
      outW: w,
      outH: h,
      origMB: bytesToMB(originalFile.size),
      outMB: bytesToMB(blob.size),
    };
  }

  // =========================
  // Scope profiles (dynamic UI)
  // =========================
  const PROFILES = [
    { id: "moa_025_true", label: "MOA — 0.25/click (True MOA)", kind: "MOA", clickValue: 0.25, moaInchesAt100: 1.047 },
    { id: "moa_0125_true", label: "MOA — 0.125/click (True MOA)", kind: "MOA", clickValue: 0.125, moaInchesAt100: 1.047 },
    { id: "mil_01", label: "MIL — 0.1/click", kind: "MIL", clickValue: 0.1, milInchesAt100: 3.6 },
    { id: "mil_005", label: "MIL — 0.05/click", kind: "MIL", clickValue: 0.05, milInchesAt100: 3.6 },
  ];
  let selectedProfileId = "moa_025_true";

  function injectProfileUI() {
    if (!distanceInput) return;
    if (document.getElementById("scopeProfileWrap")) return;

    const wrap = document.createElement("div");
    wrap.id = "scopeProfileWrap";
    wrap.style.maxWidth = "520px";
    wrap.style.margin = "14px auto 0";
    wrap.style.textAlign = "center";

    wrap.innerHTML = `
      <div style="font-weight:700; letter-spacing:.3px; margin-bottom:6px;">
        SCOPE PROFILE
      </div>
      <select id="scopeProfileSelect"
        style="
          width: min(520px, 90%);
          padding: 10px 12px;
          border-radius: 10px;
          border: 1px solid rgba(0,0,0,.25);
          font-size: 16px;
          background: #fff;
        ">
        ${PROFILES.map(p => `<option value="${p.id}">${p.label}</option>`).join("")}
      </select>
      <div style="margin-top:8px; opacity:.75; font-size:13px;">
        Used for click math + display only (backend stays locked).
      </div>
    `;

    const parent = distanceInput.parentElement;
    if (parent) parent.appendChild(wrap);

    const sel = document.getElementById("scopeProfileSelect");
    if (sel) {
      sel.value = selectedProfileId;
      sel.addEventListener("change", () => {
        selectedProfileId = sel.value;
      });
    }
  }

  function getSelectedProfile() {
    return PROFILES.find(p => p.id === selectedProfileId) || PROFILES[0];
  }

  // =========================
  // Click computation
  // =========================
  function inchesPerUnitAtDistance(profile, distanceYards) {
    const yd = n(distanceYards, 100);
    if (profile.kind === "MOA") return (profile.moaInchesAt100 || 1.047) * (yd / 100);
    return (profile.milInchesAt100 || 3.6) * (yd / 100);
  }

  function clicksFromCorrection(profile, distanceYards, dx_in, dy_in, windageDir, elevDir) {
    const unitInches = inchesPerUnitAtDistance(profile, distanceYards);
    const clickValue = n(profile.clickValue, 0.25);

    const windUnits = Math.abs(n(dx_in, 0)) / unitInches;
    const elevUnits = Math.abs(n(dy_in, 0)) / unitInches;

    const windClicks = windUnits / clickValue;
    const elevClicks = elevUnits / clickValue;

    return {
      windage: { dir: windageDir, clicks: f2(windClicks), dx_in: f2(dx_in) },
      elevation: { dir: elevDir, clicks: f2(elevClicks), dy_in: f2(dy_in) },
      assumptions: profile.kind === "MOA"
        ? `Assumes ${clickValue} MOA/click • 1 MOA = ${(profile.moaInchesAt100 || 1.047).toFixed(3)}" @ 100y`
        : `Assumes ${clickValue} MIL/click • 1 MIL = ${(profile.milInchesAt100 || 3.6).toFixed(1)}" @ 100y`,
    };
  }

  // =========================
  // Backend call (with timeout)
  // =========================
  async function analyzeToBackend(imageBlob, fileNameForServer) {
    const url = `${API_BASE}/api/analyze`;

    const fd = new FormData();
    fd.append("image", imageBlob, fileNameForServer || "target.jpg");

    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), ANALYZE_TIMEOUT_MS);

    let res;
    try {
      res = await fetch(url, {
        method: "POST",
        body: fd,
        mode: "cors",
        cache: "no-store",
        signal: controller.signal,
      });
    } catch (err) {
      clearTimeout(t);
      const msg = err && err.name === "AbortError"
        ? `Timed out after ${Math.round(ANALYZE_TIMEOUT_MS / 1000)}s`
        : (err && err.message ? err.message : String(err));
      throw new Error(`Analyze request failed\nURL tried: ${url}\n${msg}`);
    }
    clearTimeout(t);

    if (!res.ok) {
      let bodyText = "";
      try { bodyText = await res.text(); } catch (_) {}
      throw new Error(`HTTP ${res.status} ${res.statusText}\nURL tried: ${url}\n${bodyText || "(no body)"}`);
    }

    return await res.json();
  }

  // =========================
  // Render SEC
  // =========================
  function renderSEC(result, fileName, distanceYards, profile) {
    const ok = !!result?.ok;
    if (!ok) return `<div style="color:#b00;font-weight:700;">Analyze failed (no ok=true)</div>`;

    const score = result?.score;
    const offset = result?.offset_in;
    const poibX = result?.poib_in?.x;
    const poibY = result?.poib_in?.y;

    const dx = result?.correction_in?.dx;
    const dy = result?.correction_in?.dy;

    const windDir = result?.directions?.windage;
    const elevDir = result?.directions?.elevation;

    const clickObj = clicksFromCorrection(profile, distanceYards, dx, dy, windDir, elevDir);

    return `
      <div style="font-size:16px; line-height:1.35;">
        <div style="font-weight:800; margin:6px 0 14px;">Analyze success ✅</div>

        <div style="opacity:.9; margin-bottom:12px;">
          <div><b>Photo:</b> ${fileName || "(none)"}</div>
          <div><b>Distance:</b> ${distanceYards} yards</div>
          <div><b>Profile:</b> ${profile.label}</div>
        </div>

        <hr style="border:none;border-top:1px solid rgba(0,0,0,.12);margin:12px 0;">

        <div style="font-size:22px; font-weight:900; margin:6px 0 8px;">
          Score: ${f2(score)}
        </div>

        <div style="opacity:.95; margin-bottom:12px;">
          <div><b>Offset:</b> ${f2(offset)} in</div>
          <div><b>POIB:</b> x=${f2(poibX)}, y=${f2(poibY)} (in)</div>
        </div>

        <hr style="border:none;border-top:1px solid rgba(0,0,0,.12);margin:12px 0;">

        <div style="font-size:18px; font-weight:900; margin-bottom:10px;">
          Scope Clicks (${profile.kind === "MOA" ? "True MOA" : "MIL"})
        </div>

        <div style="margin-bottom:14px;">
          <div style="font-weight:800;">
            Windage: ${clickObj.windage.dir} — ${clickObj.windage.clicks} clicks
          </div>
          <div style="opacity:.85;">(dx = ${clickObj.windage.dx_in} in)</div>
        </div>

        <div style="margin-bottom:14px;">
          <div style="font-weight:800;">
            Elevation: ${clickObj.elevation.dir} — ${clickObj.elevation.clicks} clicks
          </div>
          <div style="opacity:.85;">(dy = ${clickObj.elevation.dy_in} in)</div>
        </div>

        <div style="opacity:.85; margin-top:8px;">
          ${clickObj.assumptions}
        </div>

        <hr style="border:none;border-top:1px solid rgba(0,0,0,.12);margin:14px 0;">

        <div style="font-weight:900; margin-bottom:8px;">Confirm Zero</div>
        <div style="opacity:.92; margin-bottom:12px;">
          Dial the clicks above, then fire a tight 3–5 shot group.
          If your group is centered, you’re done.
        </div>

        <div style="font-weight:900; margin-bottom:8px;">Next 5-Shot Challenge</div>
        <div style="opacity:.92;">
          Want to level up? Shoot 5 more and run it again to track improvement.
        </div>
      </div>
    `;
  }

  // =========================
  // Init + Events
  // =========================
  setPressToSeeEnabled(false);

  // Modal close handlers
  if (modalClose) modalClose.addEventListener("click", closeModal);
  if (modalOverlay) {
    modalOverlay.addEventListener("click", (e) => {
      if (e.target === modalOverlay) closeModal();
    });
  }

  // BUY MORE TARGETS
  if (buyMoreBtn) {
    buyMoreBtn.addEventListener("click", (e) => {
      e.preventDefault();
      openModal("BUY MORE TARGETS", "<div>Coming soon.</div>");
    });
  }

  // Scope UI
  injectProfileUI();

  // File picker: ensure label triggers input everywhere
  if (uploadLabel && fileInput) {
    uploadLabel.addEventListener("click", (e) => {
      e.preventDefault();
      fileInput.click();
    });
  }

  // On file selected: show thumbnail, enable press-to-see
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

      // Thumbnail (original)
      if (thumb) {
        const objUrl = URL.createObjectURL(file);
        thumb.src = objUrl;
        thumb.style.display = "block";
        thumb.onload = () => URL.revokeObjectURL(objUrl);
      }

      setPressToSeeEnabled(true);
    });
  }

  // Main analyze
  if (pressToSeeBtn) {
    pressToSeeBtn.addEventListener("click", async (e) => {
      e.preventDefault();
      if (!hasFileSelected()) return;

      const file = fileInput.files[0];
      const distanceYards = fmt(distanceInput ? distanceInput.value : "100") || "100";
      const profile = getSelectedProfile();

      openModal(
        "YOUR SCORE / SCOPE CLICKS / SHOOTING TIPS",
        `
          <div style="margin-bottom:12px;">Preparing photo…</div>
          <div style="opacity:.9;">
            <div><b>Original:</b> ${file ? file.name : "(none)"} (${bytesToMB(file.size)} MB)</div>
            <div><b>Distance:</b> ${distanceYards} yards</div>
            <div><b>Profile:</b> ${profile.label}</div>
          </div>
        `
      );

      let prep;
      try {
        prep = await prepareUploadBlob(file);
      } catch (err) {
        const message = err && err.message ? err.message : String(err);
        openModal(
          "YOUR SCORE / SCOPE CLICKS / SHOOTING TIPS",
          `<div style="color:#ff6b6b;font-weight:900;margin-bottom:10px;">Photo prep failed</div>
           <div style="white-space:pre-wrap;opacity:.95;">${stripHtml(message)}</div>`
        );
        return;
      }

      openModal(
        "YOUR SCORE / SCOPE CLICKS / SHOOTING TIPS",
        `
          <div style="margin-bottom:12px;">Analyzing…</div>
          <div style="opacity:.9;">
            <div><b>Upload:</b> ${prep.outName} (${prep.outMB} MB)</div>
            <div><b>Resize:</b> ${prep.origW}×${prep.origH} → ${prep.outW}×${prep.outH}</div>
            <div><b>Distance:</b> ${distanceYards} yards</div>
            <div><b>Profile:</b> ${profile.label}</div>
          </div>
        `
      );

      try {
        const result = await analyzeToBackend(prep.blob, prep.outName);
        openModal(
          "YOUR SCORE / SCOPE CLICKS / SHOOTING TIPS",
          renderSEC(result, prep.outName, distanceYards, profile)
        );
      } catch (err) {
        const message = err && err.message ? err.message : String(err);
        openModal(
          "YOUR SCORE / SCOPE CLICKS / SHOOTING TIPS",
          `
            <div style="color:#ff6b6b; font-weight:900; margin-bottom:10px;">
              Analyze failed
            </div>
            <div style="opacity:.95; white-space:pre-wrap;">${stripHtml(message)}</div>
            <div style="opacity:.9; margin-top:12px;">
              <b>Check:</b>
              <ul style="margin:8px 0 0 18px;">
                <li>Backend route exists: <b>/api/analyze</b></li>
                <li>multipart field name is <b>image</b></li>
                <li>Try a different photo if this one is unusual</li>
              </ul>
            </div>
          `
        );
      }
    });
  }
})();
