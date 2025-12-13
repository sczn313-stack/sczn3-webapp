import React from "react";
import ReactDOM from "react-dom/client";

const API_BASE = "https://sczn3-sec-backend-api.onrender.com";

function App() {
  const [file, setFile] = React.useState(null);
  const [result, setResult] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  async function upload() {
    if (!file) {
      setResult("Pick a file first.");
      return;
    }

    setBusy(true);
    setResult("Uploading...");

    try {
      const form = new FormData();
      // IMPORTANT: backend expects field name "image"
      form.append("image", file);

      const res = await fetch(`${API_BASE}/api/upload`, {
        method: "POST",
        body: form,
      });

      const text = await res.text();
      setResult(text);
    } catch (e) {
      setResult(String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ padding: 16, fontFamily: "system-ui" }}>
      <h2>SCZN3 Upload Test</h2>

      <input
        type="file"
        accept="image/*"
        onChange={(e) => setFile(e.target.files?.[0] || null)}
      />

      <div style={{ marginTop: 12 }}>
        <button onClick={upload} disabled={busy}>
          {busy ? "Uploading..." : "Upload"}
        </button>
      </div>

      <pre style={{ marginTop: 12, whiteSpace: "pre-wrap" }}>{result}</pre>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
