// Reminders — the reminder center. Per-lecture and per-assignment reminder
// rules, quiet hours with held reminders, and browser notifications scheduled
// at their exact fire time while the app is open. Push/email reminders for
// when the app is closed need a backend and are a v2 step.

"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { RequireAuth } from "@/components/Shell";
import { useData } from "@/lib/store";
import { computeReminders, effectiveFireAt, type Reminder } from "@/lib/reminders";
import {
  dismissReminder,
  hasFired,
  isDismissed,
  markFired,
  occurrenceKey,
  scheduleAt,
  sendNotification,
  sendTestNotification,
} from "@/lib/notify";
import { DAY_NAMES, formatTime12h, toDateKey } from "@/lib/dates";
import {
  Badge,
  Card,
  CardHeader,
  EmptyState,
  Notice,
  PrimaryButton,
  SecondaryButton,
  Select,
  TextInput,
} from "@/components/ui";

const ASSIGNMENT_LEAD_OPTIONS = [6, 12, 24, 48, 72, 168];

function formatFireTime(d: Date, now: Date): string {
  const time = formatTime12h(`${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`);
  const dayKey = toDateKey(d);
  const todayKey = toDateKey(now);
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (dayKey === todayKey) return `Today, ${time}`;
  if (dayKey === toDateKey(tomorrow)) return `Tomorrow, ${time}`;
  return `${DAY_NAMES[d.getDay()]}, ${d.getDate()} ${d.toLocaleDateString("en-GB", { month: "short" })}, ${time}`;
}

export default function RemindersPage() {
  return (
    <RequireAuth>
      <Reminders />
    </RequireAuth>
  );
}

