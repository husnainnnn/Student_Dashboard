// Reminders — the reminder center. Lists what fires now and what is coming
// up, driven by the student's own settings. Browser notifications work while
// the app is open; real push/email reminders need a backend and are a v2 step.

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { RequireAuth } from "@/components/Shell";
import { useData } from "@/lib/store";
import { computeReminders } from "@/lib/reminders";
import { Badge, Card, CardHeader, EmptyState, Notice, PrimaryButton, SecondaryButton } from "@/components/ui";

export default function RemindersPage() {
  return (
    <RequireAuth>
      <Reminders />
    </RequireAuth>
  );
}

function Reminders() {
  const { state } = useData();
  const [now, setNow] = useState(() => new Date());
  const [perm, setPerm] = useState<string>(typeof Notification !== "undefined" ? Notification.permission : "unsupported");
  const notifiedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(t);
  }, []);

  const result = useMemo(() => computeReminders(state, now), [state, now]);

  // Fire a browser notification once per active reminder (while this page is open).
  useEffect(() => {
    if (perm !== "granted" || result.quietNow) return;
    for (const r of result.active) {
      if (notifiedRef.current.has(r.id)) continue;
      notifiedRef.current.add(r.id);
      try {
        new Notification("Student Dashboard", { body: `${r.title} — ${r.detail}` });
      } catch {
        // Notifications unavailable in this browser context.
      }
    }
  }, [result, perm]);

  async function enableNotifications() {
    if (typeof Notification === "undefined") {
      setPerm("unsupported");
      return;
    }
    const p = await Notification.requestPermission();
    setPerm(p);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Reminders</h1>
        <p className="mt-1 text-sm text-slate-500">
          Lecture reminders {state.settings.lectureReminderMinutes} minutes before class · assignment reminders
          within {state.settings.assignmentReminderHours} hours · quiet hours{" "}
          {state.settings.quietHoursStart} – {state.settings.quietHoursEnd}. Change these in{" "}
          <Link href="/settings" className="font-medium text-blue-600 hover:text-blue-700">
            Settings
          </Link>
          .
        </p>
      </div>

      <div className="flex flex-col items-start gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        {perm === "granted" ? (
          <Notice tone="green">Browser notifications are on. Reminders will pop up while the app is open.</Notice>
        ) : perm === "denied" ? (
          <Notice tone="amber">Browser notifications are blocked for this site. Enable them in your browser settings to get pop-ups.</Notice>
        ) : perm === "unsupported" ? (
          <Notice tone="amber">This browser does not support notifications. The list below still updates live.</Notice>
        ) : (
          <PrimaryButton onClick={enableNotifications}>Enable browser notifications</PrimaryButton>
        )}
        <SecondaryButton onClick={() => setNow(new Date())}>Refresh now</SecondaryButton>
      </div>

      {result.quietNow ? (
        <Notice tone="blue">
          Quiet hours are on right now — reminders are held until {state.settings.quietHoursEnd}.
        </Notice>
      ) : null}

      <Card>
        <CardHeader title="Firing now" subtitle="Inside your reminder windows" />
        {result.active.length === 0 ? (
          <EmptyState title="Nothing firing right now" text="When a lecture or deadline enters your reminder window, it shows up here." />
        ) : (
          <ul className="divide-y divide-slate-100">
            {result.active.map((r) => (
              <li key={r.id} className="flex items-start justify-between gap-4 px-5 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-900">{r.title}</p>
                  <p className="text-sm text-slate-500">{r.detail}</p>
                </div>
                <span className="shrink-0">
                  <Badge tone={r.urgent ? "red" : "amber"}>{r.kind === "lecture" ? "Lecture" : "Assignment"}</Badge>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <CardHeader title="Coming up" subtitle="Next 48 hours" />
        {result.upcoming.length === 0 ? (
          <EmptyState title="Nothing coming up" text="No lectures or deadlines in the next 48 hours." />
        ) : (
          <ul className="divide-y divide-slate-100">
            {result.upcoming.map((r) => (
              <li key={r.id} className="flex items-start justify-between gap-4 px-5 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-900">{r.title}</p>
                  <p className="text-sm text-slate-500">{r.detail}</p>
                </div>
                <span className="shrink-0">
                  <Badge tone="slate">{r.kind === "lecture" ? "Lecture" : "Assignment"}</Badge>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Notice tone="blue">
        This list updates while the app is open. Reminders that should reach you when the app is closed —
        push notifications or email — need a small backend or scheduled job. That is a planned v2 step; see
        the README.
      </Notice>
    </div>
  );
}
