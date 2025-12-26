import React, { useMemo, useState } from "react";

// SCZN3 SEC — Upload Test (frontend)
// - Sends multipart/form-data with field name "image"
// - Sends POIB + distance + click value with the image
// - Shows client-side expected clicks + backend-confirmed clicks
export default function App() {
  // Backend base (override via Render env: VITE_API_BASE)
  const API_BASE = useMemo(() => {
    const raw = (import.meta?.env?.VITE_API_BASE || "").trim();
    const fallback = "https://sczn3-sec-backend-pipe.onrender.com";
    return (raw || fallback).replace(/\/+$/, "");
  }, []);

  const ENDPOINT = `${API_BASE}/api/sec`;

  // Inputs (defaults match SCZN3 v1.2)
  const [poibX, setPoibX] = useState("1.00");   // Right + / Left -
  const [poibY, setPoibY] = useState("-2.00");  // Up + / Down -
  const [distanceYards, setDistanceYards] = useState("100");
  const [clickValueMoa, setClickValueMoa] = useState("0.25");

  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [resp, setResp] = useState(null);
  const [error, setError] = useState("");
  const [showRaw, setShowRaw] = useState(true);

  function toNum(v, fallback = 0) {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  }

  function round2(n) {
    return Math.round(n * 100) / 100;
  }

  // 1 MOA @ 100 yards = 1.047 inches
  function moaInchesAt(dYds) {
    return 1.047 * (dYds / 100);
  }

  function clicksSigned(inches, dYds, clickMoa) {
    const inchesPerMoa = moaInchesAt(dYds);
    if (!inchesPerMoa || !clickMoa) return 0;
    return inches / (inchesPerMoa * clickMoa);
  }

  function dialText(axis, signedClicks) {
    const abs = Math.abs(signedClicks);
    if (axis === "windage") return signedClicks >= 0 ? `RIGHT ${abs.toFixed(2)} clicks` : `LEFT ${abs.toFixed(2)} clicks`;
    return signedClicks >= 0 ? `UP ${abs.toFixed(2)} clicks` : `DOWN ${abs.toFixed(2)} clicks`;
  }

  const expected = useMemo(() => {
    const x = toNum(poibX, 0);
    const y = toNum(poibY, 0);
    const d = toNum(distanceYards, 100);
    const c = toNum(clickValueMoa, 0.25);

    const w = round2(clicksSigned(x, d, c));
    const e = round2(clicksSigned(y, d, c));

    return {
      windage: w,
      elevation: e,
      dialWindage: dialText("windage", w),
      dialElevation: dialText("elevation", e),
    };
  }, [poibX, poibY, distanceYards, clickValueMoa]);

  const backend = useMemo(() => {
    const sec = resp?.sec;
    const w = sec?.clicksSigned?.windage;
    const e = sec?.clicksSigned?.elevation;
    const dw = sec?.dial?.windage;
    const de = sec?.dial?.elevation;

    if (typeof w !== "number" || typeof e !== "number") return null;

    return {
      windage: w,
      elevation: e,
      dialWindage: typeof dw === "string" ? dw : dialText("windage", w),
      dialElevation: typeof de === "string" ? de : dialText("elevation", e),
      computeStatus: sec?.computeStatus || "",
    };
  }, [resp]);

  function mismatchFlag() {
    if (!backend) return "";
    const dw = Math.abs(round2(backend.windage) - round2(expected.windage));
    const de = Math.abs(round2(backend.elevation) - round2(expected.elevation));
    if (dw <= 0.01 && de <= 0.01) return "MATCH ✅";
    return "MISMATCH ⚠️";
  }

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    setResp(null);

    if (!file) {
      setError("Choose an image first.");
      return;
    }

    const fd = new FormData();
    fd.append("image", file);

    // Primary names (backend should read these)
    fd.append("poibX", String(poibX));
    fd.append("poibY", String(poibY));
    fd.append("distanceYards", String(distanceYards));
    fd.append("clickValueMoa", String(clickValueMoa));

    // Optional aliases (just in case backend checks other keys)
    fd.append("x", String(poibX));
    fd.append("y", String(poibY));
    fd.append("poibXInches", String(poibX));
    fd.append("poibYInches", String(poibY));
    fd.append("distance", String(distanceYards));
    fd.append("clickValue", String(clickValueMoa));

    setLoading(true);
    try {
      const r = await fetch(ENDPOINT, { method: "POST", body: fd });
      const text = await r.text();
      let json;

      try {
        json = JSON.parse(text);
      } catch {
        json = { httpStatus: r.status, raw: text };
      }

      setResp(json);
    } catch (err) {
      setError(err?.message || String(err));
    } finally {
      setLoading(false);
    }
  }

  function onPickFile(f) {
    setFile(f || null);
    setResp(null);
    setError("");
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(f ? URL.createObjectURL(f) : "");
  }

  const boxStyle = {
    border: "2px solid #111",
    borderRadius: 10,
    padding: 14,
  };

  return (
    <div style={{ maxWidth: 980, margin: "0 auto", padding: 18, fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial" }}>
      <h1 style={{ margin: "8px 0 6px" }}>SCZN3 SEC — Upload Test</h1>

      <div style={{ marginBottom: 10, lineHeight: 1.35 }}>
        <div><b>Endpoint:</b> {ENDPOINT}</div>
        <div><b>multipart field:</b> image</div>
      </div>

      <form onSubmit={onSubmit} style={{ display: "grid", gap: 12 }}>
        <input type="file" accept="image/*" onChange={(e) => onPickFile(e.target.files?.[0])} />

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div>
            <label><b>POIB X (inches)</b> Right + / Left -</label>
            <input value={poibX} onChange={(e) => setPoibX(e.target.value)} style={{ width: "100%", padding: 10, fontSize: 16 }} />
          </div>
          <div>
            <label><b>POIB Y (inches)</b> Up + / Down -</label>
            <input value={poibY} onChange={(e) => setPoibY(e.target.value)} style={{ width: "100%", padding: 10, fontSize: 16 }} />
          </div>
          <div>
            <label><b>Distance (yards)</b></label>
            <input value={distanceYards} onChange={(e) => setDistanceYards(e.target.value)} style={{ width: "100%", padding: 10, fontSize: 16 }} />
          </div>
          <div>
            <label><b>Click Value (MOA)</b></label>
            <input value={clickValueMoa} onChange={(e) => setClickValueMoa(e.target.value)} style={{ width: "100%", padding: 10, fontSize: 16 }} />
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, alignItems: "start" }}>
          <div style={boxStyle}>
            <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 8 }}>Expected clicks (client-side sanity check)</div>
            <div style={{ fontSize: 18 }}><b>Windage:</b> {expected.windage.toFixed(2)}</div>
            <div style={{ fontSize: 18, marginBottom: 6 }}><b>Elevation:</b> {expected.elevation.toFixed(2)}</div>
            <div style={{ fontSize: 15 }}><b>Dial:</b> {expected.dialWindage}</div>
            <div style={{ fontSize: 15 }}><b>Dial:</b> {expected.dialElevation}</div>
          </div>

          <div style={{ border: "1px solid #ddd", borderRadius: 10, padding: 10, minHeight: 220 }}>
            {previewUrl ? (
              <img src={previewUrl} alt="preview" style={{ width: "100%", height: "auto", display: "block", borderRadius: 8 }} />
            ) : (
              <div style={{ color: "#666" }}>Preview will appear here.</div>
            )}
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          style={{
            padding: "12px 14px",
            fontSize: 18,
            borderRadius: 10,
            border: "2px solid #2b6cb0",
            background: loading ? "#ddd" : "#fff",
            cursor: loading ? "not-allowed" : "pointer",
            fontWeight: 800
          }}
        >
          {loading ? "Sending…" : "Send to SCZN3 SEC backend"}
        </button>

        {error ? <div style={{ color: "crimson", fontWeight: 700 }}>{error}</div> : null}

        {backend ? (
          <div style={boxStyle}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" }}>
              <div style={{ fontWeight: 900, fontSize: 18 }}>Backend confirmed</div>
              <div style={{ fontWeight: 900 }}>{mismatchFlag()}</div>
            </div>

            <div style={{ fontSize: 18, marginTop: 6 }}><b>Windage:</b> {backend.windage.toFixed(2)}</div>
            <div style={{ fontSize: 18 }}><b>Elevation:</b> {backend.elevation.toFixed(2)}</div>

            <div style={{ fontSize: 15, marginTop: 6 }}><b>Dial:</b> {backend.dialWindage}</div>
            <div style={{ fontSize: 15 }}><b>Dial:</b> {backend.dialElevation}</div>

            {backend.computeStatus ? (
              <div style={{ fontSize: 13, marginTop: 8, color: "#555" }}>
                computeStatus: {backend.computeStatus}
              </div>
            ) : null}
          </div>
        ) : null}

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input id="showRaw" type="checkbox" checked={showRaw} onChange={(e) => setShowRaw(e.target.checked)} />
          <label htmlFor="showRaw"><b>Show raw JSON response</b></label>
        </div>

        {showRaw ? (
          <>
            <h2 style={{ marginTop: 6, marginBottom: 8 }}>Response</h2>
            <pre style={{ background: "#111", color: "#eee", padding: 14, borderRadius: 12, overflowX: "auto", whiteSpace: "pre-wrap" }}>
{resp ? JSON.stringify(resp, null, 2) : ""}
            </pre>
          </>
        ) : null}
      </form>
    </div>
  );
}
