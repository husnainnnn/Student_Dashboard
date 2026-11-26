"""Student Dashboard backend — FastAPI v1.

Runs the server-side pieces the static frontend cannot do on its own:
notes RAG-lite search (retrieval over the student's own notes, no LLM)
and, once a Supabase project is wired up, the API the frontend will use
instead of localStorage.

Run locally:  uvicorn main:app --reload --port 8000
Docs:         http://localhost:8000/docs
"""

from __future__ import annotations

import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from schemas import HealthResponse, SearchRequest, SearchResponse
from search import search_notes, tokenize

VERSION = "0.1.0"

app = FastAPI(
    title="Student Dashboard API",
    description=(
        "Backend for the Student Dashboard: notes RAG-lite search over a "
        "student's own notes, backed by Supabase (see backend/supabase/)."
    ),
    version=VERSION,
)

# The frontend is a static site (GitHub Pages). Only its origin and local
# dev need to call this API; everything else is blocked by default.
_allowed_origins = [
    origin.strip()
    for origin in os.getenv(
        "ALLOWED_ORIGINS",
        "http://localhost:3000,https://husnainnnn.github.io",
    ).split(",")
    if origin.strip()
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


@app.get("/", response_model=HealthResponse)
def root() -> HealthResponse:
    return HealthResponse(status="ok", service="student-dashboard-api", version=VERSION)


@app.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(status="ok", service="student-dashboard-api", version=VERSION)


@app.post("/api/notes/search", response_model=SearchResponse)
def search(request: SearchRequest) -> SearchResponse:
    """RAG-lite retrieval: the most relevant passages from the notes sent in.

    The notes travel in the request body for v1, so the endpoint works with
    no database at all — the frontend sends the notes it already holds in
    localStorage. A later version will read them from Supabase by user id
    instead (see backend/supabase/ for the schema).
    """
    notes = [note.model_dump() for note in request.notes]
    results = search_notes(notes, request.query, top_k=request.top_k)
    return SearchResponse(
        query=request.query,
        terms=tokenize(request.query),
        total_notes=len(notes),
        results=results,
    )
