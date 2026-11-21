// Notes — upload or paste study notes, then ask questions and get the most
// relevant passages back (extractive search over your own notes).
//
// Frontend phase: text files (.txt / .md) and pasted text work fully. PDF
// parsing needs the server-side step, which lands with the backend commit —
// until then, copy the text out of a PDF and paste it here.

"use client";

import { useMemo, useRef, useState } from "react";
import { RequireAuth } from "@/components/Shell";
import { useData } from "@/lib/store";
import { Badge, Card, CardHeader, DangerButton, EmptyState, Field, Notice, PrimaryButton, SecondaryButton, TextInput } from "@/components/ui";

interface Passage {
  noteTitle: string;
  text: string;
  score: number;
}

const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "of", "to", "in", "on", "is", "are", "was", "were", "it", "its",
  "for", "with", "by", "as", "at", "from", "that", "this", "these", "those", "be", "been", "has",
  "have", "had", "do", "does", "did", "will", "would", "can", "could", "should", "i", "you", "we",
  "they", "he", "she", "not", "but", "if", "then", "than", "so", "such", "into", "about", "over",
  "after", "before", "between", "under", "again", "once", "when", "where", "which", "who", "whom",
  "what", "how", "why", "all", "any", "both", "each", "few", "more", "most", "other", "some", "no",
  "nor", "only", "own", "same", "too", "very", "just", "also",
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 2 && !STOPWORDS.has(t));
}

