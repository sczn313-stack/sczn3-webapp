import React, { useMemo, useState } from "react";

const SEC_ENDPOINT = "https://sczn3-sec-backend-pipe.onrender.com/api/sec";

// ---------------- formatting ----------------
const f2 = (n) => (Math.round(Number(n) * 100) / 100).toFixed(2);
const nowStamp = () => new Date().toISOString();

function dialFromClicksSigned(clicksSigned) {
  const w = Number(clicksSigned?.windage ?? 0);
  const e = Number(clicksSigned?.elevation ?? 0);

  const windage =
    w > 0 ? `RIGHT ${f2(Math.abs(w))}` :
    w < 0 ? `LEFT ${f2(Math.abs(w))}` :
    `CENTER 0.00`;

  const elevation =
    e > 0 ? `UP ${f2(Math.abs(e))}` :
    e < 0 ? `DOWN ${f2(Math.abs(e))}` :
    `LEVEL 0.00`;

  return { windage, elevation };
}

// ---------------- target parsing ----------------
// We treat "targetSizeInches" as LONG SIDE for now (legacy backend).
// But we also compute both long+short for validation.
function parseTargetSpec(raw) {
  const s = String(raw || "").trim().toLowerCase().replace(/\s+/g, "");

  // common aliases
  if (s === "23" || s === "23x23" || s === "23×23") {
    return { ok: true, spec: "23x23", long: 23, short: 23, aspect: 1.0 };
  }

  // accepts: 8.5x11, 8.5×11, 8.5by11, 8.5*11
  const cleaned = s.replace(/by|\*/g, "x").replace("×", "x");
  const m = cleaned.match(/^(\d+(\.\d+)?)x(\d+(\.\d+)?)$/);

  if (m) {
    const a = Number(m[1]);
    const b = Number(m[3]);
    if (!Number.isFinite(a) || !Number.isFinite(b) || a <= 0 || b <= 0) {
      return { ok: false, error: "Bad dimensions" };
    }
    const long = Math.max(a, b);
    const short = Math.min(a, b);
    const aspect = long / short;
    return { ok: true, spec: `${a}x${b}`, long, short, aspect };
  }

  // allow a single number like "11" or "17" meaning long side unknown short side
  const n = Number(s);
  if (Number.isFinite(n) && n > 0) {
    return { ok: true, spec: `${n}`, long: n, short: null, aspect: null };
  }

  return { ok: false, error: "Unrecognized target size. Use 23 or 8.5x11." };
}

// ---------------- EXIF / orientation fix ----------------
// iOS/Safari may store rotation in EXIF. Servers often ignore it.
// Re-encode upright in browser to strip EXIF.
async function normalizeImageFile(file) {
  let bitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    bitmap = await createImageBitmap(file);
  }

  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;

  const ctx = canvas.getContext("2d");
  ctx.drawImage(bitmap, 0, 0);

  const blob = await new Promise((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", 0.92)
  );

  if (!blob) return { file, meta: { width: bitmap.width, height: bitmap.height } };

  const cleanFile = new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", {
    type: "image/jpeg",
    lastModified: Date.now(),
  });

  return { file: cleanFile, meta: { width: bitmap.width, height: bitmap.height } };
}

// ---------------- mismatch / incongruence logging ----------------
function makeIssue(code, message, details) {
  return { ts: nowStamp(), code, message, details };
}

