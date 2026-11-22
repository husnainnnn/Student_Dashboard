// Mess menu upload — import a weekly mess menu file (CSV, JSON or text)
// or paste menu text, preview the parsed days, fix or skip bad rows,
// then replace or merge into the current menu. Also exports the current
// menu as CSV. Used by the Mess page. Plain white/blue styling, same as
// the rest of the app.

"use client";

import { useRef, useState, Fragment } from "react";
import { DAY_NAMES } from "@/lib/dates";
import { appBasePath } from "@/lib/paths";
import type { MessMenu } from "@/lib/types";
import {
  mergeMessMenus,
  messMenusToCsv,
  parseMessFile,
  parseMessPlainText,
  replaceMessMenus,
  validRowsToMessMenus,
  type ParsedMessRow,
} from "@/lib/mess-import";
import { downloadTextFile } from "./TimetableUpload";
import { Badge, Card, CardHeader, DangerButton, Notice, PrimaryButton, SecondaryButton, Select, TextInput } from "./ui";

const ACCEPTED = ".csv,.json,.txt,.md";

export function downloadMessCsv(menus: MessMenu[]): void {
  downloadTextFile("mess-menu.csv", messMenusToCsv(menus), "text/csv");
}

function revalidate(row: ParsedMessRow): ParsedMessRow {
  const errors: string[] = [];
  if (row.day === null) errors.push("Unknown day");
  if (!row.breakfast.trim() && !row.lunch.trim() && !row.dinner.trim()) errors.push("No meals listed");
  return { ...row, errors, skipped: errors.length > 0 ? row.skipped : false };
}

export function MessMenuUpload({
  menus,
  onChange,
}: {
  menus: MessMenu[];
  onChange: (next: MessMenu[]) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [fatalError, setFatalError] = useState<string | null>(null);
  const [sourceName, setSourceName] = useState("");
  const [rows, setRows] = useState<ParsedMessRow[] | null>(null);
  const [showPaste, setShowPaste] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [notice, setNotice] = useState<string | null>(null);

  const validCount = rows?.filter((r) => !r.skipped && r.errors.length === 0).length ?? 0;
  const errorCount = rows?.filter((r) => r.errors.length > 0).length ?? 0;

  function startPreview(resultRows: ParsedMessRow[], fatal: string | null, name: string) {
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
      const result = parseMessFile(file.name, text);
      startPreview(result.rows, result.fatalError, file.name);
    } catch {
      startPreview([], "Could not read this file. Try another file, or paste the menu as text.", file.name);
    }
  }

  function handlePaste() {
    const result = parseMessPlainText(pasteText);
    startPreview(result.rows, result.fatalError, "Pasted text");
  }

  function updateRow(index: number, patch: Partial<ParsedMessRow>) {
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
    const incoming = validRowsToMessMenus(rows);
    if (mode === "replace") {
      const next = replaceMessMenus(menus, incoming);
      onChange(next);
      setNotice(`Menu updated — ${incoming.length} day${incoming.length === 1 ? "" : "s"} set from the file.`);
    } else {
      const { merged, changedDays } = mergeMessMenus(menus, incoming);
      onChange(merged);
      setNotice(
        changedDays === 0
          ? "Nothing changed — the imported meals match the current menu."
          : `${changedDays} day${changedDays === 1 ? "" : "s"} updated from the file.`
      );
    }
    setRows(null);
    setPasteText("");
    setShowPaste(false);
  }

  return (
    <Card>
      <CardHeader
        title="Upload mess menu"
        subtitle="Import a file instead of typing every meal. CSV, JSON or text."
        action={
          <SecondaryButton type="button" onClick={() => downloadMessCsv(menus)}>
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
          <p className="text-sm font-medium text-slate-800">Drop your mess menu file here</p>
          <p className="mt-1 text-sm text-slate-500">or choose a file from your computer.</p>
          <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
            <SecondaryButton type="button" onClick={() => fileRef.current?.click()} disabled={parsing}>
              {parsing ? "Reading file…" : "Choose a file"}
            </SecondaryButton>
            <SecondaryButton type="button" onClick={() => setShowPaste((v) => !v)}>
              Paste menu text
            </SecondaryButton>
            <a
              href={`${appBasePath()}/mess-template.csv`}
              download="mess-template.csv"
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
            Accepted: .csv, .json, .txt, .md. CSV columns: day, breakfast, lunch, dinner. Day can be a name
            (Monday) or a number (1 = Monday, 0 = Sunday). Leave a meal empty when the mess is closed.
          </p>
        </div>

        {showPaste ? (
          <div className="space-y-2">
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Paste menu text</span>
              <textarea
                rows={6}
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                placeholder={"Monday,Paratha Omelette Chai,Daal Chawal,Chicken Karahi Roti\nTuesday,Bread Egg Chai,Chicken Biryani Raita,Mix Sabzi Roti"}
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
              />
              <span className="mt-1 block text-xs text-slate-500">
                One day per line, same columns as the CSV. A header row is optional.
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
                {sourceName ? `Found in ${sourceName}: ` : ""}{validCount} of {rows.length} day
                {rows.length === 1 ? "" : "s"} ready to import
              </p>
              {errorCount > 0 ? <Badge tone="amber">{errorCount} day{errorCount === 1 ? "" : "s"} need{errorCount === 1 ? "s" : ""} attention</Badge> : null}
            </div>
            <p className="text-xs text-slate-500">
              Fix a row to include it, or tick Skip to leave it out. Rows with errors are skipped by default.
            </p>
            <div className="overflow-x-auto rounded-md border border-slate-200">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs text-slate-500">
                    <th className="px-3 py-2 font-medium">Day</th>
                    <th className="px-3 py-2 font-medium">Breakfast</th>
                    <th className="px-3 py-2 font-medium">Lunch</th>
                    <th className="px-3 py-2 font-medium">Dinner</th>
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
                            value={row.breakfast}
                            onChange={(e) => updateRow(i, { breakfast: e.target.value })}
                            placeholder="Breakfast"
                            className="min-w-32 px-2 py-1"
                            aria-label="Breakfast"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <TextInput
                            value={row.lunch}
                            onChange={(e) => updateRow(i, { lunch: e.target.value })}
                            placeholder="Lunch"
                            className="min-w-32 px-2 py-1"
                            aria-label="Lunch"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <TextInput
                            value={row.dinner}
                            onChange={(e) => updateRow(i, { dinner: e.target.value })}
                            placeholder="Dinner"
                            className="min-w-32 px-2 py-1"
                            aria-label="Dinner"
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
              <PrimaryButton type="button" onClick={() => apply("replace")} disabled={validCount === 0}>
                Replace menu
              </PrimaryButton>
              <SecondaryButton type="button" onClick={() => apply("merge")} disabled={validCount === 0}>
                Merge into menu
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
