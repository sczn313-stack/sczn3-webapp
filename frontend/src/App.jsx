import React, { useMemo, useState } from "react";

const SEC_ENDPOINT_DEFAULT = "https://sczn3-sec-backend-pipe.onrender.com/api/sec";

// 1 MOA ≈ 1.047 inches at 100 yards
function inchesPerMoaAtYards(yards) {
  const y = Number(yards);
  if (!Number.isFinite(y) || y <= 0) return NaN;
  return 1.047 * (y / 100);
}

function f2(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return "0.00";
  return (Math.round(x * 100) / 100).toFixed(2);
}

function parseTargetSize(raw) {
  const s = String(raw || "").trim().toLowerCase().replaceAll("×", "x").replace(/\s+/g, "");
  if (!s) return { ok: false, reason: "Target size required (ex: 8.5x11 or 23)." };

  // single number like "23"
  if (/^\d+(\.\d+)?$/.test(s)) {
    const v = Number(s);
    if (!Number.isFinite(v) || v <= 0) return { ok: false, reason: "Bad target size number." };
    return { ok: true, spec: `${v}x${v}`, long: v, short: v };
  }

  const m = s.match(/^(\d+(\.\d+)?)x(\d+(\.\d+)?)$/);
  if (!m) return { ok: false, reason: 'Bad format. Use like "8.5x11" or "23".' };

  const a = Number(m[1]);
  const b = Number(m[3]);
  if (!Number.isFinite(a) || !Number.isFinite(b) || a <= 0 || b <= 0) {
    return { ok: false, reason: "Bad dimensions." };
  }

  const long = Math.max(a, b);
  const short = Math.min(a, b);
  return { ok: true, spec: `${a}x${b}`, long, short };
}

// iOS photos often store rotation in EXIF. Re-encode upright so x/y don’t silently swap.
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

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.92));
  if (!blob) return { file, meta: { w: bitmap.width, h: bitmap.height } };

  const cleanFile = new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", {
    type: "image/jpeg",
    lastModified: Date.now(),
  });

  return { file: cleanFile, meta: { w: bitmap.width, h: bitmap.height } };
}

// POIB truth rules (based on what your screenshots show):
// - poib.x > 0 means impacts RIGHT of bull => dial LEFT
// - poib.y > 0 means impacts BELOW bull (image Y grows down) => dial UP
function dialDirectionFromPoib(poibX, poibY) {
  const x = Number(poibX);
  const y = Number(poibY);

  const windDir =
    !Number.isFinite(x) || x === 0 ? "CENTER" :
    x > 0 ? "LEFT" : "RIGHT";

  const elevDir =
    !Number.isFinite(y) || y === 0 ? "LEVEL" :
    y > 0 ? "UP" : "DOWN";

  return { windDir, elevDir };
}

function absClicksFromPoib(poibInches, inchesPerClick) {
  const x = Number(poibInches?.x);
  const y = Number(poibInches?.y);
  const ipc = Number(inchesPerClick);

  if (!Number.isFinite(ipc) || ipc <= 0) return { w: null, e: null };

  const w = Number.isFinite(x) ? Math.abs(x) / ipc : null;
  const e = Number.isFinite(y) ? Math.abs(y) / ipc : null;

  return { w, e };
}

