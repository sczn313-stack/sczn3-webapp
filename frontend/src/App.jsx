import React, { useMemo, useState } from "react";

/**
 * SCZN3 SEC — Upload Test (frontend)
 * - Sends multipart/form-data:
 *   field "image" (file)
 *   + poibX, poibY (inches)
 *   + distanceYards
 *   + clickValueMoa
 *
 * Signs:
 * - poibX: Right +, Left -
 * - poibY: Up +, Down -
 *
 * Expected click math:
 * 1 MOA @ 100yd = 1.047"
 * moa = inches / (1.047 * (distanceYards/100))
 * clicks = moa / clickValueMoa
 */

function toNum(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function moaInchesAt(distanceYards) {
  return 1.047 * (toNum(distanceYards, 100) / 100);
}

function inchesToMoa(inches, distanceYards) {
  const denom = moaInchesAt(distanceYards);
  return denom === 0 ? 0 : inches / denom;
}

function clicksFromInches(inches, distanceYards, clickValueMoa) {
  const moa = inchesToMoa(inches, distanceYards);
  const cv = toNum(clickValueMoa, 0.25);
  return cv === 0 ? 0 : moa / cv;
}

function dialText(axisName, signedClicks) {
  // axisName: "windage" or "elevation"
  const c = toNum(signedClicks, 0);
  const abs = Math.abs(c).toFixed(2);

  if (axisName === "windage") {
    if (c > 0) return `RIGHT ${abs} clicks`;
    if (c < 0) return `LEFT ${abs} clicks`;
    return `CENTER 0.00 clicks`;
  }

  // elevation
  if (c > 0) return `UP ${abs} clicks`;
  if (c < 0) return `DOWN ${abs} clicks`;
  return `CENTER 0.00 clicks`;
}

export default function App() {
  // Backend base (Render Static Sites get env baked at build time)
  const API_BASE = useMemo(() => {
    const raw = (import.meta.env?.VITE_API_BASE || "").trim();
    const fallback = "https://sczn3-sec-backend-pipe.onrender.com";
    const base = raw || fallback;
    return base.replace(/\/+$/, "");
  }, []);

  const ENDPOINT = `${API_BASE}/api/sec`;

  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");

  // Inputs (defaults match your standard)
  const [poibX, setPoibX] = useState("1.00"); // Right + / Left -
  const [poibY, setPoibY] = useState("-2.00"); // Up + / Down -
  const [distanceYards, setDistanceYards] = useState("100");
  const [clickValueMoa, setClickValueMoa] = useState("0.25");

  const [loading, setLoading] = useState(false);
  const [resp, setResp] = useState(null);
  const [error, setError] = useState("");

  // Client-side sanity check (expected clicks)
  const expectedWindage = useMemo(() => {
    const x = toNum(poibX, 0);
    return clicksFromInches(x, distanceYards, clickValueMoa);
  }, [poibX, distanceYards, clickValueMoa]);

  const expectedElevation = useMemo(() => {
    const y = toNum(poibY, 0);
    return clicksFromInches(y, distanceYards, clickValueMoa);
  }, [poibY, distanceYards, clickValueMoa]);

  function onPickFile(e) {
    const f = e.target.files?.[0] || null;
    setFile(f);
    setResp(null);
    setError("");

    if (previewUrl) URL.revokeObjectURL(previewUrl);
    if (f) setPreviewUrl(URL.createObjectURL(f));
    else setPreviewUrl("");
  }

  async function onSubmit() {
    setError("");
    setResp(null);

    if (!file) {
      setError("Pick an image first.");
      return;
    }

    const fd = new FormData();
    // REQUIRED multipart file field name:
    fd.append("image", file);

    // Always send these fields with the image (so backend won’t default to 0,0)
    fd.append("poibX", String(toNum(poibX, 0)));
    fd.append("poibY", String(toNum(poibY, 0)));
    fd.append("distanceYards", String(toNum(distanceYards, 100)));
    fd.append("clickValueMoa", String(toNum(clickValueMoa, 0.25)));

    // Optional aliases (harmless, helps if backend checks alternates)
    fd.append("poibXInches", String(toNum(poibX, 0)));
    fd.append("poibYInches", String(toNum(poibY, 0)));
    fd.append("distance", String(toNum(distanceYards, 100)));
    fd.append("clickValue", String(toNum(clickValueMoa, 0.25)));

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
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  // Show what the backend *should* say as “dial” text for sanity
  const dialWindage = useMemo(
    () => dialText("windage", expectedWindage),
    [expectedWindage]
  );
  const dialElevation = useMemo(
    () => dialText("elevation", expectedElevation),
    [expectedElevation]
  );

  return (
    <div style={{ fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial", padding: 16, maxWidth: 980, margin: "0 auto" }}>
      <h1 style={{ margin: "8px 0 6px", fontSize: 44, lineHeight: 1.05 }}>SCZN3 SEC — Upload Test</h1>

      <div style={{ marginBottom: 10, fontSize: 16 }}>
        <div><b>Endpoint:</b> {ENDPOINT}</div>
        <div><b>multipart field:</b> image</div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: 16, alignItems: "start" }}>
        <div>
          <div style={{ marginBottom: 10 }}>
            <input type="file" accept="image/*" onChange={onPickFile} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <label style={{ display: "grid", gap: 6 }}>
              <div><b>POIB X (inches)</b> &nbsp;Right + / Left -</div>
              <input value={poibX} onChange={(e) => setPoibX(e.target.value)} inputMode="decimal" style={{ padding: 10, fontSize: 16 }} />
            </label>

            <label style={{ display: "grid", gap: 6 }}>
              <div><b>POIB Y (inches)</b> &nbsp;Up + / Down -</div>
              <input value={poibY} onChange={(e) => setPoibY(e.target.value)} inputMode="decimal" style={{ padding: 10, fontSize: 16 }} />
            </label>

            <label style={{ display: "grid", gap: 6 }}>
              <div><b>Distance (yards)</b></div>
              <input value={distanceYards} onChange={(e) => setDistanceYards(e.target.value)} inputMode="numeric" style={{ padding: 10, fontSize: 16 }} />
            </label>

            <label style={{ display: "grid", gap: 6 }}>
              <div><b>Click Value (MOA)</b></div>
              <input value={clickValueMoa} onChange={(e) => setClickValueMoa(e.target.value)} inputMode="decimal" style={{ padding: 10, fontSize: 16 }} />
            </label>
          </div>

          <div style={{ marginTop: 14, padding: 14, border: "2px solid #111", borderRadius: 10, background: "#f7f7f7", maxWidth: 420 }}>
            <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 6 }}>
              Expected clicks (client-side sanity check)
            </div>
            <div style={{ fontSize: 18 }}>
              <div><b>Windage:</b> {expectedWindage.toFixed(2)}</div>
              <div><b>Elevation:</b> {expectedElevation.toFixed(2)}</div>
            </div>
            <div style={{ marginTop: 8, fontSize: 14 }}>
              <div><b>Dial:</b> {dialWindage}</div>
              <div><b>Dial:</b> {dialElevation}</div>
            </div>
          </div>

          <button
            onClick={onSubmit}
            disabled={loading}
            style={{
              marginTop: 14,
              padding: "12px 16px",
              fontSize: 18,
              borderRadius: 10,
              border: "2px solid #0b57d0",
              background: loading ? "#d7e3ff" : "#eaf1ff",
              color: "#0b57d0",
              fontWeight: 800,
              cursor: loading ? "default" : "pointer",
              width: "100%",
              maxWidth: 420,
            }}
          >
            {loading ? "Sending..." : "Send to SCZN3 SEC backend"}
          </button>

          {error ? (
            <div style={{ marginTop: 10, color: "#b00020", fontWeight: 700 }}>
              {error}
            </div>
          ) : null}
        </div>

        <div>
          <div style={{ border: "2px solid #222", borderRadius: 12, overflow: "hidden", background: "#fff" }}>
            {previewUrl ? (
              <img src={previewUrl} alt="preview" style={{ width: "100%", display: "block" }} />
            ) : (
              <div style={{ padding: 18, color: "#555" }}>Pick an image to preview it here.</div>
            )}
          </div>
        </div>
      </div>

      <h2 style={{ marginTop: 22, fontSize: 34 }}>Response</h2>
      <pre style={{ padding: 14, borderRadius: 12, background: "#111", color: "#e9e9e9", overflowX: "auto" }}>
        {resp ? JSON.stringify(resp, null, 2) : "(none yet)"}
      </pre>
    </div>
  );
}
