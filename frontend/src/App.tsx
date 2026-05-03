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
    const payload = JSON.parse(atob(token.split(".")[1]))
    return typeof payload.sub === "string" ? payload.sub : null
  } catch {
    return null
  }
}

function getStorageKey(token: string | null) {
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

function computeFeedback(guess: string, answer: string) {
  const feedback = Array<string>(WORD_LENGTH).fill("gray")
  const pool = answer.split("")

  guess.split("").forEach((letter, index) => {
    if (letter === pool[index]) {
      feedback[index] = "green"
      pool[index] = ""
    }
  })

  guess.split("").forEach((letter, index) => {
    if (feedback[index] === "green") return

    const matchIndex = pool.indexOf(letter)
    if (matchIndex !== -1) {
      feedback[index] = "yellow"
      pool[matchIndex] = ""
    }
  })

  return feedback
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

function ResultModal({
  won,
  answer,
  guesses,
  onClose,
}: {
  won: boolean
  answer: string
  guesses: number
  onClose: () => void
}) {
  return (
    <div style={modalBackdropStyle} onClick={onClose}>
      <div style={{ ...modalPanelStyle, textAlign: "center" }} onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} aria-label="Close" style={closeButtonStyle}>x</button>
        <h2 style={{ color: "white", marginTop: 0 }}>{won ? "You won" : "Game over"}</h2>
        <p style={{ color: "#d7dadc", lineHeight: 1.6, marginBottom: 20 }}>
          {won
            ? `Solved in ${guesses} ${guesses === 1 ? "guess" : "guesses"}.`
            : `The word was ${answer.toUpperCase()}.`}
        </p>
        <button
          onClick={onClose}
          style={{
            width: "100%",
            padding: "10px 0",
            backgroundColor: "#538d4e",
            color: "white",
            border: "none",
            borderRadius: 4,
            fontSize: 16,
            fontWeight: "bold",
            cursor: "pointer",
          }}
        >
          Close
        </button>
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
  const [showResult, setShowResult] = useState(storedGame.completed)
  const [answer, setAnswer] = useState("")
  const [message, setMessage] = useState("") // error messages like "Not a valid word"
  const [loading, setLoading] = useState(false) // true while a guess request is in flight
  const [showWakeupNotice, setShowWakeupNotice] = useState(false)

  const applyGameState = useCallback((data: GameState, storageToken = token) => {
    const cached = readStoredGame(storageToken)
    const serverGuesses = data.guesses ?? []
    const savedGuesses = serverGuesses.length > 0 ? serverGuesses : cached.guesses
    const completed = savedGuesses.length >= MAX_ATTEMPTS || Boolean(data.completed) || cached.completed
    const hasPlayableState = savedGuesses.length > 0
    const shouldBlockInput = completed && hasPlayableState
    const savedWon = Boolean(data.won) || cached.won

    setGuesses(savedGuesses)
    setKeyStatuses(rebuildKeyStatuses(savedGuesses))
    setCurrentGuess("")
    setGameOver(shouldBlockInput)
    setWon(savedWon)
    setShowResult(shouldBlockInput)
    writeStoredGame(storageToken, { guesses: savedGuesses, completed: shouldBlockInput, won: savedWon })
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
    setShowResult(false)
    setCurrentGuess("")
    setMessage("")
  }, [gameOver, guesses, token, won])

  const loadGameState = useCallback(async (authToken: string) => {
    try {
      const res = await fetch(`${API}/game`, {
        headers: { "Authorization": `Bearer ${authToken}` },
      })

      if (res.status === 401) {
        handleLogout()
        return
      }

      if (!res.ok) {
        applyGameState({}, authToken)
        return
      }

      const data = await res.json()
      applyGameState(data, authToken)
    } catch {
      applyGameState({}, authToken)
    }
  }, [applyGameState, handleLogout])

  // fetch the answer when the app loads so we can reveal it on a loss
  useEffect(() => {
    const wakeupTimer = window.setTimeout(() => setShowWakeupNotice(true), 2000)

    fetch(`${API}/answer`)
      .then((r) => r.json())
      .then((data) => {
        setAnswer(data.answer)
        setShowWakeupNotice(false)
      })
      .catch(() => setMessage("Could not connect to the game server."))

    return () => window.clearTimeout(wakeupTimer)
  }, [])

  // restore today's game state when a logged-in user loads the page
  // this lets users pick up where they left off after a page refresh
  useEffect(() => {
    if (!token) return

    Promise.resolve()
      .then(() => loadGameState(token))
      .catch(() => applyGameState({}, token))
  }, [applyGameState, loadGameState, token])

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
        // Token expired. Drop back to guest mode and retry this same guess
        // without showing a login/session warning.
        handleLogout()
        res = await sendGuess(null)
      }

      if (res.status === 401 && !token) {
        // Some deployed backend versions still protect /guess. Guests should
        // still be able to play, so fall back to scoring from /answer.
        const answerRes = await fetch(`${API}/answer`)
        if (!answerRes.ok) {
          setMessage("Could not submit guess. Is the backend running?")
          return
        }

        const answerData = await answerRes.json()
        const guestAnswer = answerData.answer
        const normalizedGuess = currentGuess.toLowerCase()
        const guestFeedback = computeFeedback(normalizedGuess, guestAnswer)
        const newGuess = { letters: normalizedGuess.split(""), feedbacks: guestFeedback }
        const nextGuesses = [...guesses, newGuess]
        const correct = normalizedGuess === guestAnswer
        const completed = correct || nextGuesses.length >= MAX_ATTEMPTS

        setGuesses(nextGuesses)
        setCurrentGuess("")
        setMessage("")
        setAnswer(guestAnswer)
        updateKeyboardStatuses(normalizedGuess, guestFeedback)
        writeStoredGame(null, { guesses: nextGuesses, completed, won: correct })

        if (correct) {
          setWon(true)
          setGameOver(true)
          setShowResult(true)
        } else if (nextGuesses.length >= MAX_ATTEMPTS) {
          setWon(false)
          setGameOver(true)
          setShowResult(true)
        }

        return
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
      setAnswer(data.answer) // backend returns the answer on every guess per the spec

      updateKeyboardStatuses(data.guess, data.feedback)
      writeStoredGame(token, { guesses: nextGuesses, completed, won: data.correct })

      if (data.correct) {
        setWon(true)
        setGameOver(true)
        setShowResult(true)
      } else if (nextGuesses.length >= MAX_ATTEMPTS) {
        setWon(false)
        setGameOver(true)
        setShowResult(true)
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
        {showWakeupNotice && !answer && (
          <p style={{ color: "#818384", marginTop: 20, fontSize: 13 }}>
            Waking up the free backend. First request may take up to a minute.
          </p>
        )}
        {gameOver && !showResult && (
          <p style={{ color: "#d7dadc", marginTop: 20, fontSize: 16 }}>
            Today's game is complete. Come back tomorrow for a new word.
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

      {/* modals */}
      {showHowToPlay && <HowToPlay onClose={() => setShowHowToPlay(false)} />}
      {showResult && (
        <ResultModal
          won={won}
          answer={answer}
          guesses={guesses.length}
          onClose={() => setShowResult(false)}
        />
      )}
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
