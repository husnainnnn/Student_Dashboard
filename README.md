# Student Dashboard

A dashboard for university students: timetable, assignments, hostel mess, notes
you can ask questions about, and reminders that follow your own rules.

Repository: **https://github.com/husnainnnn/Student_Dashboard**

Built with Next.js (App Router) + TypeScript + Tailwind CSS. Any student can
download it, sign up, and use it with their own data — the seed data below is
demo data only.

## What it does

- **Today** — today's lectures with a next-class countdown, today's mess status,
  assignments due soon, active reminders, quick links.
- **Timetable** — full week grid, editable. Upload a timetable file (CSV,
  JSON, text or PDF) or paste timetable text instead of typing every lecture:
  a preview shows parsed lectures, flags bad rows, and lets you fix or skip
  them before replacing or merging. Download the current timetable as CSV.
  A blank CSV template is at `public/timetable-template.csv`.
- **Assignments** — due dates, due-soon highlight, pending / submitted / missing.
- **Mess** — weekly menu, today's breakfast/lunch/dinner booking status, mess
  form link.
- **Notes** — upload `.txt` / `.md` notes or paste text, then ask questions and
  get the most relevant passages back from your own notes (extractive search).
- **Reminders** — a reminder center driven by your own settings: lecture
  reminders N minutes before class (changeable per lecture, or off per
  lecture), assignment reminders a chosen number of hours before the due day
  ends (changeable per assignment), quiet hours that hold reminders until
  they end, and browser notifications scheduled at each reminder's exact
  fire time while the app is open.
- **Onboarding** — after signup/login, a step-by-step wizard collects your
  timetable, mess menu, important links, and reminder rules. Skippable: skipping
  fills in demo data you can replace from Settings. The timetable step also
  offers the file upload, so a new student can import instead of typing.
- **Settings** — edit everything from onboarding any time, load demo data, or
  clear your data.

## Quick start (demo mode — no setup)

```bash
git clone https://github.com/husnainnnn/Student_Dashboard.git
cd Student_Dashboard
npm install
npm run dev
```

Open http://localhost:3000, sign up with any name (demo mode), and either run
the setup wizard or skip it to explore with demo data.

In demo mode there is no server and no account: your data stays in your
browser (localStorage). That is deliberate — any student can run it immediately.

## Connect Supabase (real accounts + sync)

1. Create a free project at https://supabase.com (or use an existing one).
2. In the Supabase SQL editor, run `backend/supabase/migrations/001_initial_schema.sql` from this repo. It
   creates the tables (profiles, lectures, assignments, mess_menus, mess_status, links,
   notes, settings) with row-level security so each user only sees their
   own rows.
3. In Supabase → Authentication → Providers, make sure Email is enabled.
4. Copy `.env.example` to `.env.local` and fill in your project values:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
5. Restart `npm run dev` and sign up with a real email + password.

With Supabase configured, signup/login use real Supabase Auth and data syncs
to your project. Without the env vars, the app silently falls back to demo
mode — it never breaks because a backend is missing.

## Backend (FastAPI)

