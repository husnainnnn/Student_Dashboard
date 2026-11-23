// Assignments import — import assignments from a file (CSV, JSON or text)
// or paste them, preview the parsed rows, fix or skip bad rows, then add
// them to the list or replace the whole list. Used by the Assignments page.
// Plain white/blue styling, same as the rest of the app.

"use client";

import { useRef, useState, Fragment } from "react";
import type { Assignment, AssignmentStatus } from "@/lib/types";
import { uid } from "@/lib/store";
import { appBasePath } from "@/lib/paths";
import {
  appendAssignments,
  parseAssignmentsFile,
  parseAssignmentsPlainText,
  parseDueDate,
  parseStatus,
  replaceAssignments,
  validRowsToAssignments,
  type ParsedAssignmentRow,
} from "@/lib/assignments-import";
import { Badge, Card, CardHeader, DangerButton, Notice, PrimaryButton, SecondaryButton, Select, TextInput } from "./ui";

const ACCEPTED = ".csv,.json,.txt,.md";

const STATUS_OPTIONS: AssignmentStatus[] = ["pending", "submitted", "missing"];

function revalidate(row: ParsedAssignmentRow): ParsedAssignmentRow {
  // A null due date means "no due date" unless the row already carries an
  // invalid-date error (set by updateDue) — carry that error forward so
  // editing the course or title does not silently clear it.
  const errors: string[] = [];
  if (!row.course.trim()) errors.push("Missing course");
  if (!row.title.trim()) errors.push("Missing title");
  const dueError = row.errors.find((e) => e.startsWith("Invalid due date"));
  if (dueError) errors.push(dueError);
  return { ...row, errors, skipped: errors.length > 0 ? row.skipped : false };
}

