import React, { useMemo, useState } from "react";

/**
 * SCZN3 SEC — Minimal Scope Clicks UI + Congruence Gate
 * - Parses target size (e.g., 8.5x11) and sends LONG side to backend.
 * - Displays minimal scope clicks.
 * - Maps dial direction from POIB sign (not backend sign), so UP/DOWN is consistent.
 * - Emits an on-screen Incongruence Log if UI vs backend disagree.
 */

const DEFAULT_ENDPOINT = "https://sczn3-sec-backend-pipe.onrender.com/api/sec";

function round2(n) {
  if (typeof n !== "number" || Number.isNaN(n)) return "";
  return (Math.round(n * 100) / 100).toFixed(2);
}

function toNumber(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function normalizeSizeSpec(raw) {
  if (!raw) return "";
  return String(raw)
    .trim()
    .toLowerCase()
    .replaceAll("×", "x")
    .replaceAll(" ", "");
}

// Returns { ok, spec, long, short, reason }
function parseTargetSize(raw) {
  const spec = normalizeSizeSpec(raw);

  // Accept a simple number like "23" or "11"
  if (/^\d+(\.\d+)?$/.test(spec)) {
    const n = Number(spec);
    if (n > 0) return { ok: true, spec, long: n, short: n };
    return { ok: false, spec, long: null, short: null, reason: "Size must be > 0" };
  }

  // Accept "8.5x11"
  const m = spec.match(/^(\d+(\.\d+)?)x(\d+(\.\d+)?)$/);
  if (!m) {
    return { ok: false, spec, long: null, short: null, reason: 'Use like "8.5x11" or "23"' };
  }
  const a = Number(m[1]);
  const b = Number(m[3]);
  if (!(a > 0 && b > 0)) {
    return { ok: false, spec, long: null, short: null, reason: "Both sides must be > 0" };
  }
  const long = Math.max(a, b);
  const short = Math.min(a, b);
  return { ok: true, spec, long, short };
}

function getDialFromPoib(poibX, poibY) {
  // If group is RIGHT of bull (x > 0), dial LEFT to bring it left.
  // If group is LEFT of bull (x < 0), dial RIGHT.
  let windDir = "CENTER";
  if (typeof poibX === "number") {
    if (poibX > 0) windDir = "LEFT";
    else if (poibX < 0) windDir = "RIGHT";
  }

  // If group is BELOW bull (image y > 0), dial UP.
  // If group is ABOVE bull (image y < 0), dial DOWN.
  let elevDir = "LEVEL";
  if (typeof poibY === "number") {
    if (poibY > 0) elevDir = "UP";
    else if (poibY < 0) elevDir = "DOWN";
  }

  return { windDir, elevDir };
}

export default function App() {
  const [endpoint, setEndpoint] = useState(DEFAULT_ENDPOINT);

  const [targetPreset, setTargetPreset] = useState("8.5x11");
  const [targetSizeText, setTargetSizeText] = useState("8.5x11");

  const [distanceYards, setDistanceYards] = useState("100");
  const [clickValueMoa, setClickValueMoa] = useState("0.25");

  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");

  const [status, setStatus] = useState("");
  const [result, setResult] = useState(null);
  const [showJson, setShowJson] = useState(true);

  const [gateLog, setGateLog] = useState(null);

  const parsed = useMemo(() => parseTargetSize(targetSizeText), [targetSizeText]);

  function onChooseFile(e) {
    const f = e.target.files?.[0] || null;
    setFile(f);
    setResult(null);
    setGateLog(null);
    setStatus("");
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    if (f) setPreviewUrl(URL.createObjectURL(f));
    else setPreviewUrl("");
  }

  function applyPreset(v) {
    setTargetPreset(v);
    setTargetSizeText(v);
  }

  async function onSend() {
    setGateLog(null);
    setResult(null);

    if (!file) {
      setStatus("Choose an image first.");
      return;
    }

    if (!parsed.ok) {
      setStatus(`Fix Target Size: ${parsed.reason}`);
      return;
    }

    const d = toNumber(distanceYards);
    const cv = toNumber(clickValueMoa);
    if (d == null || d <= 0) return setStatus("Distance must be a positive number.");
    if (cv == null || cv <= 0) return setStatus("Click Value must be a positive number.");

    // Congruence Gate: ALWAYS send LONG side for non-square specs.
    const targetSizeInchesToSend = parsed.long;

    setStatus("Sending…");

    try {
      const form = new FormData();
      form.append("image", file);
      form.append("distanceYards", String(d));
      form.append("clickValueMoa", String(cv));
      form.append("targetSizeInches", String(targetSizeInchesToSend));

      const res = await fetch(endpoint, { method: "POST", body: form });
      const data = await res.json().catch(() => null);

      if (!res.ok || !data || data.ok !== true) {
        setStatus(`Backend error (${res.status}).`);
        setResult(data || { ok: false, status: res.status });
        return;
      }

      // Gate check: UI intent vs backend echo
      const backendSize = data?.sec?.targetSizeInches;
      const backendPoibX = data?.poibInches?.x;
      const backendPoibY = data?.poibInches?.y;

      const issues = [];
      if (typeof backendSize === "number") {
        const diff = Math.abs(backendSize - targetSizeInchesToSend);
        if (diff > 0.01) {
          issues.push({
            code: "TARGET_SIZE_MISMATCH",
            uiParsed: {
              spec: parsed.spec,
              long: Number(round2(parsed.long)),
              short: Number(round2(parsed.short)),
              sentToBackend: Number(round2(targetSizeInchesToSend)),
            },
            backendEcho: {
              sec_targetSizeInches: Number(round2(backendSize)),
            },
            fix: "Reject result (do not trust clicks). Confirm correct target size + confirm backend is not overriding targetSizeInches.",
          });
        }
      }

      // Direction sanity: compute dial from POIB sign (trusted) and compare backend dial if present
      const dialFromPoib = getDialFromPoib(backendPoibX, backendPoibY);
      const backendDialW = data?.dial?.windage || "";
      const backendDialE = data?.dial?.elevation || "";

      // Light check only (string contains LEFT/RIGHT and UP/DOWN)
      if (backendDialW) {
        const hasWind =
          (dialFromPoib.windDir === "LEFT" && backendDialW.toUpperCase().includes("LEFT")) ||
          (dialFromPoib.windDir === "RIGHT" && backendDialW.toUpperCase().includes("RIGHT")) ||
          (dialFromPoib.windDir === "CENTER" && backendDialW.toUpperCase().includes("CENTER"));
        if (!hasWind) {
          issues.push({
            code: "WINDAGE_DIRECTION_INCONGRUENT",
            poib: { x: Number(round2(backendPoibX)) },
            uiDial: dialFromPoib.windDir,
            backendDial: backendDialW,
            fix: "Use UI dial direction (POIB-based). Backend dial string is inconsistent.",
          });
        }
      }

      if (backendDialE) {
        const hasElev =
          (dialFromPoib.elevDir === "UP" && backendDialE.toUpperCase().includes("UP")) ||
          (dialFromPoib.elevDir === "DOWN" && backendDialE.toUpperCase().includes("DOWN")) ||
          (dialFromPoib.elevDir === "LEVEL" && backendDialE.toUpperCase().includes("LEVEL"));
        if (!hasElev) {
          issues.push({
            code: "ELEVATION_DIRECTION_INCONGRUENT",
            poib: { y: Number(round2(backendPoibY)) },
            uiDial: dialFromPoib.elevDir,
            backendDial: backendDialE,
            fix: "Use UI dial direction (POIB-based). Backend dial string is inconsistent (likely y-axis flip).",
          });
        }
      }

      if (issues.length) {
        setGateLog({
          title: "Incongruence Log",
          issues,
          note: "This result was received, but one or more variables are not congruent. Do not trust the output until fixed.",
        });
      }

      // Compute minimal clicks display from backend clicksSigned magnitudes
      const wSigned = data?.clicksSigned?.windage;
      const eSigned = data?.clicksSigned?.elevation;

      const wAbs = typeof wSigned === "number" ? Math.abs(wSigned) : null;
      const eAbs = typeof eSigned === "number" ? Math.abs(eSigned) : null;

      const uiDial = getDialFromPoib(backendPoibX, backendPoibY);

      const minimal = {
        windageDir: uiDial.windDir,
        windageClicks: wAbs,
        elevationDir: uiDial.elevDir,
        elevationClicks: eAbs,
      };

      setResult({ ...data, __ui: { parsed, sent: targetSizeInchesToSend, minimal } });
      setStatus("Done.");
    } catch (err) {
      setStatus("Network error while sending.");
      setResult({ ok: false, error: String(err) });
    }
  }

  const minimal = result?.__ui?.minimal;

  return (
    <div style={{ fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif", padding: 16 }}>
      <h1 style={{ margin: "0 0 12px 0" }}>SCZN3 SEC — Upload Test</h1>

      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 6 }}>Endpoint</div>
        <input
          value={endpoint}
          onChange={(e) => setEndpoint(e.target.value)}
          style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #ccc" }}
        />
        <div style={{ fontSize: 12, opacity: 0.75, marginTop: 6 }}>
          POST multipart field: <b>image</b>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, alignItems: "start" }}>
        {/* LEFT PANEL */}
        <div style={{ border: "2px solid #111", borderRadius: 14, padding: 14 }}>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <input type="file" accept="image/*" onChange={onChooseFile} />
          </div>

          <div style={{ marginTop: 12 }}>
            <div style={{ fontWeight: 800, marginBottom: 8 }}>Target Size</div>

            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <select
                value={targetPreset}
                onChange={(e) => applyPreset(e.target.value)}
                style={{ padding: 10, borderRadius: 10, border: "1px solid #bbb" }}
              >
                <option value="8.5x11">8.5x11</option>
                <option value="11">11</option>
                <option value="23">23</option>
              </select>

              <input
                value={targetSizeText}
                onChange={(e) => setTargetSizeText(e.target.value)}
                placeholder='e.g. "8.5x11" or "23"'
                style={{ flex: 1, padding: 10, borderRadius: 10, border: "1px solid #bbb" }}
              />
            </div>

            <div style={{ fontSize: 12, opacity: 0.75, marginTop: 6 }}>
              {parsed.ok ? (
                <>Parsed: spec={parsed.spec} &nbsp; long={round2(parsed.long)} &nbsp; short={round2(parsed.short)}</>
              ) : (
                <>Parsed: (invalid) — {parsed.reason}</>
              )}
            </div>
          </div>

          <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>Distance (yards)</div>
              <input
                value={distanceYards}
                onChange={(e) => setDistanceYards(e.target.value)}
                style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #bbb" }}
              />
            </div>
            <div>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>Click Value (MOA)</div>
              <input
                value={clickValueMoa}
                onChange={(e) => setClickValueMoa(e.target.value)}
                style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #bbb" }}
              />
            </div>
          </div>

          <button
            onClick={onSend}
            style={{
              marginTop: 14,
              width: "100%",
              padding: "14px 12px",
              borderRadius: 12,
              border: "3px solid #2b78ff",
              background: "#eaf2ff",
              fontWeight: 900,
              fontSize: 18,
              cursor: "pointer",
            }}
          >
            Send (with Congruence Gate)
          </button>

          <div style={{ marginTop: 10, fontWeight: 700 }}>Status: <span style={{ fontWeight: 600 }}>{status || "—"}</span></div>

          {/* Minimal Scope Clicks */}
          {minimal && (
            <div style={{ marginTop: 12, border: "3px solid #2c9b5f", borderRadius: 12, padding: 12 }}>
              <div style={{ fontWeight: 900, fontSize: 20, marginBottom: 10 }}>Scope Clicks (Minimal)</div>

              <div style={{ fontSize: 16, marginBottom: 6 }}>
                <b>Windage:</b>{" "}
                {minimal.windageDir} {minimal.windageClicks == null ? "—" : `${round2(minimal.windageClicks)} clicks`}
              </div>

              <div style={{ fontSize: 16, marginBottom: 10 }}>
                <b>Elevation:</b>{" "}
                {minimal.elevationDir} {minimal.elevationClicks == null ? "—" : `${round2(minimal.elevationClicks)} clicks`}
              </div>

              <div style={{ fontSize: 12, opacity: 0.85 }}>
                clicksSigned: w={round2(result?.clicksSigned?.windage)}, e={round2(result?.clicksSigned?.elevation)} &nbsp; POIB inches: x={round2(result?.poibInches?.x)}, y={round2(result?.poibInches?.y)}
              </div>

              <div style={{ fontSize: 12, opacity: 0.85, marginTop: 6 }}>
                computeStatus: {String(result?.computeStatus || "")} &nbsp; backend sec.targetSizeInches: {round2(result?.sec?.targetSizeInches)}
              </div>
            </div>
          )}

          {/* Incongruence Log */}
          {gateLog && (
            <div style={{ marginTop: 12, border: "3px solid #c0392b", borderRadius: 12, padding: 12, background: "#fff5f5" }}>
              <div style={{ fontWeight: 900, fontSize: 18, marginBottom: 8 }}>{gateLog.title}</div>
              <div style={{ fontSize: 12, marginBottom: 10 }}>{gateLog.note}</div>
              {gateLog.issues.map((it, idx) => (
                <div key={idx} style={{ marginBottom: 10, padding: 10, borderRadius: 10, border: "1px solid #e0a0a0", background: "#ffffff" }}>
                  <div style={{ fontWeight: 800 }}>{it.code}</div>
                  <pre style={{ margin: "8px 0 0 0", whiteSpace: "pre-wrap", fontSize: 12 }}>
                    {JSON.stringify(it, null, 2)}
                  </pre>
                </div>
              ))}
            </div>
          )}

          <div style={{ marginTop: 10 }}>
            <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input type="checkbox" checked={showJson} onChange={(e) => setShowJson(e.target.checked)} />
              <span style={{ fontWeight: 700 }}>Show raw JSON</span>
            </label>
          </div>
        </div>

        {/* RIGHT PANEL */}
        <div style={{ border: "2px solid #111", borderRadius: 14, padding: 14 }}>
          <div style={{ fontWeight: 900, fontSize: 20, marginBottom: 10 }}>Preview</div>

          <div style={{ border: "3px solid #111", borderRadius: 12, padding: 10, minHeight: 260, background: "#fafafa" }}>
            {previewUrl ? (
              <img src={previewUrl} alt="preview" style={{ width: "100%", height: "auto", borderRadius: 10 }} />
            ) : (
              <div style={{ opacity: 0.7 }}>Choose an image to preview it here.</div>
            )}
          </div>

          {showJson && (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontWeight: 900, fontSize: 18, marginBottom: 8 }}>Response</div>
              <pre style={{ whiteSpace: "pre-wrap", fontSize: 12, background: "#111", color: "#eaeaea", padding: 12, borderRadius: 12 }}>
                {result ? JSON.stringify(result, null, 2) : "{ }"}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