function Reminders() {
  const { state, updateSettings } = useData();
  const [now, setNow] = useState(() => new Date());
  const [perm, setPerm] = useState<string>(
    typeof Notification !== "undefined" ? Notification.permission : "unsupported"
  );
  const [dismissedKeys, setDismissedKeys] = useState<Set<string>>(new Set());
  const [testSent, setTestSent] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(t);
  }, []);

  const result = useMemo(() => computeReminders(state, now), [state, now]);

  // Schedule each reminder's notification at its exact fire time. Fired and
  // dismissed reminders are remembered in localStorage, so a refresh does
  // not send the same notification twice.
  useEffect(() => {
    if (perm !== "granted") return;
    const cancels: (() => void)[] = [];
    const all = [...result.active, ...result.upcoming, ...result.held];
    for (const r of all) {
      if (isDismissed(r) || dismissedKeys.has(occurrenceKey(r)) || hasFired(r)) continue;
      cancels.push(
        scheduleAt(effectiveFireAt(r), () => {
          if (isDismissed(r)) return;
          if (sendNotification("Student Dashboard", `${r.title} — ${r.detail}`)) markFired(r);
        })
      );
    }
    return () => cancels.forEach((c) => c());
  }, [result, perm, dismissedKeys]);

  async function enableNotifications() {
    if (typeof Notification === "undefined") {
      setPerm("unsupported");
      return;
    }
    const p = await Notification.requestPermission();
    setPerm(p);
  }

  function handleTest() {
    setTestSent(sendTestNotification());
  }

  function dismiss(r: Reminder) {
    dismissReminder(r);
    setDismissedKeys((prev) => new Set(prev).add(occurrenceKey(r)));
  }

  const settings = state.settings;
  const lectureOverrides = settings.lectureReminders ?? {};
  const assignmentOverrides = settings.assignmentReminders ?? {};
  const sortedLectures = [...state.lectures].sort((a, b) => a.day - b.day || a.start.localeCompare(b.start));
  const pendingAssignments = state.assignments
    .filter((a) => a.status === "pending" && a.due)
    .sort((a, b) => (a.due ?? "").localeCompare(b.due ?? ""));
  const visibleActive = result.active.filter((r) => !isDismissed(r) && !dismissedKeys.has(occurrenceKey(r)));

  function setLectureOverride(id: string, patch: { enabled: boolean; minutesBefore: number }) {
    updateSettings({ lectureReminders: { ...lectureOverrides, [id]: patch } });
  }

  function clearLectureOverride(id: string) {
    const next = { ...lectureOverrides };
    delete next[id];
    updateSettings({ lectureReminders: next });
  }

  function setAssignmentOverride(id: string, patch: { enabled: boolean; hoursBefore: number }) {
    updateSettings({ assignmentReminders: { ...assignmentOverrides, [id]: patch } });
  }

  function clearAssignmentOverride(id: string) {
    const next = { ...assignmentOverrides };
    delete next[id];
    updateSettings({ assignmentReminders: next });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Reminders</h1>
        <p className="mt-1 text-sm text-slate-500">
          Lecture reminders {settings.lectureReminderMinutes} minutes before class · assignment reminders
          within {settings.assignmentReminderHours} hours · quiet hours{" "}
          {settings.quietHoursEnabled
            ? `${settings.quietHoursStart} – ${settings.quietHoursEnd}`
            : "off"}
          . Change the defaults in{" "}
          <Link href="/settings" className="font-medium text-blue-600 hover:text-blue-700">
            Settings
          </Link>
          ; set per-lecture and per-assignment rules below.
        </p>
      </div>

      <Card>
        <CardHeader title="Browser notifications" subtitle="Scheduled at each reminder's exact fire time" />
        <div className="space-y-3 px-5 py-4">
          <div className="flex flex-col items-start gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            {perm === "granted" ? (
              <Notice tone="green">Browser notifications are on. Reminders pop up at their scheduled time while the app is open.</Notice>
            ) : perm === "denied" ? (
              <Notice tone="amber">Browser notifications are blocked for this site. Enable them in your browser settings to get pop-ups.</Notice>
            ) : perm === "unsupported" ? (
              <Notice tone="amber">This browser does not support notifications. The lists below still update live.</Notice>
            ) : (
              <PrimaryButton onClick={enableNotifications}>Enable browser notifications</PrimaryButton>
            )}
            {perm === "granted" ? (
              <SecondaryButton onClick={handleTest}>Send test notification</SecondaryButton>
            ) : null}
            <SecondaryButton onClick={() => setNow(new Date())}>Refresh now</SecondaryButton>
          </div>
          {testSent ? <Notice tone="green">Test notification sent — check your system notifications.</Notice> : null}
          <p className="text-xs text-slate-500">
            Notifications are scheduled per reminder and remembered once sent, so a page refresh does not
            repeat them. They only fire while the app is open in a tab.
          </p>
        </div>
      </Card>

      <Card>
        <CardHeader title="Quiet hours" subtitle="Reminders that fall inside quiet hours are held, not lost" />
        <div className="space-y-3 px-5 py-4">
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              className="h-4 w-4 accent-blue-600"
              checked={settings.quietHoursEnabled}
              onChange={(e) => updateSettings({ quietHoursEnabled: e.target.checked })}
            />
            Hold notifications during quiet hours
          </label>
          <div className="flex items-center gap-2">
            <TextInput
              type="time"
              value={settings.quietHoursStart}
              disabled={!settings.quietHoursEnabled}
              onChange={(e) => updateSettings({ quietHoursStart: e.target.value })}
              aria-label="Quiet hours start"
            />
            <span className="text-sm text-slate-500">to</span>
            <TextInput
              type="time"
              value={settings.quietHoursEnd}
              disabled={!settings.quietHoursEnabled}
              onChange={(e) => updateSettings({ quietHoursEnd: e.target.value })}
              aria-label="Quiet hours end"
            />
          </div>
          {result.quietNow ? (
            <Notice tone="blue">
              Quiet hours are on right now — reminders are held until {settings.quietHoursEnd}.
            </Notice>
          ) : (
            <p className="text-xs text-slate-500">
              Held reminders fire when quiet hours end, as long as the class or deadline is still ahead then.
            </p>
          )}
        </div>
      </Card>

      <Card>
        <CardHeader title="Firing now" subtitle="Inside your reminder windows" />
        {visibleActive.length === 0 ? (
          <EmptyState title="Nothing firing right now" text="When a lecture or deadline enters your reminder window, it shows up here." />
        ) : (
          <ul className="divide-y divide-slate-100">
            {visibleActive.map((r) => (
              <li key={r.id} className="flex items-start justify-between gap-4 px-5 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-900">{r.title}</p>
                  <p className="text-sm text-slate-500">{r.detail}</p>
                  <p className="text-xs text-slate-400">
                    {r.leadLabel} · fires {formatFireTime(effectiveFireAt(r), now)}
                    {r.heldUntil ? " (held by quiet hours)" : ""}
                  </p>
                </div>
                <span className="flex shrink-0 items-center gap-2">
                  <Badge tone={r.urgent ? "red" : "amber"}>{r.kind === "lecture" ? "Lecture" : "Assignment"}</Badge>
                  <SecondaryButton onClick={() => dismiss(r)}>Dismiss</SecondaryButton>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {result.held.length > 0 ? (
        <Card>
          <CardHeader title="Held by quiet hours" subtitle="These fire when quiet hours end" />
          <ul className="divide-y divide-slate-100">
            {result.held.map((r) => (
              <li key={r.id} className="flex items-start justify-between gap-4 px-5 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-900">{r.title}</p>
                  <p className="text-sm text-slate-500">{r.detail}</p>
                  <p className="text-xs text-slate-400">
                    {r.leadLabel} · fires {formatFireTime(effectiveFireAt(r), now)}
                  </p>
                </div>
                <span className="shrink-0">
                  <Badge tone="slate">{r.kind === "lecture" ? "Lecture" : "Assignment"}</Badge>
                </span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <Card>
        <CardHeader title="Coming up" subtitle="Next 48 hours, with exact fire times" />
        {result.upcoming.length === 0 ? (
          <EmptyState title="Nothing coming up" text="No lectures or deadlines in the next 48 hours." />
        ) : (
          <ul className="divide-y divide-slate-100">
            {result.upcoming.map((r) => (
              <li key={r.id} className="flex items-start justify-between gap-4 px-5 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-900">{r.title}</p>
                  <p className="text-sm text-slate-500">{r.detail}</p>
                  <p className="text-xs text-slate-400">
                    {r.leadLabel} · fires {formatFireTime(effectiveFireAt(r), now)}
                  </p>
                </div>
                <span className="shrink-0">
                  <Badge tone="slate">{r.kind === "lecture" ? "Lecture" : "Assignment"}</Badge>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <CardHeader
          title="Per-lecture reminders"
          subtitle={`Default: ${settings.lectureReminderMinutes} minutes before class — change it per lecture here`}
        />
        {sortedLectures.length === 0 ? (
          <div className="px-5 py-4">
            <EmptyState title="No lectures yet" text="Add lectures to your timetable to set reminders for them." />
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {sortedLectures.map((l) => {
              const ov = lectureOverrides[l.id];
              const enabled = ov ? ov.enabled : true;
              const minutes = ov ? ov.minutesBefore : settings.lectureReminderMinutes;
              const isDefault = !ov;
              return (
                <li key={l.id} className="flex flex-col gap-2 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900">
                      {DAY_NAMES[l.day]} · {l.subject}
                    </p>
                    <p className="text-sm text-slate-500">
                      {formatTime12h(l.start)} – {formatTime12h(l.end)} · {l.teacher}
                      {l.room ? ` · ${l.room}` : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <label className="flex items-center gap-1.5 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-blue-600"
                        checked={enabled}
                        onChange={(e) =>
                          setLectureOverride(l.id, { enabled: e.target.checked, minutesBefore: minutes })
                        }
                      />
                      Remind me
                    </label>
                    <TextInput
                      type="number"
                      min={0}
                      max={180}
                      value={minutes}
                      disabled={!enabled}
                      onChange={(e) =>
                        setLectureOverride(l.id, {
                          enabled: true,
                          minutesBefore: Math.max(0, Number(e.target.value) || 0),
                        })
                      }
                      aria-label={`Minutes before ${l.subject}`}
                      className="w-20"
                    />
                    <span className="text-sm text-slate-500">min before</span>
                    {!isDefault ? (
                      <SecondaryButton onClick={() => clearLectureOverride(l.id)}>Use default</SecondaryButton>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Card>
        <CardHeader
          title="Assignment deadline reminders"
          subtitle={`Default: ${settings.assignmentReminderHours} hours before the due day ends — change it per assignment here`}
        />
        {pendingAssignments.length === 0 ? (
          <div className="px-5 py-4">
            <EmptyState
              title="No pending assignments with due dates"
              text="Add an assignment with a due date to set a deadline reminder for it."
            />
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {pendingAssignments.map((a) => {
              const ov = assignmentOverrides[a.id];
              const enabled = ov ? ov.enabled : true;
              const hours = ov ? ov.hoursBefore : settings.assignmentReminderHours;
              const isDefault = !ov;
              return (
                <li key={a.id} className="flex flex-col gap-2 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900">{a.title}</p>
                    <p className="text-sm text-slate-500">
                      {a.course} · due {a.due}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <label className="flex items-center gap-1.5 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-blue-600"
                        checked={enabled}
                        onChange={(e) =>
                          setAssignmentOverride(a.id, { enabled: e.target.checked, hoursBefore: hours })
                        }
                      />
                      Remind me
                    </label>
                    <Select
                      value={String(hours)}
                      disabled={!enabled}
                      onChange={(e) =>
                        setAssignmentOverride(a.id, { enabled: true, hoursBefore: Number(e.target.value) })
                      }
                      aria-label={`Hours before ${a.title} is due`}
                    >
                      {ASSIGNMENT_LEAD_OPTIONS.map((h) => (
                        <option key={h} value={String(h)}>
                          {h >= 24 ? `${h / 24} day${h === 24 ? "" : "s"}` : `${h} hours`} before
                        </option>
                      ))}
                      {!ASSIGNMENT_LEAD_OPTIONS.includes(hours) ? (
                        <option value={String(hours)}>{hours} hours before</option>
                      ) : null}
                    </Select>
                    {!isDefault ? (
                      <SecondaryButton onClick={() => clearAssignmentOverride(a.id)}>Use default</SecondaryButton>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Notice tone="blue">
        This list updates while the app is open, and notifications are scheduled at their exact times.
        Reminders that should reach you when the app is closed — push notifications or email — need a
        small backend or scheduled job. That is a planned v2 step; see the README.
      </Notice>
    </div>
  );
}
