import React, { useMemo, useState } from "react";

export default function App() {
  // Backend base (can override with VITE_API_BASE on Render)
  const API_BASE = useMemo(() => {
    const raw = (import.meta.env?.VITE_API_BASE || "").trim();
    const fallback = "https://sczn3-sec-backend-pipe.onrender.com";
    const base = raw || fallback;
    return base.replace(/\/+$/, "");
  }, []);

  const ENDPOINT = `${API_BASE}/api/sec`;

  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");

  // Manual override toggle (DEFAULT OFF so image compute runs)
  const [manualMode, setManualMode] = useState(false);

  // Manual POIB inputs (ONLY used/sent if manualMode = true)
  const [poibX, setPoibX] = useState("");
  const [poibY, setPoibY] = useState("");

  // Defaults
  const [distanceYards, setDistanceYards] = useState("100");
  const [clickValueMoa, setClickValueMoa] = useState("0.25");
  const [targetSizeInches, setTargetSizeInches] = useState("23");

  const [loading, setLoading] = useState(false);
  const [resp, setResp] = useState(null);
  const [error, setError] = useState("");
  const [showRaw, setShowRaw] = useState(true);

  function toNum(v, fallback = 0) {
    const n = Number(String(v ?? "").trim());
    return Number.isFinite(n) ? n : fallback;
  }

  function round2(n) {
    return Math.round(n * 100) / 100;
  }

  // 1 MOA ≈ 1.047" at 100 yards
  function inchesPerClick(dY, clickMoa) {
    return 1.047 * (dY / 100) * clickMoa;
  }

  function dialTextWindage(clicksSigned) {
    const abs = Math.abs(clicksSigned);
    const r = round2(abs).toFixed(2);
    return clicksSigned >= 0 ? `RIGHT ${r} clicks` : `LEFT ${r} clicks`;
  }

  function dialTextElevation(clicksSigned) {
    const abs = Math.abs(clicksSigned);
    const r = round2(abs).toFixed(2);
    return clicksSigned >= 0 ? `UP ${r} clicks` : `DOWN ${r} clicks`;
  }

  // Client-side sanity check (ONLY meaningful when manual POIB is ON)
  const expected = useMemo(() => {
    if (!manualMode) {
      return { windage: null, elevation: null, dialW: null, dialE: null };
    }

    const dY = toNum(distanceYards, 100);
    const moa = toNum(clickValueMoa, 0.25);
    const ipc = inchesPerClick(dY, moa);

    const x = toNum(poibX, 0);
    const y = toNum(poibY, 0);

    const w = ipc === 0 ? 0 : x / ipc;
    const e = ipc === 0 ? 0 : y / ipc;

    const windage = round2(w);
    const elevation = round2(e);

    return {
      windage,
      elevation,
      dialW: dialTextWindage(windage),
      dialE: dialTextElevation(elevation),
    };
  }, [manualMode, poibX, poibY, distanceYards, clickValueMoa]);

  function onPickFile(f) {
    setFile(f || null);
    setResp(null);
    setError("");

    if (previewUrl) URL.revokeObjectURL(previewUrl);
    if (f) setPreviewUrl(URL.createObjectURL(f));
    else setPreviewUrl("");
  }

  async function onSend() {
    setError("");
    setResp(null);

    if (!file) {
      setError("Choose an image first.");
      return;
    }

    setLoading(true);

    try {
      const fd = new FormData();
      fd.append("image", file);

      // Always send these
      fd.append("distanceYards", String(distanceYards || "100"));
      fd.append("clickValueMoa", String(clickValueMoa || "0.25"));
      fd.append("targetSizeInches", String(targetSizeInches || "23"));

      // IMPORTANT:
      // Only send poibX/poibY when manualMode is ON and BOTH values are non-empty.
      if (manualMode) {
        const x = String(poibX ?? "").trim();
        const y = String(poibY ?? "").trim();
        if (x !== "" && y !== "") {
          fd.append("poibX", x);
          fd.append("poibY", y);
        }
      }

      const r = await fetch(ENDPOINT, { method: "POST", body: fd });
      const data = await r.json().catch(() => null);

      if (!r.ok) {
        throw new Error(data?.error || `HTTP ${r.status}`);
      }

      setResp(data);
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  const sec = resp?.sec;

  return (
    <div
      style={{
        fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial",
        padding: 16,
        maxWidth: 1100,
        margin: "0 auto",
      }}
    >
      <h1 style={{ margin: "8px 0 6px", fontSize: 44, fontWeight: 900 }}>
        SCZN3 SEC — Upload Test
      </h1>

      <div style={{ marginBottom: 12, fontWeight: 800 }}>
        Endpoint:{" "}
        <span style={{ fontWeight: 700, wordBreak: "break-all" }}>
          {ENDPOINT}
        </span>
        <div style={{ fontWeight: 700 }}>
          multipart field: <code>image</code>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 14,
          alignItems: "start",
        }}
      >
        {/* LEFT */}
        <div>
          <div style={{ marginBottom: 10 }}>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => onPickFile(e.target.files?.[0])}
            />
            {file ? (
              <div style={{ marginTop: 6, fontWeight: 800 }}>{file.name}</div>
            ) : null}
          </div>

          <div
            style={{
              border: "1px solid #999",
              borderRadius: 10,
              padding: 12,
              marginBottom: 12,
            }}
          >
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                fontWeight: 900,
              }}
            >
              <input
                type="checkbox"
                checked={manualMode}
                onChange={(e) => setManualMode(e.target.checked)}
              />
              Manual POIB (turn ON only when you want to type POIB)
            </label>

            {manualMode ? (
              <>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 10,
                    marginTop: 12,
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 900 }}>
                      POIB X (inches) Right + / Left -
                    </div>
                    <input
                      value={poibX}
                      onChange={(e) => setPoibX(e.target.value)}
                      style={{
                        width: "100%",
                        fontSize: 20,
                        padding: 10,
                        borderRadius: 8,
                        border: "1px solid #999",
                      }}
                    />
                  </div>
                  <div>
                    <div style={{ fontWeight: 900 }}>
                      POIB Y (inches) Up + / Down -
                    </div>
                    <input
                      value={poibY}
                      onChange={(e) => setPoibY(e.target.value)}
                      style={{
                        width: "100%",
                        fontSize: 20,
                        padding: 10,
                        borderRadius: 8,
                        border: "1px solid #999",
                      }}
                    />
                  </div>
                </div>

                <div
                  style={{
                    marginTop: 12,
                    border: "2px solid #111",
                    borderRadius: 10,
                    padding: 12,
                  }}
                >
                  <div style={{ fontWeight: 900, fontSize: 18 }}>
                    Expected clicks (client-side sanity check)
                  </div>
                  <div style={{ marginTop: 6, fontWeight: 900 }}>
                    Windage: {expected.windage?.toFixed(2) ?? "—"}
                  </div>
                  <div style={{ fontWeight: 900 }}>
                    Elevation: {expected.elevation?.toFixed(2) ?? "—"}
                  </div>
                  <div style={{ marginTop: 6, fontWeight: 900 }}>
                    Dial: {expected.dialW ?? "—"}
                  </div>
                  <div style={{ fontWeight: 900 }}>
                    Dial: {expected.dialE ?? "—"}
                  </div>
                </div>
              </>
            ) : (
              <div style={{ marginTop: 10, fontWeight: 800, opacity: 0.85 }}>
                Manual POIB is OFF → backend will compute POIB from the target
                image.
              </div>
            )}
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 10,
              marginBottom: 12,
            }}
          >
            <div>
              <div style={{ fontWeight: 900 }}>Distance (yards)</div>
              <input
                value={distanceYards}
                onChange={(e) => setDistanceYards(e.target.value)}
                style={{
                  width: "100%",
                  fontSize: 20,
                  padding: 10,
                  borderRadius: 8,
                  border: "1px solid #999",
                }}
              />
            </div>
            <div>
              <div style={{ fontWeight: 900 }}>Click Value (MOA)</div>
              <input
                value={clickValueMoa}
                onChange={(e) => setClickValueMoa(e.target.value)}
                style={{
                  width: "100%",
                  fontSize: 20,
                  padding: 10,
                  borderRadius: 8,
                  border: "1px solid #999",
                }}
              />
            </div>
          </div>

          <div style={{ marginBottom: 12 }}>
            <div style={{ fontWeight: 900 }}>Target Size (inches)</div>
            <input
              value={targetSizeInches}
              onChange={(e) => setTargetSizeInches(e.target.value)}
              style={{
                width: "100%",
                fontSize: 20,
                padding: 10,
                borderRadius: 8,
                border: "1px solid #999",
              }}
            />
          </div>

          <button
            onClick={onSend}
            disabled={loading}
            style={{
              width: "100%",
              padding: "14px 12px",
              fontSize: 18,
              fontWeight: 900,
              borderRadius: 10,
              border: "2px solid #2b6cb0",
              background: loading ? "#ddd" : "#e6f0ff",
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            {loading ? "Sending..." : "Send to SCZN3 SEC backend"}
          </button>

          {error ? (
            <div style={{ marginTop: 10, color: "crimson", fontWeight: 900 }}>
              {error}
            </div>
          ) : null}

          {/* Backend confirmed box */}
          {sec ? (
            <div
              style={{
                marginTop: 14,
                border: "3px solid #2f855a",
                borderRadius: 12,
                padding: 12,
              }}
            >
              <div style={{ fontWeight: 900, fontSize: 18, marginBottom: 6 }}>
                Backend confirmed
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 10,
                }}
              >
                <div>
                  <div style={{ fontWeight: 900 }}>
                    Windage (signed): {sec.clicksSigned?.windage}
                  </div>
                  <div style={{ fontWeight: 900 }}>
                    Dial: {sec.dial?.windage}
                  </div>
                </div>

                <div>
                  <div style={{ fontWeight: 900 }}>
                    Elevation (signed): {sec.clicksSigned?.elevation}
                  </div>
                  <div style={{ fontWeight: 900 }}>
                    Dial: {sec.dial?.elevation}
                  </div>
                </div>
              </div>

              <div style={{ marginTop: 8, fontWeight: 900 }}>
                POIB inches: x={sec.poibInches?.x}, y={sec.poibInches?.y}{" "}
                &nbsp;&nbsp;|&nbsp;&nbsp; Distance: {sec.distanceYards}y
                &nbsp;&nbsp;|&nbsp;&nbsp; Click: {sec.clickValueMoa} MOA
              </div>

              <div style={{ marginTop: 6, fontWeight: 900 }}>
                Service: {resp?.service} &nbsp;&nbsp; Build: {resp?.build}
              </div>

              <div style={{ marginTop: 6, fontWeight: 900 }}>
                computeStatus: {sec.computeStatus}
              </div>
            </div>
          ) : null}
        </div>

        {/* RIGHT */}
        <div>
          <div
            style={{
              border: "2px solid #111",
              borderRadius: 14,
              padding: 10,
              minHeight: 260,
            }}
          >
            {previewUrl ? (
              <img
                src={previewUrl}
                alt="preview"
                style={{
                  width: "100%",
                  height: "auto",
                  borderRadius: 10,
                  display: "block",
                }}
              />
            ) : (
              <div style={{ fontWeight: 900, opacity: 0.7 }}>
                Choose a target photo to preview here.
              </div>
            )}
          </div>

          <div style={{ marginTop: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <h2 style={{ margin: 0, fontSize: 36, fontWeight: 900 }}>
                Response
              </h2>

              <label style={{ fontWeight: 900, display: "flex", gap: 8, alignItems: "center" }}>
                <input
                  type="checkbox"
                  checked={showRaw}
                  onChange={(e) => setShowRaw(e.target.checked)}
                />
                Show raw JSON
              </label>
            </div>

            {showRaw ? (
              <pre
                style={{
                  marginTop: 10,
                  background: "#111",
                  color: "#fff",
                  padding: 14,
                  borderRadius: 12,
                  overflowX: "auto",
                  fontSize: 14,
                  lineHeight: 1.35,
                }}
              >
                {resp ? JSON.stringify(resp, null, 2) : "—"}
              </pre>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
