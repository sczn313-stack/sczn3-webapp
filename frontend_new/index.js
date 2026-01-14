// Pull the important fields (safe even if some are missing)
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
