import React, { useState } from "react";

export default function App() {
  const [response, setResponse] = useState("");

  async function sendTestSEC() {
    try {
      const res = await fetch(
        "https://sczn3-webapp.onrender.com/api/sec",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            shooter: "Ron",
            message: "SEC test package",
          }),
        }
      );

      const data = await res.json();
      setResponse(JSON.stringify(data, null, 2));
    } catch (err) {
      setResponse("Error: " + err.message);
    }
  }

  return (
    <div style={{ padding: "40px" }}>
      <h1>SCZN3 Frontend</h1>

      <button
        onClick={sendTestSEC}
        style={{
          padding: "12px 24px",
          fontSize: "16px",
          cursor: "pointer",
          background: "#0066ff",
          color: "white",
          border: "none",
          borderRadius: "6px",
        }}
      >
        Send SEC Test to Backend
      </button>

      <pre style={{ marginTop: "30px", background: "#eee", padding: "20px" }}>
        {response}
      </pre>
    </div>
  );
}
