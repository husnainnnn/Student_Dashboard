// Timetable upload — import a timetable file (CSV, JSON, text or PDF)
// or paste timetable text, preview the parsed lectures, fix or skip bad
// rows, then replace or merge into the current timetable. Also exports
// the current timetable as CSV. Used by the Timetable page and by the
// onboarding wizard's timetable step. Plain white/blue styling, same as
// the rest of the app.

"use client";

import { useRef, useState, Fragment } from "react";
import { DAY_NAMES } from "@/lib/dates";
import { appBasePath } from "@/lib/paths";
import { uid } from "@/lib/store";
import type { Lecture } from "@/lib/types";
import {
  lecturesToCsv,
  lectureKey,
  mergeLectures,
  parseTime,
  parseTimetableFile,
  parsePlainText,
  validateRow,
  validRowsToLectures,
  type ParsedRow,
} from "@/lib/timetable-import";
import { Badge, Card, CardHeader, DangerButton, Notice, PrimaryButton, SecondaryButton, Select, TextInput } from "./ui";

const ACCEPTED = ".csv,.json,.txt,.md,.pdf";

export function downloadTextFile(filename: string, text: string, mime = "text/plain"): void {
  const blob = new Blob([text], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadLecturesCsv(lectures: Lecture[]): void {
  downloadTextFile("timetable.csv", lecturesToCsv(lectures), "text/csv");
}

function revalidate(row: ParsedRow): ParsedRow {
  const errors = validateRow(row.day, row.start, row.end, row.subject);
  return { ...row, errors, skipped: errors.length > 0 ? row.skipped : false };
}

export function TimetableUpload({
  lectures,
  onChange,
}: {
  lectures: Lecture[];
  onChange: (next: Lecture[]) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [fatalError, setFatalError] = useState<string | null>(null);
  const [sourceName, setSourceName] = useState("");
  const [rows, setRows] = useState<ParsedRow[] | null>(null);
  const [showPaste, setShowPaste] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [notice, setNotice] = useState<string | null>(null);

  const validCount = rows?.filter((r) => !r.skipped && r.errors.length === 0).length ?? 0;
  const errorCount = rows?.filter((r) => r.errors.length > 0).length ?? 0;

  function startPreview(resultRows: ParsedRow[], fatal: string | null, name: string) {
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
      if (file.name.toLowerCase().endsWith(".pdf")) {
        const { extractPdfText } = await import("@/lib/pdf-extract");
        const { parsePdfText } = await import("@/lib/timetable-import");
        const data = await file.arrayBuffer();
        const { pages, text } = await extractPdfText(data);
        const result = parsePdfText(text);
        startPreview(result.rows, result.fatalError, `${file.name} (${pages} page${pages === 1 ? "" : "s"})`);
      } else {
        const text = await file.text();
        const result = parseTimetableFile(file.name, text);
        startPreview(result.rows, result.fatalError, file.name);
      }
    } catch {
      startPreview([], "Could not read this file. Try another file, or paste the timetable as text.", file.name);
    }
  }

  function handlePaste() {
    const result = parsePlainText(pasteText);
    startPreview(result.rows, result.fatalError, "Pasted text");
  }

  function updateRow(index: number, patch: Partial<ParsedRow>) {
    setRows((prev) => {
      if (!prev) return prev;
      const next = [...prev];
      next[index] = revalidate({ ...next[index], ...patch });
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

  function apply(mode: "replace" | "merge") {
    if (!rows) return;
    const incoming = validRowsToLectures(rows);
    if (mode === "replace") {
      onChange(incoming.map((l) => ({ ...l, id: uid() })));
      setNotice(`Timetable replaced — ${incoming.length} lecture${incoming.length === 1 ? "" : "s"} now on your timetable.`);
    } else {
      const { merged, added } = mergeLectures(lectures, incoming);
      const existingIds = new Map(lectures.map((l) => [lectureKey(l), l.id]));
      const next = merged.map((l) => ({ ...l, id: existingIds.get(lectureKey(l)) ?? uid() }));
      onChange(next);
      const skipped = incoming.length - added;
      setNotice(
        `${added} lecture${added === 1 ? "" : "s"} added` +
          (skipped > 0 ? `, ${skipped} duplicate${skipped === 1 ? "" : "s"} skipped` : "") +
          "."
      );
    }
    setRows(null);
    setPasteText("");
    setShowPaste(false);
  }

  return (
    <Card>
      <CardHeader
        title="Upload timetable"
        subtitle="Import a file instead of typing every lecture. CSV, JSON, text or PDF."
        action={
          <SecondaryButton type="button" onClick={() => downloadLecturesCsv(lectures)}>
            Download as CSV
          </SecondaryButton>
        }
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
          <p className="text-sm font-medium text-slate-800">Drop your timetable file here</p>
          <p className="mt-1 text-sm text-slate-500">or choose a file from your computer.</p>
          <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
            <SecondaryButton type="button" onClick={() => fileRef.current?.click()} disabled={parsing}>
              {parsing ? "Reading file…" : "Choose a file"}
            </SecondaryButton>
            <SecondaryButton type="button" onClick={() => setShowPaste((v) => !v)}>
              Paste timetable text
            </SecondaryButton>
            <a
              href={`${appBasePath()}/timetable-template.csv`}
              download="timetable-template.csv"
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
            Accepted: .csv, .json, .txt, .md, .pdf. CSV columns: day, start, end, subject, teacher, room.
            Times can be 24-hour (10:15) or 12-hour (10:15 AM).
          </p>
        </div>

        {showPaste ? (
          <div className="space-y-2">
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Paste timetable text</span>
              <textarea
                rows={6}
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                placeholder={"Monday,10:15,11:40,Data Science,Dr. Rabia,Seminar Hall\nTuesday,08:45,10:10,Parallel and Distributed Computing,Ms. Mahzaib,R-5"}
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
              />
              <span className="mt-1 block text-xs text-slate-500">
                One lecture per line, same columns as the CSV. A header row is optional.
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
                {sourceName ? `Found in ${sourceName}: ` : ""}{validCount} of {rows.length} row
                {rows.length === 1 ? "" : "s"} ready to import
              </p>
              {errorCount > 0 ? <Badge tone="amber">{errorCount} row{errorCount === 1 ? "" : "s"} need{errorCount === 1 ? "s" : ""} attention</Badge> : null}
            </div>
            <p className="text-xs text-slate-500">
              Fix a row to include it, or tick Skip to leave it out. Rows with errors are skipped by default.
            </p>
            <div className="overflow-x-auto rounded-md border border-slate-200">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs text-slate-500">
                    <th className="px-3 py-2 font-medium">Day</th>
                    <th className="px-3 py-2 font-medium">Start</th>
                    <th className="px-3 py-2 font-medium">End</th>
                    <th className="px-3 py-2 font-medium">Subject</th>
                    <th className="px-3 py-2 font-medium">Teacher</th>
                    <th className="px-3 py-2 font-medium">Room</th>
                    <th className="px-3 py-2 font-medium">Skip</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => (
                    <Fragment key={row.line}>
                      <tr className={row.errors.length > 0 ? "bg-red-50" : ""}>
                        <td className="px-3 py-2">
                          <Select
                            value={row.day ?? ""}
                            onChange={(e) => updateRow(i, { day: e.target.value === "" ? null : Number(e.target.value) })}
                            className="px-2 py-1"
                            aria-label="Day"
                          >
                            <option value="">—</option>
                            {DAY_NAMES.map((d, dIdx) => (
                              <option key={d} value={dIdx}>
                                {d}
                              </option>
                            ))}
                          </Select>
                        </td>
                        <td className="px-3 py-2">
                          <TextInput
                            value={row.start}
                            onChange={(e) => updateRow(i, { start: parseTime(e.target.value) ?? e.target.value })}
                            onBlur={(e) => updateRow(i, { start: parseTime(e.target.value) ?? "" })}
                            placeholder="10:15"
                            className="w-24 px-2 py-1"
                            aria-label="Start time"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <TextInput
                            value={row.end}
                            onChange={(e) => updateRow(i, { end: parseTime(e.target.value) ?? e.target.value })}
                            onBlur={(e) => updateRow(i, { end: parseTime(e.target.value) ?? "" })}
                            placeholder="11:40"
                            className="w-24 px-2 py-1"
                            aria-label="End time"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <TextInput
                            value={row.subject}
                            onChange={(e) => updateRow(i, { subject: e.target.value })}
                            placeholder="Subject"
                            className="min-w-36 px-2 py-1"
                            aria-label="Subject"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <TextInput
                            value={row.teacher}
                            onChange={(e) => updateRow(i, { teacher: e.target.value })}
                            placeholder="Teacher"
                            className="w-28 px-2 py-1"
                            aria-label="Teacher"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <TextInput
                            value={row.room}
                            onChange={(e) => updateRow(i, { room: e.target.value })}
                            placeholder="Room"
                            className="w-20 px-2 py-1"
                            aria-label="Room"
                          />
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
                          <td colSpan={7} className="px-3 pb-2 pt-0 text-xs text-red-700">
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
              <PrimaryButton type="button" onClick={() => apply("replace")} disabled={validCount === 0}>
                Replace timetable
              </PrimaryButton>
              <SecondaryButton type="button" onClick={() => apply("merge")} disabled={validCount === 0}>
                Merge into timetable
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
