import { useState } from "react"

const API = "https://wordle-clone-backend-se82.onrender.com"

// Auth handles both login and registration in one component
// onLogin is called with the JWT token after a successful login
export default function Auth({ onLogin }: { onLogin: (token: string) => void }) {
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [isRegistering, setIsRegistering] = useState(false) // toggle between login and register
  const [message, setMessage] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleSubmit() {
    if (!username || !password) {
      setMessage("Please enter a username and password")
      return
    }

    setLoading(true)
    setMessage("")

    try {
      if (isRegistering) {
        // register first, then log in automatically
        const res = await fetch(`${API}/register`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, password }),
        })
        if (!res.ok) {
          const err = await res.json()
          setMessage(err.detail)
          return
        }
      }

      // log in — note: login uses form data, not JSON, because of OAuth2 standard
      const formData = new URLSearchParams()
      formData.append("username", username)
      formData.append("password", password)

      const loginRes = await fetch(`${API}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: formData.toString(),
      })

      if (!loginRes.ok) {
        setMessage("Invalid username or password")
        return
      }

      const data = await loginRes.json()
      onLogin(data.access_token) // pass token up to App
    } catch {
      setMessage("Could not connect to the server.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      backgroundColor: "#121213",
      border: "1px solid #3a3a3c",
      borderRadius: 8,
      padding: 32,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: 12,
      minWidth: 320,
    }}>
      <h2 style={{ color: "white", margin: "0 0 8px 0" }}>
        {isRegistering ? "Create an account" : "Log in to play"}
      </h2>

      <input
        type="text"
        placeholder="Username"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        style={inputStyle}
      />
      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
        style={inputStyle}
      />

      <button onClick={handleSubmit} disabled={loading} style={buttonStyle}>
        {loading ? "..." : isRegistering ? "Register" : "Log In"}
      </button>

      {message && <p style={{ color: "#ff4444", fontSize: 14, margin: 0 }}>{message}</p>}

      <p style={{ color: "#818384", fontSize: 14, margin: 0 }}>
        {isRegistering ? "Already have an account?" : "Don't have an account?"}{" "}
        <span
          onClick={() => { setIsRegistering(!isRegistering); setMessage("") }}
          style={{ color: "white", cursor: "pointer", textDecoration: "underline" }}
        >
          {isRegistering ? "Log in" : "Register"}
        </span>
      </p>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: 260,
  padding: "10px 14px",
  backgroundColor: "#1a1a1b",
  border: "2px solid #3a3a3c",
  borderRadius: 4,
  color: "white",
  fontSize: 16,
  outline: "none",
}

const buttonStyle: React.CSSProperties = {
  width: 288,
  padding: "12px 0",
  backgroundColor: "#538d4e",
  color: "white",
  border: "none",
  borderRadius: 4,
  fontSize: 16,
  fontWeight: "bold",
  cursor: "pointer",
  marginTop: 4,
}