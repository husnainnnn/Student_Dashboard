// Timetable — full week grid with an edit mode (same editor as onboarding).

"use client";

import { useState } from "react";
import { RequireAuth } from "@/components/Shell";
import { useData } from "@/lib/store";
import { DAY_NAMES, formatTime12h, timeToMinutes } from "@/lib/dates";
import { TimetableEditor } from "@/components/editors";
import { downloadLecturesCsv, TimetableUpload } from "@/components/TimetableUpload";
import { Badge, Card, CardHeader, EmptyState, PrimaryButton, SecondaryButton } from "@/components/ui";

export default function TimetablePage() {
  return (
    <RequireAuth>
      <Timetable />
    </RequireAuth>
  );
}

function Timetable() {
  const { state, setLectures } = useData();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(state.lectures);

  function startEdit() {
    setDraft(state.lectures);
    setEditing(true);
  }

  function save() {
    setLectures(draft);
    setEditing(false);
  }

  const days = [1, 2, 3, 4, 5, 6, 0]; // Mon..Sun

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Timetable</h1>
          <p className="mt-1 text-sm text-slate-500">Your weekly lecture schedule.</p>
        </div>
        {editing ? (
          <div className="flex flex-wrap gap-2">
            <SecondaryButton onClick={() => setEditing(false)}>Cancel</SecondaryButton>
            <PrimaryButton onClick={save}>Save timetable</PrimaryButton>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <SecondaryButton onClick={() => downloadLecturesCsv(state.lectures)}>Download as CSV</SecondaryButton>
            <PrimaryButton onClick={startEdit}>Edit timetable</PrimaryButton>
          </div>
        )}
      </div>

      {editing ? (
        <div className="space-y-6">
          <TimetableUpload lectures={draft} onChange={setDraft} />
          <Card>
            <div className="px-5 py-4">
              <TimetableEditor lectures={draft} onChange={setDraft} />
              <p className="mt-3 text-xs text-slate-500">
                Changes are saved when you press “Save timetable”.
              </p>
            </div>
          </Card>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {days.map((day) => {
            const lectures = state.lectures
              .filter((l) => l.day === day)
              .sort((a, b) => timeToMinutes(a.start) - timeToMinutes(b.start));
            return (
              <Card key={day}>
                <CardHeader
                  title={DAY_NAMES[day]}
                  action={<Badge tone="slate">{lectures.length} lecture{lectures.length === 1 ? "" : "s"}</Badge>}
                />
                {lectures.length === 0 ? (
                  <EmptyState
                    title={day === 5 ? "Holiday" : "No lectures"}
                    text={day === 5 ? "Friday is a holiday." : "Nothing scheduled for this day."}
                  />
                ) : (
                  <ul className="divide-y divide-slate-100">
                    {lectures.map((l) => (
                      <li key={l.id} className="px-5 py-3">
                        <p className="text-sm font-medium text-slate-900">{l.subject}</p>
                        <p className="text-sm text-slate-500">
                          {formatTime12h(l.start)} – {formatTime12h(l.end)} · {l.teacher} · {l.room}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