export default function App() {
  const [endpoint, setEndpoint] = useState(SEC_ENDPOINT_DEFAULT);

  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");

  const [targetSize, setTargetSize] = useState("8.5x11");
  const parsedTarget = useMemo(() => parseTargetSize(targetSize), [targetSize]);

  const [distanceYards, setDistanceYards] = useState(100);
  const [clickValueMoa, setClickValueMoa] = useState(0.25);

  const [status, setStatus] = useState("");
  const [resp, setResp] = useState(null);
  const [showRaw, setShowRaw] = useState(true);

  const [issues, setIssues] = useState([]);

  const inchesPerClick = useMemo(() => {
    const ipmoa = inchesPerMoaAtYards(distanceYards);
    const cv = Number(clickValueMoa);
    if (!Number.isFinite(ipmoa) || !Number.isFinite(cv) || cv <= 0) return NaN;
    return ipmoa * cv;
  }, [distanceYards, clickValueMoa]);

  function addIssue(code, details) {
    setIssues((prev) => [{ code, details }, ...prev].slice(0, 20));
  }

  function onChooseFile(e) {
    const f = e.target.files?.[0] || null;
    setFile(f);
    setResp(null);
    setIssues([]);
    setStatus("");
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    if (f) setPreviewUrl(URL.createObjectURL(f));
    else setPreviewUrl("");
  }

  async function onSend() {
    setStatus("");
    setResp(null);
    setIssues([]);

    if (!file) {
      setStatus("Choose an image first.");
      return;
    }
    if (!parsedTarget.ok) {
      setStatus(parsedTarget.reason);
      return;
    }
    if (!endpoint?.trim()) {
      setStatus("Endpoint is empty.");
      return;
    }

    try {
      setStatus("Normalizing image…");
      const normalized = await normalizeImageFile(file);

      // Send LONG side inches (8.5x11 => 11.00)
      const targetSizeInchesToSend = parsedTarget.long;

      setStatus("Uploading…");
      const fd = new FormData();
      fd.append("image", normalized.file);
      fd.append("distanceYards", String(distanceYards));
      fd.append("clickValueMoa", String(clickValueMoa));
      fd.append("targetSizeInches", String(targetSizeInchesToSend));

      const r = await fetch(endpoint.trim(), { method: "POST", body: fd });
      const text = await r.text();

      let json;
      try {
        json = JSON.parse(text);
      } catch {
        addIssue("BACKEND_NON_JSON", { httpStatus: r.status, text: text?.slice(0, 500) });
        setStatus("Backend returned non-JSON.");
        return;
      }

      setResp(json);

      if (!r.ok || json?.ok === false) {
        addIssue("BACKEND_ERROR", { httpStatus: r.status, backend: json });
        setStatus("Backend error.");
        return;
      }

      // Congruence check: backend echo size
      const echoed = Number(json?.sec?.targetSizeInches);
      if (Number.isFinite(echoed) && Math.abs(echoed - targetSizeInchesToSend) > 0.01) {
        addIssue("TARGET_SIZE_MISMATCH", {
          uiTarget: { spec: parsedTarget.spec, long: f2(parsedTarget.long), short: f2(parsedTarget.short) },
          sentTargetSizeInches: f2(targetSizeInchesToSend),
          backendEchoTargetSizeInches: f2(echoed),
        });
      }

      setStatus("Done.");
    } catch (err) {
      addIssue("CLIENT_ERROR", { message: String(err?.message || err) });
      setStatus("Client error.");
    }
  }

  const poib = resp?.poibInches || {};
  const poibX = Number(poib?.x);
  const poibY = Number(poib?.y);

  const dirs = dialDirectionFromPoib(poibX, poibY);
  const absClicks = absClicksFromPoib(poib, inchesPerClick);

  const windageText =
    absClicks.w == null ? "—" :
    dirs.windDir === "CENTER" ? `CENTER 0.00 clicks` :
    `${dirs.windDir} ${f2(absClicks.w)} clicks`;

  const elevationText =
    absClicks.e == null ? "—" :
    dirs.elevDir === "LEVEL" ? `LEVEL 0.00 clicks` :
    `${dirs.elevDir} ${f2(absClicks.e)} clicks`;

  // Optional: detect backend dial flip (for visibility only)
  const backendDialW = resp?.dial?.windage || "";
  const backendDialE = resp?.dial?.elevation || "";

  const backendElevHasDown = String(backendDialE).toUpperCase().includes("DOWN");
  const backendElevHasUp = String(backendDialE).toUpperCase().includes("UP");
  const backendWindHasLeft = String(backendDialW).toUpperCase().includes("LEFT");
  const backendWindHasRight = String(backendDialW).toUpperCase().includes("RIGHT");

  const uiElevIsUp = elevationText.toUpperCase().includes("UP");
  const uiElevIsDown = elevationText.toUpperCase().includes("DOWN");
  const uiWindIsLeft = windageText.toUpperCase().includes("LEFT");
  const uiWindIsRight = windageText.toUpperCase().includes("RIGHT");

  const directionMismatch =
    resp &&
    (
      (backendElevHasUp && uiElevIsDown) ||
      (backendElevHasDown && uiElevIsUp) ||
      (backendWindHasLeft && uiWindIsRight) ||
      (backendWindHasRight && uiWindIsLeft)
    );

  return (
    <div style={{ padding: 16, fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial" }}>
      <h1 style={{ margin: "0 0 10px 0" }}>SCZN3 SEC — Click Test (Direction Fixed)</h1>

      <div style={{ marginBottom: 10 }}>
        <div style={{ fontWeight: 800 }}>Endpoint</div>
        <input
          value={endpoint}
          onChange={(e) => setEndpoint(e.target.value)}
          style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #bbb" }}
        />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, alignItems: "start" }}>
        {/* LEFT */}
        <div style={{ border: "2px solid #111", borderRadius: 12, padding: 14 }}>
          <div style={{ marginBottom: 10 }}>
            <input type="file" accept="image/*" onChange={onChooseFile} />
          </div>

          <div style={{ marginBottom: 10 }}>
            <div style={{ fontWeight: 900 }}>Target Size</div>
            <input
              value={targetSize}
              onChange={(e) => setTargetSize(e.target.value)}
              placeholder='8.5x11 or 23'
              style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #bbb", marginTop: 6 }}
            />
            <div style={{ marginTop: 6, fontFamily: "monospace", fontSize: 12 }}>
              {parsedTarget.ok
                ? `Parsed: spec=${parsedTarget.spec} long=${f2(parsedTarget.long)} short=${f2(parsedTarget.short)}`
                : `ERROR: ${parsedTarget.reason}`}
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
            <div>
              <div style={{ fontWeight: 800 }}>Distance (yards)</div>
              <input
                value={distanceYards}
                onChange={(e) => setDistanceYards(Number(e.target.value))}
                style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #bbb", marginTop: 6 }}
              />
            </div>
            <div>
              <div style={{ fontWeight: 800 }}>Click Value (MOA)</div>
              <input
                value={clickValueMoa}
                onChange={(e) => setClickValueMoa(Number(e.target.value))}
                style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #bbb", marginTop: 6 }}
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
              borderRadius: 12,
              border: "3px solid #2b78ff",
              background: "#ffffff",
              cursor: "pointer",
            }}
          >
            Send
          </button>

          <div style={{ marginTop: 10 }}><b>Status:</b> {status || "—"}</div>

          {/* MINIMAL OUTPUT */}
          {resp && (
            <div style={{ marginTop: 12, border: "3px solid #22a06b", padding: 12, borderRadius: 12 }}>
              <div style={{ fontWeight: 900, fontSize: 18, marginBottom: 8 }}>
                Scope Clicks (Minimal) — FIXED
              </div>

              <div style={{ fontSize: 18 }}><b>Windage:</b> {windageText}</div>
              <div style={{ fontSize: 18, marginTop: 6 }}><b>Elevation:</b> {elevationText}</div>

              <div style={{ marginTop: 10, fontFamily: "monospace", fontSize: 12 }}>
                POIB inches: x={f2(poibX)}, y={f2(poibY)}{"\n"}
                inchesPerClick: {Number.isFinite(inchesPerClick) ? f2(inchesPerClick) : "—"}{"\n"}
                backend sec.targetSizeInches: {f2(resp?.sec?.targetSizeInches)}
              </div>

              {directionMismatch && (
                <div style={{ marginTop: 10, border: "2px solid #b00020", borderRadius: 10, padding: 10, background: "#fff5f6" }}>
                  <div style={{ fontWeight: 900 }}>Backend dial text is flipped (ignored)</div>
                  <div style={{ fontFamily: "monospace", fontSize: 12, whiteSpace: "pre-wrap" }}>
                    backend dial.windage: {String(backendDialW)}{"\n"}
                    backend dial.elevation: {String(backendDialE)}
                  </div>
                </div>
              )}

              <label style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 10 }}>
                <input type="checkbox" checked={showRaw} onChange={(e) => setShowRaw(e.target.checked)} />
                Show raw JSON
              </label>
            </div>
          )}

          {/* INCONGRUENCE LOG */}
          {issues.length > 0 && (
            <div style={{ marginTop: 12, border: "3px solid #b00020", padding: 12, borderRadius: 12, background: "#fff5f6" }}>
              <div style={{ fontWeight: 900, fontSize: 16, marginBottom: 8 }}>Incongruence Log</div>
              {issues.map((it, idx) => (
                <div key={idx} style={{ marginBottom: 10 }}>
                  <div style={{ fontWeight: 900 }}>{it.code}</div>
                  <pre style={{ margin: 0, whiteSpace: "pre-wrap", fontFamily: "monospace", fontSize: 12 }}>
{JSON.stringify(it.details, null, 2)}
                  </pre>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* RIGHT */}
        <div style={{ border: "2px solid #111", borderRadius: 12, padding: 14 }}>
          <div style={{ fontWeight: 900, fontSize: 18, marginBottom: 10 }}>Preview</div>
          <div style={{ border: "2px solid #333", borderRadius: 12, overflow: "hidden" }}>
            {previewUrl ? (
              <img src={previewUrl} alt="preview" style={{ width: "100%", display: "block" }} />
            ) : (
              <div style={{ padding: 20, color: "#666" }}>Choose an image to preview it.</div>
            )}
          </div>

          {showRaw && resp && (
            <pre
              style={{
                marginTop: 12,
                background: "#111",
                color: "#fff",
                padding: 12,
                borderRadius: 12,
                overflowX: "auto",
                fontSize: 12,
              }}
            >
{JSON.stringify(resp, null, 2)}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}
