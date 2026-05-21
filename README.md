# Wordle Clone

A fullstack Wordle clone built with React + TypeScript, FastAPI, PostgreSQL, and JWT authentication.

## Live Demo

- **Frontend**: https://wordle-clone-ruddy-six.vercel.app
- **Backend**: https://wordle-clone-backend-se82.onrender.com
- **GitHub**: https://github.com/sjxchng/wordle-clone

> **Note:** The backend is hosted on Render's free tier, which spins down after inactivity. On first load, actions like logging in, submitting a guess, or restoring saved progress may take up to 60 seconds as the server wakes up, and the app may appear unresponsive during this time. This is expected behavior on the free tier, not a bug. Subsequent requests will be fast once the backend is running.

## How to Play

Guess the secret 5-letter word within 6 tries. After each guess, tiles change color:

- 🟩 **Green** — correct letter, correct position
- 🟨 **Yellow** — correct letter, wrong position
- ⬜ **Gray** — letter not in the word

The secret word is shared across all players and resets daily at midnight.

## Features

- Guest play — no account required
- Optional login/register to save and restore daily progress across sessions
- Daily word that changes at midnight and is consistent for all players
- Word validation via the Merriam-Webster Collegiate Dictionary API
- On-screen keyboard with color feedback
- Physical keyboard support
- How to Play modal
- Result modal on win or loss

## Tech Stack

**Frontend**
- React + TypeScript (Vite)
- Hosted on Vercel

**Backend**
- FastAPI (Python)
- PostgreSQL via SQLAlchemy
- JWT authentication with bcrypt password hashing
- Hosted on Render

## Running Locally

Create a `backend/.env` file:

```bash
DICTIONARY_API_KEY=your_merriam_webster_key
DATABASE_URL=your_postgres_connection_url
SECRET_KEY=your_jwt_secret
```

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

Frontend runs on `http://localhost:5173`, backend on `http://localhost:8000`.

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/answer` | Returns today's secret word |
| POST | `/guess` | Accepts a 5-letter guess, returns per-letter feedback |
| POST | `/register` | Creates a new user account |
| POST | `/login` | Returns a JWT access token |
| GET | `/game` | Restores today's saved game for a logged-in user |
| GET | `/stats` | Returns win stats for a logged-in user |

Guest players can use `/guess` without a token. Logged-in requests include a JWT so the backend can persist progress.

## Repository Notes

- Git history contains multiple focused commits built up incrementally.
- `.env` and `node_modules` are gitignored and not tracked.
- Backend dependencies are in `backend/requirements.txt`.

## Credits

- Word list: [Donald Knuth's Stanford GraphBase](https://www-cs-faculty.stanford.edu/~knuth/sgb-words.txt)
- Dictionary validation: [Merriam-Webster Collegiate Dictionary API](https://dictionaryapi.com/)