`backend/` holds a small FastAPI service — see `backend/README.md` for the
full guide. v1 does one thing: **server-side notes search (RAG-lite)**.
`POST /api/notes/search` takes a question plus the notes to search and
returns the most relevant passages with snippets, ranked the same way as
the in-browser search (title, folder and tag hits count extra). There is
no LLM and no embeddings key involved yet — the endpoint returns exactly
the passages a future answer step would ground itself in.

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000   # docs at http://localhost:8000/docs
python3 test_search.py                  # ranking tests, no extra packages
```

The Supabase schema the API will read from lives in
`backend/supabase/migrations/001_initial_schema.sql` (apply it in the
Supabase SQL editor; it is safe to run twice). The search endpoint works
without a database — notes travel in the request body for now, and reading
them from Supabase by user id is a later step.

## Project structure

```
src/
  app/
    page.tsx            Today dashboard
    timetable/          Week grid + editor
    assignments/        Assignment list + status
    mess/               Weekly menu + today's status
    notes/              Notes upload + ask-your-notes
    reminders/          Reminder center + notifications
    settings/           Edit everything, data management
    onboarding/         Setup wizard (timetable, mess, links, rules)
    login/ signup/      Auth pages
  components/
    Nav.tsx             Top navigation
    Shell.tsx           Providers + auth/onboarding gate
    ui.tsx              Shared buttons, inputs, cards, badges
    editors.tsx         Timetable / mess menu / links / preferences editors
    TimetableUpload.tsx Timetable file upload + preview + CSV export
  lib/
    types.ts            Shared types + default settings
    demo-data.ts        DEMO seed data (BCS-7E timetable etc.) — replaceable
    dates.ts            Date/time helpers
    paths.ts            Deployed base path (GitHub Pages) for static files
    timetable-import.ts CSV/JSON/text/PDF timetable parsing + CSV export
    pdf-extract.ts      In-browser PDF text extraction (pdfjs-dist)
    reminders.ts        Reminder computation from data + settings
    notify.ts           Browser notification scheduling + fired/dismissed state
    supabase.ts         Supabase client + configured check
    auth.tsx            Auth provider (Supabase Auth or local demo profile)
    store.tsx           Per-user data store (localStorage + Supabase sync)
supabase/
  schema.sql            Tables + RLS policies (run once, see above)
```

## What is real vs placeholder

- **Real:** timetable, assignments, mess menu, links, reminder rules, notes and
  search all work end to end in demo mode (localStorage) and in Supabase mode.
  Timetable import from CSV, JSON, text and PDF also works in the browser
  (pdfjs-dist; its worker file is vendored at `public/pdf.worker.min.mjs` —
  copy it again from the package if pdfjs-dist is ever upgraded).
- **Demo data:** the seed timetable is a real BCS-7E timetable and the seed
  assignments are real assignments, but they are only the demo seed. Any student
  replaces them during onboarding or from Settings. The weekly mess menu is a
  placeholder — edit it to match your hostel.
- **Placeholder:** PDF text extraction for Notes. Text files and pasted text work
  now; PDF parsing needs a server step and lands with the backend commit. Until
  then the Notes page tells you to paste the PDF text. (Timetable PDFs are
  different — those are read in the browser, see above.)
- **Not built yet:** Google Classroom API sync (assignments are manual for now),
  generative answers for Notes (currently extractive passages only — see below),
  and push/email reminders when the app is closed.

## Plugging in an LLM for Notes (later)

The Notes search is extractive: it finds the most relevant passages in your
notes and shows them. To add generative answers:

1. Add an API route (e.g. `src/app/api/ask/route.ts`) that receives the
   question, runs the same passage search, and sends the top passages plus the
   question to an LLM (Groq and OpenAI both work; Groq is free to start).
2. Keep the key server-side only (`GROQ_API_KEY` in `.env.local`, never
   `NEXT_PUBLIC_`).
3. Return the generated answer plus the passages it was based on, so the
   answer stays grounded in the student's own notes.

## Plugging in Google Classroom (later)

Assignments are manual today. To sync them automatically:

1. Enable the Google Classroom API in Google Cloud and create OAuth
   credentials for the app.
2. Add a server route that exchanges the OAuth code, lists courses and
   coursework via the Classroom API, and upserts rows into the `assignments`
   table with the student's `user_id`.
3. Add a "Connect Classroom" button in Settings that starts the OAuth flow.

## Reminders v2

The reminder center works while the app is open (in-app list + browser
notifications scheduled at each reminder's exact fire time, with per-lecture
and per-assignment rules and quiet-hours holding). Reminders that must reach a student when the app is closed
(push notifications or email) need a small backend or a scheduled job that
checks due lectures/assignments and sends them — for example a Vercel Cron Job
or a Supabase Edge Function. That is a planned v2 step, not in this frontend.

## Scripts

```bash
npm run dev     # start the dev server on http://localhost:3000
npm run build   # production build (also runs the type checker)
npm run start   # serve the production build
npm run lint    # eslint
```

## Deploy

The easiest free deploy is Vercel: import `husnainnnn/Student_Dashboard` and
deploy. Add the two `NEXT_PUBLIC_SUPABASE_*` env vars in Vercel if you want
real accounts; without them the deployed app still works in demo mode.
