import { useEffect, useState } from "react";

export default function App() {
  const [status, setStatus] = useState("checking...");

  useEffect(() => {
    fetch("http://127.0.0.1:8000/health")
      .then((r) => r.json())
      .then((d) => setStatus(d.status))
      .catch(() => setStatus("backend not reachable"));
  }, []);

  return (
    <div style={{ padding: 16, fontFamily: "system-ui" }}>
      <h1>Messenger App</h1>
      <p>
        Backend status: <b>{status}</b>
      </p>
    </div>
  );
}
