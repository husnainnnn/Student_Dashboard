"""Tests for the notes RAG-lite search (backend/search.py).

Plain Python, no extra packages:  python3 test_search.py

Covers the ranking rules the API promises: title/tag boosts, the
distinct-term bonus, stopword-only queries, snippet windows, and top_k.
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from search import chunk_text, make_snippet, search_notes, tokenize  # noqa: E402


def check(name: str, condition: bool) -> None:
    if not condition:
        raise AssertionError(f"FAIL: {name}")
    print(f"  ok: {name}")


NOTES = [
    {
        "id": "mpi",
        "title": "MPI Broadcast Notes",
        "content": (
            "MPI_Bcast sends the same message from the root process to every "
            "process in the communicator. It is a collective operation, so "
            "every process must call it. Broadcast is useful when one process "
            "holds data that all others need."
        ),
        "folder": "PDC",
        "tags": ["MPI", "parallel"],
    },
    {
        "id": "point",
        "title": "Point to Point",
        "content": (
            "MPI_Send and MPI_Recv move a message between two processes. "
            "Broadcast is not involved here. Send and receive are the basic "
            "building blocks of message passing."
        ),
        "folder": "PDC",
        "tags": ["MPI"],
    },
    {
        "id": "ds",
        "title": "K-fold Cross Validation",
        "content": (
            "K-fold cross validation splits the data into k folds and trains "
            "on k minus one folds at a time. It gives a steadier estimate of "
            "how a model generalises than a single train test split."
        ),
        "folder": "Data Science",
        "tags": ["validation"],
    },
]


def test_tokenize() -> None:
    check("stopwords and short tokens dropped",
          tokenize("How does the MPI broadcast work?") == ["mpi", "broadcast", "work"])
    check("stopword-only query tokenises to nothing",
          tokenize("what is the") == [])


def test_ranking() -> None:
    results = search_notes(NOTES, "MPI broadcast")
    check("best match is the broadcast note (title + tag boosts)",
          results[0]["note_id"] == "mpi")
    check("point-to-point note also matches, ranked below",
          results[1]["note_id"] == "point")
    check("unrelated note does not match",
          all(r["note_id"] != "ds" for r in results))
    check("matched_terms counts distinct terms",
          results[0]["matched_terms"] == 2)


def test_distinct_term_bonus() -> None:
    # One passage repeating "broadcast" vs one matching both terms once.
    notes = [
        {"id": "repeat", "title": "A", "content": "broadcast broadcast broadcast broadcast"},
        {"id": "both", "title": "B", "content": "broadcast and MPI together here"},
    ]
    results = search_notes(notes, "MPI broadcast")
    check("passage matching both terms beats one repeating a single term",
          results[0]["note_id"] == "both")


def test_title_boost() -> None:
    notes = [
        {"id": "body", "title": "Unrelated", "content": "broadcast appears in the body text here"},
        {"id": "title", "title": "Broadcast Guide", "content": "some other words entirely"},
    ]
    results = search_notes(notes, "broadcast")
    check("title hit ranks above a body-only hit",
          results and results[0]["note_id"] == "title")


def test_empty_and_limits() -> None:
    check("stopword-only query returns no results",
          search_notes(NOTES, "what is the") == [])
    check("empty query returns no results",
          search_notes(NOTES, "") == [])
    check("no notes returns no results",
          search_notes([], "MPI broadcast") == [])
    results = search_notes(NOTES, "MPI", top_k=1)
    check("top_k limits results", len(results) == 1)


def test_snippets() -> None:
    chunk = "x" * 200 + " broadcast is explained here " + "y" * 200
    snippet = make_snippet(chunk, ["broadcast"])
    check("snippet contains the hit term", "broadcast" in snippet)
    check("snippet is trimmed with ellipses", snippet.startswith("…") and snippet.endswith("…"))
    check("snippet is shorter than the full chunk", len(snippet) < len(chunk))
    chunks = chunk_text("First sentence. Second sentence! Third one? Fourth.")
    check("chunking keeps sentences together", len(chunks) >= 1 and "First sentence" in chunks[0])


def main() -> None:
    print("test_search.py")
    test_tokenize()
    test_ranking()
    test_distinct_term_bonus()
    test_title_boost()
    test_empty_and_limits()
    test_snippets()
    print("All search tests passed.")


if __name__ == "__main__":
    main()
