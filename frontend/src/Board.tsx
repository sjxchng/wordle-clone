const WORD_LENGTH = 5

// color palette for each possible tile state
const TILE_COLORS: Record<string, string> = {
  green: "#538d4e",
  yellow: "#b59f3b",
  gray: "#3a3a3c",
  empty: "#121213",
}

// Tile: one square in the grid
// letter: the character to display (empty string for unfilled tiles)
// feedback: "green" | "yellow" | "gray" | "empty"
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

// Row: one horizontal row of 5 tiles
// letters: array of characters to display
// feedbacks: array of feedback values, one per letter
function Row({ letters, feedbacks }: { letters: string[]; feedbacks: string[] }) {
  return (
    <div style={{ display: "flex", gap: 5 }}>
      {Array.from({ length: WORD_LENGTH }).map((_, index) => (
        <Tile key={index} letter={letters[index] ?? ""} feedback={feedbacks[index] ?? "empty"} />
      ))}
    </div>
  )
}

// Board: the full grid of maxAttempts rows x 5 columns
// guesses: submitted guesses with feedback from the backend
// currentGuess: what the user is currently typing (shown in the active row)
// maxAttempts: total number of rows (6 for this game)
export default function Board({
  guesses,
  currentGuess,
  maxAttempts,
}: {
  guesses: { letters: string[]; feedbacks: string[] }[]
  currentGuess: string
  maxAttempts: number
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      {Array.from({ length: maxAttempts }).map((_, rowIndex) => {
        if (rowIndex < guesses.length) {
          // submitted row — show letters with feedback colors from the backend
          return <Row key={rowIndex} letters={guesses[rowIndex].letters} feedbacks={guesses[rowIndex].feedbacks} />
        }

        if (rowIndex === guesses.length) {
          // active row — show what the user is currently typing, no colors yet
          return <Row key={rowIndex} letters={currentGuess.split("")} feedbacks={[]} />
        }

        // future row — empty
        return <Row key={rowIndex} letters={[]} feedbacks={[]} />
      })}
    </div>
  )
}