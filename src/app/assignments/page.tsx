// Assignments — list with due dates, due-soon highlight, status tracking,
// inline editing, course filter, sorting and bulk CSV import.

"use client";

import { useMemo, useState } from "react";
import { RequireAuth } from "@/components/Shell";
import { AssignmentImport } from "@/components/AssignmentImport";
import { useData } from "@/lib/store";
import { assignmentsToCsv } from "@/lib/assignments-import";
import { downloadTextFile } from "@/components/TimetableUpload";
import { daysUntil, dueLabel, formatDateShort } from "@/lib/dates";
import type { Assignment, AssignmentStatus } from "@/lib/types";
import { Badge, Card, CardHeader, DangerButton, EmptyState, Field, Notice, PrimaryButton, SecondaryButton, Select, TextInput } from "@/components/ui";

type StatusFilter = "all" | "pending" | "submitted" | "missing";
type SortMode = "due" | "course" | "title";

export default function AssignmentsPage() {
  return (
    <RequireAuth>
      <Assignments />
    </RequireAuth>
  );
}

function Assignments() {
  const { state, addAssignment, updateAssignment, deleteAssignment, setAssignments } = useData();
  const [course, setCourse] = useState("");
  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [courseFilter, setCourseFilter] = useState("all");
  const [sortMode, setSortMode] = useState<SortMode>("due");
  const [notice, setNotice] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editCourse, setEditCourse] = useState("");
  const [editTitle, setEditTitle] = useState("");
  const [editDue, setEditDue] = useState("");

  const courses = useMemo(
    () => Array.from(new Set(state.assignments.map((a) => a.course))).sort((a, b) => a.localeCompare(b)),
    [state.assignments]
  );

  const sorted = useMemo(() => {
    let list = [...state.assignments];
    if (filter !== "all") list = list.filter((a) => a.status === filter);
    if (courseFilter !== "all") list = list.filter((a) => a.course === courseFilter);
    const byDue = (a: Assignment, b: Assignment) => {
      if (!a.due && !b.due) return a.title.localeCompare(b.title);
      if (!a.due) return 1;
      if (!b.due) return -1;
      return a.due.localeCompare(b.due) || a.title.localeCompare(b.title);
    };
    if (sortMode === "course") {
      list.sort((a, b) => a.course.localeCompare(b.course) || byDue(a, b));
    } else if (sortMode === "title") {
      list.sort((a, b) => a.title.localeCompare(b.title));
    } else {
      // Due soon: work still to do first (overdue, then nearest), no due
      // date last; submitted items sit at the bottom.
      const active = list.filter((a) => a.status !== "submitted").sort(byDue);
      const done = list.filter((a) => a.status === "submitted").sort(byDue);
      list = [...active, ...done];
    }
    return list;
  }, [state.assignments, filter, courseFilter, sortMode]);

  function submit() {
    if (!title.trim()) return;
    addAssignment({ course: course.trim() || "General", title: title.trim(), due: due || null });
    setCourse("");
    setTitle("");
    setDue("");
    setShowForm(false);
    setNotice("Assignment added.");
  }

  function startEdit(a: Assignment) {
    setEditingId(a.id);
    setEditCourse(a.course);
    setEditTitle(a.title);
    setEditDue(a.due ?? "");
  }

  function saveEdit() {
    if (!editingId || !editTitle.trim()) return;
    updateAssignment(editingId, {
      course: editCourse.trim() || "General",
      title: editTitle.trim(),
      due: editDue || null,
    });
    setEditingId(null);
    setNotice("Assignment updated.");
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

  function statusTone(s: AssignmentStatus): "blue" | "green" | "red" {
    return s === "submitted" ? "green" : s === "missing" ? "red" : "blue";
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

      {notice ? <Notice tone="green">{notice}</Notice> : null}

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

      <div className="flex flex-wrap items-center gap-2">
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
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-sm text-slate-600">
            Course
            <Select
              value={courseFilter}
              onChange={(e) => setCourseFilter(e.target.value)}
              className="w-auto px-2 py-1.5"
              aria-label="Filter by course"
            >
              <option value="all">All courses</option>
              {courses.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            Sort
            <Select
              value={sortMode}
              onChange={(e) => setSortMode(e.target.value as SortMode)}
              className="w-auto px-2 py-1.5"
              aria-label="Sort assignments"
            >
              <option value="due">Due soon first</option>
              <option value="course">Course A–Z</option>
              <option value="title">Title A–Z</option>
            </Select>
          </label>
        </div>
      </div>

      <Card>
        <CardHeader
          title="All assignments"
          subtitle="Due soon is highlighted from your reminder settings"
          action={
            <SecondaryButton
              type="button"
              onClick={() => downloadTextFile("assignments.csv", assignmentsToCsv(state.assignments), "text/csv")}
              disabled={state.assignments.length === 0}
            >
              Download as CSV
            </SecondaryButton>
          }
        />
        {sorted.length === 0 ? (
          <EmptyState title="No assignments here" text="Add your first assignment with the button above, or import a list below." />
        ) : (
          <ul className="divide-y divide-slate-100">
            {sorted.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                {editingId === a.id ? (
                  <div className="grid w-full gap-3 sm:grid-cols-4">
                    <Field label="Course">
                      <TextInput value={editCourse} onChange={(e) => setEditCourse(e.target.value)} />
                    </Field>
                    <div className="sm:col-span-2">
                      <Field label="Title">
                        <TextInput value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
                      </Field>
                    </div>
                    <Field label="Due date">
                      <TextInput type="date" value={editDue} onChange={(e) => setEditDue(e.target.value)} />
                    </Field>
                    <div className="flex gap-2 sm:col-span-4">
                      <PrimaryButton onClick={saveEdit} disabled={!editTitle.trim()}>
                        Save changes
                      </PrimaryButton>
                      <SecondaryButton onClick={() => setEditingId(null)}>Cancel</SecondaryButton>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900">{a.title}</p>
                      <p className="text-sm text-slate-500">
                        {a.course}
                        {a.due ? ` · Due ${formatDateShort(a.due)}` : " · No due date"}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={toneFor(a)}>{dueLabel(a.due)}</Badge>
                      <Badge tone={statusTone(a.status)}>{a.status}</Badge>
                      <SecondaryButton onClick={() => startEdit(a)}>Edit</SecondaryButton>
                      {a.status === "submitted" ? (
                        <SecondaryButton onClick={() => updateAssignment(a.id, { status: "pending" })}>
                          Reopen
                        </SecondaryButton>
                      ) : (
                        <>
                          <SecondaryButton onClick={() => updateAssignment(a.id, { status: "submitted" })}>
                            Mark submitted
                          </SecondaryButton>
                          {a.status !== "missing" ? (
                            <SecondaryButton onClick={() => updateAssignment(a.id, { status: "missing" })}>
                              Mark missing
                            </SecondaryButton>
                          ) : (
                            <SecondaryButton onClick={() => updateAssignment(a.id, { status: "pending" })}>
                              Mark pending
                            </SecondaryButton>
                          )}
                        </>
                      )}
                      <DangerButton onClick={() => deleteAssignment(a.id)}>Delete</DangerButton>
                    </div>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <AssignmentImport assignments={state.assignments} onChange={setAssignments} />
    </div>
  );
}
