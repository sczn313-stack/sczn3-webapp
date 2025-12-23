const DEFAULT_API_BASE = "https://sczn3-sec-backend-144.onrender.com";
const API_BASE = (
  (typeof import.meta !== "undefined" &&
    import.meta.env &&
    import.meta.env.VITE_API_BASE) ||
  DEFAULT_API_BASE
).replace(/\/+$/, "");

// API endpoint
const SEC_ENDPOINT = `${API_BASE}/api/sec`;

// 2-decimal hard rule
const fmt2 = (n) => {
  const x = Number(n);
  if (!Number.isFinite(x)) return "0.00";
  return x.toFixed(2);
};

// SIGNED parse (never abs here)
const toNum = (v) => {
  const x = Number(v);
  return Number.isFinite(x) ? x : NaN;
};

function getClicksFromBackend(data) {
  // Only pull the raw signed values from backend.
  // DO NOT use Math.abs here.
  const w = toNum(data?.windage_clicks);
  const e = toNum(data?.elevation_clicks);
  return { w, e };
}

function arrowForWindage(w) {
  if (!Number.isFinite(w) || w === 0) return "";
  return w < 0 ? "←" : "→";
}
function arrowForElevation(e) {
  if (!Number.isFinite(e) || e === 0) return "";
  return e < 0 ? "↓" : "↑";
}

function labelForWindage(w) {
  // Display magnitude only
  return fmt2(Math.abs(w));
}
function labelForElevation(e) {
  return fmt2(Math.abs(e));
}