export default function App() {
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");

  // Locked defaults (you can expand later)
  const [distanceYards, setDistanceYards] = useState(100);
  const [clickValueMoa, setClickValueMoa] = useState(0.25);

  // target input
  const [targetInput, setTargetInput] = useState("8.5x11"); // user-facing
  const parsedTarget = useMemo(() => parseTargetSpec(targetInput), [targetInput]);

  const [status, setStatus] = useState("");
  const [result, setResult] = useState(null);
  const [showRaw, setShowRaw] = useState(false);

  // Incongruence log (this is your “error log” for non-coexisting variables)
  const [issues, setIssues] = useState([]);

  const minimal = useMemo(() => {
    if (!result) return null;
    const clicksSigned = result?.clicksSigned || {};
    const dial = dialFromClicksSigned(clicksSigned);
    return {
      dial,
      clicksSigned: {
        windage: Number(clicksSigned.windage ?? 0),
        elevation: Number(clicksSigned.elevation ?? 0),
      },
      poib: result?.poibInches || {},
      computeStatus: result?.computeStatus || "",
      backendSec: result?.sec || {},
    };
  }, [result]);

  function addIssue(issue) {
    setIssues((prev) => [issue, ...prev].slice(0, 25));
  }

  function clearIssues() {
    setIssues([]);
  }

  function onChooseFile(e) {
    const f = e.target.files?.[0] || null;
    setFile(f);
    setResult(null);
    setStatus("");
    clearIssues();

    if (f) setPreviewUrl(URL.createObjectURL(f));
    else setPreviewUrl("");
  }

  // The “incongruence gate”
  // 1) validates target input parses
  // 2) validates image aspect ratio roughly matches expected target aspect (when known)
  // 3) validates that what we SEND is congruent with what the user chose
  async function validateBeforeSend(normalizedMeta) {
    if (!parsedTarget.ok) {
      addIssue(makeIssue(
        "TARGET_INPUT_INVALID",
        "Target size input cannot be parsed.",
        { targetInput, error: parsedTarget.error }
      ));
      throw new Error("Fix target size input.");
    }

    // what we intend to send to backend (legacy): long side inches
    const targetSizeInchesToSend = parsedTarget.long;

    // (A) simple contradiction check: user typed 8.5x11 but sending 23 etc.
    if (String(targetInput).includes("8.5") && Math.abs(targetSizeInchesToSend - 11) > 0.01) {
      addIssue(makeIssue(
        "TARGET_SEND_CONTRADICTION",
        "Target input implies 8.5×11, but the computed long-side-to-send is not 11.",
        {
          targetInput,
          computedLongSideToSend: targetSizeInchesToSend,
          expectedLongSide: 11,
        }
      ));
      throw new Error("Target mismatch: input 8.5×11 must send long side = 11.");
    }

    // (B) aspect ratio check (only if we know both sides)
    if (parsedTarget.short && parsedTarget.aspect && normalizedMeta?.width && normalizedMeta?.height) {
      const imgLong = Math.max(normalizedMeta.width, normalizedMeta.height);
      const imgShort = Math.min(normalizedMeta.width, normalizedMeta.height);
      const imgAspect = imgLong / imgShort;

      // tolerance: 12% (you can tighten later after more test photos)
      const tol = 0.12;
      const diff = Math.abs(imgAspect - parsedTarget.aspect) / parsedTarget.aspect;

      if (diff > tol) {
        addIssue(makeIssue(
          "ASPECT_RATIO_MISMATCH",
          "Image aspect ratio does not match the chosen target size. Likely crop/zoom/wrong target selected.",
          {
            targetInput,
            expectedAspect: parsedTarget.aspect,
            imageAspect: imgAspect,
            diffRatio: diff,
            imageWH: { w: normalizedMeta.width, h: normalizedMeta.height },
            note: "This is a safety gate: it prevents wrong size math from producing fake click outputs."
          }
        ));
        throw new Error("Aspect mismatch: image doesn’t match the selected target size.");
      }
    }

    return { targetSizeInchesToSend };
  }

  async function onSend() {
    if (!file) {
      setStatus("Pick an image first.");
      return;
    }

    setStatus("Normalizing image (EXIF)...");
    setResult(null);
    clearIssues();

    try {
      const normalized = await normalizeImageFile(file);
      const cleanFile = normalized.file;
      const meta = normalized.meta;

      // --- VALIDATION GATE ---
      setStatus("Validating input congruence...");
      const { targetSizeInchesToSend } = await validateBeforeSend(meta);

      // --- SEND ---
      setStatus("Uploading...");
      const fd = new FormData();
      fd.append("image", cleanFile);

      // core fields
      fd.append("distanceYards", String(distanceYards));
      fd.append("clickValueMoa", String(clickValueMoa));

      // legacy backend expects this name today
      fd.append("targetSizeInches", String(targetSizeInchesToSend));

      // extra fields for audit + future backend validation (safe to ignore if backend doesn’t use)
      fd.append("targetSpec", parsedTarget.spec);
      fd.append("targetLongSideInches", String(parsedTarget.long));
      if (parsedTarget.short) fd.append("targetShortSideInches", String(parsedTarget.short));

      const res = await fetch(SEC_ENDPOINT, { method: "POST", body: fd });
      const text = await res.text();

      let json;
      try {
        json = JSON.parse(text);
      } catch {
        addIssue(makeIssue(
          "BACKEND_NON_JSON",
          "Backend did not return JSON.",
          { httpStatus: res.status, text: text?.slice(0, 400) }
        ));
        throw new Error(text || `HTTP ${res.status}`);
      }

      if (!res.ok || json?.ok === false) {
        addIssue(makeIssue(
          "BACKEND_ERROR",
          "Backend returned an error.",
          { httpStatus: res.status, backend: json }
        ));
        throw new Error(json?.error || json?.message || `HTTP ${res.status}`);
      }

      // --- RESPONSE CONGRUENCE CHECK ---
      // If backend echoes a different target size than we sent, that’s a hard mismatch.
      const echoed = Number(json?.sec?.targetSizeInches);
      if (Number.isFinite(echoed) && Math.abs(echoed - targetSizeInchesToSend) > 0.01) {
        addIssue(makeIssue(
          "BACKEND_ECHO_MISMATCH",
          "Backend sec.targetSizeInches does not match what the client sent.",
          {
            targetInput,
            sentTargetSizeInches: targetSizeInchesToSend,
            backendEchoTargetSizeInches: echoed,
          }
        ));
        throw new Error("Backend echo mismatch: refusing to show click outputs.");
      }

      setResult(json);
      setStatus("Done.");
    } catch (err) {
      setStatus(String(err?.message || err));
    }
  }

  return (
    <div style={{ padding: 18, fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial" }}>
      <h1 style={{ margin: 0 }}>SCZN3 SEC — Congruence-Gated Click Test</h1>

      <div style={{ marginTop: 6, color: "#444" }}>
        Endpoint: {SEC_ENDPOINT}
        <br />
        This build refuses to output clicks if target size + image data are not congruent.
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginTop: 14 }}>
        {/* LEFT */}
        <div style={{ border: "2px solid #222", padding: 14, borderRadius: 12 }}>
          <div style={{ marginBottom: 10 }}>
            <input type="file" accept="image/*" onChange={onChooseFile} />
          </div>

          <div style={{ marginBottom: 10 }}>
            <div style={{ fontWeight: 900 }}>Target Size</div>
            <div style={{ display: "flex", gap: 10, marginTop: 6, alignItems: "center" }}>
              <select
                value={targetInput}
                onChange={(e) => setTargetInput(e.target.value)}
                style={{ padding: 10, fontSize: 16, width: 220 }}
              >
                <option value="8.5x11">8.5x11</option>
                <option value="23x23">23x23</option>
                <option value="11x17">11x17</option>
              </select>

              <input
                value={targetInput}
                onChange={(e) => setTargetInput(e.target.value)}
                style={{ padding: 10, fontSize: 16, flex: 1 }}
                placeholder="Or type: 8.5x11"
              />
            </div>

            <div style={{ marginTop: 8, fontFamily: "monospace", fontSize: 13, color: "#222" }}>
              Parsed:{" "}
              {parsedTarget.ok
                ? `spec=${parsedTarget.spec} long=${f2(parsedTarget.long)} short=${parsedTarget.short ? f2(parsedTarget.short) : "?"}`
                : `ERROR: ${parsedTarget.error}`}
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
            <div>
              <div style={{ fontWeight: 800 }}>Distance (yards)</div>
              <input
                style={{ width: "100%", padding: 10, fontSize: 16, marginTop: 6 }}
                value={distanceYards}
                onChange={(e) => setDistanceYards(Number(e.target.value))}
              />
            </div>

            <div>
              <div style={{ fontWeight: 800 }}>Click Value (MOA)</div>
              <input
                style={{ width: "100%", padding: 10, fontSize: 16, marginTop: 6 }}
                value={clickValueMoa}
                onChange={(e) => setClickValueMoa(Number(e.target.value))}
              />
            </div>
          </div>

          <button
            onClick={onSend}
            style={{
              width: "100%",
              padding: 14,
              fontSize: 18,
              fontWeight: 900,
              borderRadius: 10,
              border: "3px solid #2c66ff",
              background: "white",
              cursor: "pointer",
            }}
          >
            Send (with Congruence Gate)
          </button>

          <div style={{ marginTop: 10 }}>
            <b>Status:</b> {status}
          </div>

          {/* INCONGRUENCE LOG */}
          {issues.length > 0 && (
            <div style={{ marginTop: 12, border: "3px solid #d33", padding: 12, borderRadius: 10 }}>
              <div style={{ fontWeight: 900, fontSize: 16, marginBottom: 8 }}>
                Incongruence Log (blocked or flagged)
              </div>
              {issues.map((x, i) => (
                <div key={i} style={{ marginBottom: 10 }}>
                  <div style={{ fontWeight: 900 }}>
                    {x.code} — {x.message}
                  </div>
                  <div style={{ fontFamily: "monospace", fontSize: 12, whiteSpace: "pre-wrap" }}>
                    {JSON.stringify({ ts: x.ts, ...x.details }, null, 2)}
                  </div>
                </div>
              ))}
              <button
                onClick={clearIssues}
                style={{ padding: 10, borderRadius: 8, border: "1px solid #999", cursor: "pointer" }}
              >
                Clear Log
              </button>
            </div>
          )}

          {/* MINIMAL OUTPUT */}
          {minimal && (
            <div style={{ marginTop: 14, border: "3px solid #2aa66a", padding: 14, borderRadius: 10 }}>
              <div style={{ fontWeight: 900, fontSize: 18, marginBottom: 8 }}>Scope Clicks (Minimal)</div>

              <div style={{ fontSize: 18, lineHeight: 1.6 }}>
                <div><b>Windage:</b> {minimal.dial.windage} <b>clicks</b></div>
                <div><b>Elevation:</b> {minimal.dial.elevation} <b>clicks</b></div>
              </div>

              <div style={{ marginTop: 10, fontFamily: "monospace", fontSize: 13, color: "#222" }}>
                clicksSigned: w={f2(minimal.clicksSigned.windage)}, e={f2(minimal.clicksSigned.elevation)}{"\n"}
                POIB inches: x={f2(minimal.poib?.x ?? 0)}, y={f2(minimal.poib?.y ?? 0)}{"\n"}
                computeStatus: {String(minimal.computeStatus)}{"\n"}
                backend sec.targetSizeInches: {f2(Number(minimal.backendSec?.targetSizeInches ?? 0))}
              </div>

              <label style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 10 }}>
                <input type="checkbox" checked={showRaw} onChange={(e) => setShowRaw(e.target.checked)} />
                Show raw JSON
              </label>
            </div>
          )}
        </div>

        {/* RIGHT */}
        <div style={{ border: "2px solid #222", padding: 14, borderRadius: 12 }}>
          <div style={{ fontWeight: 900, fontSize: 18, marginBottom: 10 }}>Preview</div>

          <div style={{ border: "2px solid #333", borderRadius: 10, overflow: "hidden" }}>
            {previewUrl ? (
              <img src={previewUrl} alt="preview" style={{ width: "100%", display: "block" }} />
            ) : (
              <div style={{ padding: 20, color: "#666" }}>Choose an image to preview it.</div>
            )}
          </div>

          {showRaw && result && (
            <pre
              style={{
                marginTop: 12,
                background: "#111",
                color: "#fff",
                padding: 12,
                borderRadius: 10,
                overflowX: "auto",
                fontSize: 12,
              }}
            >
{JSON.stringify(result, null, 2)}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}
