import { useCallback, useEffect, useState } from "react"
import Board from "./Board"
import Keyboard from "./Keyboard"

// FastAPI backend URL used by every fetch call in this component
const API = "http://localhost:8000"
const WORD_LENGTH = 5
const MAX_ATTEMPTS = 6

export default function App() {
  // guesses: array of submitted guesses, each with letters and feedback colors
  const [guesses, setGuesses] = useState<{ letters: string[]; feedbacks: string[] }[]>([])
  // currentGuess: the word the user is currently typing, not yet submitted
  const [currentGuess, setCurrentGuess] = useState("")
  // keyStatuses: maps each letter to its best known feedback color (green > yellow > gray)
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
      const res = await fetch(`${API}/guess`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guess: currentGuess }),
      })

      if (!res.ok) {
        const err = await res.json()
        setMessage(err.detail) // show backend error like "Not a valid word"
        return
      }

      const data = await res.json()
      const newGuess = { letters: data.guess.split(""), feedbacks: data.feedback }

      setGuesses((prev) => [...prev, newGuess])
      setCurrentGuess("")
      setMessage("") // clear any previous error on a successful guess
      setAnswer(data.answer) // backend returns the answer on every guess per the spec

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
      setLoading(false) // always unblock input, even if the request threw
    }
  }, [currentGuess, guesses.length, updateKeyboardStatuses])

  // handleKey: processes input from both the physical keyboard and the on-screen keyboard
  // useCallback with its dependencies ensures this always has fresh state values
  const handleKey = useCallback((key: string) => {
    if (gameOver || loading) return // ignore input when game is over or request is in flight

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
  }, [currentGuess.length, gameOver, loading, submitGuess])

  // listen for physical keyboard input
  // the cleanup function removes the old listener before adding a new one
  // this ensures handleKey always has the latest state values
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      handleKey(e.key)
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [handleKey]) // re-runs whenever handleKey changes (i.e. whenever state changes)

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 40 }}>
      <h1 style={{ color: "white", marginBottom: 20 }}>Definitely Not Wordle</h1>
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