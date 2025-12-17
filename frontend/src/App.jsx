mport { useMemo, useState } from "react";

export default function App() {
const API_BASE = useMemo(() => {
const fromEnv = import.meta?.env?.VITE_SEC_API_BASE;
return (fromEnv && String(fromEnv).trim()) || "https://sczn3-sec-backend-33.onrender.com";
}, []);

const [impactX, setImpactX] = useState(-2.0);
const [impactY, setImpactY] = useState(1.5);
const [distanceYards, setDistanceYards] = useState(100);
const [clickValueMOA, setClickValueMOA] = useState(0.25);

const [loading, setLoading] = useState(false);
const [error, setError] = useState("");
const [result, setResult] = useState(null);

async function computeSEC() {
setError("");
setResult(null);

const payload = {
impact_x_in: Number(impactX),
impact_y_in: Number(impactY),
distance_yards: Number(distanceYards),
click_value_moa: Number(clickValueMOA),
};

const values = Object.values(payload);
if (values.some((v) => typeof v !== "number" || Number.isNaN(v) || !Number.isFinite(v))) {
setError("All inputs must be valid numbers.");
return;
}
if (payload.distance_yards <= 0) {
setError("Distance (yards) must be > 0.");
return;
}
if (payload.click_value_moa <= 0) {
setError("Click value (MOA) must be > 0.");
return;
}

setLoading(true);
try {
const res = await fetch(`${API_BASE}/api/sec/compute`, {
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify(payload),
});

const data = await res.json().catch(() => ({}));

if (!res.ok) {
setError(data?.error || `Request failed (${res.status})`);
return;
}

setResult(data);
} catch (e) {
setError("Network error. Check the backend URL and try again.");
} finally {
setLoading(false);
}
}

async function copyResult() {
if (!result) return;
const text =
`Windage: ${result.windage?.direction || ""} ${result.windage?.clicks || ""}\n` +
`Elevation: ${result.elevation?.direction || ""} ${result.elevation?.clicks || ""}\n` +
`API: ${API_BASE}`;
try {
await navigator.clipboard.writeText(text);
} catch {
// ignore clipboard errors
}
}

const cardStyle = {
border: "1px solid rgba(255,255,255,0.15)",
borderRadius: 12,
padding: 16,
background: "rgba(255,255,255,0.04)",
};

const labelStyle = { fontSize: 12, opacity: 0.8, marginBottom: 6 };
const inputStyle = {
width: "100%",
padding: "10px 12px",
borderRadius: 10,
border: "1px solid rgba(255,255,255,0.15)",
background: "rgba(0,0,0,0.2)",
color: "white",
outline: "none",
};

const bigNum = { fontSize: 28, fontWeight: 800, letterSpacing: 0.2 };
const small = { fontSize: 12, opacity: 0.8 };

return (
<div
style={{
minHeight: "100vh",
background: "#0b0f14",
color: "white",
padding: 18,
fontFamily:
'system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji"',
}}
>
<div style={{ maxWidth: 880, margin: "0 auto" }}>
<div style={{ marginBottom: 14 }}>
<div style={{ fontSize: 20, fontWeight: 800 }}>The Smart Target — SEC</div>
<div style={small}>
Backend: <span style={{ opacity: 1 }}>{API_BASE}</span>
</div>
</div>

<div style={{ display: "grid", gap: 12, gridTemplateColumns: "1fr" }}>
<div style={cardStyle}>
<div style={{ fontWeight: 700, marginBottom: 10 }}>Inputs</div>

<div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
<div>
<div style={labelStyle}>Impact X (inches) — +Right / -Left</div>
<input
style={inputStyle}
type="number"
step="0.01"
value={impactX}
onChange={(e) => setImpactX(e.target.value)}
/>
</div>

<div>
<div style={labelStyle}>Impact Y (inches) — +High / -Low</div>
<input
style={inputStyle}
type="number"
step="0.01"
value={impactY}
onChange={(e) => setImpactY(e.target.value)}
/>
</div>

<div>
<div style={labelStyle}>Distance (yards)</div>
<input
style={inputStyle}
type="number"
step="1"
value={distanceYards}
onChange={(e) => setDistanceYards(e.target.value)}
/>
</div>

<div>
<div style={labelStyle}>Click Value (MOA) — e.g. 0.25</div>
<input
style={inputStyle}
type="number"
step="0.01"
value={clickValueMOA}
onChange={(e) => setClickValueMOA(e.target.value)}
/>
</div>
</div>

<div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
<button
onClick={computeSEC}
disabled={loading}
style={{
padding: "10px 14px",
borderRadius: 10,
border: "1px solid rgba(255,255,255,0.2)",
background: loading ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.12)",
color: "white",
cursor: loading ? "not-allowed" : "pointer",
fontWeight: 700,
}}
>
{loading ? "Computing..." : "Compute SEC"}
</button>

<button
onClick={() => {
setImpactX(-2.0);
setImpactY(1.5);
setDistanceYards(100);
setClickValueMOA(0.25);
setError("");
setResult(null);
}}
style={{
padding: "10px 14px",
borderRadius: 10,
border: "1px solid rgba(255,255,255,0.12)",
background: "transparent",
color: "white",
cursor: "pointer",
fontWeight: 700,
opacity: 0.9,
}}
>
Reset Sample
</button>

<button
onClick={copyResult}
disabled={!result}
style={{
padding: "10px 14px",
borderRadius: 10,
border: "1px solid rgba(255,255,255,0.12)",
background: "transparent",
color: "white",
cursor: result ? "pointer" : "not-allowed",
fontWeight: 700,
opacity: result ? 0.9 : 0.35,
}}
>
Copy Result
</button>
</div>

{error ? (
<div style={{ marginTop: 12, color: "#ffb4b4", fontWeight: 700 }}>
{error}
</div>
) : null}
</div>

<div style={cardStyle}>
<div style={{ fontWeight: 700, marginBottom: 10 }}>SEC Output (clicks only)</div>

{!result ? (
<div style={{ opacity: 0.7 }}>Run “Compute SEC” to see Windage & Elevation.</div>
) : (
<div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
<div style={cardStyle}>
<div style={{ opacity: 0.8, fontSize: 12, marginBottom: 6 }}>Windage</div>
<div style={bigNum}>
{result.windage?.direction} {result.windage?.clicks}
</div>
</div>

<div style={cardStyle}>
<div style={{ opacity: 0.8, fontSize: 12, marginBottom: 6 }}>Elevation</div>
<div style={bigNum}>
{result.elevation?.direction} {result.elevation?.clicks}
</div>
</div>
</div>
)}

<div style={{ marginTop: 12, opacity: 0.65, fontSize: 12 }}>
Output is clicks only, always two decimals.
</div>
</div>
</div>
</div>
</div>
);
}
