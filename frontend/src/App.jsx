const API_BASE = "https://sczn3-sec-backend.onrender.com";
import React, { useState } from "react";

export default function App() {
  const [response, setResponse] = useState("");


    try {
  async function uploadImage(file) {
  const formData = new FormData();
  formData.append("image", file);

  const res = await fetch(`${API_BASE}/api/upload`, {
    method: "POST",
    body: formData,
  });

  const data = await res.json();
  setResponse(JSON.stringify(data, null, 2));
}
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

      <button type="button" onClick={() => uploadImage(selectedFile)}>
  Upload
</button>
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
