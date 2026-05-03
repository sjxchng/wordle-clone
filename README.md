# Definitely Not Wordle

A full-stack Wordle clone with guest play, account login, saved progress, and a daily shared word.

## Live Demo

- **Frontend**: https://wordle-clone-ruddy-six.vercel.app
- **Backend**: https://wordle-clone-backend-se82.onrender.com
- **GitHub**: https://github.com/sjxchng/wordle-clone

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

Create a `backend/.env` file first:

```bash
DICTIONARY_API_KEY=your_merriam_webster_key
DATABASE_URL=your_postgres_connection_url
SECRET_KEY=your_jwt_secret
```

The `.env` file is ignored by Git and should not be committed.

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

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/register` | Creates a new user account |
| POST | `/login` | Logs in and returns a JWT access token |
| GET | `/answer` | Returns the current secret word |
| POST | `/guess` | Accepts a 5-letter guess, returns per-letter feedback |
| GET | `/game` | Restores today's saved game for a logged-in user |
| GET | `/stats` | Returns completed-game stats for a logged-in user |

Guest players can use `/guess` without logging in. Logged-in guesses are saved so progress restores after refresh.

## Features

- Guess the daily 5-letter word in 6 tries.
- Green, yellow, and gray tile feedback after every valid guess.
- On-screen keyboard and physical keyboard support.
- Keyboard colors update as letters are discovered.
- Guest play works without an account.
- Register and log in to save progress.
- Saved progress restores after page refresh.
- Logging out resets the board back to a guest game.
- "How to Play" modal opens and closes.
- Win and loss results appear in a popup.
- Invalid words show a "Not a valid word" error.
- The daily word is deterministic from the current date, so everyone gets the same word for the day.

## Deployment

- Frontend is hosted on Vercel.
- Backend is hosted on Render.
- The deployed backend uses PostgreSQL for users, saved guesses, and stats.

## Repository Notes

- Git history contains multiple focused commits.
- `.env` and `node_modules` are ignored and are not tracked.
- `frontend/package-lock.json` is committed for reproducible frontend installs.
- Backend dependencies are listed in `backend/requirements.txt`.

## Credits

- Word list: [Donald Knuth's Stanford GraphBase](https://www-cs-faculty.stanford.edu/~knuth/sgb-words.txt)
- Dictionary validation: [Merriam-Webster Collegiate Dictionary API](https://dictionaryapi.com/)
