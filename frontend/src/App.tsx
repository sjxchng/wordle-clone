import { useCallback, useEffect, useState } from "react"
import Board from "./Board"
import Keyboard from "./Keyboard"
import Auth from "./Auth"

// FastAPI backend URL used by every fetch call in this component
const API = "https://wordle-clone-backend-se82.onrender.com"
const WORD_LENGTH = 5
const MAX_ATTEMPTS = 6

type Guess = { letters: string[]; feedbacks: string[] }
type GameState = { guesses?: Guess[]; completed?: boolean; won?: boolean }
type StoredGameState = { guesses: Guess[]; completed: boolean; won: boolean }

const todayKey = new Date().toISOString().slice(0, 10)

function getUsernameFromToken(token: string | null) {
  if (!token) return null

  try {
    // JWTs are three base64url segments separated by dots: header.payload.signature
    // the payload is the middle segment; atob decodes it from base64 to a JSON string
    const payload = JSON.parse(atob(token.split(".")[1]))
    return typeof payload.sub === "string" ? payload.sub : null
  } catch {
    return null
  }
}

function getStorageKey(token: string | null) {
  // scoping the key by date and user means yesterday's guest cache doesn't bleed
  // into today's game, and a logged-in user's state doesn't overwrite a guest's
  const user = getUsernameFromToken(token)
  return `definitely-not-wordle:${todayKey}:${user ?? "guest"}`
}

function readStoredGame(token: string | null): StoredGameState {
  try {
    const raw = localStorage.getItem(getStorageKey(token))
    if (!raw) return { guesses: [], completed: false, won: false }

    const parsed = JSON.parse(raw)
    return {
      guesses: Array.isArray(parsed.guesses) ? parsed.guesses : [],
      completed: Boolean(parsed.completed),
      won: Boolean(parsed.won),
    }
  } catch {
    return { guesses: [], completed: false, won: false }
  }
}

function writeStoredGame(token: string | null, state: StoredGameState) {
  localStorage.setItem(getStorageKey(token), JSON.stringify(state))
}

function clearStoredGame(token: string | null) {
  localStorage.removeItem(getStorageKey(token))
}

function rebuildKeyStatuses(guesses: Guess[]) {
  // recompute keyboard colors from a saved guess list — used on initial render
  // to restore key colors when the page loads with cached guesses
  const priority: Record<string, number> = { green: 3, yellow: 2, gray: 1 }
  const statuses: Record<string, string> = {}

  guesses.forEach((g) => {
    g.letters.forEach((letter, i) => {
      const status = g.feedbacks[i]
      if ((priority[status] ?? 0) > (priority[statuses[letter]] ?? 0)) {
        statuses[letter] = status
      }
    })
  })

  return statuses
}

const modalBackdropStyle: React.CSSProperties = {
  position: "fixed",
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: "rgba(0,0,0,0.8)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 100,
}

const modalPanelStyle: React.CSSProperties = {
  position: "relative",
  backgroundColor: "#121213",
  border: "1px solid #3a3a3c",
  borderRadius: 8,
  padding: 32,
  maxWidth: 400,
  width: "90%",
}

const closeButtonStyle: React.CSSProperties = {
  position: "absolute",
  top: 10,
  right: 12,
  background: "none",
  border: "none",
  color: "#818384",
  cursor: "pointer",
  fontSize: 24,
  lineHeight: 1,
}

// HowToPlay renders the instructions modal
function HowToPlay({ onClose }: { onClose: () => void }) {
  return (
    <div style={modalBackdropStyle} onClick={onClose}>
      <div style={modalPanelStyle} onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} aria-label="Close" style={closeButtonStyle}>x</button>
        <h2 style={{ color: "white", marginTop: 0 }}>How To Play</h2>
        <p style={{ color: "#d7dadc", lineHeight: 1.6 }}>
          Guess the secret 5-letter word within 6 tries.
        </p>
        <p style={{ color: "#d7dadc", lineHeight: 1.6 }}>
          After each guess, tiles change color to show how close you were:
        </p>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <div style={{ width: 36, height: 36, backgroundColor: "#538d4e", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: "bold", borderRadius: 4 }}>A</div>
          <span style={{ color: "#d7dadc" }}>Correct letter, correct position</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <div style={{ width: 36, height: 36, backgroundColor: "#b59f3b", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: "bold", borderRadius: 4 }}>B</div>
          <span style={{ color: "#d7dadc" }}>Correct letter, wrong position</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 24 }}>
          <div style={{ width: 36, height: 36, backgroundColor: "#3a3a3c", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: "bold", borderRadius: 4 }}>C</div>
          <span style={{ color: "#d7dadc" }}>Letter not in the word</span>
        </div>
        <button onClick={onClose} style={{
          width: "100%", padding: "10px 0",
          backgroundColor: "#538d4e", color: "white",
          border: "none", borderRadius: 4,
          fontSize: 16, fontWeight: "bold", cursor: "pointer",
        }}>Got it</button>
      </div>
    </div>
  )
}

