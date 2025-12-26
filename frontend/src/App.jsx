import React, { useMemo, useState, useEffect } from "react";

// SCZN3 SEC — Upload Test (Frontend)
// This page shows:
// - Manual POIB toggle (when ON, you type POIB)
// - When OFF, backend computes POIB from the image
// IMPORTANT: "Expected clicks" must be CORRECTION (what to dial) = NEGATIVE of POIB offset.

export default function App() {
  // ---- Backend base ----
  const API_BASE = useMemo(() => {
    const raw = (import.meta?.env?.VITE_API_BASE || "").trim();
    const fallback = "https://sczn3-sec-backend-pipe.onrender.com";
    const base = (raw || fallback).trim();
    return base.replace(/\/+$/, "");
  }, []);

  const ENDPOINT = `${API_BASE}/api/sec`;

  // ---- UI state ----
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");

  const [manualPoib, setManualPoib] = useState(false);
  const [poibX, setPoibX] = useState(""); // inches, Right + / Left -
  const [poibY, setPoibY] = useState(""); // inches, Up + / Down -

  const [distanceYards, setDistanceYards] = useState("100");
  const [clickValueMoa, setClickValueMoa] = useState("0.25");
  const [targetSizeInches, setTargetSizeInches] = useState("23");

  const [loading, setLoading] = useState(false);
  const [resp, setResp] = useState(null);
  const [error, setError] = useState("");

  // ---- Helpers ----
  function toNum(v, fallback = 0) {
    const n = Number(String(v ?? "").trim());
    return Number.isFinite(n) ? n : fallback;
  }

  // 1 MOA ≈ 1.047" @ 100y
  function inchesPerClick(dYards, moaPerClick) {
    return 1.047 * (dYards / 100) * moaPerClick;
  }

  function dialText(axis, clicksSigned) {
    const abs = Math.abs(clicksSigned);
    const rounded = Math.round(abs * 100) / 100;

    if (axis === "windage") {
      if (rounded === 0) return "CENTER (0.00 clicks)";
      return clicksSigned >= 0 ? `RIGHT ${rounded} clicks` : `LEFT ${rounded} clicks`;
    }
    // elevation
    if (rounded === 0) return "LEVEL (0.00 clicks)";
    return clicksSigned >= 0 ? `UP ${rounded} clicks` : `DOWN ${rounded} clicks`;
  }

  // ---- Preview URL ----
  useEffect(() => {
    if (!file) {
      setPreviewUrl("");
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // ---- Expected clicks (client-side sanity check) ----
  const expected = useMemo(() => {
    // If manual POIB is OFF, frontend does not know POIB (backend will compute from image)
    if (!manualPoib) {
      return {
        windage: 0,
        elevation: 0,
        dialWindage: "CENTER (0.00 clicks)",
        dialElevation: "LEVEL (0.00 clicks)",
        note: "Manual POIB is OFF → expected is 0.00 here because POIB comes from the image on the backend.",
      };
    }

    const d = toNum(distanceYards, 100);
    const cv = toNum(clickValueMoa, 0.25);
    const x = toNum(poibX, 0);
    const y = toNum(poibY, 0);

    const ipc = inchesPerClick(d, cv);

    // ⭐ SIGN FIX (CORRECTION = NEGATIVE of POIB)
    // If POIB is RIGHT (+), correction is LEFT (-).
    // If POIB is UP (+), correction is DOWN (-).
    const windage = ipc === 0 ? 0 : (-x / ipc);
    const elevation = ipc === 0 ? 0 : (-y / ipc);

    const w2 = Math.round(windage * 100) / 100;
    const e2 = Math.round(elevation * 100) / 100;

    return {
      windage: w2,
      elevation: e2,
      dialWindage: dialText("windage", w2),
      dialElevation: dialText("elevation", e2),
      note: "",
    };
  }, [manualPoib, poibX, poibY, distanceYards, clickValueMoa]);

  // ---- Submit ----
  async function onSubmit() {
    setError("");
    setResp(null);

    if (!file) {
      setError("Choose an image first.");
      return;
    }

    const fd = new FormData();
    fd.append("image", file);

    fd.append("distanceYards", String(toNum(distanceYards, 100)));
    fd.append("clickValueMoa", String(toNum(clickValueMoa, 0.25)));
    fd.append("targetSizeInches", String(toNum(targetSizeInches, 23)));

    // Only send POIB if manual is ON
    if (manualPoib) {
      fd.append("poibX", String(toNum(poibX, 0)));
      fd.append("poibY", String(toNum(poibY, 0)));
    }

    setLoading(true);
    try {
      const r = await fetch(ENDPOINT, { method: "POST", body: fd });
      const j = await r.json().catch(() => null);

      if (!r.ok) {
        setError(j?.error || `Request failed (${r.status})`);
        setResp(j);
        return;
      }

      setResp(j);
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  // ---- Pull nice display values from backend ----
  const backend = useMemo(() => {
    const sec = resp?.sec;
    if (!sec) return null;

    const clicks = sec?.clicksSigned || {};
    const dial = sec?.dial || {};
    const poib = sec?.poibInches || {};

    return {
      windage: clicks?.windage,
      elevation: clicks?.elevation,
      dialWindage: dial?.windage,
      dialElevation: dial?.elevation,
      poibX: poib?.x,
      poibY: poib?.y,
      distance: sec?.distanceYards,
      click: sec?.clickValueMoa,
      service: resp?.service,
      build: resp?.build,
      computeStatus: sec?.computeStatus,
    };
  }, [resp]);

  return (
    <div style={{ padding: 16, fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial" }}>
      <h1 style={{ margin: "0 0 10px 0" }}>SCZN3 SEC — Upload Test</h1>

      <div style={{ marginBottom: 10, fontSize: 14 }}>
        <div><b>Endpoint:</b> {ENDPOINT}</div>
        <div><b>multipart field:</b> image</div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(320px, 520px) 1fr", gap: 16, alignItems: "start" }}>
        {/* Left controls */}
        <div style={{ border: "2px solid #111", borderRadius: 10, padding: 14 }}>
          <div style={{ marginBottom: 10 }}>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
            {file ? <div style={{ marginTop: 6, fontWeight: 700 }}>{file.name}</div> : null}
          </div>

          <div style={{ border: "2px solid #111", borderRadius: 10, padding: 12, marginBottom: 12 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <input
                type="checkbox"
                checked={manualPoib}
                onChange={(e) => setManualPoib(e.target.checked)}
              />
              <div>
                <div style={{ fontWeight: 800, fontSize: 16 }}>Manual POIB (turn ON only when you want to type POIB)</div>
                <div style={{ fontSize: 13, marginTop: 4 }}>
                  Manual POIB is <b>{manualPoib ? "ON" : "OFF"}</b> → {manualPoib ? "you type POIB." : "backend will compute POIB from the target image."}
                </div>
              </div>
            </label>
          </div>

          {manualPoib ? (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
              <div>
                <div style={{ fontWeight: 700 }}>POIB X (inches) Right + / Left -</div>
                <input
                  value={poibX}
                  onChange={(e) => setPoibX(e.target.value)}
                  style={{ width: "100%", padding: 10, fontSize: 16, borderRadius: 8, border: "2px solid #111" }}
                  placeholder="e.g., 1.00"
                />
              </div>
              <div>
                <div style={{ fontWeight: 700 }}>POIB Y (inches) Up + / Down -</div>
                <input
                  value={poibY}
                  onChange={(e) => setPoibY(e.target.value)}
                  style={{ width: "100%", padding: 10, fontSize: 16, borderRadius: 8, border: "2px solid #111" }}
                  placeholder="e.g., -2.00"
                />
              </div>
            </div>
          ) : null}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
            <div>
              <div style={{ fontWeight: 700 }}>Distance (yards)</div>
              <input
                value={distanceYards}
                onChange={(e) => setDistanceYards(e.target.value)}
                style={{ width: "100%", padding: 10, fontSize: 16, borderRadius: 8, border: "2px solid #111" }}
              />
            </div>
            <div>
              <div style={{ fontWeight: 700 }}>Click Value (MOA)</div>
              <input
                value={clickValueMoa}
                onChange={(e) => setClickValueMoa(e.target.value)}
                style={{ width: "100%", padding: 10, fontSize: 16, borderRadius: 8, border: "2px solid #111" }}
              />
            </div>
          </div>

          <div style={{ marginBottom: 12 }}>
            <div style={{ fontWeight: 700 }}>Target Size (inches)</div>
            <input
              value={targetSizeInches}
              onChange={(e) => setTargetSizeInches(e.target.value)}
              style={{ width: "100%", padding: 10, fontSize: 16, borderRadius: 8, border: "2px solid #111" }}
            />
          </div>

          <div style={{ border: "2px solid #111", borderRadius: 10, padding: 12, marginBottom: 12 }}>
            <div style={{ fontWeight: 900, fontSize: 16, marginBottom: 8 }}>
              Expected clicks (client-side sanity check)
            </div>
            <div style={{ fontSize: 15, lineHeight: 1.5 }}>
              <div><b>Windage:</b> {Number(expected.windage).toFixed(2)}</div>
              <div><b>Elevation:</b> {Number(expected.elevation).toFixed(2)}</div>
              <div><b>Dial:</b> {expected.dialWindage}</div>
              <div><b>Dial:</b> {expected.dialElevation}</div>
              {expected.note ? (
                <div style={{ marginTop: 8, fontSize: 13 }}>
                  ({expected.note})
                </div>
              ) : null}
            </div>
          </div>

          <button
            onClick={onSubmit}
            disabled={loading}
            style={{
              width: "100%",
              padding: 14,
              fontSize: 18,
              fontWeight: 900,
              borderRadius: 10,
              border: "3px solid #2b6cb0",
              background: loading ? "#ddd" : "#e6f0ff",
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            {loading ? "Sending..." : "Send to SCZN3 SEC backend"}
          </button>

          {error ? (
            <div style={{ marginTop: 12, color: "#b00020", fontWeight: 700 }}>
              {error}
            </div>
          ) : null}

          {backend ? (
            <div style={{ marginTop: 12, border: "3px solid #22c55e", borderRadius: 10, padding: 12 }}>
              <div style={{ fontWeight: 900, fontSize: 16, marginBottom: 8 }}>Backend confirmed</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, fontSize: 15 }}>
                <div>
                  <div><b>Windage (signed):</b> {backend.windage}</div>
                  <div><b>Dial:</b> {backend.dialWindage}</div>
                </div>
                <div>
                  <div><b>Elevation (signed):</b> {backend.elevation}</div>
                  <div><b>Dial:</b> {backend.dialElevation}</div>
                </div>
              </div>

              <div style={{ marginTop: 8, fontSize: 14 }}>
                <div><b>POIB inches:</b> x={backend.poibX}, y={backend.poibY} &nbsp;|&nbsp; <b>Distance:</b> {backend.distance}y &nbsp;|&nbsp; <b>Click:</b> {backend.click} MOA</div>
                <div><b>Service:</b> {backend.service} &nbsp;&nbsp; <b>Build:</b> {backend.build}</div>
                <div><b>computeStatus:</b> {backend.computeStatus}</div>
              </div>
            </div>
          ) : null}
        </div>

        {/* Right preview + JSON */}
        <div>
          <div style={{ border: "2px solid #111", borderRadius: 10, padding: 12, marginBottom: 12 }}>
            <div style={{ fontWeight: 800, marginBottom: 8 }}>Preview</div>
            {previewUrl ? (
              <img
                src={previewUrl}
                alt="preview"
                style={{ width: "100%", maxWidth: 650, borderRadius: 10, border: "2px solid #111" }}
              />
            ) : (
              <div style={{ opacity: 0.7 }}>Choose an image to preview.</div>
            )}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <h2 style={{ margin: 0 }}>Response</h2>
            <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <input type="checkbox" checked readOnly />
              <span style={{ fontWeight: 700 }}>Show raw JSON</span>
            </label>
          </div>

          <pre
            style={{
              margin: 0,
              padding: 12,
              borderRadius: 10,
              border: "2px solid #111",
              background: "#0b0b0b",
              color: "#f5f5f5",
              overflowX: "auto",
              minHeight: 220,
            }}
          >
            {resp ? JSON.stringify(resp, null, 2) : "{\n  (no response yet)\n}"}
          </pre>
        </div>
      </div>
    </div>
  );
}
