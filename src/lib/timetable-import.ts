// Timetable import/export — pure functions, no browser APIs.
// Supported inputs: CSV, JSON, plain text (CSV rows, one per line) and
// plain text extracted from a PDF. Every parser returns the same shape so
// the preview step can show rows, errors and a valid-row count before the
// user applies anything.

import { DAY_NAMES } from "./dates";
import type { Lecture } from "./types";

export type ParsedLecture = Omit<Lecture, "id">;

export interface ParsedRow {
  line: number; // 1-based source line
  raw: string;
  day: number | null;
  start: string; // "HH:MM" 24h, "" when unparsable
  end: string;
  subject: string;
  teacher: string;
  room: string;
  errors: string[];
  skipped: boolean; // user choice in the preview
}

export interface ParseResult {
  format: "csv" | "json" | "text" | "pdf";
  rows: ParsedRow[];
  fatalError: string | null; // set when the whole input could not be read
}

export const TIMETABLE_CSV_HEADER = "day,start,end,subject,teacher,room";

// ---------- day + time ----------

const DAY_MAP: Record<string, number> = {};
DAY_NAMES.forEach((name, i) => {
  DAY_MAP[name.toLowerCase()] = i;
  DAY_MAP[name.slice(0, 3).toLowerCase()] = i;
});

/** "Monday", "mon", "MON", or a JS day number 0-6. Anything else -> null. */
export function parseDay(value: string): number | null {
  const v = value.trim().toLowerCase();
  if (v === "") return null;
  if (v in DAY_MAP) return DAY_MAP[v];
  if (/^[0-6]$/.test(v)) return Number(v);
  return null;
}

/**
 * "10:15", "10.15", "10:15 AM", "10:15am" -> "HH:MM" 24h.
 * Anything else -> null.
 */
export function parseTime(value: string): string | null {
  const m = value.trim().match(/^(\d{1,2})[:.](\d{2})\s*([AaPp][Mm])?$/);
  if (!m) return null;
  let h = Number(m[1]);
  const min = Number(m[2]);
  const ampm = m[3]?.toLowerCase();
  if (ampm) {
    if (h < 1 || h > 12) return null;
    if (ampm === "pm" && h !== 12) h += 12;
    if (ampm === "am" && h === 12) h = 0;
  }
  if (h > 23 || min > 59) return null;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

export function timeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

// ---------- row validation ----------

export function validateRow(
  day: number | null,
  start: string,
  end: string,
  subject: string
): string[] {
  const errors: string[] = [];
  if (day === null) errors.push("Unknown day");
  if (!start) errors.push("Bad start time");
  if (!end) errors.push("Bad end time");
  if (start && end && timeToMinutes(start) >= timeToMinutes(end)) {
    errors.push("End time is before start time");
  }
  if (!subject.trim()) errors.push("Missing subject");
  return errors;
}

function makeRow(
  line: number,
  raw: string,
  fields: { day: number | null; start: string; end: string; subject: string; teacher: string; room: string }
): ParsedRow {
  const errors = validateRow(fields.day, fields.start, fields.end, fields.subject);
  return { line, raw, ...fields, errors, skipped: errors.length > 0 };
}

// ---------- CSV ----------

/** Minimal CSV parser: handles quoted fields and "" escapes. */
export function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

const HEADER_ALIASES: Record<string, keyof ParsedLecture | "ignore"> = {
  day: "day",
  weekday: "day",
  start: "start",
  starttime: "start",
  "start time": "start",
  from: "start",
  end: "end",
  endtime: "end",
  "end time": "end",
  to: "end",
  subject: "subject",
  course: "subject",
  class: "subject",
  title: "subject",
  teacher: "teacher",
  lecturer: "teacher",
  faculty: "teacher",
  room: "room",
  venue: "room",
  location: "room",
};

function headerMap(cells: string[]): (keyof ParsedLecture | "ignore")[] | null {
  const mapped = cells.map((c) => HEADER_ALIASES[c.toLowerCase()] ?? "ignore");
  if (!mapped.includes("day") || !mapped.includes("subject")) return null;
  return mapped;
}

/** Parse one CSV row (already split into cells) into a ParsedRow. */
function rowFromCells(
  line: number,
  raw: string,
  cells: string[],
  mapping: (keyof ParsedLecture | "ignore")[] | null
): ParsedRow {
  const get = (key: keyof ParsedLecture): string => {
    if (mapping) {
      const idx = mapping.indexOf(key);
      return idx >= 0 ? cells[idx] ?? "" : "";
    }
    // No header: standard column order day,start,end,subject,teacher,room.
    const order: (keyof ParsedLecture)[] = ["day", "start", "end", "subject", "teacher", "room"];
    const idx = order.indexOf(key);
    return cells[idx] ?? "";
  };
  return makeRow(line, raw, {
    day: parseDay(get("day")),
    start: parseTime(get("start")) ?? "",
    end: parseTime(get("end")) ?? "",
    subject: get("subject"),
    teacher: get("teacher"),
    room: get("room"),
  });
}

export function parseCsvText(text: string): ParseResult {
  const lines = text.split(/\r?\n/);
  const rows: ParsedRow[] = [];
  let mapping: (keyof ParsedLecture | "ignore")[] | null = null;
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
    if (cells.length < 3) return; // not a lecture row
    rows.push(rowFromCells(i + 1, trimmed, cells, mapping));
  });
  return { format: "csv", rows, fatalError: rows.length === 0 ? "No lecture rows found in the file." : null };
}

