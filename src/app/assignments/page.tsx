// Assignments — list with due dates, due-soon highlight, status tracking.

"use client";

import { useMemo, useState } from "react";
import { RequireAuth } from "@/components/Shell";
import { useData } from "@/lib/store";
import { daysUntil, dueLabel, formatDateShort } from "@/lib/dates";
import { Badge, Card, CardHeader, DangerButton, EmptyState, Field, PrimaryButton, SecondaryButton, TextInput } from "@/components/ui";

export default function AssignmentsPage() {
  return (
    <RequireAuth>
      <Assignments />
    </RequireAuth>
  );
}

function Assignments() {
  const { state, addAssignment, updateAssignment, deleteAssignment } = useData();
  const [course, setCourse] = useState("");
  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState<"all" | "pending" | "submitted" | "missing">("all");

  const sorted = useMemo(() => {
    const list = [...state.assignments].sort((a, b) => {
      if (!a.due && !b.due) return a.title.localeCompare(b.title);
      if (!a.due) return 1;
      if (!b.due) return -1;
      return a.due.localeCompare(b.due);
    });
    return filter === "all" ? list : list.filter((a) => a.status === filter);
  }, [state.assignments, filter]);

  function submit() {
    if (!title.trim()) return;
    addAssignment({ course: course.trim() || "General", title: title.trim(), due: due || null });
    setCourse("");
    setTitle("");
    setDue("");
    setShowForm(false);
  }

  function toneFor(a: { due: string | null; status: string }): "red" | "amber" | "green" | "slate" {
    if (a.status === "submitted") return "green";
    if (a.status === "missing") return "red";
    if (!a.due) return "slate";
    const d = daysUntil(a.due);
    if (d < 0) return "red";
    if (d <= 3) return "amber";
    return "slate";
  }

  const counts = useMemo(() => {
    return {
      all: state.assignments.length,
      pending: state.assignments.filter((a) => a.status === "pending").length,
      submitted: state.assignments.filter((a) => a.status === "submitted").length,
      missing: state.assignments.filter((a) => a.status === "missing").length,
    };
  }, [state.assignments]);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Assignments</h1>
          <p className="mt-1 text-sm text-slate-500">
            {counts.pending} pending · {counts.submitted} submitted · {counts.missing} missing
          </p>
        </div>
        <PrimaryButton onClick={() => setShowForm((v) => !v)}>
          {showForm ? "Close form" : "Add assignment"}
        </PrimaryButton>
      </div>

      {showForm ? (
        <Card>
          <div className="grid gap-4 px-5 py-4 sm:grid-cols-4">
            <Field label="Course">
              <TextInput value={course} placeholder="e.g. Compiler Construction" onChange={(e) => setCourse(e.target.value)} />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Title">
                <TextInput value={title} placeholder="e.g. CC Assignment 5" onChange={(e) => setTitle(e.target.value)} />
              </Field>
            </div>
            <Field label="Due date">
              <TextInput type="date" value={due} onChange={(e) => setDue(e.target.value)} />
            </Field>
          </div>
          <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-3">
            <SecondaryButton onClick={() => setShowForm(false)}>Cancel</SecondaryButton>
            <PrimaryButton onClick={submit} disabled={!title.trim()}>
              Add assignment
            </PrimaryButton>
          </div>
        </Card>
      ) : null}

      <div className="flex gap-2">
        {(["all", "pending", "submitted", "missing"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-full px-3 py-1.5 text-sm font-medium ${
              filter === f ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            {f[0].toUpperCase() + f.slice(1)} ({counts[f]})
          </button>
        ))}
      </div>

      <Card>
        <CardHeader title="All assignments" subtitle="Due soon is highlighted from your reminder settings" />
        {sorted.length === 0 ? (
          <EmptyState title="No assignments here" text="Add your first assignment with the button above." />
        ) : (
          <ul className="divide-y divide-slate-100">
            {sorted.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-900">{a.title}</p>
                  <p className="text-sm text-slate-500">
                    {a.course}
                    {a.due ? ` · Due ${formatDateShort(a.due)}` : " · No due date"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone={toneFor(a)}>{dueLabel(a.due)}</Badge>
                  <Badge tone={a.status === "submitted" ? "green" : a.status === "missing" ? "red" : "blue"}>
                    {a.status}
                  </Badge>
                  {a.status !== "submitted" ? (
                    <SecondaryButton onClick={() => updateAssignment(a.id, { status: "submitted" })}>
                      Mark submitted
                    </SecondaryButton>
                  ) : (
                    <SecondaryButton onClick={() => updateAssignment(a.id, { status: "pending" })}>
                      Reopen
                    </SecondaryButton>
                  )}
                  <DangerButton onClick={() => deleteAssignment(a.id)}>Delete</DangerButton>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
