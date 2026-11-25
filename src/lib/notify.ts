// Browser notifications with real scheduling.
// The Reminders page schedules each reminder with setTimeout at its exact
// fire time (chunked, because setTimeout caps at ~24.8 days), instead of
// only noticing it on a 30-second poll. Fired and dismissed reminders are
// remembered in localStorage, keyed by reminder + occurrence, so a page
// refresh does not re-fire a notification that already went out.
//
// This only works while the app is open in a tab. Reminders that should
// reach the student when the app is closed need a backend — a planned v2 step.

import type { Reminder } from "./reminders";
import { effectiveFireAt } from "./reminders";
import { toDateKey } from "./dates";

const FIRED_KEY = "sd-fired-reminders";
const DISMISSED_KEY = "sd-dismissed-reminders";
const MAX_TIMEOUT_MS = 2147483647; // setTimeout's 32-bit cap

/** Stable key for one occurrence of a reminder (same reminder next week is a new occurrence). */
export function occurrenceKey(r: Reminder): string {
  return `${r.id}@${toDateKey(effectiveFireAt(r))}`;
}

type StoredMap = Record<string, number>; // occurrence key -> timestamp ms

function readMap(key: string): StoredMap {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as StoredMap;
    // Prune entries older than 7 days so the store never grows.
    const cutoff = Date.now() - 7 * 24 * 3600 * 1000;
    const kept: StoredMap = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (typeof v === "number" && v > cutoff) kept[k] = v;
    }
    return kept;
  } catch {
    return {};
  }
}

function writeMap(key: string, map: StoredMap): void {
  try {
    localStorage.setItem(key, JSON.stringify(map));
  } catch {
    // Storage full or unavailable — notifications still fire, just without dedupe.
  }
}

export function hasFired(r: Reminder): boolean {
  return occurrenceKey(r) in readMap(FIRED_KEY);
}

export function markFired(r: Reminder): void {
  const map = readMap(FIRED_KEY);
  map[occurrenceKey(r)] = Date.now();
  writeMap(FIRED_KEY, map);
}

export function isDismissed(r: Reminder): boolean {
  return occurrenceKey(r) in readMap(DISMISSED_KEY);
}

export function dismissReminder(r: Reminder): void {
  const map = readMap(DISMISSED_KEY);
  map[occurrenceKey(r)] = Date.now();
  writeMap(DISMISSED_KEY, map);
}

/** Send one browser notification now. Returns false when not permitted. */
export function sendNotification(title: string, body: string): boolean {
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return false;
  try {
    new Notification(title, { body });
    return true;
  } catch {
    return false;
  }
}

export function sendTestNotification(): boolean {
  return sendNotification(
    "Student Dashboard — test",
    "Notifications are working. Reminders will pop up at their scheduled time while the app is open."
  );
}

/**
 * Schedule `fn` to run at `at`, chunking the wait so it survives the
 * setTimeout cap. Returns a cancel function.
 */
export function scheduleAt(at: Date, fn: () => void): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let cancelled = false;
  const tick = () => {
    if (cancelled) return;
    const wait = at.getTime() - Date.now();
    if (wait <= 0) {
      fn();
      return;
    }
    timer = setTimeout(tick, Math.min(wait, MAX_TIMEOUT_MS));
  };
  tick();
  return () => {
    cancelled = true;
    if (timer) clearTimeout(timer);
  };
}
