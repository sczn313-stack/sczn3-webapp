import React, { useMemo, useRef, useState } from "react";

const round2 = (n) => Math.round(n * 100) / 100;

function parseSize(spec) {
  const m = String(spec || "")
    .toLowerCase()
    .replace(/\s/g, "")
    .match(/^(\d+(\.\d+)?)x(\d+(\.\d+)?)$/);
  if (!m) return null;
  const w = parseFloat(m[1]);
  const h = parseFloat(m[3]);
  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return null;
  return { widthIn: w, heightIn: h };
}

export default function App() {
  // Endpoint
  const [endpoint, setEndpoint] = useState(
    "https://sczn3-sec-backend-pipe-17.onrender.com/api/sec"
  );

  // Inputs
  const [targetSizeSpec, setTargetSizeSpec] = useState("8.5x11");
  const [distanceYards, setDistanceYards] = useState(100);
  const [clickValueMoa, setClickValueMoa] = useState(0.25);
  const [deadbandIn, setDeadbandIn] = useState(0.1);
  const [bullX, setBullX] = useState(4.25);
  const [bullY, setBullY] = useState(5.5);

  // Image + tap-to-mark holes
  const [file, setFile] = useState(null);
  const [imgUrl, setImgUrl] = useState("");
  const imgRef = useRef(null);

  // Holes in inches (X right+, Y down+)
  const [holes, setHoles] = useState([]);

  // Output
  const [status, setStatus] = useState("");
  const [respJson, setRespJson] = useState(null);
  const [showRaw, setShowRaw] = useState(true);

  const size = useMemo(() => parseSize(targetSizeSpec), [targetSizeSpec]);

  function clearAll() {
    setHoles([]);
    setRespJson(null);
    setStatus("");
  }

  function onPickFile(f) {
    setFile(f || null);
    setHoles([]);
    setRespJson(null);
    setStatus("");
    if (imgUrl) URL.revokeObjectURL(imgUrl);
    setImgUrl(f ? URL.createObjectURL(f) : "");
  }

  function onImageTap(e) {
    if (!imgRef.current || !size) return;

    const rect = imgRef.current.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    const xPx = clientX - rect.left;
    const yPx = clientY - rect.top;

    const xPxClamped = Math.max(0, Math.min(rect.width, xPx));
    const yPxClamped = Math.max(0, Math.min(rect.height, yPx));

    const xIn = (xPxClamped / rect.width) * size.widthIn;
    const yIn = (yPxClamped / rect.height) * size.heightIn;

    setHoles((prev) => [...prev, { x: round2(xIn), y: round2(yIn) }]);
  }

  function undoLast() {
    setHoles((prev) => prev.slice(0, -1));
  }

  async function onSend() {
    setRespJson(null);

    if (!size) {
      setStatus("Bad Target Size. Use format like 8.5x11");
      return;
    }
    if (!imgUrl) {
      setStatus("Choose an image first.");
      return;
    }
    if (holes.length < 3) {
      setStatus("Tap at least 3 bullet holes on the image, then Send.");
      return;
    }

    setStatus("Sending...");

    try {
      const form = new FormData();

      form.append("targetSizeSpec", `${size.widthIn}x${size.heightIn}`);
      form.append("distanceYards", String(distanceYards));
      form.append("clickValueMoa", String(clickValueMoa));
      form.append("deadbandIn", String(deadbandIn));
      form.append("bullX", String(bullX));
      form.append("bullY", String(bullY));

      // NO paste box, NO demo holes: we send only what you tapped
      form.append("holesJson", JSON.stringify(holes));

      // image optional on backend, but we send it anyway for future
      if (file) form.append("image", file);

      const r = await fetch(endpoint, { method: "POST", body: form });
      const data = await r.json().catch(() => null);

      if (!r.ok) {
        setStatus(`Error (${r.status})`);
        setRespJson(data || { ok: false, error: { code: "BAD_RESPONSE" } });
        return;
      }

      setStatus("Done.");
      setRespJson(data);
    } catch (err) {
      setStatus("Network error.");
      setRespJson({
        ok: false,
        error: { code: "NETWORK", message: String(err?.message || err) },
      });
    }
  }

  const scopeLine =
    respJson?.scopeClicks?.windage && respJson?.scopeClicks?.elevation
      ? `Windage: ${respJson.scopeClicks.windage} | Elevation: ${respJson.scopeClicks.elevation}`
      : null;

  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: 16, fontFamily: "system-ui, Arial" }}>
      <h1 style={{ marginTop: 0 }}>POIB Anchor Test</h1>

      <label>
        Endpoint (POST)
        <input
          value={endpoint}
          onChange={(e) => setEndpoint(e.target.value)}
          style={{ width: "100%", padding: 10, marginTop: 6 }}
        />
      </label>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
        <label>
          Target Size
          <input
            value={targetSizeSpec}
            onChange={(e) => setTargetSizeSpec(e.target.value)}
            style={{ width: "100%", padding: 10, marginTop: 6 }}
          />
        </label>

        <label>
          Distance (yards)
          <input
            type="number"
            value={distanceYards}
            onChange={(e) => setDistanceYards(Number(e.target.value))}
            style={{ width: "100%", padding: 10, marginTop: 6 }}
          />
        </label>

        <label>
          Click Value (MOA)
          <input
            type="number"
            step="0.01"
            value={clickValueMoa}
            onChange={(e) => setClickValueMoa(Number(e.target.value))}
            style={{ width: "100%", padding: 10, marginTop: 6 }}
          />
        </label>

        <label>
          Deadband (inches)
          <input
            type="number"
            step="0.01"
            value={deadbandIn}
            onChange={(e) => setDeadbandIn(Number(e.target.value))}
            style={{ width: "100%", padding: 10, marginTop: 6 }}
          />
        </label>

        <label>
          Bull X (inches)
          <input
            type="number"
            step="0.01"
            value={bullX}
            onChange={(e) => setBullX(Number(e.target.value))}
            style={{ width: "100%", padding: 10, marginTop: 6 }}
          />
        </label>

        <label>
          Bull Y (inches)
          <input
            type="number"
            step="0.01"
            value={bullY}
            onChange={(e) => setBullY(Number(e.target.value))}
            style={{ width: "100%", padding: 10, marginTop: 6 }}
          />
        </label>
      </div>

      <div style={{ marginTop: 12 }}>
        <label>
          Image
          <input
            type="file"
            accept="image/*"
            onChange={(e) => onPickFile(e.target.files?.[0] || null)}
            style={{ width: "100%", marginTop: 6 }}
          />
        </label>

        {imgUrl ? (
          <div style={{ marginTop: 10 }}>
            <div style={{ fontWeight: 900, marginBottom: 6 }}>
              Tap each bullet hole (adds a point). Min 3.
            </div>

            <div
              style={{
                border: "2px solid #ddd",
                borderRadius: 10,
                overflow: "hidden",
                touchAction: "manipulation",
              }}
              onClick={onImageTap}
              onTouchStart={onImageTap}
            >
              <img ref={imgRef} src={imgUrl} alt="target" style={{ width: "100%", display: "block" }} />
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
              <button onClick={undoLast} disabled={!holes.length} style={{ padding: "10px 12px" }}>
                Undo Last
              </button>
              <button onClick={clearAll} style={{ padding: "10px 12px" }}>
                Clear
              </button>
              <div style={{ marginLeft: "auto", fontWeight: 900, paddingTop: 10 }}>
                Holes: {holes.length}
              </div>
            </div>

            <div style={{ marginTop: 10, fontFamily: "ui-monospace, SFMono-Regular", fontSize: 13 }}>
              {holes.length ? JSON.stringify(holes) : "Tap holes to add points..."}
            </div>
          </div>
        ) : (
          <div style={{ marginTop: 10, fontWeight: 800 }}>Choose an image first.</div>
        )}
      </div>

      <button
        onClick={onSend}
        style={{
          width: "100%",
          marginTop: 14,
          padding: "14px 18px",
          fontSize: 18,
          fontWeight: 900,
          borderRadius: 10,
          border: "2px solid #1e5eff",
          background: "white",
          cursor: "pointer",
        }}
      >
        Send
      </button>

      <div style={{ marginTop: 10, fontWeight: 900 }}>{status}</div>

      {scopeLine ? (
        <div
          style={{
            border: "2px solid #26a269",
            padding: 12,
            borderRadius: 10,
            background: "#f6fffb",
            fontSize: 18,
            fontWeight: 900,
            marginTop: 10,
          }}
        >
          {scopeLine}
        </div>
      ) : null}

      <label style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10 }}>
        <input type="checkbox" checked={showRaw} onChange={(e) => setShowRaw(e.target.checked)} />
        Show raw JSON
      </label>

      {showRaw && respJson ? (
        <pre
          style={{
            background: "#111",
            color: "#eee",
            padding: 12,
            borderRadius: 10,
            overflowX: "auto",
            fontSize: 13,
            lineHeight: 1.25,
            marginTop: 8,
          }}
        >
          {JSON.stringify(respJson, null, 2)}
        </pre>
      ) : null}
    </div>
  );
}
