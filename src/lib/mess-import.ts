// Mess menu import/export — pure functions, no browser APIs.
// Supported inputs: CSV, JSON and plain text (CSV rows, one per line).
// Every parser returns the same shape so the preview step can show rows,
// errors and a valid-row count before the user applies anything.
// Reuses the CSV line parser and day parser from timetable-import.

import { DAY_NAMES } from "./dates";
import { parseCsvLine, parseDay } from "./timetable-import";
import type { MessMenu } from "./types";

export type ParsedMessMenu = Omit<MessMenu, "day"> & { day: number };

export interface ParsedMessRow {
  line: number; // 1-based source line
  raw: string;
  day: number | null;
  breakfast: string;
  lunch: string;
  dinner: string;
  errors: string[];
  skipped: boolean; // user choice in the preview
}

export interface MessParseResult {
  format: "csv" | "json" | "text";
  rows: ParsedMessRow[];
  fatalError: string | null; // set when the whole input could not be read
}

export const MESS_CSV_HEADER = "day,breakfast,lunch,dinner";

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

function makeRow(
  line: number,
  raw: string,
  fields: { day: number | null; breakfast: string; lunch: string; dinner: string }
): ParsedMessRow {
  const errors: string[] = [];
  if (fields.day === null) errors.push("Unknown day");
  if (!fields.breakfast.trim() && !fields.lunch.trim() && !fields.dinner.trim()) {
    errors.push("No meals listed");
  }
  return { line, raw, ...fields, errors, skipped: errors.length > 0 };
}

const HEADER_ALIASES: Record<string, "day" | "breakfast" | "lunch" | "dinner" | "ignore"> = {
  day: "day",
  weekday: "day",
  breakfast: "breakfast",
  lunch: "lunch",
  dinner: "dinner",
  supper: "dinner",
};

function headerMap(cells: string[]): ("day" | "breakfast" | "lunch" | "dinner" | "ignore")[] | null {
  const mapped = cells.map((c) => HEADER_ALIASES[c.toLowerCase()] ?? "ignore");
  if (!mapped.includes("day")) return null;
  if (!mapped.includes("breakfast") && !mapped.includes("lunch") && !mapped.includes("dinner")) return null;
  return mapped;
}

function rowFromCells(
  line: number,
  raw: string,
  cells: string[],
  mapping: ("day" | "breakfast" | "lunch" | "dinner" | "ignore")[] | null
): ParsedMessRow {
  const get = (key: "day" | "breakfast" | "lunch" | "dinner"): string => {
    if (mapping) {
      const idx = mapping.indexOf(key);
      return idx >= 0 ? cells[idx] ?? "" : "";
    }
    // No header: standard column order day,breakfast,lunch,dinner.
    const order: ("day" | "breakfast" | "lunch" | "dinner")[] = ["day", "breakfast", "lunch", "dinner"];
    return cells[order.indexOf(key)] ?? "";
  };
  return makeRow(line, raw, {
    day: parseDay(get("day")),
    breakfast: get("breakfast"),
    lunch: get("lunch"),
    dinner: get("dinner"),
  });
}

export function parseMessCsvText(text: string): MessParseResult {
  const lines = text.split(/\r?\n/);
  const rows: ParsedMessRow[] = [];
  let mapping: ("day" | "breakfast" | "lunch" | "dinner" | "ignore")[] | null = null;
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
    if (cells.length < 2) return; // not a menu row
    rows.push(rowFromCells(i + 1, trimmed, cells, mapping));
  });
  return { format: "csv", rows, fatalError: rows.length === 0 ? "No menu rows found in the file." : null };
}

/**
 * Accepts a bare array of {day,breakfast,lunch,dinner} and the app's own
 * export format {app:"student-dashboard", type:"mess-menu", menus:[...]}.
 * Day may be a name ("Monday") or a JS day number 0-6.
 */
export function parseMessJsonText(text: string): MessParseResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { format: "json", rows: [], fatalError: "This file is not valid JSON." };
  }
  const list = Array.isArray(parsed) ? parsed : (parsed as { menus?: unknown })?.menus;
  if (!Array.isArray(list)) {
    return {
      format: "json",
      rows: [],
      fatalError: 'Expected a list of menus, or an object with a "menus" list.',
    };
  }
  const rows: ParsedMessRow[] = list.map((item, i) => {
    const r = (item ?? {}) as Record<string, unknown>;
    const dayRaw = r.day;
    const day =
      typeof dayRaw === "number" ? (dayRaw >= 0 && dayRaw <= 6 ? dayRaw : null) : parseDay(String(dayRaw ?? ""));
    return makeRow(i + 1, JSON.stringify(item), {
      day,
      breakfast: String(r.breakfast ?? ""),
      lunch: String(r.lunch ?? ""),
      dinner: String(r.dinner ?? ""),
    });
  });
  return { format: "json", rows, fatalError: rows.length === 0 ? "No menus found in the JSON file." : null };
}

