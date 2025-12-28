import React, { useMemo, useState } from "react";

const DEFAULT_ENDPOINT = "https://sczn3-sec-backend-pipe.onrender.com/api/sec";

function round2(n) {
  return (Math.round(n * 100) / 100).toFixed(2);
}

function parseTargetSpec(specRaw) {
  const s = (specRaw || "").trim().toLowerCase();
  // Accept "11", "8.5x11", "8.5×11"
  if (!s) return { ok: false, reason: "EMPTY" };

  const n = Number(s);
  if (Number.isFinite(n) && n > 0) {
    return { ok: true, spec: String(n), long: n, short: null };
  }

  const cleaned = s.replace("×", "x");
  const parts = cleaned.split("x").map((p) => Number(p.trim()));
  if (parts.length === 2 && parts.every((x) => Number.isFinite(x) && x > 0)) {
    const long = Math.max(parts[0], parts[1]);
    const short = Math.min(parts[0], parts[1]);
    return { ok: true, spec: `${short}x${long}`, long, short };
  }

  return { ok: false, reason: "UNPARSEABLE" };
}

function dialFromClicksSigned(clicksSigned) {
  const w = Number(clicksSigned?.windage);
  const e = Number(clicksSigned?.elevation);

  if (!Number.isFinite(w) || !Number.isFinite(e)) return null;

  const wDir = w < 0 ? "LEFT" : "RIGHT";
  const eDir = e < 0 ? "DOWN" : "UP";

  return {
    windage: `${wDir} ${round2(Math.abs(w))} clicks`,
    elevation: `${eDir} ${round2(Math.abs(e))} clicks`,
    w,
    e,
  };
}

