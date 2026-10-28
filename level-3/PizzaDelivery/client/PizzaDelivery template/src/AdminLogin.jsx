import { useState } from "react";

export default function AdminLogin({ onLogin, onBack }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch(
        "http://localhost:5000/api/admin/login",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ username, password }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Login failed.");
      }

      onLogin(data.token);
    } catch (err) {
      setError(err.message || "Server connection failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={styles.page}>
      <form onSubmit={handleSubmit} style={styles.card}>
        <h1>🔐 Admin Login</h1>
        <p>Pizza Paradise Management</p>

        <label style={styles.label}>
          Username
          <input
            style={styles.input}
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            required
            autoComplete="username"
          />
        </label>

        <label style={styles.label}>
          Password
          <input
            style={styles.input}
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            autoComplete="current-password"
          />
        </label>

        {error && <p style={styles.error}>{error}</p>}

        <button style={styles.button} disabled={loading}>
          {loading ? "Logging in..." : "Login"}
        </button>

        <button
          type="button"
          onClick={onBack}
          style={styles.backButton}
        >
          Back to Menu
        </button>
      </form>
    </main>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    display: "grid",
    placeItems: "center",
    background: "#fff8f1",
    padding: "20px",
    fontFamily: "Arial, sans-serif",
  },
  card: {
    width: "100%",
    maxWidth: "380px",
    display: "grid",
    gap: "16px",
    padding: "32px",
    background: "#ffffff",
    borderRadius: "16px",
    boxShadow: "0 8px 30px #00000012",
  },
  label: {
    display: "grid",
    gap: "8px",
    fontWeight: "600",
  },
  input: {
    width: "100%",
    boxSizing: "border-box",
    padding: "12px",
    border: "1px solid #ddd",
    borderRadius: "8px",
  },
  button: {
    padding: "13px",
    border: "none",
    borderRadius: "8px",
    background: "#e34d25",
    color: "white",
    fontWeight: "bold",
    cursor: "pointer",
  },
  backButton: {
    padding: "10px",
    border: "none",
    background: "transparent",
    cursor: "pointer",
  },
  error: {
    color: "#c62828",
  },
};
