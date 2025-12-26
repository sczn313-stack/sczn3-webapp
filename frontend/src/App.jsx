import React, { useMemo, useState } from "react";

export default function App() {
  // Backend base (can override with VITE_API_BASE on Render)
  const API_BASE = useMemo(() => {
    const raw = (import.meta?.env?.VITE_API_BASE || "").trim();
    const fallback = "https://sczn3-sec-backend-pipe.onrender.com";
    const base = raw || fallback;
    return base.replace(/\/+$/, "");
  }, []);

  const ENDPOINT = `${API_BASE}/api/sec`;

  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");

  // Inputs (defaults match your standard)
  const [poibX, setPoibX] = useState("1.00");     // Right + / Left -
  const [poibY, setPoibY] = useState("-2.00");    // Up + / Down -
  const [distanceYards, setDistanceYards] = useState("100");
  const [clickValueMoa, setClickValueMoa] = useState("0.25");

  const [loading, setLoading] = useState(false);
  const [resp, setResp] = useState(null);
  const [error, setError] = useState("");

  function toNum(v, fallback = 0) {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  }

  function moaAtDistanceInches(distance) {
    // 1 MOA ≈ 1.047" @ 100 yards
    return 1.047 * (distance / 100);
  }

  const expected = useMemo(() => {
    const x = toNum(poibX, 0);
    const y = toNum(poibY, 0);
    const d = toNum(distanceYards, 100);
    const click = toNum(clickValueMoa, 0.25);

    const inchesPerClick = moaAtDistanceInches(d) * click; // inches per click
    const windage = inchesPerClick !== 0 ? x / inchesPerClick : 0;
    const elevation = inchesPerClick !== 0 ? y / inchesPerClick : 0;

    return {
      windage: Number(windage.toFixed(2)),
      elevation: Number(elevation.toFixed(2)),
    };
  }, [poibX, poibY, distanceYards, clickValueMoa]);

  function onPickFile(e) {
    const f = e.target.files?.[0] || null;
    setFile(f);
    setResp(null);
    setError("");

    if (f) {
      const url = URL.createObjectURL(f);
      setPreviewUrl(url);
    } else {
      setPreviewUrl("");
    }
  }

  async function send() {
    setError("");
    setResp(null);

    if (!file) {
      setError("Pick an image first.");
      return;
    }

    // Build form data (THIS is the fix)
    const fd = new FormData();
    fd.append("image", file);

    // Send the numeric fields as strings (multer/express will parse them from req.body)
    fd.append("poibX", String(toNum(poibX, 0)));
    fd.append("poibY", String(toNum(poibY, 0)));
    fd.append("distanceYards", String(toNum(distanceYards, 100)));
    fd.append("clickValueMoa", String(toNum(clickValueMoa, 0.25)));

    // Also include the canonical center (optional, but helpful)
    fd.append("centerCol", "L");
    fd.append("centerRow", "12");

    // (Optional compatibility aliases in case backend expects different names)
    fd.append("poibXInches", String(toNum(poibX, 0)));
    fd.append("poibYInches", String(toNum(poibY, 0)));

    try {
      setLoading(true);
      const r = await fetch(ENDPOINT, { method: "POST", body: fd });

      const text = await r.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        data = { ok: false, httpStatus: r.status, raw: text };
      }

      // Always show status
      data.httpStatus = r.status;
      setResp(data);

      if (!r.ok || data?.ok === false) {
        setError(data?.error || `Request failed (HTTP ${r.status}).`);
      }
    } catch (err) {
      setError(err?.message || "Network error.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial", padding: 18, maxWidth: 980, margin: "0 auto" }}>
      <h1 style={{ margin: "0 0 6px 0", fontSize: 44, letterSpacing: 0.5 }}>SCZN3 SEC — Upload Test</h1>

      <div style={{ fontSize: 16, marginBottom: 8 }}>
        <div><b>Endpoint:</b> {ENDPOINT}</div>
        <div><b>multipart field:</b> image</div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 16, alignItems: "start" }}>
        <div>
          <div style={{ margin: "10px 0" }}>
            <input type="file" accept="image/*" onChange={onPickFile} />
            {file ? <span style={{ marginLeft: 10 }}>{file.name}</span> : null}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <div style={{ fontWeight: 700 }}>POIB X (inches) Right + / Left -</div>
              <input
                value={poibX}
                onChange={(e) => setPoibX(e.target.value)}
                inputMode="decimal"
                style={{ width: "100%", padding: 10, fontSize: 18, borderRadius: 8, border: "1px solid #ccc" }}
              />
            </div>

            <div>
              <div style={{ fontWeight: 700 }}>POIB Y (inches) Up + / Down -</div>
              <input
                value={poibY}
                onChange={(e) => setPoibY(e.target.value)}
                inputMode="decimal"
                style={{ width: "100%", padding: 10, fontSize: 18, borderRadius: 8, border: "1px solid #ccc" }}
              />
            </div>

            <div>
              <div style={{ fontWeight: 700 }}>Distance (yards)</div>
              <input
                value={distanceYards}
                onChange={(e) => setDistanceYards(e.target.value)}
                inputMode="numeric"
                style={{ width: "100%", padding: 10, fontSize: 18, borderRadius: 8, border: "1px solid #ccc" }}
              />
            </div>

            <div>
              <div style={{ fontWeight: 700 }}>Click Value (MOA)</div>
              <input
                value={clickValueMoa}
                onChange={(e) => setClickValueMoa(e.target.value)}
                inputMode="decimal"
                style={{ width: "100%", padding: 10, fontSize: 18, borderRadius: 8, border: "1px solid #ccc" }}
              />
            </div>
          </div>

          <div style={{ marginTop: 14, padding: 14, border: "2px solid #111", borderRadius: 12 }}>
            <div style={{ fontWeight: 800, fontSize: 20, marginBottom: 6 }}>
              Expected clicks (client-side sanity check)
            </div>
            <div style={{ fontSize: 18 }}>
              <div><b>Windage:</b> {expected.windage}</div>
              <div><b>Elevation:</b> {expected.elevation}</div>
            </div>
          </div>

          <button
            onClick={send}
            disabled={loading}
            style={{
              marginTop: 14,
              width: "100%",
              padding: "14px 16px",
              fontSize: 20,
              fontWeight: 800,
              borderRadius: 10,
              border: "none",
              cursor: loading ? "not-allowed" : "pointer",
              background: "#e7e7e7",
            }}
          >
            {loading ? "Sending..." : "Send to SCZN3 SEC backend"}
          </button>

          {error ? (
            <div style={{ marginTop: 12, color: "#b00020", fontWeight: 700 }}>
              {error}
            </div>
          ) : null}
        </div>

        <div>
          {previewUrl ? (
            <img
              src={previewUrl}
              alt="preview"
              style={{ width: "100%", borderRadius: 12, border: "1px solid #ddd" }}
            />
          ) : (
            <div style={{ width: "100%", height: 220, borderRadius: 12, border: "1px dashed #bbb", display: "grid", placeItems: "center", color: "#777" }}>
              Preview
            </div>
          )}
        </div>
      </div>

      <h2 style={{ marginTop: 24, fontSize: 34 }}>Response</h2>

      <pre style={{
        background: "#111",
        color: "#eee",
        padding: 16,
        borderRadius: 12,
        overflowX: "auto",
        fontSize: 14,
        lineHeight: 1.35
      }}>
        {resp ? JSON.stringify(resp, null, 2) : "(no response yet)"}
      </pre>
    </div>
  );
}
