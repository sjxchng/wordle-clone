// Keyboard layout shown on screen. The labels are also passed back to App as
// input commands, so "Enter" submits and "⌫" deletes.
const ROWS = [
  ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"],
  ["a", "s", "d", "f", "g", "h", "j", "k", "l"],
  ["Enter", "z", "x", "c", "v", "b", "n", "m", "⌫"],
]

// Maps the best known status for a key to its display color.
const KEY_COLORS: Record<string, string> = {
  green: "#538d4e",
  yellow: "#b59f3b",
  gray: "#3a3a3c",
}

function Key({
  label,
  status,
  onClick,
}: {
  label: string
  status: string
  onClick: (label: string) => void
}) {
  const bg = KEY_COLORS[status] ?? "#818384"
  const isWide = label === "Enter" || label === "⌫"

  return (
    <button
      onClick={() => onClick(label)}
      style={{
        width: isWide ? 65 : 43,
        height: 58,
        backgroundColor: bg,
        color: "white",
        border: "none",
        borderRadius: 4,
        fontSize: isWide ? 13 : 18,
        fontWeight: "bold",
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  )
}

// Keyboard renders the clickable on-screen keyboard. App owns the input logic,
// so each key simply reports its label through onKey.
export default function Keyboard({
  keyStatuses,
  onKey,
}: {
  keyStatuses: Record<string, string>
  onKey: (key: string) => void
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 20 }}>
      {ROWS.map((row, i) => (
        <div key={i} style={{ display: "flex", gap: 6, justifyContent: "center" }}>
          {row.map((key) => (
            <Key key={key} label={key} status={keyStatuses[key] ?? ""} onClick={onKey} />
          ))}
        </div>
      ))}
    </div>
  )
}
