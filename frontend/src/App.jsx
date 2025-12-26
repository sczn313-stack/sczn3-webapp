import React, { useMemo, useEffect, useState } from "react";

export default function App() {
  // --------- Config (Render Static Site can override with VITE_API_BASE) ----------
  const API_BASE = useMemo(() => {
    const raw = (import.meta?.env?.VITE_API_BASE || "").trim();
    const fallback = "https://sczn3-sec-backend-pipe.onrender.com";
    return (raw || fallback).replace(/\/+$/, "");
  }, []);

  const ENDPOINT = `${API_BASE}/api/sec`;

  // --------- State ----------
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");

  const [poibX, setPoibX] = useState("1.00"); // Right + / Left -
  const [poibY, setPoibY] = useState("-2.00"); // Up + / Down -
  const [distanceYards, setDistanceYards] = useState("100");
  const [clickValueMoa, setClickValueMoa] = useState("0.25");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [resp, setResp] = useState(null);
  const [showRaw, setShowRaw] = useState(true);

  // --------- Helpers ----------
  function toNum(v, fallback = 0) {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  }

  function moaInchesAt(distanceYardsNum) {
    // 1 MOA ≈ 1.047" at 100 yards
    return 1.047 * (distanceYardsNum / 100);
  }

  function dialText(axis, signedClicks) {
    const n = Number(signedClicks);
    if (!Number.isFinite(n) || n === 0) {
      return axis === "windage" ? "CENTER (0.00 clicks)" : "LEVEL (0.00 clicks)";
    }

    const abs = Math.abs(n);
    if (axis === "windage") {
      const dir = n > 0 ? "RIGHT" : "LEFT";
      return `${dir} ${abs.toFixed(2)} clicks`;
    } else {
      const dir = n > 0 ? "UP" : "DOWN";
      return `${dir} ${abs.toFixed(2)} clicks`;
    }
  }

  // --------- Preview image URL ----------
  useEffect(() => {
    if (!file) {
      setPreviewUrl("");
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // --------- Expected clicks (client sanity check) ----------
  const expected = useMemo(() => {
    const x = toNum(poibX);
    const y = toNum(poibY);
    const dist = toNum(distanceYards, 100);
    const click = toNum(clickValueMoa, 0.25);

    if (!Number.isFinite(dist) || dist <= 0) return null;
    if (!Number.isFinite(click) || click <= 0) return null;

    const moaIn = moaInchesAt(dist);
    const denom = moaIn * click;
    if (denom === 0) return null;

    const windage = x / denom; // + = RIGHT
    const elevation = y / denom; // + = UP

    return {
      windage,
      elevation,
      dialWindage: dialText("windage", windage),
      dialElevation: dialText("elevation", elevation),
    };
  }, [poibX, poibY, distanceYards, clickValueMoa]);

  // --------- Submit ----------
  async function send() {
    setError("");
    setResp(null);

    if (!file) {
      setError("Choose an image file first.");
      return;
    }

    const fd = new FormData();
    fd.append("image", file);

    // These names match what the backend expects (and common aliases)
    fd.append("poibX", String(poibX));
    fd.append("poibY", String(poibY));
    fd.append("distanceYards", String(distanceYards));
    fd.append("clickValueMoa", String(clickValueMoa));

    // Extra aliases (harmless, helps if backend reads alternates)
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
        throw new Error(`Backend did not return JSON.\n\n${text.slice(0, 400)}`);
      }

      if (!r.ok) {
        throw new Error(json?.error || `HTTP ${r.status}`);
      }

      setResp(json);
    } catch (e) {
      setError(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  // --------- Pull backend-confirmed values ----------
  const backendConfirmed = useMemo(() => {
    const sec = resp?.sec;
    if (!sec) return null;

    const clicksSigned = sec?.clicksSigned || {};
    const dial = sec?.dial || {};

    const wind = Number(clicksSigned?.windage);
    const elev = Number(clicksSigned?.elevation);

    const hasSigned =
      Number.isFinite(wind) || Number.isFinite(elev) || !!dial?.windage || !!dial?.elevation;

    if (!hasSigned) return null;

    return {
      windageSigned: Number.isFinite(wind) ? wind : null,
      elevationSigned: Number.isFinite(elev) ? elev : null,
      dialWindage: dial?.windage || (Number.isFinite(wind) ? dialText("windage", wind) : ""),
      dialElevation: dial?.elevation || (Number.isFinite(elev) ? dialText("elevation", elev) : ""),
      poib: sec?.poibInches || null,
      distanceYards: sec?.distanceYards,
      clickValueMoa: sec?.clickValueMoa,
      build: resp?.build,
      service: resp?.service,
    };
  }, [resp]);

  // --------- UI ----------
  return (
    <div style={{ padding: 18, fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial" }}>
      <h1 style={{ margin: "0 0 10px 0" }}>SCZN3 SEC — Upload Test</h1>

      <div style={{ marginBottom: 10, lineHeight: 1.4 }}>
        <div>
          <b>Endpoint:</b> {ENDPOINT}
        </div>
        <div>
          <b>multipart field:</b> image
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, alignItems: "start" }}>
        {/* Left: inputs */}
        <div>
          <div style={{ marginBottom: 10 }}>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
            {file?.name ? (
              <div style={{ marginTop: 6, opacity: 0.8 }}>{file.name}</div>
            ) : null}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <label>
              <div style={{ fontWeight: 700 }}>POIB X (inches) Right + / Left -</div>
              <input
                value={poibX}
                onChange={(e) => setPoibX(e.target.value)}
                style={{ width: "100%", padding: 8, fontSize: 16 }}
              />
            </label>

            <label>
              <div style={{ fontWeight: 700 }}>POIB Y (inches) Up + / Down -</div>
              <input
                value={poibY}
                onChange={(e) => setPoibY(e.target.value)}
                style={{ width: "100%", padding: 8, fontSize: 16 }}
              />
            </label>

            <label>
              <div style={{ fontWeight: 700 }}>Distance (yards)</div>
              <input
                value={distanceYards}
                onChange={(e) => setDistanceYards(e.target.value)}
                style={{ width: "100%", padding: 8, fontSize: 16 }}
              />
            </label>

            <label>
              <div style={{ fontWeight: 700 }}>Click Value (MOA)</div>
              <input
                value={clickValueMoa}
                onChange={(e) => setClickValueMoa(e.target.value)}
                style={{ width: "100%", padding: 8, fontSize: 16 }}
              />
            </label>
          </div>

          {/* Expected clicks */}
          <div
            style={{
              marginTop: 12,
              padding: 12,
              border: "2px solid #222",
              borderRadius: 10,
              background: "#fff",
            }}
          >
            <div style={{ fontWeight: 900, fontSize: 18, marginBottom: 8 }}>
              Expected clicks (client-side sanity check)
            </div>

            {expected ? (
              <>
                <div style={{ fontSize: 18 }}>
                  <b>Windage:</b> {expected.windage.toFixed(2)}
                </div>
                <div style={{ fontSize: 18 }}>
                  <b>Elevation:</b> {expected.elevation.toFixed(2)}
                </div>
                <div style={{ marginTop: 6 }}>
                  <b>Dial:</b> {expected.dialWindage}
                </div>
                <div>
                  <b>Dial:</b> {expected.dialElevation}
                </div>
              </>
            ) : (
              <div style={{ opacity: 0.8 }}>Enter valid distance + click value.</div>
            )}
          </div>

          <button
            onClick={send}
            disabled={loading}
            style={{
              marginTop: 14,
              width: "100%",
              padding: "12px 14px",
              fontSize: 16,
              fontWeight: 800,
              borderRadius: 10,
              border: "2px solid #2c6bed",
              background: loading ? "#dbe7ff" : "#eaf2ff",
              cursor: loading ? "default" : "pointer",
            }}
          >
            {loading ? "Sending..." : "Send to SCZN3 SEC backend"}
          </button>

          {error ? (
            <div
              style={{
                marginTop: 12,
                padding: 10,
                border: "2px solid #c00",
                borderRadius: 10,
                color: "#c00",
                whiteSpace: "pre-wrap",
              }}
            >
              {error}
            </div>
          ) : null}
        </div>

        {/* Right: preview */}
        <div>
          {previewUrl ? (
            <img
              src={previewUrl}
              alt="Preview"
              style={{ width: "100%", borderRadius: 12, border: "2px solid #111" }}
            />
          ) : (
            <div
              style={{
                width: "100%",
                minHeight: 240,
                borderRadius: 12,
                border: "2px dashed #777",
                display: "grid",
                placeItems: "center",
                opacity: 0.7,
              }}
            >
              Image preview
            </div>
          )}
        </div>
      </div>

      {/* Backend confirmed */}
      {backendConfirmed ? (
        <div
          style={{
            marginTop: 18,
            padding: 12,
            border: "2px solid #0b5",
            borderRadius: 12,
            background: "#f3fff8",
          }}
        >
          <div style={{ fontWeight: 900, fontSize: 18, marginBottom: 6 }}>Backend confirmed</div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <div>
                <b>Windage (signed):</b>{" "}
                {backendConfirmed.windageSigned === null
                  ? "—"
                  : backendConfirmed.windageSigned.toFixed(2)}
              </div>
              <div>
                <b>Dial:</b> {backendConfirmed.dialWindage}
              </div>
            </div>

            <div>
              <div>
                <b>Elevation (signed):</b>{" "}
                {backendConfirmed.elevationSigned === null
                  ? "—"
                  : backendConfirmed.elevationSigned.toFixed(2)}
              </div>
              <div>
                <b>Dial:</b> {backendConfirmed.dialElevation}
              </div>
            </div>
          </div>

          {backendConfirmed.poib ? (
            <div style={{ marginTop: 8, opacity: 0.9 }}>
              <b>POIB inches:</b> x={backendConfirmed.poib.x}, y={backendConfirmed.poib.y}{" "}
              <span style={{ marginLeft: 10 }}>
                <b>Distance:</b> {backendConfirmed.distanceYards}y
              </span>{" "}
              <span style={{ marginLeft: 10 }}>
                <b>Click:</b> {backendConfirmed.clickValueMoa} MOA
              </span>
            </div>
          ) : null}

          <div style={{ marginTop: 6, opacity: 0.75 }}>
            <b>Service:</b> {backendConfirmed.service}{" "}
            <span style={{ marginLeft: 10 }}>
              <b>Build:</b> {backendConfirmed.build}
            </span>
          </div>
        </div>
      ) : null}

      {/* Response (raw) */}
      <div style={{ marginTop: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <h2 style={{ margin: 0 }}>Response</h2>
          <label style={{ display: "flex", alignItems: "center", gap: 6, opacity: 0.9 }}>
            <input type="checkbox" checked={showRaw} onChange={(e) => setShowRaw(e.target.checked)} />
            Show raw JSON
          </label>
        </div>

        {showRaw ? (
          <pre
            style={{
              marginTop: 10,
              padding: 14,
              background: "#111",
              color: "#eee",
              borderRadius: 12,
              overflowX: "auto",
              whiteSpace: "pre",
            }}
          >
            {resp ? JSON.stringify(resp, null, 2) : "(no response yet)"}
          </pre>
        ) : null}
      </div>
    </div>
  );
}