// ---------- JSON ----------

/**
 * Accepts a bare array of {day,start,end,subject,teacher,room} and the
 * app's own export format {app:"student-dashboard", type:"timetable",
 * lectures:[...]}. Day may be a name ("Monday") or a JS day number 0-6.
 */
export function parseJsonText(text: string): ParseResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { format: "json", rows: [], fatalError: "This file is not valid JSON." };
  }
  const list = Array.isArray(parsed)
    ? parsed
    : (parsed as { lectures?: unknown })?.lectures;
  if (!Array.isArray(list)) {
    return {
      format: "json",
      rows: [],
      fatalError: "Expected a list of lectures, or an object with a \"lectures\" list.",
    };
  }
  const rows: ParsedRow[] = list.map((item, i) => {
    const r = (item ?? {}) as Record<string, unknown>;
    const dayRaw = r.day;
    const day =
      typeof dayRaw === "number" ? (dayRaw >= 0 && dayRaw <= 6 ? dayRaw : null) : parseDay(String(dayRaw ?? ""));
    return makeRow(i + 1, JSON.stringify(item), {
      day,
      start: parseTime(String(r.start ?? "")) ?? "",
      end: parseTime(String(r.end ?? "")) ?? "",
      subject: String(r.subject ?? ""),
      teacher: String(r.teacher ?? ""),
      room: String(r.room ?? ""),
    });
  });
  return { format: "json", rows, fatalError: rows.length === 0 ? "No lectures found in the JSON file." : null };
}

// ---------- plain text / pasted text ----------

export function parsePlainText(text: string): ParseResult {
  // Same CSV rows, one per line, header optional. Lines starting with
  // "#" are comments and are skipped.
  const result = parseCsvText(text);
  return { ...result, format: "text" };
}

// ---------- text extracted from a PDF ----------

const ROOM_WORDS = ["hall", "auditorium", "lab", "library", "studio"];
const TITLE_WORDS = ["dr.", "mr.", "ms.", "mrs.", "miss", "prof.", "prof"];

/**
 * Lines from a PDF are rarely comma-separated, so a line like
 * "Monday 10:15 11:40 Data Science Dr. Rabia Seminar Hall" is matched
 * as: day, start, end, then subject + teacher + room guessed from the
 * tail (a room code like R-8, a "Hall"/"Lab" word, or a titled name).
 * Lines that already look like CSV rows are parsed as CSV first.
 */
