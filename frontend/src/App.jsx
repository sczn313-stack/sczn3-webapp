import React, { useMemo, useState } from "react";

export default function App() {
  // Backend base (can override with VITE_API_BASE in Render later)
  const API_BASE = useMemo(() => {
    const raw = (import.meta?.env?.VITE_API_BASE || "").trim();
    const fallback = "https://sczn3-sec-backend-pipe.onrender.com";
    const base = raw || fallback;
    return base.replace(/\/+$/, "");
  }, []);

  const ENDPOINT = `${API_BASE}/api/sec`;

  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");

  // Inputs to test click math WITHOUT Hoppscotch
  const [poibXIn, setPoibXIn] = useState("1.00");   // inches (Right + / Left -)
  const [poibYIn, setPoibYIn] = useState("-2.00");  // inches (Up + / Down -)
  const [distanceYards, setDistanceYards] = useState("100");
  const [clickValueMoa, setClickValueMoa] = useState("0.25");

  const [loading, setLoading] = useState(false);
  const [resp, setResp] = useState(null);
  const [error, setError] = useState("");

  function onPickFile(e) {
    const f = e.target.files?.[0] || null;
    setFile(f);
    setResp(null);
    setError("");

    if (previewUrl) URL.revokeObjectURL(previewUrl);
    if (f) setPreviewUrl(URL.createObjectURL(f));
    else setPreviewUrl("");
  }

  function toNumString(v, fallback = "0") {
    const n = Number(v);
    return Number.isFinite(n) ? String(n) : fallback;
  }

  async function onSend() {
    setResp(null);
    setError("");

    if (!file) {
      setError("Pick an image first.");
      return;
    }

    setLoading(true);
    try {
      const form = new FormData();

      // IMPORTANT: backend expects multipart field name exactly "image"
      form.append("image", file);

      // Extra fields (backend can read these if implemented)
      form.append("poibXIn", toNumString(poibXIn, "0"));
      form.append("poibYIn", toNumString(poibYIn, "0"));
      form.append("distanceYards", toNumString(distanceYards, "100"));
      form.append("clickValueMoa", toNumString(clickValueMoa, "0.25"));

      const res = await fetch(ENDPOINT, { method: "POST", body: form });

      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        data = { ok: false, httpStatus: res.status, raw: text };
      }

      setResp({ httpStatus: res.status, ...data });
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  // Simple “expected clicks” preview (client-side sanity check)
  function expectedClicks() {
    const x = Number(poibXIn);
    const y = Number(poibYIn);
    const yards = Number(distanceYards);
    const click = Number(clickValueMoa);

    if (![x, y, yards, click].every(Number.isFinite) || yards <= 0 || click <= 0) {
      return null;
    }

    // MOA inches per 100 yards approximation (good enough for proof test)
    const moaInchesAtYards = 1.047 * (yards / 100);
    const moaX = x / moaInchesAtYards;
    const moaY = y / moaInchesAtYards;

    const windageClicks = moaX / click;
    const elevationClicks = moaY / click;

    return {
      windage: Number.isFinite(windageClicks) ? windageClicks.toFixed(2) : "0.00",
      elevation: Number.isFinite(elevationClicks) ? elevationClicks.toFixed(2) : "0.00",
    };
  }

  const exp = expectedClicks();

  return (
    <div style={{ maxWidth: 980, margin: "0 auto", padding: 16, fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial" }}>
      <h1 style={{ marginBottom: 6 }}>SCZN3 SEC — Upload Test</h1>

      <div style={{ marginBottom: 10 }}>
        <div><b>Endpoint:</b> {ENDPOINT}</div>
        <div><b>multipart field:</b> image</div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, alignItems: "start" }}>
        <div>
          <div style={{ marginBottom: 10 }}>
            <input type="file" accept="image/*" onChange={onPickFile} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
            <label>
              <div style={{ fontSize: 12, opacity: 0.8 }}>POIB X (inches) Right + / Left -</div>
              <input
                value={poibXIn}
                onChange={(e) => setPoibXIn(e.target.value)}
                inputMode="decimal"
                style={{ width: "100%", padding: 8 }}
              />
            </label>

            <label>
              <div style={{ fontSize: 12, opacity: 0.8 }}>POIB Y (inches) Up + / Down -</div>
              <input
                value={poibYIn}
                onChange={(e) => setPoibYIn(e.target.value)}
                inputMode="decimal"
                style={{ width: "100%", padding: 8 }}
              />
            </label>

            <label>
              <div style={{ fontSize: 12, opacity: 0.8 }}>Distance (yards)</div>
              <input
                value={distanceYards}
                onChange={(e) => setDistanceYards(e.target.value)}
                inputMode="numeric"
                style={{ width: "100%", padding: 8 }}
              />
            </label>

            <label>
              <div style={{ fontSize: 12, opacity: 0.8 }}>Click Value (MOA)</div>
              <input
                value={clickValueMoa}
                onChange={(e) => setClickValueMoa(e.target.value)}
                inputMode="decimal"
                style={{ width: "100%", padding: 8 }}
              />
            </label>
          </div>

          {exp && (
            <div style={{ padding: 10, border: "1px solid #333", borderRadius: 8, marginBottom: 12 }}>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>Expected clicks (client-side sanity check)</div>
              <div>Windage: <b>{exp.windage}</b></div>
              <div>Elevation: <b>{exp.elevation}</b></div>
            </div>
          )}

          <button
            onClick={onSend}
            disabled={loading}
            style={{
              width: "100%",
              padding: 12,
              fontSize: 16,
              fontWeight: 700,
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            {loading ? "Sending..." : "Send to SCZN3 SEC backend"}
          </button>

          {error && (
            <div style={{ marginTop: 10, color: "crimson" }}>
              <b>Error:</b> {error}
            </div>
          )}
        </div>

        <div>
          {previewUrl ? (
            <img
              src={previewUrl}
              alt="preview"
              style={{ width: "100%", borderRadius: 10, border: "1px solid #333" }}
            />
          ) : (
            <div style={{ padding: 20, border: "1px dashed #555", borderRadius: 10, opacity: 0.8 }}>
              Choose a file to preview it here.
            </div>
          )}
        </div>
      </div>

      <h2 style={{ marginTop: 20 }}>Response</h2>
      <pre style={{ background: "#111", padding: 12, borderRadius: 10, overflow: "auto" }}>
        {resp ? JSON.stringify(resp, null, 2) : "No response yet."}
      </pre>
    </div>
  );
}
