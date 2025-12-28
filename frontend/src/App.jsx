import React, { useMemo, useState } from "react";

const DEFAULT_ENDPOINT = "https://sczn3-sec-backend-pipe.onrender.com/api/sec";

// 1 MOA ≈ 1.047 inches at 100 yards
function inchesPerMoaAtYards(yards) {
  const y = Number(yards);
  if (!Number.isFinite(y) || y <= 0) return NaN;
  return 1.047 * (y / 100);
}

function fmt2(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return "—";
  return x.toFixed(2);
}

function parseTargetSpec(specRaw) {
  const raw = String(specRaw ?? "").trim().toLowerCase();
  if (!raw) return { ok: false, error: "Missing target size." };

  // Accept "11" or "23"
  if (/^\d+(\.\d+)?$/.test(raw)) {
    const v = Number(raw);
    if (!Number.isFinite(v) || v <= 0) return { ok: false, error: "Bad target size." };
    return { ok: true, spec: raw, long: v, short: v };
  }

  // Accept "8.5x11" or "8.5 x 11"
  const m = raw.replace(/\s+/g, "").match(/^(\d+(\.\d+)?)[x×](\d+(\.\d+)?)$/);
  if (m) {
    const a = Number(m[1]);
    const b = Number(m[3]);
    if (!Number.isFinite(a) || !Number.isFinite(b) || a <= 0 || b <= 0) {
      return { ok: false, error: "Bad target size spec." };
    }
    const long = Math.max(a, b);
    const short = Math.min(a, b);
    return { ok: true, spec: `${a}x${b}`, long, short };
  }

  // Common aliases
  if (raw === "letter" || raw === "8.5x11" || raw === "8.5×11") {
    return { ok: true, spec: "8.5x11", long: 11, short: 8.5 };
  }

  return { ok: false, error: `Unrecognized target size: "${specRaw}"` };
}

function dialFromSignedClicks(axis, signedClicks) {
  const v = Number(signedClicks);
  if (!Number.isFinite(v) || Math.abs(v) < 0.000001) {
    return axis === "windage" ? "CENTER 0.00 clicks" : "LEVEL 0.00 clicks";
  }
  const abs = Math.abs(v);
  if (axis === "windage") return v > 0 ? `RIGHT ${fmt2(abs)} clicks` : `LEFT ${fmt2(abs)} clicks`;
  return v > 0 ? `UP ${fmt2(abs)} clicks` : `DOWN ${fmt2(abs)} clicks`;
}

function extractDirection(dialStr) {
  const s = String(dialStr || "").toUpperCase();
  if (s.includes("LEFT")) return "LEFT";
  if (s.includes("RIGHT")) return "RIGHT";
  if (s.includes("UP")) return "UP";
  if (s.includes("DOWN")) return "DOWN";
  return null;
}