function rowFromPdfLine(line: number, raw: string): ParsedRow | null {
  const cells = parseCsvLine(raw);
  if (cells.length >= 4 && parseDay(cells[0]) !== null && parseTime(cells[1]) !== null) {
    return rowFromCells(line, raw, cells, null);
  }
  const m = raw.match(
    /^([A-Za-z]+)\s+(\d{1,2}[:.]\d{2}\s*[AaPp]?[Mm]?)\s*[-–]?\s*(\d{1,2}[:.]\d{2}\s*[AaPp]?[Mm]?)\s+(.+)$/
  );
  if (!m) return null;
  const day = parseDay(m[1]);
  const start = parseTime(m[2]) ?? "";
  const end = parseTime(m[3]) ?? "";
  let rest = m[4].trim();
  let room = "";
  let teacher = "";

  // Room: a trailing code like R-8, R8, LH-1, Lab 3, or a room word.
  const codeMatch = rest.match(/\s([A-Za-z]{1,3}[- ]?\d+[A-Za-z]?)$/);
  const wordMatch = rest.match(new RegExp(`\\s([A-Za-z]+\\s(?:${ROOM_WORDS.join("|")}))$`, "i"));
  if (codeMatch) {
    room = codeMatch[1];
    rest = rest.slice(0, codeMatch.index).trim();
  } else if (wordMatch) {
    room = wordMatch[1];
    rest = rest.slice(0, wordMatch.index).trim();
  }

  // Teacher: a trailing titled name ("Dr. Rabia", "Ms. Mahzaib").
  const tokens = rest.split(/\s+/);
  if (tokens.length >= 3) {
    const title = tokens[tokens.length - 2].toLowerCase();
    if (TITLE_WORDS.includes(title)) {
      teacher = tokens.slice(-2).join(" ");
      rest = tokens.slice(0, -2).join(" ");
    }
  }

  return makeRow(line, raw, { day, start, end, subject: rest, teacher, room });
}

export function parsePdfText(text: string): ParseResult {
  const rows: ParsedRow[] = [];
  text.split(/\r?\n/).forEach((line, i) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    const row = rowFromPdfLine(i + 1, trimmed);
    if (row) rows.push(row);
  });
  return {
    format: "pdf",
    rows,
    fatalError:
      rows.length === 0
        ? "No timetable rows found in this PDF. Try the CSV template or paste the timetable as text instead."
        : null,
  };
}

// ---------- dispatch by file ----------

export function parseTimetableFile(fileName: string, text: string): ParseResult {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "json") return parseJsonText(text);
  if (ext === "csv") return parseCsvText(text);
  if (ext === "pdf") return parsePdfText(text);
  return parsePlainText(text); // .txt, .md and pasted text
}

// ---------- export ----------

export function lecturesToCsv(lectures: (Lecture | ParsedLecture)[]): string {
  const lines = [TIMETABLE_CSV_HEADER];
  const sorted = [...lectures].sort(
    (a, b) => a.day - b.day || timeToMinutes(a.start) - timeToMinutes(b.start)
  );
  for (const l of sorted) {
    lines.push(
      [DAY_NAMES[l.day], l.start, l.end, l.subject, l.teacher, l.room].map(csvEscape).join(",")
    );
  }
  return lines.join("\n") + "\n";
}

export interface TimetableExport {
  app: "student-dashboard";
  type: "timetable";
  version: 1;
  exportedAt: string;
  lectures: ParsedLecture[];
}

/** The app's own JSON export — parseJsonText reads this back exactly. */
export function lecturesToExportJson(lectures: (Lecture | ParsedLecture)[]): string {
  const data: TimetableExport = {
    app: "student-dashboard",
    type: "timetable",
    version: 1,
    exportedAt: new Date().toISOString(),
    lectures: lectures.map((l) => ({
      day: l.day,
      subject: l.subject,
      teacher: l.teacher,
      room: l.room,
      start: l.start,
      end: l.end,
    })),
  };
  return JSON.stringify(data, null, 2) + "\n";
}

// ---------- apply helpers ----------

export function lectureKey(l: ParsedLecture): string {
  return [l.day, l.start, l.end, l.subject, l.teacher, l.room]
    .map((v) => String(v).trim().toLowerCase())
    .join("|");
}

/** Merge incoming lectures into the current list, skipping exact duplicates. */
export function mergeLectures(
  existing: Lecture[],
  incoming: ParsedLecture[]
): { merged: ParsedLecture[]; added: number } {
  const seen = new Set(existing.map(lectureKey));
  const merged: ParsedLecture[] = existing.map((l) => ({
    day: l.day,
    subject: l.subject,
    teacher: l.teacher,
    room: l.room,
    start: l.start,
    end: l.end,
  }));
  let added = 0;
  for (const l of incoming) {
    const key = lectureKey(l);
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(l);
    added++;
  }
  return { merged, added };
}

/** Rows the user has not skipped and that have no errors, as lectures. */
export function validRowsToLectures(rows: ParsedRow[]): ParsedLecture[] {
  return rows
    .filter((r) => !r.skipped && r.errors.length === 0 && r.day !== null)
    .map((r) => ({
      day: r.day as number,
      start: r.start,
      end: r.end,
      subject: r.subject.trim(),
      teacher: r.teacher.trim(),
      room: r.room.trim(),
    }));
}
