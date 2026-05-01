from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
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