// Reminders, computed from the student's own data and their own settings.
// Pure functions — no timers, no network. The Reminders page and Today page
// call these on render (and re-render on a timer) so the list is always fresh.
//
// Per-lecture and per-assignment overrides live in settings: a lecture can
// have its own lead time or be silenced, and an assignment its own
// hours-before-due. Quiet hours hold a reminder until they end — but only
// when the delay still leaves time before the event itself.

import type { AppState, Assignment, Lecture, Settings } from "./types";
import { daysUntil, formatTime12h, isWithinQuietHours, nextQuietHoursEnd, timeToMinutes } from "./dates";

export type ReminderKind = "lecture" | "assignment";

export interface Reminder {
  id: string;
  kind: ReminderKind;
  title: string;
  detail: string;
  when: Date; // when the event happens (lecture start / assignment due, end of day)
  fireAt: Date; // when the notification should fire, before quiet-hours holding
  urgent: boolean;
  heldUntil?: Date; // set when fireAt falls inside quiet hours — fires then instead
  leadLabel: string; // e.g. "30 min before" / "48h before due"
}

export interface ReminderResult {
  active: Reminder[]; // firing now (inside the student's reminder window)
  upcoming: Reminder[]; // scheduled in the next 48 hours
  held: Reminder[]; // fire time inside quiet hours — held until quiet hours end
  quietNow: boolean;
}

function lectureStartDate(lecture: Lecture, base: Date): Date {
  const d = new Date(base);
  d.setHours(0, 0, 0, 0);
  const [h, m] = lecture.start.split(":").map(Number);
  d.setHours(h, m, 0, 0);
  return d;
}

/** Next occurrence of a lecture (today, or the same weekday next week). */
function nextOccurrence(lecture: Lecture, now: Date): Date {
  const today = now.getDay();
  let diff = (lecture.day - today + 7) % 7;
  const start = lectureStartDate(lecture, now);
  if (diff === 0 && start.getTime() <= now.getTime()) diff = 7;
  const d = new Date(start);
  d.setDate(d.getDate() + diff);
  return d;
}

/**
 * Apply quiet hours to a fire time. Returns the time the reminder should
 * actually fire, or null when it fires as planned. A reminder is only held
 * when quiet hours end before the event itself — an early-morning lecture
 * still needs its reminder even during quiet hours.
 */
function applyQuietHours(
  fireAt: Date,
  eventAt: Date,
  settings: Settings
): Date | null {
  if (!settings.quietHoursEnabled) return null;
  if (!isWithinQuietHours(fireAt, settings.quietHoursStart, settings.quietHoursEnd)) return null;
  const heldUntil = nextQuietHoursEnd(fireAt, settings.quietHoursStart, settings.quietHoursEnd);
  if (heldUntil.getTime() >= eventAt.getTime()) return null;
  return heldUntil;
}

/** Effective fire time once quiet-hours holding is applied. */
export function effectiveFireAt(r: Reminder): Date {
  return r.heldUntil ?? r.fireAt;
}

export function computeReminders(state: AppState, now: Date): ReminderResult {
  const settings: Settings = state.settings;
  const quietNow =
    settings.quietHoursEnabled &&
    isWithinQuietHours(now, settings.quietHoursStart, settings.quietHoursEnd);
  const active: Reminder[] = [];
  const upcoming: Reminder[] = [];
  const held: Reminder[] = [];
  const horizon = new Date(now.getTime() + 48 * 60 * 60 * 1000);

  // --- Lecture reminders: N minutes before class, per lecture or global.
  for (const lecture of state.lectures) {
    const override = (settings.lectureReminders ?? {})[lecture.id];
    if (override && !override.enabled) continue; // silenced for this lecture
    const minutesBefore = override ? override.minutesBefore : settings.lectureReminderMinutes;
    const start = nextOccurrence(lecture, now);
    const fireAt = new Date(start.getTime() - minutesBefore * 60000);
    const heldUntil = applyQuietHours(fireAt, start, settings);
    const mins = Math.max(0, Math.round((start.getTime() - now.getTime()) / 60000));
    const r: Reminder = {
      id: `lecture-${lecture.id}`,
      kind: "lecture",
      title: `${lecture.subject} starts in ${mins} min`,
      detail: `${formatTime12h(lecture.start)} – ${formatTime12h(lecture.end)} · ${lecture.teacher} · ${lecture.room}`,
      when: start,
      fireAt,
      urgent: mins <= 15,
      heldUntil: heldUntil ?? undefined,
      leadLabel: `${minutesBefore} min before`,
    };
    const effective = effectiveFireAt(r);
    if (now >= effective && now < start) active.push(r);
    else if (heldUntil && now < heldUntil && start <= horizon) held.push(r);
    else if (start > now && start <= horizon) upcoming.push(r);
  }

  // --- Assignment reminders: due within the student's chosen window.
  for (const a of state.assignments) {
    if (a.status !== "pending" || !a.due) continue;
    const override = (settings.assignmentReminders ?? {})[a.id];
    if (override && !override.enabled) continue; // silenced for this assignment
    const hoursBefore = override ? override.hoursBefore : settings.assignmentReminderHours;
    const dueEnd = new Date(a.due + "T23:59:00");
    const fireAt = new Date(dueEnd.getTime() - hoursBefore * 3600000);
    const heldUntil = applyQuietHours(fireAt, dueEnd, settings);
    const d = daysUntil(a.due);
    const base: Omit<Reminder, "title" | "urgent" | "when" | "fireAt"> = {
      id: `assignment-${a.id}`,
      kind: "assignment",
      detail: `${a.course} · due ${a.due}`,
      heldUntil: heldUntil ?? undefined,
      leadLabel: `${hoursBefore}h before due`,
    };
    const effective = heldUntil ?? fireAt;
    if (d < 0) {
      active.push({
        ...base,
        title: `${a.title} is overdue`,
        detail: `${a.course} · was due ${a.due}`,
        when: dueEnd,
        fireAt,
        urgent: true,
      });
      continue;
    }
    const r: Reminder = {
      ...base,
      title: `${a.title} due ${d === 0 ? "today" : d === 1 ? "tomorrow" : `in ${d} days`}`,
      when: dueEnd,
      fireAt,
      urgent: d <= 1,
    };
    if (now >= effective) active.push(r);
    else if (heldUntil && now < heldUntil && fireAt <= horizon) held.push(r);
    else if (fireAt <= horizon) upcoming.push(r);
  }

  const byWhen = (x: Reminder, y: Reminder) => x.when.getTime() - y.when.getTime();
  active.sort(byWhen);
  upcoming.sort(byWhen);
  held.sort((x, y) => effectiveFireAt(x).getTime() - effectiveFireAt(y).getTime());
  return { active, upcoming, held, quietNow };
}

export function nextLectureToday(lectures: Lecture[], now: Date): Lecture | null {
  const today = lectures
    .filter((l) => l.day === now.getDay())
    .sort((a, b) => timeToMinutes(a.start) - timeToMinutes(b.start));
  const nowMins = now.getHours() * 60 + now.getMinutes();
  for (const l of today) {
    if (timeToMinutes(l.end) > nowMins) return l;
  }
  return null;
}
