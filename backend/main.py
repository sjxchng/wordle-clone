from fastapi import FastAPI, HTTPException # to send error codes
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel # to define the shape of the request body
import random
import os

# create FastAPI app
app = FastAPI()

app.add_middleware(
    # CORS = Cross-Origin Resource Sharing <- Browsers block requests between different
    # domains by default, and this tells the backend to allow requests from anywhere
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# word list sourced from Donald Knuth's Stanford GraphBase:
# "Download sgb-words.txt, the 5757 five-letter words of English
# (https://www-cs-faculty.stanford.edu/~knuth/sgb-words.txt)"
WORDS_FILE = os.path.join(os.path.dirname(__file__), "words.txt")

# read file, strip whitespace, lowercase, keep only 5-letter alphabetical words
with open(WORDS_FILE) as f:
    WORDS = [w.strip().lower() for w in f.readlines() if len(w.strip()) == 5 and w.strip().isalpha()]

# pick one random word at server startup
# this word stays fixed for the entire session
secret = random.choice(WORDS)

# pydantic automatically validates and parses incoming JSON request bodies
class GuessRequest(BaseModel):
    guess: str


def compute_feedback(guess: str, secret: str) -> list[str]:
    feedback = ["gray"] * 5
    secret_chars = list(secret)  # copy so we can null out matched letters

    # first pass: greens (correct letter, correct position)
    for i in range(5):
        if guess[i] == secret_chars[i]:
            feedback[i] = "green"
            secret_chars[i] = None  # mark as used so it can't become a yellow

    # second pass: yellows (correct letter, wrong position)
    for i in range(5):
        if feedback[i] == "green":
            continue
        if guess[i] in secret_chars:
            feedback[i] = "yellow"
            secret_chars[secret_chars.index(guess[i])] = None  # mark as used

    return feedback


# GET /answer — reveals the secret word, required by the spec
@app.get("/answer")
def get_answer():
    return {"answer": secret}


# POST /guess — accepts a 5-letter guess, returns per-letter feedback and win status
@app.post("/guess")
def guess(body: GuessRequest):
    g = body.guess.lower().strip()

    if len(g) != 5:
        raise HTTPException(status_code=400, detail="Guess must be exactly 5 letters")
    if not g.isalpha():
        raise HTTPException(status_code=400, detail="Guess must contain only letters")

    feedback = compute_feedback(g, secret)
    return {
        "guess": g,
        "feedback": feedback,
        "correct": g == secret,
    }