export default function App() {
  // token: JWT stored in localStorage so it persists across page refreshes
  const [token, setToken] = useState<string | null>(() => localStorage.getItem("token"))
  const storedGame = readStoredGame(token)
  const [showAuth, setShowAuth] = useState(false) // show login modal over the game
  const [showHowToPlay, setShowHowToPlay] = useState(false)

  // guesses: array of submitted guesses, each with letters and feedback colors
  const [guesses, setGuesses] = useState<Guess[]>(storedGame.guesses)
  // currentGuess: the word the user is currently typing, not yet submitted
  const [currentGuess, setCurrentGuess] = useState("")
  // keyStatuses: maps each letter to its best known feedback color (green > yellow > gray)
  const [keyStatuses, setKeyStatuses] = useState<Record<string, string>>(() => rebuildKeyStatuses(storedGame.guesses))
  const [gameOver, setGameOver] = useState(storedGame.completed)
  const [won, setWon] = useState(storedGame.won)
  // answer starts null and is only populated once the server reveals it at game-end —
  // keeping it out of state while the game is active means it can't be read from devtools
  const [answer, setAnswer] = useState<string | null>(null)
  const [message, setMessage] = useState("") // error messages like "Not a valid word"
  const [loading, setLoading] = useState(false) // true while a guess request is in flight
  const [showWakeupNotice, setShowWakeupNotice] = useState(false)
  const [toast, setToast] = useState("") // auto-dismissing result message shown after win or loss

  // showToast: displays a toast message that disappears after 3 seconds
  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(""), 3000)
  }

  const applyGameState = useCallback((data: GameState, storageToken = token, useCacheFallback = false) => {
    const cached = readStoredGame(storageToken)
    const serverGuesses = data.guesses ?? []
    const savedGuesses = serverGuesses.length > 0 ? serverGuesses : useCacheFallback ? cached.guesses : []
    const completed = !useCacheFallback && (savedGuesses.length >= MAX_ATTEMPTS || Boolean(data.completed))
    const savedWon = !useCacheFallback && Boolean(data.won)

    setGuesses(savedGuesses)
    setKeyStatuses(rebuildKeyStatuses(savedGuesses))
    setGameOver(completed)
    setWon(savedWon)
    writeStoredGame(storageToken, { guesses: savedGuesses, completed, won: savedWon })
  }, [token])

  // log out by clearing the token from state and localStorage
  const handleLogout = useCallback(() => {
    if (token) {
      writeStoredGame(token, { guesses, completed: gameOver, won })
    }

    localStorage.removeItem("token")
    clearStoredGame(null)
    setToken(null)
    setShowAuth(false)
    // reset game state for guest
    setGuesses([])
    setKeyStatuses({})
    setGameOver(false)
    setWon(false)
    setCurrentGuess("")
    setMessage("")
    setAnswer(null)
  }, [gameOver, guesses, token, won])

  const loadGameState = useCallback(async (authToken: string) => {
    try {
      const res = await fetch(`${API}/game`, {
        headers: { "Authorization": `Bearer ${authToken}` },
      })

      if (res.status === 401) {
        // token was rejected by the server (expired or revoked) — clear it and fall back to guest
        handleLogout()
        return
      }

      if (!res.ok) {
        applyGameState({}, authToken, true)
        return
      }

      const data = await res.json()
      applyGameState(data, authToken)
    } catch {
      // network failure — recover from localStorage cache so the user isn't locked out
      applyGameState({}, authToken, true)
    }
  }, [applyGameState, handleLogout])

  // show the wakeup notice after 2 s if the backend hasn't responded yet —
  // Render's free tier spins down after inactivity and can take ~60 s to cold-start
  useEffect(() => {
    const wakeupTimer = window.setTimeout(() => setShowWakeupNotice(true), 2000)
    const hideTimer = window.setTimeout(() => setShowWakeupNotice(false), 8000)
    return () => {
      window.clearTimeout(wakeupTimer)
      window.clearTimeout(hideTimer)
    }
  }, [])

  // restore today's game state when a logged-in user loads the page
  // this lets users pick up where they left off after a page refresh
  useEffect(() => {
    if (!token) return

    Promise.resolve()
      .then(() => loadGameState(token))
      .catch(() => applyGameState({}, token, true))
  }, [token])

  // called by Auth component after successful login — saves token to state and localStorage
  async function handleLogin(newToken: string) {
    localStorage.setItem("token", newToken)
    setToken(newToken)
    setShowAuth(false)
    setMessage("")
    await loadGameState(newToken)
  }

  // updateKeyboardStatuses: called after each guess to color the keyboard keys
  // useCallback memoizes this function so it doesn't get recreated on every render
  // which matters because submitGuess depends on it
  const updateKeyboardStatuses = useCallback((guess: string, feedback: string[]) => {
    // green=3, yellow=2, gray=1 — keys only ever upgrade, never downgrade
    // so a green key stays green even if the same letter shows up gray later
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
  }, []) // no dependencies — priority is a constant defined inside the function

  // submitGuess: POSTs the current guess to the backend and processes the response
  // useCallback ensures handleKey always has the latest version of this function
  const submitGuess = useCallback(async () => {
    setLoading(true) // block input while the request is in flight

    try {
      async function sendGuess(authToken: string | null) {
        const headers: Record<string, string> = { "Content-Type": "application/json" }
        if (authToken) headers["Authorization"] = `Bearer ${authToken}` // logged-in guesses are saved

        return fetch(`${API}/guess`, {
          method: "POST",
          headers,
          body: JSON.stringify({ guess: currentGuess }),
        })
      }

      let res = await sendGuess(token)

      if (res.status === 401 && token) {
        // token expired mid-session — drop back to guest mode and retry the same guess
        // transparently so the user doesn't see a login prompt mid-game
        handleLogout()
        res = await sendGuess(null)
      }

      if (!res.ok) {
        const err = await res.json()
        setMessage(err.detail) // show backend error like "Not a valid word"
        return
      }

      const data = await res.json()
      const newGuess = { letters: data.guess.split(""), feedbacks: data.feedback }
      const nextGuesses = [...guesses, newGuess]
      const completed = data.correct || nextGuesses.length >= MAX_ATTEMPTS

      setGuesses(nextGuesses)
      setCurrentGuess("")
      setMessage("") // clear any previous error on a successful guess

      // the server only includes "answer" in the response once the game is over;
      // it's null for every in-progress guess so it never leaks via network traffic
      if (data.answer) {
        setAnswer(data.answer)
      }

      updateKeyboardStatuses(data.guess, data.feedback)
      writeStoredGame(token, { guesses: nextGuesses, completed, won: data.correct })

      if (data.correct) {
        setWon(true)
        setGameOver(true)
        showToast(`You won in ${nextGuesses.length} ${nextGuesses.length === 1 ? "guess" : "guesses"}! 🎉`)
      } else if (nextGuesses.length >= MAX_ATTEMPTS) {
        setWon(false)
        setGameOver(true)
        showToast(`Game over! The word was ${(data.answer ?? "???").toUpperCase()}`)
      }
    } catch {
      setMessage("Could not submit guess. Is the backend running?")
    } finally {
      setLoading(false) // always unblock input, even if the request threw
    }
  }, [currentGuess, guesses, handleLogout, token, updateKeyboardStatuses])

  // handleKey: processes input from both the physical keyboard and the on-screen keyboard
  // useCallback with its dependencies ensures this always has fresh state values
  const handleKey = useCallback((key: string) => {
    // ignore input when game is over, request is in flight, or a modal is open
    if (gameOver || loading || showAuth || showHowToPlay) return

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
    // only accept single alphabetical characters
    if (key.length === 1 && key.match(/[a-zA-Z]/)) {
      if (currentGuess.length < WORD_LENGTH) {
        setCurrentGuess((g) => g + key.toLowerCase())
        setMessage("") // clear error when user starts typing again
      }
    }
  }, [currentGuess.length, gameOver, loading, showAuth, showHowToPlay, submitGuess])

  // listen for physical keyboard input
  // the cleanup function removes the old listener before adding a new one
  // this ensures handleKey always has the latest state values
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) { handleKey(e.key) }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [handleKey]) // re-runs whenever handleKey changes (i.e. whenever state changes)

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#121213" }}>
      {/* header bar */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 16px", height: 50,
        borderBottom: "1px solid #3a3a3c",
      }}>
        <button
          onClick={() => setShowHowToPlay(true)}
          style={{ background: "none", border: "none", color: "#d7dadc", cursor: "pointer", fontSize: 14 }}
        >
          How to Play
        </button>
        <div style={{ color: "white", fontWeight: "bold", fontSize: 18, letterSpacing: 2 }}>
          DEFINITELY NOT WORDLE
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {token ? (
            <button
              onClick={handleLogout}
              style={{ background: "none", border: "1px solid #3a3a3c", color: "#818384", borderRadius: 4, padding: "4px 10px", cursor: "pointer", fontSize: 13 }}
            >
              Log out
            </button>
          ) : (
            <button
              onClick={() => setShowAuth(true)}
              style={{ background: "none", border: "1px solid #3a3a3c", color: "#d7dadc", borderRadius: 4, padding: "4px 10px", cursor: "pointer", fontSize: 13 }}
            >
              Log in
            </button>
          )}
        </div>
      </div>

      {/* game area */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 30 }}>
        <Board guesses={guesses} currentGuess={currentGuess} maxAttempts={MAX_ATTEMPTS} />
        <Keyboard keyStatuses={keyStatuses} onKey={handleKey} />
        {showWakeupNotice && (
          <p style={{ color: "#818384", marginTop: 20, fontSize: 13 }}>
            Waking up the free backend. First request may take up to a minute.
          </p>
        )}
        {gameOver && !toast && (
          <p style={{ color: "#d7dadc", marginTop: 20, fontSize: 16 }}>
            Today's game is complete. Come back tomorrow for a new word.
            {answer && !won && (
              <span style={{ color: "#818384" }}> The word was <strong style={{ color: "#d7dadc" }}>{answer.toUpperCase()}</strong>.</span>
            )}
          </p>
        )}
        {message && <p style={{ color: "white", marginTop: 20, fontSize: 18 }}>{message}</p>}
        {/* prompt guests to log in for progress tracking */}
        {!token && (
          <p style={{ color: "#818384", marginTop: 20, fontSize: 13 }}>
            <span
              onClick={() => setShowAuth(true)}
              style={{ color: "#d7dadc", cursor: "pointer", textDecoration: "underline" }}
            >
              Log in
            </span>
            {" "}to save your progress and track stats
          </p>
        )}
      </div>

      {/* auto-dismissing toast shown after win or loss — disappears after 3 seconds */}
      {toast && (
        <div style={{
          position: "fixed",
          top: 80,
          left: "50%",
          transform: "translateX(-50%)",
          backgroundColor: won ? "#538d4e" : "#3a3a3c",
          color: "white",
          padding: "12px 24px",
          borderRadius: 8,
          fontSize: 16,
          fontWeight: "bold",
          zIndex: 200,
          boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
          whiteSpace: "nowrap",
        }}>
          {toast}
        </div>
      )}

      {/* modals */}
      {showHowToPlay && <HowToPlay onClose={() => setShowHowToPlay(false)} />}
      {showAuth && (
        <div style={modalBackdropStyle} onClick={() => setShowAuth(false)}>
          <div style={{ position: "relative" }}>
            <button
              onClick={() => setShowAuth(false)}
              style={{
                position: "absolute", top: -40, right: 0,
                background: "none", border: "none", color: "#818384",
                cursor: "pointer", fontSize: 24,
              }}
            >x</button>
            <div onClick={(e) => e.stopPropagation()}>
              <Auth onLogin={handleLogin} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}