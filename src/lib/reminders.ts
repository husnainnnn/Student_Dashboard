// Reminders, computed from the student's own data and their own settings.
// Pure functions — no timers, no network. The Reminders page and Today page
// call these on render (and re-render on a timer) so the list is always fresh.

import type { AppState, Assignment, Lecture, Settings } from "./types";
import { daysUntil, formatTime12h, isWithinQuietHours, timeToMinutes } from "./dates";

export type ReminderKind = "lecture" | "assignment";

export interface Reminder {
  id: string;
  kind: ReminderKind;
  title: string;
  detail: string;
  when: Date; // when the reminder fires / the event happens
  urgent: boolean;
}

export interface ReminderResult {
  active: Reminder[]; // firing now (inside the student's reminder window)
  upcoming: Reminder[]; // scheduled in the next 48 hours
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

export function computeReminders(state: AppState, now: Date): ReminderResult {
  const settings: Settings = state.settings;
  const quietNow = isWithinQuietHours(now, settings.quietHoursStart, settings.quietHoursEnd);
  const active: Reminder[] = [];
  const upcoming: Reminder[] = [];
  const horizon = new Date(now.getTime() + 48 * 60 * 60 * 1000);

  // --- Lecture reminders: fire N minutes before class, per the student's setting.
  for (const lecture of state.lectures) {
    const start = nextOccurrence(lecture, now);
    const remindAt = new Date(start.getTime() - settings.lectureReminderMinutes * 60000);
    const mins = Math.max(0, Math.round((start.getTime() - now.getTime()) / 60000));
    const r: Reminder = {
      id: `lecture-${lecture.id}`,
      kind: "lecture",
      title: `${lecture.subject} starts in ${mins} min`,
      detail: `${formatTime12h(lecture.start)} – ${formatTime12h(lecture.end)} · ${lecture.teacher} · ${lecture.room}`,
      when: start,
      urgent: mins <= 15,
    };
    if (now >= remindAt && now < start) active.push(r);
    else if (start > now && start <= horizon) upcoming.push(r);
  }

  // --- Assignment reminders: due within the student's chosen window.
  for (const a of state.assignments) {
    if (a.status !== "pending" || !a.due) continue;
    const d = daysUntil(a.due);
    if (d < 0) {
      active.push({
        id: `assignment-${a.id}`,
        kind: "assignment",
        title: `${a.title} is overdue`,
        detail: `${a.course} · was due ${a.due}`,
        when: new Date(a.due + "T23:59:00"),
        urgent: true,
      });
      continue;
    }
    const hoursLeft = d * 24 + 23; // rough: due at end of the due day
    if (hoursLeft <= settings.assignmentReminderHours) {
      active.push({
        id: `assignment-${a.id}`,
        kind: "assignment",
        title: `${a.title} due ${d === 0 ? "today" : d === 1 ? "tomorrow" : `in ${d} days`}`,
        detail: `${a.course} · due ${a.due}`,
        when: new Date(a.due + "T23:59:00"),
        urgent: d <= 1,
      });
    } else if (d <= 7) {
      upcoming.push({
        id: `assignment-${a.id}`,
        kind: "assignment",
        title: `${a.title} due in ${d} days`,
        detail: `${a.course} · due ${a.due}`,
        when: new Date(a.due + "T23:59:00"),
        urgent: false,
      });
    }
  }

  const byWhen = (x: Reminder, y: Reminder) => x.when.getTime() - y.when.getTime();
  active.sort(byWhen);
  upcoming.sort(byWhen);
  return { active, upcoming, quietNow };
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
