// Assignments import/export — pure functions, no browser APIs.
// Supported inputs: CSV, JSON and plain text (CSV rows, one per line).
// Every parser returns the same shape so the preview step can show rows,
// errors and a valid-row count before the user applies anything.
// Reuses the CSV line parser from timetable-import.

import { parseCsvLine } from "./timetable-import";
import type { Assignment, AssignmentStatus } from "./types";

export type ParsedAssignment = Omit<Assignment, "id" | "status"> & { status: AssignmentStatus };

export interface ParsedAssignmentRow {
  line: number; // 1-based source line
  raw: string;
  course: string;
  title: string;
  due: string | null; // ISO date "YYYY-MM-DD" or null
  status: AssignmentStatus;
  errors: string[];
  skipped: boolean; // user choice in the preview
}

export interface AssignmentParseResult {
  format: "csv" | "json" | "text";
  rows: ParsedAssignmentRow[];
  fatalError: string | null; // set when the whole input could not be read
}

export const ASSIGNMENTS_CSV_HEADER = "course,title,due,status";

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

// ---------- due date ----------

const MONTHS: Record<string, number> = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4,
  may: 5, jun: 6, june: 6, jul: 7, july: 7, aug: 8, august: 8, sep: 9, sept: 9,
  september: 9, oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12,
};

function toIso(y: number, m: number, d: number): string | null {
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  const date = new Date(y, m - 1, d);
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) return null;
  const mm = String(m).padStart(2, "0");
  const dd = String(d).padStart(2, "0");
  return `${y}-${mm}-${dd}`;
}

/**
 * Accepts "2026-11-26", "26/11/2026", "26-11-2026", "26 Nov 2026",
 * "26 November 2026" and "Nov 26, 2026". Empty means no due date.
 * Anything else -> null (unparsable).
 */
export function parseDueDate(value: string): string | null {
  const v = value.trim();
  if (v === "") return null;
  let m = v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return toIso(Number(m[1]), Number(m[2]), Number(m[3]));
  m = v.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (m) return toIso(Number(m[3]), Number(m[2]), Number(m[1])); // day first
  m = v.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/);
  if (m) {
    const month = MONTHS[m[2].toLowerCase()];
    if (month) return toIso(Number(m[3]), month, Number(m[1]));
  }
  m = v.match(/^([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})$/);
  if (m) {
    const month = MONTHS[m[1].toLowerCase()];
    if (month) return toIso(Number(m[3]), month, Number(m[2]));
  }
  return null;
}

// ---------- status ----------

const STATUS_MAP: Record<string, AssignmentStatus> = {
  pending: "pending",
  todo: "pending",
  open: "pending",
  "not started": "pending",
  submitted: "submitted",
  done: "submitted",
  "turned in": "submitted",
  complete: "submitted",
  completed: "submitted",
  missing: "missing",
  missed: "missing",
  late: "missing",
  overdue: "missing",
};

export function parseStatus(value: string): AssignmentStatus | null {
  const v = value.trim().toLowerCase();
  if (v === "") return "pending";
  return STATUS_MAP[v] ?? null;
}

// ---------- rows ----------

function makeRow(
  line: number,
  raw: string,
  fields: { course: string; title: string; dueRaw: string; statusRaw: string }
): ParsedAssignmentRow {
  const errors: string[] = [];
  const course = fields.course.trim();
  const title = fields.title.trim();
  let due: string | null = null;
  if (fields.dueRaw.trim() === "") {
    due = null;
  } else {
    due = parseDueDate(fields.dueRaw);
    if (due === null) errors.push(`Invalid due date "${fields.dueRaw.trim()}"`);
  }
  const status = parseStatus(fields.statusRaw);
  if (status === null) errors.push(`Unknown status "${fields.statusRaw.trim()}"`);
  if (!course) errors.push("Missing course");
  if (!title) errors.push("Missing title");
  return {
    line,
    raw,
    course,
    title,
    due,
    status: status ?? "pending",
    errors,
    skipped: errors.length > 0,
  };
}

const HEADER_ALIASES: Record<string, "course" | "title" | "due" | "status" | "ignore"> = {
  course: "course",
  subject: "course",
  class: "course",
  title: "title",
  assignment: "title",
  name: "title",
  task: "title",
  due: "due",
  "due date": "due",
  duedate: "due",
  due_date: "due",
  deadline: "due",
  status: "status",
  state: "status",
};

function headerMap(cells: string[]): ("course" | "title" | "due" | "status" | "ignore")[] | null {
  const mapped = cells.map((c) => HEADER_ALIASES[c.trim().toLowerCase()] ?? "ignore");
  if (!mapped.includes("title")) return null;
  return mapped;
}

function rowFromCells(
  line: number,
  raw: string,
  cells: string[],
  mapping: ("course" | "title" | "due" | "status" | "ignore")[] | null
): ParsedAssignmentRow {
  const get = (key: "course" | "title" | "due" | "status"): string => {
    if (mapping) {
      const idx = mapping.indexOf(key);
      return idx >= 0 ? cells[idx] ?? "" : "";
    }
    // No header: standard column order course,title,due,status.
    const order: ("course" | "title" | "due" | "status")[] = ["course", "title", "due", "status"];
    return cells[order.indexOf(key)] ?? "";
  };
  return makeRow(line, raw, {
    course: get("course"),
    title: get("title"),
    dueRaw: get("due"),
    statusRaw: get("status"),
  });
}

