# Student Dashboard backend — v1

FastAPI backend for the Student Dashboard. v1 does the one thing the static
frontend cannot do on its own: **server-side notes search (RAG-lite)** —
retrieval over a student's own notes, with ranked passages and snippets.
There is no LLM and no embeddings key involved; a later step can feed the
returned passages to a language model for grounded answers.

The Supabase schema in `supabase/migrations/` is the database this API will
read from once the frontend moves off localStorage. v1 does not need it yet:
the search endpoint takes the notes in the request body, so it works with
no database at all.

## Run it

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

API docs: http://localhost:8000/docs

## Endpoints

| Method | Path | What it does |
| --- | --- | --- |
| GET | `/health` | Liveness check — `{"status": "ok", ...}` |
| POST | `/api/notes/search` | RAG-lite retrieval over the notes in the body |

### POST /api/notes/search

```bash
curl -X POST http://localhost:8000/api/notes/search \
  -H "Content-Type: application/json" \
  -d '{
    "query": "how does MPI broadcast work",
    "notes": [
      {"id": "1", "title": "PDC Lecture 5", "content": "MPI_Bcast sends the same message...", "folder": "PDC", "tags": ["MPI"]}
    ],
    "top_k": 5
  }'
```

Response: the query terms found, and up to `top_k` passages, best first —
each with the note it came from, a snippet around the first hit, a score,
and how many of the query terms it matched.

How ranking works (same rules as the frontend search in
`src/app/notes/page.tsx`, plus metadata boosts):

1. The query is tokenised; stopwords and short tokens are dropped.
2. Each note is split into sentence-aware passages of ~600 characters.
3. A passage scores one point per term hit, plus 3 per distinct query term
   matched — a passage matching more different terms beats one repeating a
   single term.
4. A term in the note title adds 4, in the folder adds 2, in the tags adds 2.

## Config

Copy `.env.example` to `.env` and fill in your own values. The search API
works without any of them; they are for the Supabase-backed version.

- `SUPABASE_URL`, `SUPABASE_ANON_KEY` — your Supabase project.
- `SUPABASE_SERVICE_ROLE_KEY` — server-side admin work only. Keep it
  secret; never put it in the frontend or commit it.
- `PORT` — local port (default 8000).
- `ALLOWED_ORIGINS` — comma-separated frontend origins allowed to call the
  API (default: `http://localhost:3000` and the GitHub Pages site).

## Database

`supabase/migrations/001_initial_schema.sql` creates the tables the app
needs — profiles, lectures, assignments, mess_menus, mess_status, links,
notes, settings — mirroring `src/lib/types.ts`, one row per user, with Row
Level Security on every table so a student can only touch their own rows.

Apply it in the Supabase dashboard (SQL Editor → paste → Run) or with the
Supabase CLI (`supabase db push`). The SQL is idempotent — safe to run twice.

## Tests

```bash
python3 test_search.py   # no extra packages needed
```

Checks the ranking rules: title/tag boosts, distinct-term bonus, stopword
queries returning nothing, snippet windows, and the `top_k` limit.

## What's next (not in v1)

- Read notes from Supabase by user id instead of the request body, with the
  student's Supabase Auth token on the request.
- Feed the top passages to an LLM (Groq/OpenAI) for grounded answers — key
  stays server-side only, never `NEXT_PUBLIC_`.
- Sync endpoints for lectures, assignments, mess and settings so the
  frontend can move off localStorage.
