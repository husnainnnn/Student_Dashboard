// Notes — upload or paste study notes, then ask questions and get the most
// relevant passages back (extractive search over your own notes).
//
// PDF files are read in the browser with pdf.js (see src/lib/pdf-extract.ts),
// so no server step is needed. Notes can be organised into folders with tags,
// and each note can be exported as a Markdown file.

"use client";

import { useMemo, useRef, useState } from "react";
import { RequireAuth } from "@/components/Shell";
import { useData } from "@/lib/store";
import { extractPdfText } from "@/lib/pdf-extract";
import type { Note } from "@/lib/types";
import { Badge, Card, CardHeader, DangerButton, EmptyState, Field, Notice, PrimaryButton, SecondaryButton, Select, TextInput } from "@/components/ui";

interface Passage {
  noteTitle: string;
  noteFolder?: string;
  noteTags?: string[];
  text: string;
  snippet: string;
  score: number;
  matchedTerms: number;
  totalTerms: number;
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

/** A short window around the first search hit, so the result reads as a snippet. */
function makeSnippet(chunk: string, terms: string[]): string {
  const lower = chunk.toLowerCase();
  let first = -1;
  for (const term of terms) {
    const idx = lower.indexOf(term);
    if (idx !== -1 && (first === -1 || idx < first)) first = idx;
  }
  if (first === -1) return chunk.slice(0, 280);
  const start = Math.max(0, first - 120);
  const end = Math.min(chunk.length, first + 220);
  const prefix = start > 0 ? "…" : "";
  const suffix = end < chunk.length ? "…" : "";
  return `${prefix}${chunk.slice(start, end).trim()}${suffix}`;
}

function searchNotes(notes: Note[], query: string, topK = 5): Passage[] {
  const terms = tokenize(query);
  if (terms.length === 0) return [];
  const results: Passage[] = [];
  for (const note of notes) {
    for (const chunk of chunkText(note.content)) {
      const lower = chunk.toLowerCase();
      let score = 0;
      const matched = new Set<string>();
      for (const term of terms) {
        let idx = 0;
        let hits = 0;
        while ((idx = lower.indexOf(term, idx)) !== -1) {
          hits += 1;
          idx += term.length;
        }
        if (hits > 0) {
          matched.add(term);
          score += hits;
        }
      }
      // A passage matching more distinct terms ranks above one repeating a single term.
      if (score > 0) {
        results.push({
          noteTitle: note.title,
          noteFolder: note.folder,
          noteTags: note.tags,
          text: chunk,
          snippet: makeSnippet(chunk, terms),
          score: score + matched.size * 3,
          matchedTerms: matched.size,
          totalTerms: terms.length,
        });
      }
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

function parseTags(raw: string): string[] {
  const seen = new Set<string>();
  const tags: string[] = [];
  for (const part of raw.split(",")) {
    const tag = part.trim();
    if (!tag) continue;
    const key = tag.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      tags.push(tag);
    }
  }
  return tags;
}

function downloadFile(filename: string, text: string) {
  const blob = new Blob([text], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function noteToMarkdown(note: Note): string {
  const lines = [`# ${note.title}`, ""];
  if (note.folder) lines.push(`Folder: ${note.folder}`);
  if (note.tags?.length) lines.push(`Tags: ${note.tags.join(", ")}`);
  if (note.folder || note.tags?.length) lines.push("");
  lines.push(note.content);
  return lines.join("\n");
}

function safeFilename(title: string): string {
  const clean = title.replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "-") || "note";
  return `${clean}.md`;
}

export default function NotesPage() {
  return (
    <RequireAuth>
      <Notes />
    </RequireAuth>
  );
}

function Notes() {
  const { state, addNote, updateNote, deleteNote } = useData();
  const [title, setTitle] = useState("");
  const [folder, setFolder] = useState("");
  const [tagsRaw, setTagsRaw] = useState("");
  const [pasted, setPasted] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Passage[] | null>(null);
  const [searched, setSearched] = useState(false);
  const [uploadMsg, setUploadMsg] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [folderFilter, setFolderFilter] = useState("All");
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editFolder, setEditFolder] = useState("");
  const [editTags, setEditTags] = useState("");
  const [editContent, setEditContent] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const queryTerms = useMemo(() => tokenize(query), [query]);

  const folders = useMemo(() => {
    const set = new Set<string>();
    for (const n of state.notes) if (n.folder) set.add(n.folder);
    return [...set].sort();
  }, [state.notes]);

  const allTags = useMemo(() => {
    const set = new Set<string>();
    for (const n of state.notes) (n.tags ?? []).forEach((t) => set.add(t));
    return [...set].sort();
  }, [state.notes]);

  const visibleNotes = useMemo(
    () =>
      state.notes.filter(
        (n) =>
          (folderFilter === "All" || (n.folder ?? "") === folderFilter) &&
          (!tagFilter || (n.tags ?? []).some((t) => t.toLowerCase() === tagFilter.toLowerCase()))
      ),
    [state.notes, folderFilter, tagFilter]
  );

  function resetAddForm() {
    setTitle("");
    setFolder("");
    setTagsRaw("");
    setPasted("");
    setShowAdd(false);
  }

  function addFromText(text: string, name: string) {
    const clean = text.trim();
    if (!clean) return;
    addNote(title.trim() || name, clean, {
      folder: folder.trim() || undefined,
      tags: parseTags(tagsRaw),
    });
    resetAddForm();
    setUploadMsg(`Added “${title.trim() || name}” (${clean.length.toLocaleString()} characters).`);
  }

  async function handleFile(file: File) {
    const lower = file.name.toLowerCase();
    setUploading(true);
    setUploadMsg(null);
    try {
      if (lower.endsWith(".pdf")) {
        const { pages, text } = await extractPdfText(await file.arrayBuffer());
        if (!text.trim()) {
          setUploadMsg(`“${file.name}” has no readable text (scanned image PDFs cannot be read). Copy the text out and paste it below instead.`);
          return;
        }
        addFromText(text, file.name.replace(/\.pdf$/i, ""));
        setUploadMsg(`Added “${file.name.replace(/\.pdf$/i, "")}” from PDF — ${pages} page${pages === 1 ? "" : "s"}, ${text.length.toLocaleString()} characters.`);
        return;
      }
      const text = await file.text();
      addFromText(text, file.name.replace(/\.[^.]+$/, ""));
    } catch {
      setUploadMsg(`Could not read “${file.name}”. Try a .txt / .md file, or paste the text below.`);
    } finally {
      setUploading(false);
    }
  }

  function ask() {
    if (!query.trim()) return;
    setResults(searchNotes(state.notes, query));
    setSearched(true);
  }

  function startEdit(note: Note) {
    setEditingId(note.id);
    setEditTitle(note.title);
    setEditFolder(note.folder ?? "");
    setEditTags((note.tags ?? []).join(", "));
    setEditContent(note.content);
  }

  function saveEdit() {
    if (!editingId || !editTitle.trim() || !editContent.trim()) return;
    updateNote(editingId, {
      title: editTitle.trim(),
      folder: editFolder.trim() || undefined,
      tags: parseTags(editTags),
      content: editContent.trim(),
    });
    setEditingId(null);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Notes</h1>
          <p className="mt-1 text-sm text-slate-500">
            Upload your notes, then ask questions and get the most relevant passages back.
          </p>
        </div>
        <PrimaryButton onClick={() => setShowAdd((v) => !v)}>{showAdd ? "Close form" : "Add note"}</PrimaryButton>
      </div>

      {uploadMsg ? <Notice tone="blue">{uploadMsg}</Notice> : null}

      {showAdd ? (
        <Card>
          <div className="space-y-4 px-5 py-4">
            <Field label="Note title">
              <TextInput value={title} placeholder="e.g. PDC — MPI Basics" onChange={(e) => setTitle(e.target.value)} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Folder" hint="Optional — e.g. PDC, Data Science">
                <TextInput
                  value={folder}
                  placeholder="e.g. PDC"
                  list="note-folders"
                  onChange={(e) => setFolder(e.target.value)}
                />
                <datalist id="note-folders">
                  {folders.map((f) => (
                    <option key={f} value={f} />
                  ))}
                </datalist>
              </Field>
              <Field label="Tags" hint="Optional — comma separated, e.g. MPI, deadlock">
                <TextInput value={tagsRaw} placeholder="e.g. MPI, deadlock" onChange={(e) => setTagsRaw(e.target.value)} />
              </Field>
            </div>
            <div>
              <span className="mb-1 block text-sm font-medium text-slate-700">Upload a file</span>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  ref={fileRef}
                  type="file"
                  accept=".txt,.md,.pdf"
                  disabled={uploading}
                  className="w-full min-w-0 text-sm text-slate-600 sm:w-auto"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void handleFile(f);
                    e.target.value = "";
                  }}
                />
                <span className="text-xs text-slate-500">
                  {uploading ? "Reading file…" : ".txt / .md / .pdf — PDF text is read in your browser."}
                </span>
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
                    <p className="mb-1 text-xs font-medium text-blue-700">
                      {r.noteTitle}
                      {r.noteFolder ? ` — ${r.noteFolder}` : ""}
                      <span className="font-normal text-slate-400">
                        {" "}· matched {r.matchedTerms} of {r.totalTerms} word{r.totalTerms === 1 ? "" : "s"}
                      </span>
                    </p>
                    <p className="text-sm leading-relaxed text-slate-700">
                      <HighlightedText text={r.snippet} terms={queryTerms} />
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
        <CardHeader
          title="Your notes"
          subtitle={`${visibleNotes.length} of ${state.notes.length} note${state.notes.length === 1 ? "" : "s"}`}
          action={
            <SecondaryButton
              onClick={() =>
                downloadFile(
                  "all-notes.md",
                  visibleNotes.map(noteToMarkdown).join("\n\n---\n\n")
                )
              }
              disabled={visibleNotes.length === 0}
            >
              Export all
            </SecondaryButton>
          }
        />
        {state.notes.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-5 py-3">
            <Select value={folderFilter} onChange={(e) => setFolderFilter(e.target.value)} className="w-auto">
              <option value="All">All folders</option>
              {folders.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </Select>
            {allTags.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTagFilter((v) => (v === t ? null : t))}
                className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                  tagFilter === t
                    ? "border-blue-600 bg-blue-600 text-white"
                    : "border-slate-300 bg-white text-slate-600 hover:border-blue-600 hover:text-blue-700"
                }`}
              >
                {t}
              </button>
            ))}
            {tagFilter ? (
              <button type="button" onClick={() => setTagFilter(null)} className="text-xs font-medium text-blue-700 hover:underline">
                Clear tag filter
              </button>
            ) : null}
          </div>
        ) : null}
        {state.notes.length === 0 ? (
          <EmptyState title="No notes yet" text="Upload a .txt/.md/.pdf file or paste text to add your first note." />
        ) : visibleNotes.length === 0 ? (
          <EmptyState title="No notes in this folder" text="Try another folder or clear the tag filter." />
        ) : (
          <ul className="divide-y divide-slate-100">
            {visibleNotes.map((n) => (
              <li key={n.id} className="flex flex-wrap items-start justify-between gap-3 px-5 py-3">
                {editingId === n.id ? (
                  <div className="w-full space-y-3">
                    <Field label="Title">
                      <TextInput value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
                    </Field>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field label="Folder">
                        <TextInput value={editFolder} onChange={(e) => setEditFolder(e.target.value)} />
                      </Field>
                      <Field label="Tags (comma separated)">
                        <TextInput value={editTags} onChange={(e) => setEditTags(e.target.value)} />
                      </Field>
                    </div>
                    <Field label="Content">
                      <textarea
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        rows={6}
                        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
                      />
                    </Field>
                    <div className="flex justify-end gap-2">
                      <SecondaryButton onClick={() => setEditingId(null)}>Cancel</SecondaryButton>
                      <PrimaryButton onClick={saveEdit} disabled={!editTitle.trim() || !editContent.trim()}>
                        Save changes
                      </PrimaryButton>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-900">{n.title}</p>
                      <p className="truncate text-sm text-slate-500">{n.content.slice(0, 160)}…</p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        {n.folder ? <Badge tone="blue">{n.folder}</Badge> : null}
                        {(n.tags ?? []).map((t) => (
                          <button key={t} type="button" onClick={() => setTagFilter(t)} title="Filter by this tag">
                            <Badge tone="slate">{t}</Badge>
                          </button>
                        ))}
                        <span className="text-xs text-slate-400">
                          {n.content.length.toLocaleString()} characters · {n.content.split(/\s+/).length.toLocaleString()} words
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <SecondaryButton onClick={() => downloadFile(safeFilename(n.title), noteToMarkdown(n))}>
                        Export
                      </SecondaryButton>
                      <SecondaryButton onClick={() => startEdit(n)}>Edit</SecondaryButton>
                      <DangerButton onClick={() => deleteNote(n.id)}>Delete</DangerButton>
                    </div>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