export function AssignmentImport({
  assignments,
  onChange,
}: {
  assignments: Assignment[];
  onChange: (next: Assignment[]) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [fatalError, setFatalError] = useState<string | null>(null);
  const [sourceName, setSourceName] = useState("");
  const [rows, setRows] = useState<ParsedAssignmentRow[] | null>(null);
  const [showPaste, setShowPaste] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [notice, setNotice] = useState<string | null>(null);

  const validCount = rows?.filter((r) => !r.skipped && r.errors.length === 0).length ?? 0;
  const errorCount = rows?.filter((r) => r.errors.length > 0).length ?? 0;

  function startPreview(resultRows: ParsedAssignmentRow[], fatal: string | null, name: string) {
    setFatalError(fatal);
    setSourceName(name);
    setRows(fatal ? null : resultRows);
    setNotice(null);
    setParsing(false);
  }

  async function handleFile(file: File) {
    setParsing(true);
    setFatalError(null);
    setNotice(null);
    try {
      const text = await file.text();
      const result = parseAssignmentsFile(file.name, text);
      startPreview(result.rows, result.fatalError, file.name);
    } catch {
      startPreview([], "Could not read this file. Try another file, or paste the assignments as text.", file.name);
    }
  }

  function handlePaste() {
    const result = parseAssignmentsPlainText(pasteText);
    startPreview(result.rows, result.fatalError, "Pasted text");
  }

  function updateRow(index: number, patch: Partial<ParsedAssignmentRow>) {
    setRows((prev) => {
      if (!prev) return prev;
      const next = [...prev];
      next[index] = revalidate({ ...next[index], ...patch });
      return next;
    });
  }

  function updateDue(index: number, raw: string) {
    // The date input gives YYYY-MM-DD; an empty value means no due date.
    setRows((prev) => {
      if (!prev) return prev;
      const next = [...prev];
      const row = { ...next[index] };
      if (raw.trim() === "") {
        row.due = null;
        row.errors = row.errors.filter((e) => !e.startsWith("Invalid due date"));
      } else {
        const parsed = parseDueDate(raw);
        row.due = parsed;
        row.errors = row.errors.filter((e) => !e.startsWith("Invalid due date"));
        if (parsed === null) row.errors.push(`Invalid due date "${raw.trim()}"`);
      }
      row.skipped = row.errors.length > 0 ? row.skipped : false;
      next[index] = row;
      return next;
    });
  }

  function toggleSkip(index: number) {
    setRows((prev) => {
      if (!prev) return prev;
      const next = [...prev];
      next[index] = { ...next[index], skipped: !next[index].skipped };
      return next;
    });
  }

  function apply(mode: "add" | "replace") {
    if (!rows) return;
    const incoming = validRowsToAssignments(rows);
    if (mode === "add") {
      const { merged, added, duplicates } = appendAssignments(assignments, incoming, uid);
      onChange(merged);
      setNotice(
        duplicates === 0
          ? `Added ${added} assignment${added === 1 ? "" : "s"} to your list.`
          : `Added ${added} assignment${added === 1 ? "" : "s"} — ${duplicates} duplicate${duplicates === 1 ? "" : "s"} skipped.`
      );
    } else {
      const { replaced, duplicates } = replaceAssignments(incoming, uid);
      onChange(replaced);
      setNotice(
        duplicates === 0
          ? `List replaced — ${replaced.length} assignment${replaced.length === 1 ? "" : "s"} now in your list.`
          : `List replaced — ${replaced.length} assignment${replaced.length === 1 ? "" : "s"} (${duplicates} duplicate${duplicates === 1 ? "" : "s"} removed).`
      );
    }
    setRows(null);
    setPasteText("");
    setShowPaste(false);
  }

  return (
    <Card>
      <CardHeader
        title="Bulk import"
        subtitle="Import assignments from a file instead of typing them one by one. CSV, JSON or text."
      />
      <div className="space-y-4 px-5 py-4">
        <div
          className={`rounded-md border-2 border-dashed px-4 py-6 text-center ${
            dragOver ? "border-blue-600 bg-blue-50" : "border-slate-300 bg-white"
          }`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            const file = e.dataTransfer.files?.[0];
            if (file) void handleFile(file);
          }}
        >
          <p className="text-sm font-medium text-slate-800">Drop your assignments file here</p>
          <p className="mt-1 text-sm text-slate-500">or choose a file from your computer.</p>
          <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
            <SecondaryButton type="button" onClick={() => fileRef.current?.click()} disabled={parsing}>
              {parsing ? "Reading file…" : "Choose a file"}
            </SecondaryButton>
            <SecondaryButton type="button" onClick={() => setShowPaste((v) => !v)}>
              Paste assignment text
            </SecondaryButton>
            <a
              href={`${appBasePath()}/assignments-template.csv`}
              download="assignments-template.csv"
              className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-blue-700 hover:bg-slate-50"
            >
              Download template
            </a>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept={ACCEPTED}
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleFile(file);
              e.target.value = "";
            }}
          />
          <p className="mt-3 text-xs text-slate-500">
            Accepted: .csv, .json, .txt, .md. CSV columns: course, title, due, status. Due date can be
            2026-11-26, 26/11/2026 or 26 Nov 2026 — leave it empty for no due date. Status can be pending,
            submitted or missing.
          </p>
        </div>

        {showPaste ? (
          <div className="space-y-2">
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Paste assignment text</span>
              <textarea
                rows={6}
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                placeholder={"Compiler Construction,CC Assignment 5,2026-11-26,pending\nData Science,DS CP IV,2026-11-19,missing"}
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
              />
              <span className="mt-1 block text-xs text-slate-500">
                One assignment per line, same columns as the CSV. A header row is optional.
              </span>
            </label>
            <div className="flex gap-2">
              <PrimaryButton type="button" onClick={handlePaste} disabled={!pasteText.trim()}>
                Parse pasted text
              </PrimaryButton>
              <SecondaryButton type="button" onClick={() => setShowPaste(false)}>
                Close
              </SecondaryButton>
            </div>
          </div>
        ) : null}

        {fatalError ? <Notice tone="amber">{fatalError}</Notice> : null}
        {notice ? <Notice tone="green">{notice}</Notice> : null}

        {rows ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-medium text-slate-800">
                {sourceName ? `Found in ${sourceName}: ` : ""}{validCount} of {rows.length} assignment
                {rows.length === 1 ? "" : "s"} ready to import
              </p>
              {errorCount > 0 ? <Badge tone="amber">{errorCount} row{errorCount === 1 ? "" : "s"} need{errorCount === 1 ? "s" : ""} attention</Badge> : null}
            </div>
            <p className="text-xs text-slate-500">
              Fix a row to include it, or tick Skip to leave it out. Rows with errors are skipped by default.
            </p>
            <div className="overflow-x-auto rounded-md border border-slate-200">
              <table className="w-full min-w-[680px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs text-slate-500">
                    <th className="px-3 py-2 font-medium">Course</th>
                    <th className="px-3 py-2 font-medium">Title</th>
                    <th className="px-3 py-2 font-medium">Due date</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 font-medium">Skip</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => (
                    <Fragment key={row.line}>
                      <tr className={row.errors.length > 0 ? "bg-red-50" : ""}>
                        <td className="px-3 py-2">
                          <TextInput
                            value={row.course}
                            onChange={(e) => updateRow(i, { course: e.target.value })}
                            placeholder="Course"
                            className="min-w-36 px-2 py-1"
                            aria-label="Course"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <TextInput
                            value={row.title}
                            onChange={(e) => updateRow(i, { title: e.target.value })}
                            placeholder="Title"
                            className="min-w-36 px-2 py-1"
                            aria-label="Title"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <TextInput
                            type="date"
                            value={row.due ?? ""}
                            onChange={(e) => updateDue(i, e.target.value)}
                            className="px-2 py-1"
                            aria-label="Due date"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <Select
                            value={row.status}
                            onChange={(e) => {
                              const status = parseStatus(e.target.value) ?? "pending";
                              updateRow(i, { status });
                            }}
                            className="px-2 py-1"
                            aria-label="Status"
                          >
                            {STATUS_OPTIONS.map((s) => (
                              <option key={s} value={s}>
                                {s}
                              </option>
                            ))}
                          </Select>
                        </td>
                        <td className="px-3 py-2 text-center">
                          <input
                            type="checkbox"
                            checked={row.skipped}
                            onChange={() => toggleSkip(i)}
                            className="h-4 w-4 accent-blue-600"
                            aria-label={`Skip row ${i + 1}`}
                          />
                        </td>
                      </tr>
                      {row.errors.length > 0 ? (
                        <tr className="bg-red-50">
                          <td colSpan={5} className="px-3 pb-2 pt-0 text-xs text-red-700">
                            Line {row.line}: {row.errors.join(" · ")}
                            <span className="text-red-500"> — {row.raw}</span>
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap gap-2">
              <PrimaryButton type="button" onClick={() => apply("add")} disabled={validCount === 0}>
                Add to list
              </PrimaryButton>
              <SecondaryButton type="button" onClick={() => apply("replace")} disabled={validCount === 0}>
                Replace list
              </SecondaryButton>
              <DangerButton type="button" onClick={() => setRows(null)}>
                Discard
              </DangerButton>
            </div>
          </div>
        ) : null}
      </div>
    </Card>
  );
}
