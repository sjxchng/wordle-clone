import { useCallback, useEffect, useState } from "react"
import Board from "./Board"
import Keyboard from "./Keyboard"
import Auth from "./Auth"

// FastAPI backend URL used by every fetch call in this component
const API = "https://wordle-clone-backend-se82.onrender.com"
const WORD_LENGTH = 5
const MAX_ATTEMPTS = 6

export default function App() {
  // token: JWT token stored in localStorage so it persists across page refreshes
  const [token, setToken] = useState<string | null>(() => localStorage.getItem("token"))

  const [guesses, setGuesses] = useState<{ letters: string[]; feedbacks: string[] }[]>([])
  const [currentGuess, setCurrentGuess] = useState("")
  const [keyStatuses, setKeyStatuses] = useState<Record<string, string>>({})
  const [gameOver, setGameOver] = useState(false)
  const [won, setWon] = useState(false)
  const [answer, setAnswer] = useState("")
  const [message, setMessage] = useState("") // error messages like "Not a valid word"
  const [loading, setLoading] = useState(false) // true while a guess request is in flight

  // fetch the answer when the app loads so we can reveal it on a loss
  useEffect(() => {
    fetch(`${API}/answer`)
      .then((r) => r.json())
      .then((data) => setAnswer(data.answer))
      .catch(() => setMessage("Could not connect to the game server."))
  }, [])

  // called by Auth component after successful login — saves token to state and localStorage
  function handleLogin(newToken: string) {
    localStorage.setItem("token", newToken)
    setToken(newToken)
    setCurrentGuess("") // clear any keystrokes typed during login
  }

  // log out by clearing the token from state and localStorage
  function handleLogout() {
    localStorage.removeItem("token")
    setToken(null)
  }

  // updateKeyboardStatuses: called after each guess to color the keyboard keys
  const updateKeyboardStatuses = useCallback((guess: string, feedback: string[]) => {
    // green=3, yellow=2, gray=1 — keys only ever upgrade, never downgrade
    const priority: Record<string, number> = { green: 3, yellow: 2, gray: 1 }

    setKeyStatuses((prev) => {
      const next = { ...prev }
      guess.split("").forEach((letter, index) => {
        const newStatus = feedback[index]
        if ((priority[newStatus] ?? 0) > (priority[next[letter]] ?? 0)) {
          next[letter] = newStatus
        }
      })
      return next
    })
  }, [])

  // submitGuess: POSTs the current guess to the backend with the JWT token in the header
  const submitGuess = useCallback(async () => {
    setLoading(true) // block input while the request is in flight

    try {
      const res = await fetch(`${API}/guess`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`, // send JWT token so backend knows who is guessing
        },
        body: JSON.stringify({ guess: currentGuess }),
      })

      if (res.status === 401) {
        // token expired or invalid — log out and show login screen
        handleLogout()
        return
      }

      if (!res.ok) {
        const err = await res.json()
        setMessage(err.detail)
        return
      }

      const data = await res.json()
      const newGuess = { letters: data.guess.split(""), feedbacks: data.feedback }

      setGuesses((prev) => [...prev, newGuess])
      setCurrentGuess("")
      setMessage("")
      setAnswer(data.answer)

      updateKeyboardStatuses(data.guess, data.feedback)

      if (data.correct) {
        setWon(true)
        setGameOver(true)
      } else if (guesses.length + 1 >= MAX_ATTEMPTS) {
        setGameOver(true)
      }
    } catch {
      setMessage("Could not submit guess. Is the backend running?")
    } finally {
      setLoading(false)
    }
  }, [currentGuess, guesses.length, token, updateKeyboardStatuses])

  // handleKey: processes input from both the physical keyboard and the on-screen keyboard
  const handleKey = useCallback((key: string) => {
    if (gameOver || loading) return

    if (key === "⌫" || key === "Backspace") {
      setCurrentGuess((g) => g.slice(0, -1))
      return
    }

    if (key === "Enter") {
      if (currentGuess.length !== WORD_LENGTH) {
        setMessage("Guess must be exactly 5 letters")
        return
      }
      submitGuess()
      return
    }

    if (key.length === 1 && key.match(/[a-zA-Z]/)) {
      if (currentGuess.length < WORD_LENGTH) {
        setCurrentGuess((g) => g + key.toLowerCase())
        setMessage("")
      }
    }
  }, [currentGuess.length, gameOver, loading, submitGuess])

  // listen for physical keyboard input
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      handleKey(e.key)
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [handleKey]) // re-runs whenever handleKey changes (i.e. whenever state changes)

  // if no token, show the login/register screen
  if (!token) {
    return <Auth onLogin={handleLogin} />
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 40 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 20 }}>
        <h1 style={{ color: "white", margin: 0 }}>Definitely Not Wordle</h1>
        <button
          onClick={handleLogout}
          style={{
            background: "none",
            border: "1px solid #3a3a3c",
            color: "#818384",
            borderRadius: 4,
            padding: "4px 10px",
            cursor: "pointer",
            fontSize: 13,
          }}
        >
          Log out
        </button>
      </div>
      <Board guesses={guesses} currentGuess={currentGuess} maxAttempts={MAX_ATTEMPTS} />
      <Keyboard keyStatuses={keyStatuses} onKey={handleKey} />
      {message && (
        <p style={{ color: "white", marginTop: 20, fontSize: 18 }}>{message}</p>
      )}
      {gameOver && (
        <p style={{ color: "white", marginTop: 20, fontSize: 20 }}>
          {won ? "You won! 🎉" : `Game over! The word was "${answer}"`}
        </p>
      )}
    </div>
  )
}