export function parseAssignmentsCsvText(text: string): AssignmentParseResult {
  const lines = text.split(/\r?\n/);
  const rows: ParsedAssignmentRow[] = [];
  let mapping: ("course" | "title" | "due" | "status" | "ignore")[] | null = null;
  let started = false;
  lines.forEach((line, i) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;
    const cells = parseCsvLine(trimmed);
    if (!started) {
      started = true;
      const maybeHeader = headerMap(cells);
      if (maybeHeader) {
        mapping = maybeHeader;
        return;
      }
    }
    if (cells.length < 2) return; // not an assignment row
    rows.push(rowFromCells(i + 1, trimmed, cells, mapping));
  });
  return { format: "csv", rows, fatalError: rows.length === 0 ? "No assignment rows found in the file." : null };
}

/**
 * Accepts a bare array of {course,title,due,status} and the app's own
 * export format {app:"student-dashboard", type:"assignments", assignments:[...]}.
 * Due may be "YYYY-MM-DD" or any format parseDueDate accepts.
 */
export function parseAssignmentsJsonText(text: string): AssignmentParseResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { format: "json", rows: [], fatalError: "This file is not valid JSON." };
  }
  const list = Array.isArray(parsed) ? parsed : (parsed as { assignments?: unknown })?.assignments;
  if (!Array.isArray(list)) {
    return {
      format: "json",
      rows: [],
      fatalError: 'Expected a list of assignments, or an object with an "assignments" list.',
    };
  }
  const rows: ParsedAssignmentRow[] = list.map((item, i) => {
    const r = (item ?? {}) as Record<string, unknown>;
    return makeRow(i + 1, JSON.stringify(item), {
      course: String(r.course ?? r.subject ?? ""),
      title: String(r.title ?? r.assignment ?? r.name ?? ""),
      dueRaw: String(r.due ?? r.dueDate ?? r.deadline ?? ""),
      statusRaw: String(r.status ?? ""),
    });
  });
  return { format: "json", rows, fatalError: rows.length === 0 ? "No assignments found in the JSON file." : null };
}

export function parseAssignmentsPlainText(text: string): AssignmentParseResult {
  // Same CSV rows, one per line, header optional. Lines starting with
  // "#" are comments and are skipped.
  const result = parseAssignmentsCsvText(text);
  return { ...result, format: "text" };
}

export function parseAssignmentsFile(fileName: string, text: string): AssignmentParseResult {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "json") return parseAssignmentsJsonText(text);
  if (ext === "csv") return parseAssignmentsCsvText(text);
  return parseAssignmentsPlainText(text); // .txt, .md and pasted text
}

// ---------- export ----------

export function assignmentsToCsv(assignments: Assignment[]): string {
  const lines = [ASSIGNMENTS_CSV_HEADER];
  for (const a of assignments) {
    lines.push([a.course, a.title, a.due ?? "", a.status].map(csvEscape).join(","));
  }
  return lines.join("\n") + "\n";
}

export interface AssignmentsExport {
  app: "student-dashboard";
  type: "assignments";
  version: 1;
  exportedAt: string;
  assignments: ParsedAssignment[];
}

/** The app's own JSON export — parseAssignmentsJsonText reads this back exactly. */
export function assignmentsToExportJson(assignments: Assignment[]): string {
  const data: AssignmentsExport = {
    app: "student-dashboard",
    type: "assignments",
    version: 1,
    exportedAt: new Date().toISOString(),
    assignments: assignments.map((a) => ({ course: a.course, title: a.title, due: a.due, status: a.status })),
  };
  return JSON.stringify(data, null, 2) + "\n";
}

// ---------- apply helpers ----------

/** Rows the user has not skipped and that have no errors, as assignments (no ids yet). */
export function validRowsToAssignments(rows: ParsedAssignmentRow[]): ParsedAssignment[] {
  return rows
    .filter((r) => !r.skipped && r.errors.length === 0)
    .map((r) => ({ course: r.course, title: r.title, due: r.due, status: r.status }));
}

function sameAssignment(a: ParsedAssignment, b: Assignment): boolean {
  return (
    a.course.toLowerCase() === b.course.toLowerCase() &&
    a.title.toLowerCase() === b.title.toLowerCase() &&
    (a.due ?? "") === (b.due ?? "")
  );
}

/**
 * Append imported rows to the current list, skipping exact duplicates
 * (same course + title + due date) both within the import and against
 * what is already there. Returns the merged list and how many rows were
 * added and how many were skipped as duplicates.
 */
export function appendAssignments(
  current: Assignment[],
  incoming: ParsedAssignment[],
  makeId: () => string
): { merged: Assignment[]; added: number; duplicates: number } {
  const merged: Assignment[] = [...current];
  let added = 0;
  let duplicates = 0;
  const seen = new Set<string>();
  for (const row of incoming) {
    const key = `${row.course.toLowerCase()}|${row.title.toLowerCase()}|${row.due ?? ""}`;
    if (seen.has(key) || merged.some((a) => sameAssignment(row, a))) {
      duplicates++;
      continue;
    }
    seen.add(key);
    merged.push({ ...row, id: makeId() });
    added++;
  }
  return { merged, added, duplicates };
}

/** Replace the whole list with the imported rows (deduplicated within the import). */
export function replaceAssignments(
  incoming: ParsedAssignment[],
  makeId: () => string
): { replaced: Assignment[]; duplicates: number } {
  const { merged, duplicates } = appendAssignments([], incoming, makeId);
  return { replaced: merged, duplicates };
}
