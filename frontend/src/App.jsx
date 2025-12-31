import React, { useMemo, useState } from "react";

const round2 = (n) => Math.round(n * 100) / 100;

function safeParseHoles(text) {
  const t = (text || "").trim();
  if (!t) return null;
  try {
    const v = JSON.parse(t);
    if (!Array.isArray(v)) return null;

    const holes = [];
    for (const item of v) {
      if (
        item &&
        typeof item === "object" &&
        typeof item.x === "number" &&
        typeof item.y === "number" &&
        Number.isFinite(item.x) &&
        Number.isFinite(item.y)
      ) {
        holes.push({ x: item.x, y: item.y });
      }
    }
    return holes.length ? holes : null;
  } catch {
    return null;
  }
}

export default function App() {
  // URLs
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

  // Image
  const [file, setFile] = useState(null);

  // Optional advanced holes mode (hidden by default)
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [holesText, setHolesText] = useState("");

  // Output
  const [status, setStatus] = useState("");
  const [respJson, setRespJson] = useState(null);
  const [showRaw, setShowRaw] = useState(true);

  const parsedHoles = useMemo(() => safeParseHoles(holesText), [holesText]);

  // Parse targetSizeSpec into width/height (inches)
  function parseSize(spec) {
    // accepts "8.5x11" or "11x8.5"
    const m = String(spec || "")
      .toLowerCase()
      .replace(/\s/g, "")
      .match(/^(\d+(\.\d+)?)x(\d+(\.\d+)?)$/);
    if (!m) return null;
    const a = parseFloat(m[1]);
    const b = parseFloat(m[3]);
    if (!Number.isFinite(a) || !Number.isFinite(b) || a <= 0 || b <= 0) return null;
    return { widthIn: a, heightIn: b };
  }

  async function onSend() {
    setRespJson(null);

    const size = parseSize(targetSizeSpec);
    if (!size) {
      setStatus("Bad Target Size. Use format like 8.5x11");
      return;
    }

    // ✅ NEW RULE:
    // - If image exists: send image (no holes required)
    // - Else if Advanced is ON and holes JSON exists: send holes
    // - Else: show a plain message (no popup)
    const canSendWithImage = !!file;
    const canSendWithHoles = showAdvanced && Array.isArray(parsedHoles) && parsedHoles.length > 0;

    if (!canSendWithImage && !canSendWithHoles) {
      setStatus("Choose an image (recommended). Or enable Advanced and paste holes JSON.");
      return;
    }

    setStatus("Sending...");

    try {
      const form = new FormData();

      // Always include these
      form.append("targetSizeSpec", `${size.widthIn}x${size.heightIn}`);
      form.append("targetSizeInches", `${size.widthIn}x${size.heightIn}`); // backward-friendly
      form.append("distanceYards", String(distanceYards));
      form.append("clickValueMoa", String(clickValueMoa));
      form.append("deadbandIn", String(deadbandIn));
      form.append("bullX", String(bullX));
      form.append("bullY", String(bullY));

      if (canSendWithImage) {
        form.append("image", file);
      } else if (canSendWithHoles) {
        form.append("holesJson", JSON.stringify(parsedHoles));
      }

      const r = await fetch(endpoint, { method: "POST", body: form });
      const data = await r.json().catch(() => null);

      if (!r.ok) {
        setStatus(`Error (${r.status})`);
        setRespJson(
          data || { ok: false, error: { code: "BAD_RESPONSE", message: "Non-JSON response" } }
        );
        return;
      }

      setStatus("Done.");
      setRespJson(data);
    } catch (e) {
      setStatus("Network error.");
      setRespJson({ ok: false, error: { code: "NETWORK", message: String(e?.message || e) } });
    }
  }

  const scopeLine =
    respJson?.scopeClicks?.windage && respJson?.scopeClicks?.elevation
      ? `Windage: ${respJson.scopeClicks.windage} | Elevation: ${respJson.scopeClicks.elevation}`
      : null;

  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: 16, fontFamily: "system-ui, Arial" }}>
      <h1 style={{ marginTop: 0 }}>POIB Anchor Test</h1>

      <div style={{ display: "grid", gap: 12 }}>
        <label>
          Endpoint (POST)
          <input
            value={endpoint}
            onChange={(e) => setEndpoint(e.target.value)}
            style={{ width: "100%", padding: 10, marginTop: 6 }}
          />
        </label>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
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

        <label>
          Image (recommended)
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            style={{ width: "100%", marginTop: 6 }}
          />
          <div style={{ fontSize: 13, opacity: 0.8, marginTop: 6 }}>
            {file ? `Selected: ${file.name}` : "No image selected."}
          </div>
        </label>

        <button
          onClick={onSend}
          style={{
            padding: "14px 18px",
            fontSize: 18,
            fontWeight: 700,
            borderRadius: 10,
            border: "2px solid #1e5eff",
            background: "white",
            cursor: "pointer",
          }}
        >
          Send
        </button>

        <div style={{ fontWeight: 700 }}>{status}</div>

        {scopeLine ? (
          <div
            style={{
              border: "2px solid #26a269",
              padding: 12,
              borderRadius: 10,
              background: "#f6fffb",
              fontSize: 18,
              fontWeight: 800,
            }}
          >
            {scopeLine}
          </div>
        ) : null}

        <label style={{ display: "flex", alignItems: "center", gap: 10 }}>
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
            }}
          >
            {JSON.stringify(respJson, null, 2)}
          </pre>
        ) : null}

        {/* Advanced mode (optional) */}
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid #ddd" }}>
          <label style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <input
              type="checkbox"
              checked={showAdvanced}
              onChange={(e) => setShowAdvanced(e.target.checked)}
            />
            Advanced: send holes JSON instead of image
          </label>

          {showAdvanced ? (
            <div style={{ marginTop: 10 }}>
              <div style={{ fontSize: 13, opacity: 0.85, marginBottom: 6 }}>
                Paste holes JSON in inches like: [{"{"}"x":4.00,"y":5.00{"}"}]
              </div>
              <textarea
                value={holesText}
                onChange={(e) => setHolesText(e.target.value)}
                placeholder='[{"x":4.00,"y":5.00}]'
                rows={6}
                style={{ width: "100%", padding: 10, fontFamily: "ui-monospace, SFMono-Regular" }}
              />
              <div style={{ fontSize: 13, opacity: 0.85, marginTop: 6 }}>
                Parsed holes: {parsedHoles ? parsedHoles.length : 0}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
