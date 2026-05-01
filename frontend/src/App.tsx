import Board from "./Board"

function App() {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 40 }}>
      <h1 style={{ color: "white", marginBottom: 20 }}>Definitely Not Wordle</h1>
      <Board guesses={[]} currentGuess="test" />
    </div>
  )
}

export default App