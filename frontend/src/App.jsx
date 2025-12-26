import React, { useEffect, useMemo, useState } from "react";

/**
 * SCZN3 SEC — Upload Test (Frontend)
 * - Sends multipart/form-data to POST {API_BASE}/api/sec
 * - multipart field name MUST be: image
 * - When Manual POIB is OFF → backend computes POIB from the target image
 * - When Manual POIB is ON  → sends poibX/poibY (inches) and backend uses those
 *
 * Optional fields the backend accepts (strings in multipart):
 * - distanceYards
 * - clickValueMoa
 * - targetSizeInches
 * - poibX, poibY  (only when manual mode ON)
 */

export default function App() {
  // Backend base (override with VITE_API_BASE in Render Static Site env vars)
  const API_BASE = useMemo(() => {
    const raw = (import.meta?.env?.VITE_API_BASE || "").trim();
    const fallback = "https://sczn3-sec-backend-pipe.onrender.com";
    const base = raw || fallback;
    return base.replace(/\/+$/, "");
  }, []);

  const ENDPOINT = `${API_BASE}/api/sec`;

  // File + preview
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");

  // Inputs
  const [manualPoibOn, setManualPoibOn] = useState(false);

  // POIB in inches (Right + / Left -, Up + / Down -)
  const [poibX, setPoibX] = useState("1.00");
  const [poibY, setPoibY] = useState("-2.00");

  const [distanceYards, setDistanceYards] = useState("100");
  const [clickValueMoa, setClickValueMoa] = useState("0.25");
  const [targetSizeInches, setTargetSizeInches] = useState("23");

  // Response
  const [loading, setLoading] = useState(false);
  const [resp, setResp] = useState(null);
  const [error, setError] = useState("");
  const [showRaw, setShowRaw] = useState(true);

  // Build preview URL
  useEffect(() => {
    if (!file) {
      setPreviewUrl("");
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // Helpers
  const toNum = (v, fallback = 0) => {
    const n = Number(String(v ?? "").trim());
    return Number.isFinite(n) ? n : fallback;
  };

  // 1 MOA ≈ 1.047" at 100 yards
  const inchesPerClick = (dy, moaPerClick) => 1.047 * (dy / 100) * moaPerClick;

  const dialText = (axis, clicksSigned) => {
    const abs = Math.abs(clicksSigned);
    const rounded = Math.round(abs * 100) / 100;
    if (axis === "windage") {
      if (rounded === 0) return "CENTER (0.00 clicks)";
      return clicksSigned >= 0 ? `RIGHT ${rounded} clicks` : `LEFT ${rounded} clicks`;
    }
    // elevation
    if (rounded === 0) return "LEVEL (0.00 clicks)";
    return clicksSigned >= 0 ? `UP ${rounded} clicks` : `DOWN ${rounded} clicks`;
  };

  // Client-side expected clicks (only meaningful when Manual POIB is ON)
  const expected = useMemo(() => {
    if (!manualPoibOn) {
      return {
        windage: 0,
        elevation: 0,
        dialWindage: "CENTER (0.00 clicks)",
        dialElevation: "LEVEL (0.00 clicks)",
      };
    }

    const dy = toNum(distanceYards, 100);
    const cv = toNum(clickValueMoa, 0.25);
    const x = toNum(poibX, 0);
    const y = toNum(poibY, 0);

    const ipc = inchesPerClick(dy, cv);
    const windage = ipc === 0 ? 0 : x / ipc;
    const elevation = ipc === 0 ? 0 : y / ipc;

    const w2 = Math.round(windage * 100) / 100;
    const e2 = Math.round(elevation * 100) / 100;

    return {
      windage: w2,
      elevation: e2,
      dialWindage: dialText("windage", w2),
      dialElevation: dialText("elevation", e2),
    };
  }, [manualPoibOn, distanceYards, clickValueMoa, poibX, poibY]);

  const backendConfirmed = useMemo(() => {
    if (!resp?.ok) return null;

    // Prefer standard shape: resp.sec.*
    const sec = resp.sec || null;
    if (!sec) return null;

    const clicksSigned = sec.clicksSigned || {};
    const poibInches = sec.poibInches || {};
    const dial = sec.dial || {};

    const windage = typeof clicksSigned.windage === "number" ? clicksSigned.windage : null;
    const elevation = typeof clicksSigned.elevation === "number" ? clicksSigned.elevation : null;

    const x = typeof poibInches.x === "number" ? poibInches.x : null;
    const y = typeof poibInches.y === "number" ? poibInches.y : null;

    return {
      windage,
      elevation,
      dialWindage: dial.windage || "",
      dialElevation: dial.elevation || "",
      x,
      y,
      distanceYards: sec.distanceYards,
      clickValueMoa: sec.clickValueMoa,
      service: resp.service,
      build: resp.build,
      computeStatus: sec.computeStatus,
    };
  }, [resp]);

  const onSend = async () => {
    setError("");
    setResp(null);

    if (!file) {
      setError("Choose a target image first.");
      return;
    }

    setLoading(true);
    try {
      const fd = new FormData();

      // MUST be "image"
      fd.append("image", file);

      // Always send these (backend can default them, but we want consistency)
      fd.append("distanceYards", String(distanceYards));
      fd.append("clickValueMoa", String(clickValueMoa));
      fd.append("targetSizeInches", String(targetSizeInches));

      // Only send POIB fields when manual mode is ON
      if (manualPoibOn) {
        fd.append("poibX", String(poibX));
        fd.append("poibY", String(poibY));
      }

      const r = await fetch(ENDPOINT, {
        method: "POST",
        body: fd,
      });

      let data;
      try {
        data = await r.json();
      } catch (e) {
        const txt = await r.text();
        throw new Error(`Backend did not return JSON. Status ${r.status}. Body: ${txt?.slice(0, 200)}`);
      }

      setResp(data);

      if (!r.ok || data?.ok === false) {
        setError(data?.error || `Request failed (HTTP ${r.status})`);
      }
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  };

  // Simple layout styles (no external CSS required)
  const styles = {
    page: {
      fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
      padding: 16,
      maxWidth: 1100,
      margin: "0 auto",
    },
    title: { fontSize: 44, fontWeight: 900, margin: "8px 0 8px" },
    sub: { fontSize: 16, marginBottom: 14, lineHeight: 1.4 },
    mono: { fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" },
    grid: {
      display: "grid",
      gridTemplateColumns: "420px 1fr",
      gap: 16,
      alignItems: "start",
    },
    card: {
      border: "2px solid #111",
      borderRadius: 12,
      padding: 14,
      background: "#fff",
    },
    label: { fontWeight: 800, marginBottom: 6 },
    small: { fontSize: 13, opacity: 0.9 },
    row2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 },
    input: {
      width: "100%",
      padding: 10,
      fontSize: 16,
      borderRadius: 10,
      border: "2px solid #111",
      outline: "none",
      boxSizing: "border-box",
    },
    btn: {
      width: "100%",
      padding: "14px 14px",
      fontSize: 18,
      fontWeight: 800,
      borderRadius: 12,
      border: "3px solid #1b4fff",
      background: loading ? "#e9f0ff" : "#eef5ff",
      cursor: loading ? "not-allowed" : "pointer",
      marginTop: 10,
    },
    previewWrap: {
      border: "2px solid #111",
      borderRadius: 14,
      overflow: "hidden",
      background: "#fafafa",
      minHeight: 280,
    },
    previewImg: { width: "100%", height: "auto", display: "block" },
    bigBox: {
      border: "2px solid #111",
      borderRadius: 14,
      padding: 14,
      marginTop: 12,
      background: "#fff",
    },
    confirmed: {
      border: "3px solid #1a9b3a",
      borderRadius: 14,
      padding: 14,
      background: "#f4fff7",
      marginTop: 10,
    },
    err: {
      border: "3px solid #b00020",
      borderRadius: 14,
      padding: 12,
      background: "#fff5f5",
      marginTop: 10,
      color: "#7a0015",
      fontWeight: 700,
    },
    pre: {
      whiteSpace: "pre-wrap",
      wordBreak: "break-word",
      fontSize: 12.5,
      lineHeight: 1.35,
      padding: 14,
      borderRadius: 14,
      background: "#0b0b0b",
      color: "#f4f4f4",
      overflow: "auto",
      maxHeight: 520,
    },
    checkboxRow: { display: "flex", alignItems: "center", gap: 10, marginTop: 10 },
  };

  return (
    <div style={styles.page}>
      <div style={styles.title}>SCZN3 SEC — Upload Test</div>

      <div style={styles.sub}>
        <div>
          <b>Endpoint:</b> <span style={styles.mono}>{ENDPOINT}</span>
        </div>
        <div>
          <b>multipart field:</b> <span style={styles.mono}>image</span>
        </div>
      </div>

      <div style={styles.grid}>
        {/* LEFT: Controls */}
        <div style={styles.card}>
          <div style={{ marginBottom: 10 }}>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
            <div style={{ marginTop: 8, fontWeight: 800 }}>{file?.name || "No file selected"}</div>
          </div>

          <div style={styles.bigBox}>
            <div style={styles.checkboxRow}>
              <input
                type="checkbox"
                checked={manualPoibOn}
                onChange={(e) => setManualPoibOn(e.target.checked)}
                id="manualPoib"
              />
              <label htmlFor="manualPoib" style={{ fontWeight: 900 }}>
                Manual POIB (turn ON only when you want to type POIB)
              </label>
            </div>
            <div style={{ marginTop: 8, fontWeight: 700 }}>
              Manual POIB is <b>{manualPoibOn ? "ON" : "OFF"}</b> →{" "}
              {manualPoibOn ? "backend uses your typed POIB." : "backend will compute POIB from the target image."}
            </div>

            {manualPoibOn && (
              <div style={{ marginTop: 12 }}>
                <div style={styles.row2}>
                  <div>
                    <div style={styles.label}>POIB X (inches) Right + / Left -</div>
                    <input style={styles.input} value={poibX} onChange={(e) => setPoibX(e.target.value)} />
                  </div>
                  <div>
                    <div style={styles.label}>POIB Y (inches) Up + / Down -</div>
                    <input style={styles.input} value={poibY} onChange={(e) => setPoibY(e.target.value)} />
                  </div>
                </div>
              </div>
            )}
          </div>

          <div style={{ marginTop: 12 }}>
            <div style={styles.row2}>
              <div>
                <div style={styles.label}>Distance (yards)</div>
                <input
                  style={styles.input}
                  value={distanceYards}
                  onChange={(e) => setDistanceYards(e.target.value)}
                />
              </div>
              <div>
                <div style={styles.label}>Click Value (MOA)</div>
                <input
                  style={styles.input}
                  value={clickValueMoa}
                  onChange={(e) => setClickValueMoa(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div style={{ marginTop: 12 }}>
            <div style={styles.label}>Target Size (inches)</div>
            <input
              style={styles.input}
              value={targetSizeInches}
              onChange={(e) => setTargetSizeInches(e.target.value)}
            />
          </div>

          <div style={{ marginTop: 12, border: "2px solid #111", borderRadius: 14, padding: 14 }}>
            <div style={{ fontWeight: 900, fontSize: 18, marginBottom: 8 }}>
              Expected clicks (client-side sanity check)
            </div>
            <div style={{ fontWeight: 800 }}>Windage: {expected.windage.toFixed(2)}</div>
            <div style={{ fontWeight: 800 }}>Elevation: {expected.elevation.toFixed(2)}</div>
            <div style={{ marginTop: 6 }}>
              <div style={{ fontWeight: 700 }}>Dial: {expected.dialWindage}</div>
              <div style={{ fontWeight: 700 }}>Dial: {expected.dialElevation}</div>
            </div>
            {!manualPoibOn && (
              <div style={{ marginTop: 8, fontSize: 12, opacity: 0.85 }}>
                (Manual POIB is OFF → expected is 0.00 here because POIB comes from the image on the backend.)
              </div>
            )}
          </div>

          <button style={styles.btn} onClick={onSend} disabled={loading}>
            {loading ? "Sending..." : "Send to SCZN3 SEC backend"}
          </button>

          {error && <div style={styles.err}>{error}</div>}

          {backendConfirmed && (
            <div style={styles.confirmed}>
              <div style={{ fontWeight: 900, fontSize: 18, marginBottom: 8 }}>Backend confirmed</div>

              <div style={styles.row2}>
                <div>
                  <div style={{ fontWeight: 900 }}>Windage (signed): {backendConfirmed.windage?.toFixed(2)}</div>
                  <div style={{ fontWeight: 800 }}>Dial: {backendConfirmed.dialWindage}</div>
                </div>
                <div>
                  <div style={{ fontWeight: 900 }}>Elevation (signed): {backendConfirmed.elevation?.toFixed(2)}</div>
                  <div style={{ fontWeight: 800 }}>Dial: {backendConfirmed.dialElevation}</div>
                </div>
              </div>

              <div style={{ marginTop: 8, fontWeight: 800 }}>
                POIB inches: x={backendConfirmed.x?.toFixed(2)}, y={backendConfirmed.y?.toFixed(2)}{" "}
                <span style={{ opacity: 0.7 }}>|</span> Distance: {backendConfirmed.distanceYards}y{" "}
                <span style={{ opacity: 0.7 }}>|</span> Click: {backendConfirmed.clickValueMoa} MOA
              </div>

              <div style={{ marginTop: 8, fontSize: 13 }}>
                <div>
                  <b>Service:</b> {backendConfirmed.service} &nbsp;&nbsp; <b>Build:</b> {backendConfirmed.build}
                </div>
                <div>
                  <b>computeStatus:</b> {backendConfirmed.computeStatus}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT: Preview + Response */}
        <div>
          <div style={styles.previewWrap}>
            {previewUrl ? (
              <img src={previewUrl} alt="preview" style={styles.previewImg} />
            ) : (
              <div style={{ padding: 16, opacity: 0.7 }}>
                Choose an image to see a preview here.
              </div>
            )}
          </div>

          <div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ fontSize: 44, fontWeight: 900 }}>Response</div>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 800 }}>
              <input type="checkbox" checked={showRaw} onChange={(e) => setShowRaw(e.target.checked)} />
              Show raw JSON
            </label>
          </div>

          {showRaw && (
            <pre style={styles.pre}>
              {resp ? JSON.stringify(resp, null, 2) : "No response yet."}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}