function useImageFromFile(file) {
  const [img, setImg] = useState(null);
  useEffect(() => {
    if (!file) return setImg(null);
    const url = URL.createObjectURL(file);
    const i = new Image();
    i.onload = () => setImg(i);
    i.onerror = () => setImg(null);
    i.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);
  return img;
}

function nextIndex() {
  // Simple 3-digit index that increments per device/session
  const key = "SCZN3_SEC_INDEX";
  const cur = Number(localStorage.getItem(key) || "0");
  const nxt = (Number.isFinite(cur) ? cur : 0) + 1;
  localStorage.setItem(key, String(nxt));
  return String(nxt).padStart(3, "0");
}

export default function App() {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);

  const [rawBackend, setRawBackend] = useState(null);
  const [error, setError] = useState("");

  const [result, setResult] = useState(null); // { w, e, index }
  const [index, setIndex] = useState("001");

  const img = useImageFromFile(file);

  const canvasRef = useRef(null);

  // Derive UI-safe values (LOCKED)
  const derived = useMemo(() => {
    const w = result?.w;
    const e = result?.e;

    return {
      windArrow: arrowForWindage(w),
      elevArrow: arrowForElevation(e),
      windText: labelForWindage(w),
      elevText: labelForElevation(e),
    };
  }, [result]);

  // Draw SEC card to canvas for download
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;

    const ctx = c.getContext("2d");
    if (!ctx) return;

    // 4x6-ish canvas (high-res for crisp PNG)
    const W = 1200;
    const H = 1800;
    c.width = W;
    c.height = H;

    // White background
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, W, H);

    // Border
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 18;
    ctx.strokeRect(40, 40, W - 80, H - 80);
    ctx.lineWidth = 6;
    ctx.strokeRect(80, 80, W - 160, H - 160);

    // Title
    ctx.fillStyle = "#000000";
    ctx.font = "bold 86px Arial";
    ctx.textAlign = "center";
    ctx.fillText("SCZN3 Shooter Experience Card (SEC)", W / 2, 210);

    // Sections
    ctx.font = "bold 84px Arial";
    ctx.fillText("Windage", W / 2, 620);

    // Windage arrow + number
    ctx.font = "bold 200px Arial";
    ctx.textAlign = "center";
    ctx.fillText(`${derived.windArrow} ${derived.windText}`.trim(), W / 2, 860);

    // Elevation label
    ctx.font = "bold 84px Arial";
    ctx.fillText("Elevation", W / 2, 1180);

    // Elevation arrow + number
    ctx.font = "bold 200px Arial";
    ctx.fillText(`${derived.elevArrow} ${derived.elevText}`.trim(), W / 2, 1420);

    // Index
    ctx.font = "italic 64px Arial";
    ctx.fillText(`Index: ${index}`, W / 2, 1670);
  }, [derived, index]);

  const onPickFile = (e) => {
    setError("");
    setRawBackend(null);
    setResult(null);

    const f = e.target.files?.[0] || null;
    setFile(f);
  };

  async function onAnalyze() {
    setError("");
    setRawBackend(null);
    setResult(null);

    if (!file) {
      setError("Choose a target photo first.");
      return;
    }

    setLoading(true);
    try {
      const form = new FormData();
      form.append("file", file);

      const res = await fetch(SEC_ENDPOINT, {
        method: "POST",
        body: form,
      });

      const text = await res.text().catch(() => "");
      let data = null;
      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        data = { raw: text };
      }

      setRawBackend(data);

      if (!res.ok) {
        setError(
          `Backend error (${res.status}). ${
            data?.error || data?.message || "See Debug."
          }`
        );
        return;
      }

      const { w, e } = getClicksFromBackend(data);

      // FAIL CLOSED if missing clicks
      if (!Number.isFinite(w) || !Number.isFinite(e)) {
        setError("Backend response missing windage/elevation click values.");
        return;
      }

      const idx = nextIndex();
      setIndex(idx);
      setResult({ w: Number(w), e: Number(e), index: idx });
    } catch (err) {
      setError(`Load failed: ${err?.message || String(err)}`);
    } finally {
      setLoading(false);
    }
  }

  function onDownloadPng() {
    const c = canvasRef.current;
    if (!c) return;
    const url = c.toDataURL("image/png");

    const a = document.createElement("a");
    a.href = url;
    a.download = `SCZN3_SEC_${index}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  return (
    <div style={{ fontFamily: "Arial, sans-serif", padding: 20, maxWidth: 1100, margin: "0 auto" }}>
      <h1 style={{ fontSize: 54, margin: "10px 0 20px" }}>SCZN3 Shooter Experience Card (SEC)</h1>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", marginBottom: 14 }}>
        <label style={{ display: "inline-block" }}>
          <input
            type="file"
            accept="image/*"
            onChange={onPickFile}
            style={{ display: "none" }}
          />
          <span
            style={{
              display: "inline-block",
              padding: "12px 18px",
              border: "1px solid #ccc",
              borderRadius: 10,
              cursor: "pointer",
              fontWeight: 700,
            }}
          >
            Choose Target Photo
          </span>
        </label>

        <button
          onClick={onAnalyze}
          disabled={!file || loading}
          style={{
            padding: "12px 18px",
            borderRadius: 10,
            border: "1px solid #ccc",
            cursor: !file || loading ? "not-allowed" : "pointer",
            fontWeight: 700,
          }}
        >
          {loading ? "Analyzing..." : "Analyze / SEC"}
        </button>

        <button
          onClick={onDownloadPng}
          disabled={!result}
          style={{
            padding: "12px 18px",
            borderRadius: 10,
            border: "1px solid #ccc",
            cursor: !result ? "not-allowed" : "pointer",
            fontWeight: 700,
            opacity: !result ? 0.5 : 1,
          }}
        >
          Download SEC (PNG)
        </button>
      </div>

      {error ? (
        <div style={{ background: "#ffe5e5", border: "1px solid #ffb3b3", padding: 12, borderRadius: 10, marginBottom: 16 }}>
          <b>Error:</b> {error}
        </div>
      ) : null}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, alignItems: "start" }}>
        <div>
          <h3 style={{ margin: "10px 0" }}>Target Preview</h3>
          <div style={{ border: "1px solid #ddd", borderRadius: 12, padding: 12, minHeight: 300 }}>
            {img ? (
              <img
                src={img.src}
                alt="Target preview"
                style={{ width: "100%", borderRadius: 10 }}
              />
            ) : (
              <div style={{ color: "#777" }}>Choose a target photo to preview it.</div>
            )}
          </div>
        </div>

        <div>
          <h3 style={{ margin: "10px 0" }}>SEC Preview</h3>
          <div style={{ border: "1px solid #ddd", borderRadius: 12, padding: 12 }}>
            <canvas ref={canvasRef} style={{ width: "100%", borderRadius: 10 }} />
          </div>
        </div>
      </div>

      <details style={{ marginTop: 18 }}>
        <summary style={{ cursor: "pointer", fontWeight: 700 }}>Debug</summary>
        <div style={{ marginTop: 10, fontFamily: "monospace", fontSize: 12, whiteSpace: "pre-wrap" }}>
          <div><b>API_BASE:</b> {API_BASE || "(same-origin)"} </div>
          <div><b>SEC_ENDPOINT:</b> {SEC_ENDPOINT}</div>
          <div><b>Index:</b> {index}</div>
          <div><b>Result (signed):</b> {result ? JSON.stringify(result, null, 2) : "(none)"}</div>
          <div><b>Raw backend:</b> {rawBackend ? JSON.stringify(rawBackend, null, 2) : "(none)"}</div>
        </div>
      </details>
    </div>
  );
}