function chunkText(text: string, size = 600): string[] {
  const sentences = text.replace(/\s+/g, " ").match(/[^.!?]+[.!?]+["']?\s*|[^.!?]+$/g) ?? [text];
  const chunks: string[] = [];
  let current = "";
  for (const s of sentences) {
    const sentence = s.trim();
    if (!sentence) continue;
    if ((current + " " + sentence).length > size && current) {
      chunks.push(current.trim());
      current = sentence;
    } else {
      current = current ? `${current} ${sentence}` : sentence;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

function searchNotes(notes: { title: string; content: string }[], query: string, topK = 3): Passage[] {
  const terms = tokenize(query);
  if (terms.length === 0) return [];
  const results: Passage[] = [];
  for (const note of notes) {
    for (const chunk of chunkText(note.content)) {
      const lower = chunk.toLowerCase();
      let score = 0;
      for (const term of terms) {
        let idx = 0;
        while ((idx = lower.indexOf(term, idx)) !== -1) {
          score += 1;
          idx += term.length;
        }
      }
      if (score > 0) results.push({ noteTitle: note.title, text: chunk, score });
    }
  }
  return results.sort((a, b) => b.score - a.score).slice(0, topK);
}

function HighlightedText({ text, terms }: { text: string; terms: string[] }) {
  if (terms.length === 0) return <>{text}</>;
  const pattern = new RegExp(`(${terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "gi");
  const parts = text.split(pattern);
  return (
    <>
      {parts.map((part, i) =>
        terms.some((t) => t.toLowerCase() === part.toLowerCase()) ? (
          <mark key={i} className="rounded-sm bg-yellow-200 px-0.5">
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}

export default function NotesPage() {
  return (
    <RequireAuth>
      <Notes />
    </RequireAuth>
  );
}

function Notes() {
  const { state, addNote, deleteNote } = useData();
  const [title, setTitle] = useState("");
  const [pasted, setPasted] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Passage[] | null>(null);
  const [searched, setSearched] = useState(false);
  const [uploadMsg, setUploadMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const queryTerms = useMemo(() => tokenize(query), [query]);

  function addFromText(text: string, name: string) {
    const clean = text.trim();
    if (!clean) return;
    addNote(title.trim() || name, clean);
    setTitle("");
    setPasted("");
    setShowAdd(false);
    setUploadMsg(`Added “${title.trim() || name}” (${clean.length.toLocaleString()} characters).`);
  }

  async function handleFile(file: File) {
    const lower = file.name.toLowerCase();
    if (lower.endsWith(".pdf")) {
      setUploadMsg(
        "PDF parsing needs the server step, which is not in this frontend build yet. Open the PDF, copy its text, and paste it below — or wait for the backend commit."
      );
      return;
    }
    const text = await file.text();
    addFromText(text, file.name.replace(/\.[^.]+$/, ""));
  }

  function ask() {
    if (!query.trim()) return;
    setResults(searchNotes(state.notes, query));
    setSearched(true);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Notes</h1>
          <p className="mt-1 text-sm text-slate-500">
            Upload your notes, then ask questions and get the most relevant passages back.
          </p>
        </div>
        <PrimaryButton onClick={() => setShowAdd((v) => !v)}>{showFormLabel(showAdd)}</PrimaryButton>
      </div>

      {uploadMsg ? <Notice tone="blue">{uploadMsg}</Notice> : null}

      {showAdd ? (
        <Card>
          <div className="space-y-4 px-5 py-4">
            <Field label="Note title">
              <TextInput value={title} placeholder="e.g. PDC — MPI Basics" onChange={(e) => setTitle(e.target.value)} />
            </Field>
            <div>
              <span className="mb-1 block text-sm font-medium text-slate-700">Upload a text file</span>
              <div className="flex items-center gap-2">
                <input
                  ref={fileRef}
                  type="file"
                  accept=".txt,.md,.pdf"
                  className="text-sm text-slate-600"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void handleFile(f);
                    e.target.value = "";
                  }}
                />
                <span className="text-xs text-slate-500">.txt / .md work now. PDF text can be pasted below.</span>
              </div>
            </div>
            <div>
              <span className="mb-1 block text-sm font-medium text-slate-700">Or paste text</span>
              <textarea
                value={pasted}
                onChange={(e) => setPasted(e.target.value)}
                rows={6}
                placeholder="Paste your notes here…"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
              />
            </div>
            <div className="flex justify-end gap-2">
              <SecondaryButton onClick={() => setShowAdd(false)}>Cancel</SecondaryButton>
              <PrimaryButton onClick={() => addFromText(pasted, "Untitled note")} disabled={!pasted.trim()}>
                Save note
              </PrimaryButton>
            </div>
          </div>
        </Card>
      ) : null}

      <Card>
        <CardHeader title="Ask your notes" subtitle="Extractive search — the most relevant passages from your own notes" />
        <div className="space-y-3 px-5 py-4">
          <div className="flex gap-2">
            <TextInput
              value={query}
              placeholder="e.g. What causes deadlock in MPI?"
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") ask();
              }}
            />
            <PrimaryButton onClick={ask} disabled={!query.trim() || state.notes.length === 0}>
              Ask
            </PrimaryButton>
          </div>
          {searched && results !== null ? (
            results.length === 0 ? (
              <p className="text-sm text-slate-500">
                No matching passages found. Try different words, or add more notes.
              </p>
            ) : (
              <ul className="space-y-3">
                {results.map((r, i) => (
                  <li key={i} className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3">
                    <p className="mb-1 text-xs font-medium text-blue-700">{r.noteTitle}</p>
                    <p className="text-sm leading-relaxed text-slate-700">
                      <HighlightedText text={r.text} terms={queryTerms} />
                    </p>
                  </li>
                ))}
              </ul>
            )
          ) : null}
          <p className="text-xs text-slate-500">
            Answers are passages from your notes, not generated text. A generative answer step (Groq/OpenAI)
            can be plugged in later — see the README.
          </p>
        </div>
      </Card>

      <Card>
        <CardHeader title="Your notes" subtitle={`${state.notes.length} note${state.notes.length === 1 ? "" : "s"}`} />
        {state.notes.length === 0 ? (
          <EmptyState title="No notes yet" text="Upload a .txt/.md file or paste text to add your first note." />
        ) : (
          <ul className="divide-y divide-slate-100">
            {state.notes.map((n) => (
              <li key={n.id} className="flex items-start justify-between gap-4 px-5 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-900">{n.title}</p>
                  <p className="truncate text-sm text-slate-500">{n.content.slice(0, 160)}…</p>
                  <p className="mt-0.5 text-xs text-slate-400">{n.content.length.toLocaleString()} characters</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone="slate">{n.content.split(/\s+/).length.toLocaleString()} words</Badge>
                  <DangerButton onClick={() => deleteNote(n.id)}>Delete</DangerButton>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function showFormLabel(showAdd: boolean): string {
  return showAdd ? "Close form" : "Add note";
}
