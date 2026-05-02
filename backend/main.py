from fastapi import FastAPI, HTTPException # HTTPException lets us return HTTP error codes like 400, 422
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel # lets us define the shape of incoming request bodies
import os
import random
import httpx # async HTTP client for calling the Merriam-Webster API
from dotenv import load_dotenv # loads environment variables from .env file

load_dotenv() # reads .env and makes its values available via os.getenv()
DICTIONARY_API_KEY = os.getenv("DICTIONARY_API_KEY") # grab the MW API key from environment

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

# pick one random word at server startup
# this word stays fixed for the entire session
secret = random.choice(WORDS)


class GuessRequest(BaseModel):
    """Shape of the JSON body expected by POST /guess.

    Attributes:
        guess: The 5-letter word submitted by the user.
    """
    guess: str


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
        HTTPException: 400 if the guess is not exactly 5 letters or contains non-alpha characters.
    """
    if len(guess) != WORD_LENGTH:
        raise HTTPException(status_code=400, detail="Guess must be exactly 5 letters")
    if not guess.isalpha():
        raise HTTPException(status_code=400, detail="Guess must contain only letters")


async def is_valid_word(word: str) -> bool:
    """Check if a word exists in the Merriam-Webster Collegiate Dictionary.

    Falls back to the Knuth word list if the API key is missing or the call fails,
    so the game still works without an internet connection or a valid key.

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
        # MW returns a list of dicts if the word exists
        # if the word doesn't exist it returns a list of strings (spelling suggestions)
        return isinstance(data, list) and len(data) > 0 and isinstance(data[0], dict)
    except Exception:
        # if the API call fails for any reason, fall back to the Knuth word list
        return word in WORDS


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
        feedback: A list of 5 strings, each "green", "yellow", or "gray".
    """
    feedback = ["gray"] * WORD_LENGTH
    copy = list(answer) # copy of answer so we can null out matched letters

    # first pass: greens
    for i in range(5):
        if guess[i] == copy[i]:
            feedback[i] = "green"
            copy[i] = None
            
    # second pass: yellows
    for i in range(5):
        if feedback[i] == "green":
            continue # already matched, skip
        if guess[i] in copy:
            feedback[i] = "yellow"
            # mark as used to it can't be used again
            copy[copy.index(guess[i])] = None

    return feedback


@app.get("/answer")
def get_answer():
    """Reveal the current secret word.

    Returns:
        JSON object with the secret word, e.g. {"answer": "crane"}.
    """
    return {"answer": secret}


@app.post("/guess")
async def guess(body: GuessRequest):
    """Score one 5-letter guess and return feedback for the UI to render.

    Async because is_valid_word makes an async HTTP call to Merriam-Webster.

    Args:
        body: Request body containing the guess string.

    Returns:
        JSON with the cleaned guess, per-letter feedback, win status, and the answer.

    Raises:
        HTTPException: 400 if the guess is invalid, 422 if the word is not in the dictionary.
    """
    submitted_guess = clean_guess(body.guess)
    validate_guess(submitted_guess)

    if not await is_valid_word(submitted_guess):
        raise HTTPException(status_code=422, detail="Not a valid word")

    feedback = compute_feedback(submitted_guess, secret)
    return {
        "guess": submitted_guess,
        "feedback": feedback,
        "correct": submitted_guess == secret,
        "answer": secret, # spec says the guess endpoint should reveal the word
    }