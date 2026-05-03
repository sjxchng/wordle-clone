from fastapi import FastAPI, HTTPException, Depends # HTTPException lets us return HTTP error codes like 400, 422
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from pydantic import BaseModel # lets us define the shape of incoming request bodies
import os
import random
import httpx # async HTTP client for calling the Merriam-Webster API
import datetime
from dotenv import load_dotenv # loads environment variables from .env file
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy import create_engine, Column, String, Integer, Boolean, Date, ForeignKey
from sqlalchemy.orm import declarative_base, sessionmaker, Session

load_dotenv() # reads .env and makes its values available via os.getenv()
DICTIONARY_API_KEY = os.getenv("DICTIONARY_API_KEY") # grab the MW API key from environment
DATABASE_URL = os.getenv("DATABASE_URL")

# JWT config — used to sign and verify auth tokens
SECRET_KEY = os.getenv("SECRET_KEY", "changeme-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # tokens last 24 hours

# password hashing — bcrypt is the industry standard
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# OAuth2 — tells FastAPI where the login endpoint is
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")

app = FastAPI()

app.add_middleware(
    # CORS = Cross-Origin Resource Sharing
    # browsers block requests between different domains by default
    # this tells the backend to allow requests from anywhere
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

WORD_LENGTH = 5 # used everywhere instead of hardcoding 5

# word list sourced from Donald Knuth's Stanford GraphBase:
# https://www-cs-faculty.stanford.edu/~knuth/sgb-words.txt
WORDS_FILE = os.path.join(os.path.dirname(__file__), "words.txt")

# read file, strip whitespace, lowercase, keep only 5-letter alphabetical words
with open(WORDS_FILE) as f:
    WORDS = [
        word.strip().lower()
        for word in f.readlines()
        if len(word.strip()) == WORD_LENGTH and word.strip().isalpha()
    ]

# ── Database setup ──────────────────────────────────────────────────────────

# SQLAlchemy connects to PostgreSQL using the DATABASE_URL from environment
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(bind=engine)
Base = declarative_base()


class User(Base):
    """Stores registered users.

    Attributes:
        username: Unique identifier for the user.
        hashed_password: bcrypt hash of the user's password. Never stored in plain text.
    """
    __tablename__ = "users"
    username = Column(String, primary_key=True, index=True)
    hashed_password = Column(String)


class GameRecord(Base):
    """Stores one game record per user per day.

    Attributes:
        id: Auto-incrementing primary key.
        username: Foreign key linking to the users table.
        date: The date this game was played.
        guesses: Number of guesses used.
        won: Whether the user won.
        completed: Whether the game is finished (won or lost).
    """
    __tablename__ = "game_records"
    id = Column(Integer, primary_key=True, autoincrement=True)
    username = Column(String, ForeignKey("users.username"))
    date = Column(Date)
    guesses = Column(Integer, default=0)
    won = Column(Boolean, default=False)
    completed = Column(Boolean, default=False)


# create tables if they don't exist yet
Base.metadata.create_all(bind=engine)


def get_db():
    """Yield a database session and close it when done.

    Used as a FastAPI dependency — each request gets its own session.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ── Daily word ───────────────────────────────────────────────────────────────

def get_daily_word() -> str:
    """Pick a word based on today's date.

    Returns:
        A 5-letter word that stays the same all day and changes at midnight.
    """
    today = datetime.date.today()
    index = today.toordinal() % len(WORDS)
    return WORDS[index]


# ── Auth helpers ─────────────────────────────────────────────────────────────

def hash_password(password: str) -> str:
    """Hash a plain text password using bcrypt.

    Args:
        password: The plain text password to hash.

    Returns:
        A bcrypt hash string safe to store in the database.
    """
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    """Check if a plain text password matches a bcrypt hash.

    Args:
        plain: The plain text password from the login request.
        hashed: The stored bcrypt hash from the database.

    Returns:
        True if the password matches, False otherwise.
    """
    return pwd_context.verify(plain, hashed)


def create_access_token(username: str) -> str:
    """Create a signed JWT token for a user.

    Args:
        username: The username to encode in the token.

    Returns:
        A signed JWT string the frontend stores and sends with requests.
    """
    expire = datetime.datetime.utcnow() + datetime.timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    return jwt.encode({"sub": username, "exp": expire}, SECRET_KEY, algorithm=ALGORITHM)


def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    """Decode a JWT token and return the corresponding user.

    Used as a FastAPI dependency on protected endpoints.

    Args:
        token: JWT token from the Authorization header.
        db: Database session.

    Returns:
        The User object if the token is valid.

    Raises:
        HTTPException: 401 if the token is invalid or the user doesn't exist.
    """
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username = payload.get("sub")
        if username is None:
            raise HTTPException(status_code=401, detail="Invalid token")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

    user = db.query(User).filter(User.username == username).first()
    if user is None:
        raise HTTPException(status_code=401, detail="User not found")
    return user


# ── Word validation ──────────────────────────────────────────────────────────

async def is_valid_word(word: str) -> bool:
    """Check if a word exists in the Merriam-Webster Collegiate Dictionary.

    Falls back to the Knuth word list if the API key is missing or the call fails.

    Args:
        word: The cleaned 5-letter guess to validate.

    Returns:
        True if the word is valid, False otherwise.
    """
    if not DICTIONARY_API_KEY:
        return word in WORDS
    try:
        url = f"https://www.dictionaryapi.com/api/v3/references/collegiate/json/{word}?key={DICTIONARY_API_KEY}"
        async with httpx.AsyncClient() as client:
            res = await client.get(url, timeout=3)
        data = res.json()
        return isinstance(data, list) and len(data) > 0 and isinstance(data[0], dict)
    except Exception:
        return word in WORDS


# ── Feedback logic ───────────────────────────────────────────────────────────

def clean_guess(raw_guess: str) -> str:
    """Normalize user input before validation.

    Args:
        raw_guess: Raw string from the request body.

    Returns:
        Lowercased and whitespace-stripped version of the input.
    """
    return raw_guess.lower().strip()


def validate_guess(guess: str) -> None:
    """Reject anything that is not exactly 5 alphabetical characters.

    Args:
        guess: Cleaned guess string to validate.

    Raises:
        HTTPException: 400 if the guess is invalid.
    """
    if len(guess) != WORD_LENGTH:
        raise HTTPException(status_code=400, detail="Guess must be exactly 5 letters")
    if not guess.isalpha():
        raise HTTPException(status_code=400, detail="Guess must contain only letters")


def compute_feedback(guess: str, answer: str) -> list[str]:
    """Return green/yellow/gray feedback for each letter in the guess.

    Uses a two-pass approach to handle duplicate letters correctly:
    - Pass 1: Mark greens (correct letter, correct position) and consume those letters.
    - Pass 2: Mark yellows (correct letter, wrong position) using only unconsumed letters.
    Anything unmatched stays gray.

    Args:
        guess: The cleaned 5-letter guess submitted by the user.
        answer: The secret word to compare against.

    Returns:
        A list of 5 strings, each "green", "yellow", or "gray".
    """
    feedback = ["gray"] * WORD_LENGTH
    pool = list(answer)  # copy so we can null out matched letters

    # first pass: greens
    for i in range(5):
        if guess[i] == pool[i]:
            feedback[i] = "green"
            pool[i] = None  # mark as used so it can't become a yellow

    # second pass: yellows
    for i in range(5):
        if feedback[i] == "green":
            continue  # already matched, skip
        if guess[i] in pool:
            feedback[i] = "yellow"
            pool[pool.index(guess[i])] = None  # mark as used

    return feedback


# ── Request/Response models ──────────────────────────────────────────────────

class RegisterRequest(BaseModel):
    """Shape of the JSON body expected by POST /register."""
    username: str
    password: str


class GuessRequest(BaseModel):
    """Shape of the JSON body expected by POST /guess."""
    guess: str


# ── Endpoints ────────────────────────────────────────────────────────────────

@app.post("/register")
def register(body: RegisterRequest, db: Session = Depends(get_db)):
    """Register a new user.

    Args:
        body: Request body with username and password.
        db: Database session.

    Returns:
        Success message.

    Raises:
        HTTPException: 400 if the username is already taken.
    """
    existing = db.query(User).filter(User.username == body.username).first()
    if existing:
        raise HTTPException(status_code=400, detail="Username already taken")

    user = User(username=body.username, hashed_password=hash_password(body.password))
    db.add(user)
    db.commit()
    return {"message": "User created successfully"}


@app.post("/login")
def login(form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    """Log in and receive a JWT access token.

    Args:
        form: OAuth2 form with username and password fields.
        db: Database session.

    Returns:
        JWT access token and token type.

    Raises:
        HTTPException: 401 if credentials are invalid.
    """
    user = db.query(User).filter(User.username == form.username).first()
    if not user or not verify_password(form.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid username or password")

    token = create_access_token(user.username)
    return {"access_token": token, "token_type": "bearer"}


@app.get("/answer")
def get_answer():
    """Reveal today's secret word. Required by the project spec.

    Returns:
        JSON with today's word.
    """
    return {"answer": get_daily_word()}


@app.post("/guess")
async def guess(
    body: GuessRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Score one 5-letter guess and return feedback for the UI to render.

    Requires authentication. Tracks game state per user per day.

    Args:
        body: Request body containing the guess string.
        db: Database session.
        current_user: The authenticated user making the guess.

    Returns:
        JSON with feedback, win status, and today's answer.

    Raises:
        HTTPException: 400 if guess is invalid, 422 if not a real word, 403 if game is already over.
    """
    today = datetime.date.today()
    secret = get_daily_word()

    # get or create today's game record for this user
    record = db.query(GameRecord).filter(
        GameRecord.username == current_user.username,
        GameRecord.date == today,
    ).first()

    if record is None:
        record = GameRecord(username=current_user.username, date=today, guesses=0)
        db.add(record)
        db.commit()
        db.refresh(record)

    if record.completed:
        raise HTTPException(status_code=403, detail="You have already completed today's game")

    submitted_guess = clean_guess(body.guess)
    validate_guess(submitted_guess)

    if not await is_valid_word(submitted_guess):
        raise HTTPException(status_code=422, detail="Not a valid word")

    feedback = compute_feedback(submitted_guess, secret)
    correct = submitted_guess == secret

    # update game record
    record.guesses += 1
    if correct:
        record.won = True
        record.completed = True
    elif record.guesses >= 6:
        record.completed = True

    db.commit()

    return {
        "guess": submitted_guess,
        "feedback": feedback,
        "correct": correct,
        "answer": secret,
        "guesses_used": record.guesses,
    }


@app.get("/stats")
def get_stats(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Return game stats for the current user.

    Args:
        current_user: The authenticated user.
        db: Database session.

    Returns:
        Total games played, wins, and win percentage.
    """
    records = db.query(GameRecord).filter(
        GameRecord.username == current_user.username,
        GameRecord.completed == True,
    ).all()

    total = len(records)
    wins = sum(1 for r in records if r.won)
    return {
        "games_played": total,
        "wins": wins,
        "win_percentage": round(wins / total * 100) if total > 0 else 0,
    }