export default function App() {
  const [endpoint, setEndpoint] = useState(DEFAULT_ENDPOINT);

  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");

  const [distanceYards, setDistanceYards] = useState("100");
  const [clickValueMoa, setClickValueMoa] = useState("0.25");

  const [targetPreset, setTargetPreset] = useState("8.5x11");
  const [targetSpec, setTargetSpec] = useState("8.5x11");

  const [status, setStatus] = useState("");
  const [rawJson, setRawJson] = useState(null);
  const [showRaw, setShowRaw] = useState(true);

  const parsedTarget = useMemo(() => parseTargetSpec(targetSpec), [targetSpec]);

  const ipp = useMemo(() => {
    const d = Number(distanceYards);
    const c = Number(clickValueMoa);
    const ipmoa = inchesPerMoaAtYards(d);
    if (!Number.isFinite(ipmoa) || !Number.isFinite(c) || c <= 0) return NaN;
    return ipmoa * c; // inches per click
  }, [distanceYards, clickValueMoa]);

  const computed = useMemo(() => {
    if (!rawJson) return null;

    // Try the common shapes we’ve seen in your screenshots.
    const poib = rawJson?.poibInches || rawJson?.sec?.poibInches || rawJson?.result?.poibInches || null;
    const sec = rawJson?.sec || rawJson?.result?.sec || null;
    const clicksSignedBackend = rawJson?.clicksSigned || rawJson?.result?.clicksSigned || null;
    const dialBackend = rawJson?.dial || rawJson?.result?.dial || null;

    const x = poib?.x;
    const y = poib?.y;

    const logs = [];

    // --- Congruence Gate: target size ---
    const backendSize = sec?.targetSizeInches;
    if (parsedTarget.ok && Number.isFinite(Number(backendSize))) {
      const uiLong = Number(parsedTarget.long);
      const be = Number(backendSize);
      if (Math.abs(uiLong - be) > 0.01) {
        logs.push({
          code: "TARGET_SIZE_INCONGRUENT",
          uiTargetLongInches: uiLong,
          backendTargetSizeInches: be,
          fix: "Frontend must send targetSizeInches correctly, and backend must echo it back consistently."
        });
      }
    }

    // If we can’t compute clicks (no POIB or bad conversion), stop here.
    if (!Number.isFinite(Number(x)) || !Number.isFinite(Number(y)) || !Number.isFinite(ipp) || ipp <= 0) {
      return {
        ok: false,
        logs,
        sec,
        poib,
        clicksSignedBackend,
        dialBackend
      };
    }

    // --- Minimal scope clicks: ALWAYS derived from POIB ---
    // IMPORTANT: dial direction is OPPOSITE the POIB offset.
    // +x means impacts RIGHT -> dial LEFT
    // +y means impacts BELOW (image coords often +down) -> dial UP
    // So: signed clicks for dial = -poib / inchesPerClick
    const windSignedDial = -(Number(x) / ipp);
    const elevSignedDial = -(Number(y) / ipp);

    const windDial = dialFromSignedClicks("windage", windSignedDial);
    const elevDial = dialFromSignedClicks("elevation", elevSignedDial);

    // --- Direction congruence checks (optional but helpful) ---
    const uiWindDir = extractDirection(windDial);
    const uiElevDir = extractDirection(elevDial);

    const beWindDir = extractDirection(dialBackend?.windage);
    const beElevDir = extractDirection(dialBackend?.elevation);

    if (beElevDir && uiElevDir && beElevDir !== uiElevDir) {
      logs.push({
        code: "ELEVATION_DIRECTION_INCONGRUENT",
        poibY: Number(y),
        uiDial: uiElevDir,
        backendDial: beElevDir,
        fix: "Ignore backend dial strings; UI should compute dial from POIB consistently (this build does)."
      });
    }
    if (beWindDir && uiWindDir && beWindDir !== uiWindDir) {
      logs.push({
        code: "WINDAGE_DIRECTION_INCONGRUENT",
        poibX: Number(x),
        uiDial: uiWindDir,
        backendDial: beWindDir,
        fix: "Ignore backend dial strings; UI should compute dial from POIB consistently (this build does)."
      });
    }

    // If backend provides clicksSigned, check sign agreement (diagnostic only)
    if (clicksSignedBackend?.elevation != null) {
      const beE = Number(clicksSignedBackend.elevation);
      if (Number.isFinite(beE)) {
        // Backend "signed" may be using image axis; we ONLY flag it so you can see it.
        const uiE = Number(elevSignedDial);
        const signMismatch = (beE === 0 && uiE !== 0) || (beE !== 0 && uiE !== 0 && Math.sign(beE) !== Math.sign(uiE));
        if (signMismatch) {
          logs.push({
            code: "ELEVATION_SIGN_MISMATCH",
            backendClicksSignedElevation: beE,
            uiSignedElevation: Number(fmt2(uiE)),
            fix: "Backend likely not applying the Y-axis flip. Keep backend numeric as-is for now; UI dial is authoritative."
          });
        }
      }
    }
    if (clicksSignedBackend?.windage != null) {
      const beW = Number(clicksSignedBackend.windage);
      if (Number.isFinite(beW)) {
        const uiW = Number(windSignedDial);
        const signMismatch = (beW === 0 && uiW !== 0) || (beW !== 0 && uiW !== 0 && Math.sign(beW) !== Math.sign(uiW));
        if (signMismatch) {
          logs.push({
            code: "WINDAGE_SIGN_MISMATCH",
            backendClicksSignedWindage: beW,
            uiSignedWindage: Number(fmt2(uiW)),
            fix: "Backend may define sign differently. UI dial is authoritative."
          });
        }
      }
    }

    return {
      ok: true,
      logs,
      sec,
      poib: { x: Number(x), y: Number(y) },
      inchesPerClick: ipp,
      signedDial: { windage: windSignedDial, elevation: elevSignedDial },
      minimal: { windageDial: windDial, elevationDial: elevDial },
      clicksSignedBackend,
      dialBackend
    };
  }, [rawJson, ipp, parsedTarget.ok, parsedTarget.long]);

  function onPickFile(e) {
    const f = e.target.files && e.target.files[0] ? e.target.files[0] : null;
    setFile(f);
    setRawJson(null);
    setStatus("");
    if (f) {
      const url = URL.createObjectURL(f);
      setPreviewUrl(url);
    } else {
      setPreviewUrl("");
    }
  }

  function onPresetChange(p) {
    setTargetPreset(p);
    if (p === "8.5x11") setTargetSpec("8.5x11");
    if (p === "23") setTargetSpec("23");
    if (p === "custom") setTargetSpec("");
  }

  async function onSend() {
    try {
      setStatus("");
      setRawJson(null);

      if (!endpoint.trim()) {
        setStatus("Missing endpoint URL.");
        return;
      }
      if (!file) {
        setStatus("Choose an image first.");
        return;
      }
      if (!parsedTarget.ok) {
        setStatus(parsedTarget.error);
        return;
      }

      const d = Number(distanceYards);
      const c = Number(clickValueMoa);
      if (!Number.isFinite(d) || d <= 0) {
        setStatus("Distance must be a valid number.");
        return;
      }
      if (!Number.isFinite(c) || c <= 0) {
        setStatus("Click value must be a valid number.");
        return;
      }

      // Always send the LONG SIDE as targetSizeInches (8.5x11 -> 11)
      const targetLong = Number(parsedTarget.long);

      const fd = new FormData();
      fd.append("image", file);
      fd.append("distanceYards", String(d));
      fd.append("clickValueMoa", String(c));
      fd.append("targetSizeInches", String(targetLong));

      // (Extra compatibility fields — harmless if backend ignores)
      fd.append("targetSize", String(targetLong));
      fd.append("targetSpec", String(parsedTarget.spec));

      setStatus("Sending…");
      const res = await fetch(endpoint.trim(), { method: "POST", body: fd });
      const text = await res.text();

      let json = null;
      try {
        json = JSON.parse(text);
      } catch {
        json = { ok: false, error: "Non-JSON response from backend", httpStatus: res.status, body: text };
      }

      setRawJson(json);

      if (!res.ok) {
        setStatus(`Backend error (${res.status}).`);
        return;
      }

      setStatus("Done.");
    } catch (err) {
      setStatus(`Error: ${err?.message || String(err)}`);
    }
  }

  const box = (borderColor) => ({
    border: `3px solid ${borderColor}`,
    borderRadius: 12,
    padding: 14,
    background: "#fff",
    boxSizing: "border-box",
  });

  return (
    <div style={{ fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial", padding: 14, color: "#111" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <h1 style={{ margin: "6px 0 4px", fontSize: 36, letterSpacing: 0.2 }}>SCZN3 SEC — Upload Test</h1>

        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 14, marginBottom: 6 }}>Endpoint</div>
          <input
            value={endpoint}
            onChange={(e) => setEndpoint(e.target.value)}
            style={{ width: "100%", padding: 10, borderRadius: 10, border: "2px solid #bbb" }}
          />
          <div style={{ marginTop: 6, fontSize: 13 }}>
            POST multipart field: <b>image</b>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          {/* LEFT */}
          <div style={box("#000")}>
            <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 10 }}>
              <input type="file" accept="image/*" onChange={onPickFile} />
              <div style={{ fontSize: 13, color: "#444" }}>{file ? file.name : "No file selected"}</div>
            </div>

            <div style={{ marginBottom: 10 }}>
              <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 6 }}>Target Size</div>

              <div style={{ display: "grid", gridTemplateColumns: "160px 1fr", gap: 10, alignItems: "center" }}>
                <select
                  value={targetPreset}
                  onChange={(e) => onPresetChange(e.target.value)}
                  style={{ padding: 10, borderRadius: 10, border: "2px solid #bbb" }}
                >
                  <option value="8.5x11">8.5×11</option>
                  <option value="23">23</option>
                  <option value="custom">Custom</option>
                </select>

                <input
                  value={targetSpec}
                  onChange={(e) => setTargetSpec(e.target.value)}
                  placeholder='Examples: 8.5x11 or 23'
                  style={{ padding: 10, borderRadius: 10, border: "2px solid #bbb" }}
                />
              </div>

              <div style={{ fontSize: 13, marginTop: 6, color: parsedTarget.ok ? "#333" : "#b00020" }}>
                {parsedTarget.ok ? (
                  <>Parsed: spec={parsedTarget.spec} long={fmt2(parsedTarget.long)} short={fmt2(parsedTarget.short)}</>
                ) : (
                  parsedTarget.error
                )}
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
              <div>
                <div style={{ fontWeight: 800, marginBottom: 6 }}>Distance (yards)</div>
                <input
                  value={distanceYards}
                  onChange={(e) => setDistanceYards(e.target.value)}
                  style={{ width: "100%", padding: 10, borderRadius: 10, border: "2px solid #bbb" }}
                />
              </div>
              <div>
                <div style={{ fontWeight: 800, marginBottom: 6 }}>Click Value (MOA)</div>
                <input
                  value={clickValueMoa}
                  onChange={(e) => setClickValueMoa(e.target.value)}
                  style={{ width: "100%", padding: 10, borderRadius: 10, border: "2px solid #bbb" }}
                />
              </div>
            </div>

            <button
              onClick={onSend}
              style={{
                width: "100%",
                padding: 14,
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

            <div style={{ marginTop: 10, fontSize: 14 }}>
              <b>Status:</b> {status || "—"}
            </div>

            {/* RESULTS */}
            {computed && (
              <>
                <div style={{ marginTop: 12, ...box("#22a06b") }}>
                  <div style={{ fontWeight: 900, fontSize: 22, marginBottom: 8 }}>Scope Clicks (Minimal)</div>

                  {computed.ok ? (
                    <>
                      <div style={{ fontSize: 18, marginBottom: 6 }}>
                        <b>Windage:</b> {computed.minimal.windageDial}
                      </div>
                      <div style={{ fontSize: 18, marginBottom: 10 }}>
                        <b>Elevation:</b> {computed.minimal.elevationDial}
                      </div>

                      <div style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace", fontSize: 13 }}>
                        signedDial: w={fmt2(computed.signedDial.windage)}, e={fmt2(computed.signedDial.elevation)}{" "}
                        | POIB inches: x={fmt2(computed.poib?.x)}, y={fmt2(computed.poib?.y)}{" "}
                        | computeStatus: {rawJson?.computeStatus || rawJson?.result?.computeStatus || "—"}{" "}
                        | backend sec.targetSizeInches: {fmt2(computed.sec?.targetSizeInches)}
                      </div>
                    </>
                  ) : (
                    <div style={{ color: "#b00020" }}>
                      Can’t compute minimal clicks (missing POIB or conversion values).
                    </div>
                  )}

                  <div style={{ marginTop: 10 }}>
                    <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <input type="checkbox" checked={showRaw} onChange={(e) => setShowRaw(e.target.checked)} />
                      Show raw JSON
                    </label>
                  </div>
                </div>

                {computed.logs && computed.logs.length > 0 && (
                  <div style={{ marginTop: 12, ...box("#b00020") }}>
                    <div style={{ fontWeight: 900, fontSize: 18, marginBottom: 6 }}>Incongruence Log</div>
                    <div style={{ fontSize: 13, marginBottom: 10 }}>
                      This result was received, but one or more variables are not congruent. Do not trust the output until fixed.
                    </div>

                    {computed.logs.map((l, idx) => (
                      <div key={idx} style={{ padding: 10, borderRadius: 10, border: "2px solid #b00020", background: "#fff" }}>
                        <div style={{ fontWeight: 900, marginBottom: 6 }}>{l.code}</div>
                        <pre style={{ margin: 0, whiteSpace: "pre-wrap", fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace", fontSize: 12 }}>
{JSON.stringify(l, null, 2)}
                        </pre>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          {/* RIGHT */}
          <div style={box("#000")}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <div style={{ fontWeight: 900, fontSize: 22 }}>Preview</div>
              <div style={{ fontSize: 13, color: "#444" }}>
                {showRaw ? "Raw JSON: ON" : "Raw JSON: OFF"}
              </div>
            </div>

            <div style={{ border: "2px solid #ddd", borderRadius: 12, padding: 10, minHeight: 320 }}>
              {previewUrl ? (
                <img src={previewUrl} alt="preview" style={{ width: "100%", height: "auto", borderRadius: 10 }} />
              ) : (
                <div style={{ color: "#666" }}>Choose an image to preview.</div>
              )}
            </div>

            {showRaw && rawJson && (
              <div style={{ marginTop: 12 }}>
                <div style={{ fontWeight: 900, fontSize: 18, marginBottom: 6 }}>Response</div>
                <pre
                  style={{
                    margin: 0,
                    padding: 12,
                    borderRadius: 12,
                    background: "#111",
                    color: "#f3f3f3",
                    overflowX: "auto",
                    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                    fontSize: 12,
                    lineHeight: 1.35,
                  }}
                >
{JSON.stringify(rawJson, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>

        <div style={{ marginTop: 14, textAlign: "center", color: "#333", fontStyle: "italic" }}>
          Faith • Order • Precision
        </div>
      </div>
    </div>
  );
}
