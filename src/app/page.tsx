// Today — the home dashboard: next class countdown, today's lectures,
// today's mess status, assignments due soon, active reminders, quick links.

"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { RequireAuth } from "@/components/Shell";
import { useAuth } from "@/lib/auth";
import { useData } from "@/lib/store";
import { computeReminders, nextLectureToday } from "@/lib/reminders";
import { DAY_NAMES, formatDateLong, formatTime12h, humanCountdown, timeToMinutes, toDateKey } from "@/lib/dates";
import { Badge, Card, CardHeader, EmptyState, Notice, PrimaryButton } from "@/components/ui";

function useNow(intervalMs = 30000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

export default function TodayPage() {
  return (
    <RequireAuth>
      <Today />
    </RequireAuth>
  );
}

function Today() {
  const { user } = useAuth();
  const { state, setMessStatus } = useData();
  const now = useNow();
  const todayKey = toDateKey(now);
  const todayLectures = useMemo(
    () =>
      state.lectures
        .filter((l) => l.day === now.getDay())
        .sort((a, b) => timeToMinutes(a.start) - timeToMinutes(b.start)),
    [state.lectures, now]
  );
  const next = nextLectureToday(state.lectures, now);
  const reminders = useMemo(() => computeReminders(state, now), [state, now]);
  const messToday = state.messStatus[todayKey] ?? { breakfast: false, lunch: false, dinner: false };
  const todayMenu = state.messMenus.find((m) => m.day === now.getDay());
  const dueSoon = useMemo(() => {
    const horizon = state.settings.assignmentReminderHours;
    return state.assignments
      .filter((a) => a.status === "pending" && a.due)
      .sort((a, b) => (a.due as string).localeCompare(b.due as string))
      .slice(0, 5);
  }, [state.assignments, state.settings.assignmentReminderHours]);

  function toggleMeal(meal: "breakfast" | "lunch" | "dinner") {
    setMessStatus(todayKey, { ...messToday, [meal]: !messToday[meal] });
  }

  const nextStart = next ? new Date(now) : null;
  if (next && nextStart) {
    const [h, m] = next.start.split(":").map(Number);
    nextStart.setHours(h, m, 0, 0);
  }
  const countdown = next && nextStart ? humanCountdown(nextStart.getTime() - now.getTime()) : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          Good {now.getHours() < 12 ? "morning" : now.getHours() < 17 ? "afternoon" : "evening"}
          {user ? `, ${user.displayName}` : ""}
        </h1>
        <p className="mt-1 text-sm text-slate-500">{formatDateLong(now)}</p>
      </div>

      {state.settings.demoData ? (
        <Notice tone="amber">
          You are seeing demo data (a BCS-7E timetable and sample assignments). Replace it with your own
          from <Link href="/onboarding" className="font-medium underline">setup</Link> or{" "}
          <Link href="/settings" className="font-medium underline">Settings</Link>.
        </Notice>
      ) : null}

      {reminders.quietNow ? (
        <Notice tone="blue">
          Quiet hours are on ({state.settings.quietHoursStart} – {state.settings.quietHoursEnd}). Reminders
          are held until quiet hours end.
        </Notice>
      ) : null}

      {reminders.active.length > 0 ? (
        <Card>
          <CardHeader title="Reminders" subtitle="Based on your reminder settings" />
          <ul className="divide-y divide-slate-100">
            {reminders.active.map((r) => (
              <li key={r.id} className="flex items-start justify-between gap-4 px-5 py-3">
                <div>
                  <p className="text-sm font-medium text-slate-900">{r.title}</p>
                  <p className="text-sm text-slate-500">{r.detail}</p>
                </div>
                <Badge tone={r.urgent ? "red" : "amber"}>{r.kind === "lecture" ? "Lecture" : "Assignment"}</Badge>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader
              title="Today's lectures"
              subtitle={todayLectures.length > 0 ? `${DAY_NAMES[now.getDay()]} · ${todayLectures.length} lecture${todayLectures.length === 1 ? "" : "s"}` : DAY_NAMES[now.getDay()]}
              action={
                <Link href="/timetable" className="text-sm font-medium text-blue-600 hover:text-blue-700">
                  Full timetable
                </Link>
              }
            />
            {todayLectures.length === 0 ? (
              <EmptyState title="No lectures today" text="Enjoy the day off — or use it to catch up on assignments." />
            ) : (
              <ul className="divide-y divide-slate-100">
                {todayLectures.map((l) => {
                  const isNext = next?.id === l.id;
                  const ended = timeToMinutes(l.end) <= now.getHours() * 60 + now.getMinutes();
                  return (
                    <li key={l.id} className={`flex items-start justify-between gap-4 px-5 py-3 ${isNext ? "bg-blue-50/60" : ""}`}>
                      <div>
                        <p className="text-sm font-medium text-slate-900">
                          {l.subject} {isNext ? <Badge tone="blue">Next · in {countdown}</Badge> : null}
                          {ended ? <Badge tone="slate">Done</Badge> : null}
                        </p>
                        <p className="text-sm text-slate-500">
                          {l.teacher} · {l.room}
                        </p>
                      </div>
                      <span className="whitespace-nowrap text-sm font-medium text-slate-700">
                        {formatTime12h(l.start)} – {formatTime12h(l.end)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader
              title="Assignments due soon"
              action={
                <Link href="/assignments" className="text-sm font-medium text-blue-600 hover:text-blue-700">
                  All assignments
                </Link>
              }
            />
            {dueSoon.length === 0 ? (
              <EmptyState title="Nothing due soon" text="No pending assignments with a due date in the list." />
            ) : (
              <ul className="divide-y divide-slate-100">
                {dueSoon.map((a) => (
                  <li key={a.id} className="flex items-start justify-between gap-4 px-5 py-3">
                    <div>
                      <p className="text-sm font-medium text-slate-900">{a.title}</p>
                      <p className="text-sm text-slate-500">{a.course}</p>
                    </div>
                    <Badge tone={a.due === todayKey ? "red" : "amber"}>
                      {a.due ? `Due ${a.due}` : "No due date"}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Mess today" subtitle="Tap a meal to mark it booked" />
            <div className="space-y-2 px-5 py-4">
              {(["breakfast", "lunch", "dinner"] as const).map((meal) => {
                if (!state.settings.mealsToTrack[meal]) return null;
                const booked = messToday[meal];
                const menuText = todayMenu ? todayMenu[meal] : "";
                return (
                  <button
                    key={meal}
                    onClick={() => toggleMeal(meal)}
                    className={`flex w-full items-center justify-between rounded-md border px-3 py-2.5 text-left text-sm ${
                      booked ? "border-blue-200 bg-blue-50" : "border-slate-200 bg-white hover:bg-slate-50"
                    }`}
                  >
                    <span>
                      <span className="block font-medium capitalize text-slate-900">{meal}</span>
                      {menuText ? <span className="block text-xs text-slate-500">{menuText}</span> : null}
                    </span>
                    <span className={`text-xs font-medium ${booked ? "text-blue-700" : "text-slate-400"}`}>
                      {booked ? "Booked" : "Not booked"}
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="border-t border-slate-100 px-5 py-3">
              <Link href="/mess" className="text-sm font-medium text-blue-600 hover:text-blue-700">
                Weekly menu and details
              </Link>
            </div>
          </Card>

          <Card>
            <CardHeader title="Quick links" />
            <ul className="divide-y divide-slate-100">
              {state.links.length === 0 ? (
                <li className="px-5 py-4 text-sm text-slate-500">No links yet — add some in Settings.</li>
              ) : (
                state.links.map((l) => (
                  <li key={l.id} className="px-5 py-3">
                    <a href={l.url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-blue-600 hover:text-blue-700">
                      {l.label}
                    </a>
                  </li>
                ))
              )}
            </ul>
          </Card>

          <Card>
            <div className="px-5 py-4">
              <p className="text-sm font-medium text-slate-900">Need to set up your own data?</p>
              <p className="mt-1 text-sm text-slate-500">
                Add your timetable, mess menu, links and reminder rules in a few minutes.
              </p>
              <div className="mt-3">
                <Link href="/onboarding">
                  <PrimaryButton>Open setup</PrimaryButton>
                </Link>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
