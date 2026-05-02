# Definitely Not Wordle

A full-stack Wordle clone

## Live Demo

- **Frontend**: https://wordle-clone-ruddy-six.vercel.app
- **Backend**: https://wordle-clone-backend-se82.onrender.com

## How to Play

Guess the secret 5-letter word within 6 tries. After each guess, tiles change color to show how close your guess was:

- 🟩 **Green** — correct letter, correct position
- 🟨 **Yellow** — correct letter, wrong position
- ⬜ **Gray** — letter not in the word

## Tech Stack

**Frontend**
- React + TypeScript (Vite)
- Hosted on Vercel

**Backend**
- FastAPI (Python)
- Hosted on Render
- Word validation via [Merriam-Webster Collegiate Dictionary API](https://dictionaryapi.com/)

## Running Locally

**Backend**
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload
```

**Frontend**
```bash
cd frontend
npm install
npm run dev
```

The frontend runs on `http://localhost:5173` and the backend on `http://localhost:8000`.

You'll need a `.env` file in `backend/` with your Merriam-Webster API key:
```
DICTIONARY_API_KEY=your_key_here
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/answer` | Returns the current secret word |
| POST | `/guess` | Accepts a 5-letter guess, returns per-letter feedback |

## Credits

- Word list: [Donald Knuth's Stanford GraphBase](https://www-cs-faculty.stanford.edu/~knuth/sgb-words.txt)
- Dictionary validation: [Merriam-Webster Collegiate Dictionary API](https://dictionaryapi.com/)
