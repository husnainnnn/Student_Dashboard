"""Notes RAG-lite search — server-side retrieval over a student's own notes.

This mirrors the extractive search already in the frontend
(src/app/notes/page.tsx) so results stay consistent wherever they run:
the query is tokenised (stopwords dropped), each note is split into
~600-character passages, and passages are ranked by term hits with a bonus
for matching more distinct terms. The server adds boosts the browser
version does not have: a hit in the note title, folder or tags counts
extra, because those fields say what a note is about.

No LLM and no embeddings are involved — this is retrieval only. A future
step can feed the top passages to a language model; the API already
returns exactly the passages such a step would need.
"""

from __future__ import annotations

import re

STOPWORDS = {
    "the", "a", "an", "and", "or", "of", "to", "in", "on", "is", "are", "was",
    "were", "it", "its", "for", "with", "by", "as", "at", "from", "that",
    "this", "these", "those", "be", "been", "has", "have", "had", "do", "does",
    "did", "will", "would", "can", "could", "should", "i", "you", "we",
    "they", "he", "she", "not", "but", "if", "then", "than", "so", "such",
    "into", "about", "over", "after", "before", "between", "under", "again",
    "once", "when", "where", "which", "who", "whom", "what", "how", "why",
    "all", "any", "both", "each", "few", "more", "most", "other", "some",
    "no", "nor", "only", "own", "same", "too", "very", "just", "also",
}

# Extra weight for a term hit outside the passage body.
TITLE_BOOST = 4
TAG_BOOST = 2
FOLDER_BOOST = 2
# Bonus per distinct query term matched, on top of the raw hit count.
DISTINCT_TERM_BONUS = 3


def tokenize(text: str) -> list[str]:
    """Lowercase words, dropping stopwords and tokens of 2 chars or fewer."""
    return [
        token
        for token in re.split(r"[^a-z0-9]+", text.lower())
        if len(token) > 2 and token not in STOPWORDS
    ]


def chunk_text(text: str, size: int = 600) -> list[str]:
    """Split text into sentence-aware chunks of at most ~`size` chars."""
    normalised = re.sub(r"\s+", " ", text).strip()
    if not normalised:
        return []
    sentences = re.findall(r"[^.!?]+[.!?]+[\"']?\s*|[^.!?]+$", normalised)
    chunks: list[str] = []
    current = ""
    for sentence in sentences:
        sentence = sentence.strip()
        if not sentence:
            continue
        if current and len(current) + 1 + len(sentence) > size:
            chunks.append(current.strip())
            current = sentence
        else:
            current = f"{current} {sentence}".strip() if current else sentence
    if current.strip():
        chunks.append(current.strip())
    return chunks


def make_snippet(chunk: str, terms: list[str], before: int = 120, after: int = 220) -> str:
    """A short window around the first search hit, so the result reads as a snippet."""
    lower = chunk.lower()
    first = -1
    for term in terms:
        idx = lower.find(term)
        if idx != -1 and (first == -1 or idx < first):
            first = idx
    if first == -1:
        return chunk[:280]
    start = max(0, first - before)
    end = min(len(chunk), first + after)
    prefix = "…" if start > 0 else ""
    suffix = "…" if end < len(chunk) else ""
    return f"{prefix}{chunk[start:end].strip()}{suffix}"


def _count_hits(lower: str, term: str) -> int:
    """Non-overlapping occurrences of `term` in `lower`."""
    hits = 0
    idx = 0
    while True:
        idx = lower.find(term, idx)
        if idx == -1:
            return hits
        hits += 1
        idx += len(term)


def search_notes(notes: list[dict], query: str, top_k: int = 5) -> list[dict]:
    """Rank passages from `notes` for `query`.

    Each note is a dict with ``id``, ``title``, ``content`` and optional
    ``folder`` / ``tags``. Returns at most ``top_k`` passages, best first,
    each with the note it came from, a snippet, a score and how many of the
    query terms it matched.
    """
    terms = tokenize(query)
    if not terms:
        return []

    results: list[dict] = []
    for note in notes:
        title = (note.get("title") or "").strip()
        content = note.get("content") or ""
        folder = (note.get("folder") or "").strip()
        tags = [str(tag) for tag in (note.get("tags") or [])]

        title_lower = title.lower()
        folder_lower = folder.lower()
        tags_lower = " ".join(tags).lower()

        # A term in the title, folder or tags says what the note is about,
        # so it counts even when the body never uses the word.
        meta_matched: set[str] = set()
        meta_score = 0
        for term in terms:
            boosts = 0
            if term in title_lower:
                boosts += TITLE_BOOST
            if term in folder_lower:
                boosts += FOLDER_BOOST
            if term in tags_lower:
                boosts += TAG_BOOST
            if boosts:
                meta_matched.add(term)
                meta_score += boosts

        note_results: list[dict] = []
        for chunk in chunk_text(content):
            lower = chunk.lower()
            score = 0
            matched: set[str] = set()
            for term in terms:
                hits = _count_hits(lower, term)
                if hits:
                    matched.add(term)
                    score += hits
            if not matched:
                continue
            # Title / folder / tag hits say what the note is about, so they
            # count extra — once per distinct term, not per occurrence.
            for term in matched:
                if term in title_lower:
                    score += TITLE_BOOST
                if term in folder_lower:
                    score += FOLDER_BOOST
                if term in tags_lower:
                    score += TAG_BOOST
            score += len(matched) * DISTINCT_TERM_BONUS
            note_results.append(
                {
                    "note_id": note.get("id", ""),
                    "note_title": title,
                    "note_folder": folder or None,
                    "note_tags": tags,
                    "text": chunk,
                    "snippet": make_snippet(chunk, terms),
                    "score": score,
                    "matched_terms": len(matched),
                    "total_terms": len(terms),
                }
            )

        if not note_results and meta_matched:
            # Title/folder/tag hit but the body never uses the word: still
            # surface the note, using its opening passage as the snippet.
            chunks = chunk_text(content)
            text = chunks[0] if chunks else title
            note_results.append(
                {
                    "note_id": note.get("id", ""),
                    "note_title": title,
                    "note_folder": folder or None,
                    "note_tags": tags,
                    "text": text,
                    "snippet": make_snippet(text, terms),
                    "score": meta_score + len(meta_matched) * DISTINCT_TERM_BONUS,
                    "matched_terms": len(meta_matched),
                    "total_terms": len(terms),
                }
            )
        results.extend(note_results)

    results.sort(key=lambda item: item["score"], reverse=True)
    return results[: max(1, top_k)]
