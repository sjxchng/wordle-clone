// the color each feedback value maps to
const TILE_COLORS: Record<string, string> = {
  green: "#538d4e",
  yellow: "#b59f3b",
  gray: "#3a3a3c",
  empty: "#121213",
}

// a single tile in the grid
function Tile({ letter, feedback }: { letter: string; feedback: string }) {
  const bg = TILE_COLORS[feedback] ?? TILE_COLORS.empty
  return (
    <div style={{
      width: 62,
      height: 62,
      border: "2px solid #3a3a3c",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: 32,
      fontWeight: "bold",
      color: "white",
      backgroundColor: bg,
      textTransform: "uppercase",
    }}>
      {letter}
    </div>
  )
}

// one row of 5 tiles
function Row({ letters, feedbacks }: { letters: string[]; feedbacks: string[] }) {
  return (
    <div style={{ display: "flex", gap: 5 }}>
      {[0, 1, 2, 3, 4].map((i) => (
        <Tile key={i} letter={letters[i] ?? ""} feedback={feedbacks[i] ?? "empty"} />
      ))}
    </div>
  )
}

// the full 6x5 board
// guesses is an array of submitted guesses, each with letters and feedback
// currentGuess is what the user is currently typing
export default function Board({
  guesses,
  currentGuess,
}: {
  guesses: { letters: string[]; feedbacks: string[] }[]
  currentGuess: string
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      {[0, 1, 2, 3, 4, 5].map((rowIndex) => {
        if (rowIndex < guesses.length) {
          // already submitted row — show letters and feedback colors
          return <Row key={rowIndex} letters={guesses[rowIndex].letters} feedbacks={guesses[rowIndex].feedbacks} />
        } else if (rowIndex === guesses.length) {
          // current active row — show what user is typing, no colors
          return <Row key={rowIndex} letters={currentGuess.split("")} feedbacks={[]} />
        } else {
          // empty row
          return <Row key={rowIndex} letters={[]} feedbacks={[]} />
        }
      })}
    </div>
  )
}