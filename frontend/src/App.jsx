import React, { useMemo, useState } from "react";

function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

function parseSize(sizeStr) {
  // expects "8.5x11"
  const s = String(sizeStr || "").toLowerCase().trim();
  const m = s.match(/^(\d+(?:\.\d+)?)\s*x\s*(\d+(?:\.\d+)?)$/);
  if (!m) return { widthIn: 8.5, heightIn: 11 };
  return { widthIn: Number(m[1]), heightIn: Number(m[2]) };
}

function safeParseHoles(text) {
  const t = (text || "").trim();
  if (!t) return null;

  try {
    const v = JSON.parse(t);

    // allow either: [ {x,y}, ... ] OR { holes:[...], ... }
    if (Array.isArray(v)) {
      return { holes: v };
    }
    if (v && typeof v === "object") {
      if (Array.isArray(v.holes)) return v;
      // if user pasted a single point as {x,y} treat as poib
      if (typeof v.x === "number" && typeof v.y === "number") return { poib: v };
    }
    return null;
  } catch {
    return null;
  }
}

export default function App() {
  const [endpoint, setEndpoint] = useState(
    "https://sczn3-sec-backend-pipe-17.onrender.com/api/sec"
  );

  const [targetSize, setTargetSize] = useState("8.5x11");
  const [distanceYards, setDistanceYards] = useState(100);
  const [clickValueMoa, setClickValueMoa] = useState(0.25);
  const [deadbandInches, setDeadbandInches] = useState(0.1);
  const [bullX, setBullX] = useState(4.25);
  const [bullY, setBullY] = useState(5.5);

  const [holesJsonText, setHolesJsonText] = useState("");
  const [imageFile, setImageFile] = useState(null);

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const buildStamp = "FRONTEND_NO_DEMO_NO_POPUP_V1";

  const parsed = useMemo(() => safeParseHoles(holesJsonText), [holesJsonText]);

  const canSend = useMemo(() => {
    // require at least holes JSON or an image file
    const hasJson = !!parsed;
    const hasImg = !!imageFile;
    return hasJson || hasImg;
  }, [parsed, imageFile]);

  async function onSend() {
    setError("");
    setResult(null);

    if (!canSend) {
      setError("Add holes JSON (or choose an image) before sending.");
      return;
    }

    const basePayload = {
      targetSize,
      distanceYards: Number(distanceYards),
      clickValueMoa: Number(clickValueMoa),
      deadbandInches: Number(deadbandInches),
      bullX: Number(bullX),
      bullY: Number(bullY),
      buildClient: buildStamp,
    };

    let payload = { ...basePayload };

    if (parsed) {
      // merge parsed object (either {holes:[...]} or {poib:{x,y}})
      payload = { ...payload, ...parsed };
    }

    try {
      setLoading(true);

      let res;
      if (imageFile) {
        // multipart (backend supports it)
        const fd = new FormData();
        fd.append("payload", JSON.stringify(payload));
        fd.append("image", imageFile);

        res = await fetch(endpoint, {
          method: "POST",
          body: fd,
        });
      } else {
        // JSON only
        res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      const data = await res.json().catch(() => null);

      if (!res.ok || !data || data.ok === false) {
        const msg =
          (data && (data.message || data.error)) ||
          `Request failed (${res.status})`;
        setError(msg);
        setResult(data);
        return;
      }

      setResult(data);
    } catch (e) {
      setError(e && e.message ? e.message : "Network error");
    } finally {
      setLoading(false);
    }
  }

  const windageLabel =
    result && result.scopeClicks ? result.scopeClicks.windage : "";
  const elevationLabel =
    result && result.scopeClicks ? result.scopeClicks.elevation : "";

  return (
    <div style={{ maxWidth: 980, margin: "0 auto", padding: 16, fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial" }}>
      <div style={{ fontWeight: 800, fontSize: 22, marginBottom: 10 }}>
        POIB Anchor Test
      </div>

      <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 10 }}>
        Build: {buildStamp}
      </div>

      <div style={{ border: "2px solid #111", padding: 12, borderRadius: 10 }}>
        <div style={{ fontWeight: 800, marginBottom: 6 }}>Backend Endpoint</div>
        <input
          value={endpoint}
          onChange={(e) => setEndpoint(e.target.value)}
          style={{
            width: "100%",
            padding: 10,
            borderRadius: 8,
            border: "1px solid #999",
            fontSize: 14,
          }}
        />

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
          <div>
            <div style={{ fontWeight: 800, marginBottom: 6 }}>Target Size</div>
            <select
              value={targetSize}
              onChange={(e) => setTargetSize(e.target.value)}
              style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #999", fontSize: 14 }}
            >
              <option value="8.5x11">8.5x11</option>
              <option value="23x23">23x23</option>
              <option value="12x18">12x18</option>
            </select>
          </div>

          <div>
            <div style={{ fontWeight: 800, marginBottom: 6 }}>Distance (yards)</div>
            <input
              type="number"
              value={distanceYards}
              onChange={(e) => setDistanceYards(e.target.value)}
              style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #999", fontSize: 14 }}
            />
          </div>

          <div>
            <div style={{ fontWeight: 800, marginBottom: 6 }}>Click Value (MOA)</div>
            <input
              type="number"
              step="0.01"
              value={clickValueMoa}
              onChange={(e) => setClickValueMoa(e.target.value)}
              style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #999", fontSize: 14 }}
            />
          </div>

          <div>
            <div style={{ fontWeight: 800, marginBottom: 6 }}>Deadband (inches)</div>
            <input
              type="number"
              step="0.01"
              value={deadbandInches}
              onChange={(e) => setDeadbandInches(e.target.value)}
              style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #999", fontSize: 14 }}
            />
          </div>

          <div>
            <div style={{ fontWeight: 800, marginBottom: 6 }}>Bull X (inches)</div>
            <input
              type="number"
              step="0.01"
              value={bullX}
              onChange={(e) => setBullX(e.target.value)}
              style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #999", fontSize: 14 }}
            />
          </div>

          <div>
            <div style={{ fontWeight: 800, marginBottom: 6 }}>Bull Y (inches)</div>
            <input
              type="number"
              step="0.01"
              value={bullY}
              onChange={(e) => setBullY(e.target.value)}
              style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #999", fontSize: 14 }}
            />
          </div>
        </div>

        <div style={{ marginTop: 12 }}>
          <div style={{ fontWeight: 800, marginBottom: 6 }}>Image (optional for now)</div>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setImageFile(e.target.files && e.target.files[0] ? e.target.files[0] : null)}
          />
        </div>

        <div style={{ marginTop: 12 }}>
          <div style={{ fontWeight: 800, marginBottom: 6 }}>Holes JSON (in inches)</div>
          <textarea
            value={holesJsonText}
            onChange={(e) => setHolesJsonText(e.target.value)}
            placeholder='Example: [{"x":3.9,"y":4.8},{"x":3.95,"y":4.75}]'
            style={{
              width: "100%",
              minHeight: 140,
              padding: 10,
              borderRadius: 8,
              border: "1px solid #999",
              fontSize: 14,
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
            }}
          />
          <div style={{ marginTop: 6, fontSize: 12, opacity: 0.75 }}>
            Tip: Paste holes as an array of {"{x,y}"} points (inches). No demo button. No popups.
          </div>
        </div>

        {error ? (
          <div style={{ marginTop: 12, padding: 10, borderRadius: 8, border: "1px solid #900", color: "#900" }}>
            {error}
          </div>
        ) : null}

        <div style={{ display: "flex", gap: 12, marginTop: 12 }}>
          <button
            onClick={onSend}
            disabled={loading}
            style={{
              width: "100%",
              padding: 14,
              borderRadius: 10,
              border: "2px solid #0b5",
              fontSize: 18,
              fontWeight: 800,
              cursor: loading ? "not-allowed" : "pointer",
              background: loading ? "#eee" : "#fff",
            }}
          >
            {loading ? "Sending..." : "Send"}
          </button>
        </div>

        {result ? (
          <div style={{ marginTop: 14, padding: 12, borderRadius: 10, border: "2px solid #0b5" }}>
            <div style={{ fontWeight: 900, fontSize: 18 }}>
              Windage: {windageLabel} | Elevation: {elevationLabel}
            </div>

            <details style={{ marginTop: 10 }}>
              <summary style={{ fontWeight: 900, cursor: "pointer" }}>Show raw JSON</summary>
              <pre
                style={{
                  marginTop: 10,
                  background: "#111",
                  color: "#eee",
                  padding: 12,
                  borderRadius: 10,
                  overflowX: "auto",
                  fontSize: 12,
                }}
              >
                {JSON.stringify(result, null, 2)}
              </pre>
            </details>
          </div>
        ) : null}
      </div>
    </div>
  );
}