export default function App() {
  const [endpoint, setEndpoint] = useState(DEFAULT_ENDPOINT);

  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");

  const [distanceYards, setDistanceYards] = useState(100);
  const [clickValueMoa, setClickValueMoa] = useState(0.25);

  const [targetSpec, setTargetSpec] = useState("8.5x11");

  const parsed = useMemo(() => parseTargetSpec(targetSpec), [targetSpec]);

  const [status, setStatus] = useState("");
  const [resp, setResp] = useState(null);
  const [showRaw, setShowRaw] = useState(true);

  const [incongruence, setIncongruence] = useState([]);

  function addIncon(code, detail) {
    setIncongruence((prev) => [...prev, { code, ...detail }]);
  }

  async function onSend() {
    setStatus("Sending...");
    setResp(null);
    setIncongruence([]);

    if (!file) {
      setStatus("Pick a file first.");
      return;
    }
    if (!parsed.ok) {
      setStatus("Fix target size (ex: 8.5x11 or 23).");
      return;
    }

    const fd = new FormData();
    fd.append("image", file);
    fd.append("distanceYards", String(distanceYards));
    fd.append("clickValueMoa", String(clickValueMoa));

    // IMPORTANT: send LONG SIDE inches (11 for 8.5x11)
    fd.append("targetSizeInches", String(parsed.long));

    let json;
    try {
      const r = await fetch(endpoint, { method: "POST", body: fd });
      json = await r.json();
    } catch (e) {
      setStatus(`Network/parse error: ${e?.message || String(e)}`);
      return;
    }

    setResp(json);
    setStatus("Done.");

    // Congruence checks
    const backendTS = Number(json?.sec?.targetSizeInches);
    if (!Number.isFinite(backendTS)) {
      addIncon("BACKEND_MISSING_TARGET_SIZE", {
        fix: "Backend must echo sec.targetSizeInches (numeric).",
      });
    } else if (Math.abs(backendTS - parsed.long) > 0.01) {
      addIncon("TARGET_SIZE_INCONGRUENT", {
        uiLong: parsed.long,
        backendLong: backendTS,
        fix: "Do not trust output until UI and backend agree on target size inches.",
      });
    }

    // Direction checks (dial vs clicksSigned)
    const d = dialFromClicksSigned(json?.clicksSigned);
    if (!d) {
      addIncon("MISSING_CLICKS_SIGNED", {
        fix: "Backend must return clicksSigned.windage and clicksSigned.elevation as numbers.",
      });
      return;
    }

    const backendDialW = String(json?.dial?.windage || "");
    const backendDialE = String(json?.dial?.elevation || "");

    // If backend includes dial strings, verify they match click sign direction
    if (backendDialW) {
      const expectW = d.w < 0 ? "LEFT" : "RIGHT";
      if (!backendDialW.toUpperCase().includes(expectW)) {
        addIncon("WINDAGE_DIRECTION_INCONGRUENT", {
          clicksSigned: { windage: d.w },
          backendDial: backendDialW,
          expected: expectW,
          fix: "Backend dial windage must be derived from clicksSigned sign.",
        });
      }
    }
    if (backendDialE) {
      const expectE = d.e < 0 ? "DOWN" : "UP";
      if (!backendDialE.toUpperCase().includes(expectE)) {
        addIncon("ELEVATION_DIRECTION_INCONGRUENT", {
          clicksSigned: { elevation: d.e },
          backendDial: backendDialE,
          expected: expectE,
          fix: "Backend dial elevation must be derived from clicksSigned sign (and EXIF/Y-up must be normalized).",
        });
      }
    }
  }

  function onPickFile(f) {
    setFile(f || null);
    setResp(null);
    setIncongruence([]);
    setStatus("");

    if (previewUrl) URL.revokeObjectURL(previewUrl);
    if (f) setPreviewUrl(URL.createObjectURL(f));
    else setPreviewUrl("");
  }

  const minimal = useMemo(() => dialFromClicksSigned(resp?.clicksSigned), [resp]);

  return (
    <div style={{ fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial", padding: 18 }}>
      <h1 style={{ margin: "0 0 8px 0" }}>SCZN3 SEC — Upload Test</h1>

      <div style={{ marginBottom: 10 }}>
        <div style={{ fontWeight: 700 }}>Endpoint</div>
        <input
          value={endpoint}
          onChange={(e) => setEndpoint(e.target.value)}
          style={{ width: "100%", padding: 8, border: "1px solid #ccc", borderRadius: 6 }}
        />
        <div style={{ marginTop: 6, opacity: 0.8 }}>
          POST multipart field: <b>image</b> (plus distanceYards, clickValueMoa, targetSizeInches)
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, alignItems: "start" }}>
        <div>
          <div style={{ padding: 14, border: "2px solid #111", borderRadius: 10 }}>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => onPickFile(e.target.files?.[0] || null)}
            />

            <div style={{ marginTop: 14 }}>
              <div style={{ fontWeight: 700 }}>Target Size</div>
              <input
                value={targetSpec}
                onChange={(e) => setTargetSpec(e.target.value)}
                style={{ width: "100%", padding: 10, border: "1px solid #ccc", borderRadius: 8 }}
              />
              <div style={{ marginTop: 6, opacity: 0.85 }}>
                {parsed.ok ? (
                  <>Parsed: spec={parsed.spec} long={round2(parsed.long)} short={parsed.short ? round2(parsed.short) : "n/a"}</>
                ) : (
                  <>Enter target size like <b>8.5x11</b> or <b>23</b>.</>
                )}
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 14 }}>
              <div>
                <div style={{ fontWeight: 700 }}>Distance (yards)</div>
                <input
                  type="number"
                  value={distanceYards}
                  onChange={(e) => setDistanceYards(Number(e.target.value))}
                  style={{ width: "100%", padding: 10, border: "1px solid #ccc", borderRadius: 8 }}
                />
              </div>

              <div>
                <div style={{ fontWeight: 700 }}>Click Value (MOA)</div>
                <input
                  type="number"
                  step="0.01"
                  value={clickValueMoa}
                  onChange={(e) => setClickValueMoa(Number(e.target.value))}
                  style={{ width: "100%", padding: 10, border: "1px solid #ccc", borderRadius: 8 }}
                />
              </div>
            </div>

            <button
              onClick={onSend}
              style={{
                marginTop: 14,
                width: "100%",
                padding: 14,
                borderRadius: 10,
                border: "3px solid #2b6cb0",
                background: "white",
                fontWeight: 800,
                fontSize: 16,
              }}
            >
              Send (with Congruence Gate)
            </button>

            <div style={{ marginTop: 10, fontWeight: 700 }}>Status: <span style={{ fontWeight: 500 }}>{status}</span></div>

            {minimal && (
              <div style={{ marginTop: 14, padding: 14, border: "3px solid #2f855a", borderRadius: 10 }}>
                <div style={{ fontWeight: 900, fontSize: 18, marginBottom: 8 }}>Scope Clicks (Minimal)</div>
                <div style={{ fontSize: 16 }}>
                  <div><b>Windage:</b> {minimal.windage}</div>
                  <div><b>Elevation:</b> {minimal.elevation}</div>
                </div>
                <div style={{ marginTop: 10, fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace", fontSize: 12, opacity: 0.9 }}>
                  clicksSigned: w={round2(minimal.w)}, e={round2(minimal.e)}{" "}
                  {" "}backend sec.targetSizeInches: {Number(resp?.sec?.targetSizeInches).toFixed(2)}
                </div>
              </div>
            )}

            {incongruence.length > 0 && (
              <div style={{ marginTop: 14, padding: 14, border: "3px solid #c53030", borderRadius: 10 }}>
                <div style={{ fontWeight: 900, fontSize: 18, marginBottom: 8 }}>Incongruence Log</div>
                <div style={{ marginBottom: 8 }}>
                  This result was received, but one or more variables are not congruent. <b>Do not trust output until fixed.</b>
                </div>
                {incongruence.map((x, i) => (
                  <div key={i} style={{ marginTop: 10, padding: 10, border: "1px solid #c53030", borderRadius: 8 }}>
                    <div style={{ fontWeight: 900 }}>{x.code}</div>
                    <pre style={{ margin: "6px 0 0 0", whiteSpace: "pre-wrap" }}>
                      {JSON.stringify(x, null, 2)}
                    </pre>
                  </div>
                ))}
              </div>
            )}

            <div style={{ marginTop: 12 }}>
              <label style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
                <input type="checkbox" checked={showRaw} onChange={(e) => setShowRaw(e.target.checked)} />
                Show raw JSON
              </label>
            </div>
          </div>
        </div>

        <div>
          <div style={{ fontWeight: 900, marginBottom: 8 }}>Preview</div>
          <div style={{ border: "2px solid #111", borderRadius: 10, padding: 10, background: "#fff" }}>
            {previewUrl ? (
              <img src={previewUrl} alt="preview" style={{ width: "100%", height: "auto", display: "block" }} />
            ) : (
              <div style={{ padding: 24, opacity: 0.7 }}>Choose an image to preview.</div>
            )}
          </div>

          {showRaw && resp && (
            <div style={{ marginTop: 14 }}>
              <div style={{ fontWeight: 900, marginBottom: 8 }}>Response</div>
              <pre style={{ padding: 12, background: "#111", color: "#fff", borderRadius: 10, overflowX: "auto" }}>
                {JSON.stringify(resp, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