export function parseMessPlainText(text: string): MessParseResult {
  // Same CSV rows, one per line, header optional. Lines starting with
  // "#" are comments and are skipped.
  const result = parseMessCsvText(text);
  return { ...result, format: "text" };
}

export function parseMessFile(fileName: string, text: string): MessParseResult {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "json") return parseMessJsonText(text);
  if (ext === "csv") return parseMessCsvText(text);
  return parseMessPlainText(text); // .txt, .md and pasted text
}

// ---------- export ----------

export function messMenusToCsv(menus: MessMenu[]): string {
  const lines = [MESS_CSV_HEADER];
  const sorted = [...menus].sort((a, b) => a.day - b.day);
  for (const m of sorted) {
    lines.push([DAY_NAMES[m.day], m.breakfast, m.lunch, m.dinner].map(csvEscape).join(","));
  }
  return lines.join("\n") + "\n";
}

export interface MessExport {
  app: "student-dashboard";
  type: "mess-menu";
  version: 1;
  exportedAt: string;
  menus: ParsedMessMenu[];
}

/** The app's own JSON export — parseMessJsonText reads this back exactly. */
export function messMenusToExportJson(menus: MessMenu[]): string {
  const data: MessExport = {
    app: "student-dashboard",
    type: "mess-menu",
    version: 1,
    exportedAt: new Date().toISOString(),
    menus: menus.map((m) => ({ day: m.day, breakfast: m.breakfast, lunch: m.lunch, dinner: m.dinner })),
  };
  return JSON.stringify(data, null, 2) + "\n";
}

// ---------- apply helpers ----------

/** Rows the user has not skipped and that have no errors, as menus. */
export function validRowsToMessMenus(rows: ParsedMessRow[]): ParsedMessMenu[] {
  return rows
    .filter((r) => !r.skipped && r.errors.length === 0 && r.day !== null)
    .map((r) => ({
      day: r.day as number,
      breakfast: r.breakfast.trim(),
      lunch: r.lunch.trim(),
      dinner: r.dinner.trim(),
    }));
}

/**
 * Replace the whole weekly menu with the incoming rows. Days not present
 * in the import keep their current meals, so a partial file never wipes
 * the rest of the week.
 */
export function replaceMessMenus(current: MessMenu[], incoming: ParsedMessMenu[]): MessMenu[] {
  const byDay = new Map(incoming.map((m) => [m.day, m]));
  return [0, 1, 2, 3, 4, 5, 6].map((day) => {
    const next = byDay.get(day);
    if (next) return { day, breakfast: next.breakfast, lunch: next.lunch, dinner: next.dinner };
    return current.find((m) => m.day === day) ?? { day, breakfast: "", lunch: "", dinner: "" };
  });
}

/**
 * Merge incoming rows into the current menu: only meals that are
 * non-empty in the import overwrite the current value for that day.
 * Returns the merged menu and how many days changed.
 */
export function mergeMessMenus(
  current: MessMenu[],
  incoming: ParsedMessMenu[]
): { merged: MessMenu[]; changedDays: number } {
  const byDay = new Map(incoming.map((m) => [m.day, m]));
  let changedDays = 0;
  const merged = [0, 1, 2, 3, 4, 5, 6].map((day) => {
    const base = current.find((m) => m.day === day) ?? { day, breakfast: "", lunch: "", dinner: "" };
    const next = byDay.get(day);
    if (!next) return base;
    const mergedDay: MessMenu = {
      day,
      breakfast: next.breakfast || base.breakfast,
      lunch: next.lunch || base.lunch,
      dinner: next.dinner || base.dinner,
    };
    if (
      mergedDay.breakfast !== base.breakfast ||
      mergedDay.lunch !== base.lunch ||
      mergedDay.dinner !== base.dinner
    ) {
      changedDays++;
    }
    return mergedDay;
  });
  return { merged, changedDays };
}
