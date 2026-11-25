// Small date/time helpers. All times are local time.

export const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
export const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function parseDateKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function formatDateLong(d: Date): string {
  return d.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function formatDateShort(key: string): string {
  const d = parseDateKey(key);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

/** "13:45" -> "1:45 PM" */
export function formatTime12h(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${ampm}`;
}

export function timeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

export function minutesToTime(total: number): string {
  const h = Math.floor(total / 60) % 24;
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Whole days from today (local) until the given date key. Negative = past. */
export function daysUntil(key: string): number {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = parseDateKey(key);
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}

export function dueLabel(key: string | null): string {
  if (!key) return "No due date";
  const d = daysUntil(key);
  if (d < 0) return `Overdue by ${-d} day${-d === 1 ? "" : "s"}`;
  if (d === 0) return "Due today";
  if (d === 1) return "Due tomorrow";
  return `Due in ${d} days`;
}

/** True when `now` falls inside the quiet-hours window (handles overnight wrap). */
export function isWithinQuietHours(now: Date, start: string, end: string): boolean {
  const mins = now.getHours() * 60 + now.getMinutes();
  const s = timeToMinutes(start);
  const e = timeToMinutes(end);
  if (s === e) return false;
  if (s < e) return mins >= s && mins < e;
  return mins >= s || mins < e; // overnight, e.g. 22:00 -> 07:00
}

/**
 * The next time quiet hours end, at or after `after`. Assumes `after` is
 * inside quiet hours. Handles overnight windows (e.g. 22:00 -> 07:00 ends
 * the following morning).
 */
export function nextQuietHoursEnd(after: Date, start: string, end: string): Date {
  const s = timeToMinutes(start);
  const e = timeToMinutes(end);
  const [eh, em] = end.split(":").map(Number);
  const d = new Date(after);
  d.setHours(eh, em, 0, 0);
  if (s > e && after.getHours() * 60 + after.getMinutes() >= s) {
    // Evening side of an overnight window — quiet hours end tomorrow morning.
    d.setDate(d.getDate() + 1);
  }
  return d;
}

export function humanCountdown(ms: number): string {
  if (ms <= 0) return "now";
  const totalMin = Math.round(ms / 60000);
  if (totalMin < 60) return `${totalMin} min`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}
