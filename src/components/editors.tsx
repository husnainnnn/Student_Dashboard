// Form editors shared by the onboarding wizard and the Settings page.
// Controlled components: they edit the values passed in and call onChange.

"use client";

import type { Lecture, MessMenu, SavedLink, Settings } from "@/lib/types";
import { DAY_NAMES } from "@/lib/dates";
import { DangerButton, Field, SecondaryButton, Select, TextInput } from "./ui";
import { uid } from "@/lib/store";

// ---------- Timetable ----------

export function TimetableEditor({
  lectures,
  onChange,
}: {
  lectures: Lecture[];
  onChange: (next: Lecture[]) => void;
}) {
  function update(id: string, patch: Partial<Lecture>) {
    onChange(lectures.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  }

  function add() {
    onChange([...lectures, { id: uid(), day: 1, subject: "", teacher: "", room: "", start: "10:15", end: "11:40" }]);
  }

  const sorted = [...lectures].sort((a, b) => a.day - b.day || a.start.localeCompare(b.start));

  return (
    <div className="space-y-3">
      {sorted.length === 0 ? (
        <p className="text-sm text-slate-500">No lectures added yet. Add your first lecture below.</p>
      ) : (
        sorted.map((l) => (
          <div key={l.id} className="grid grid-cols-2 gap-2 rounded-md border border-slate-200 p-3 sm:grid-cols-7">
            <div className="col-span-2 sm:col-span-1">
              <Field label="Day">
                <Select value={l.day} onChange={(e) => update(l.id, { day: Number(e.target.value) })}>
                  {DAY_NAMES.map((d, i) => (
                    <option key={d} value={i}>
                      {d}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <div className="col-span-2 sm:col-span-2">
              <Field label="Subject">
                <TextInput value={l.subject} placeholder="e.g. Data Science" onChange={(e) => update(l.id, { subject: e.target.value })} />
              </Field>
            </div>
            <div>
              <Field label="Teacher">
                <TextInput value={l.teacher} placeholder="e.g. Dr. Rabia" onChange={(e) => update(l.id, { teacher: e.target.value })} />
              </Field>
            </div>
            <div>
              <Field label="Room">
                <TextInput value={l.room} placeholder="e.g. R-8" onChange={(e) => update(l.id, { room: e.target.value })} />
              </Field>
            </div>
            <div>
              <Field label="Start">
                <TextInput type="time" value={l.start} onChange={(e) => update(l.id, { start: e.target.value })} />
              </Field>
            </div>
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <Field label="End">
                  <TextInput type="time" value={l.end} onChange={(e) => update(l.id, { end: e.target.value })} />
                </Field>
              </div>
              <DangerButton type="button" onClick={() => onChange(lectures.filter((x) => x.id !== l.id))}>
                Remove
              </DangerButton>
            </div>
          </div>
        ))
      )}
      <SecondaryButton type="button" onClick={add}>
        Add lecture
      </SecondaryButton>
    </div>
  );
}

// ---------- Mess menu ----------

export function MessMenuEditor({
  menus,
  onChange,
}: {
  menus: MessMenu[];
  onChange: (next: MessMenu[]) => void;
}) {
  function update(day: number, field: "breakfast" | "lunch" | "dinner", value: string) {
    onChange(menus.map((m) => (m.day === day ? { ...m, [field]: value } : m)));
  }

  return (
    <div className="space-y-3">
      {[1, 2, 3, 4, 5, 6, 0].map((day) => {
        const m = menus.find((x) => x.day === day) ?? { day, breakfast: "", lunch: "", dinner: "" };
        return (
          <div key={day} className="grid gap-2 rounded-md border border-slate-200 p-3 sm:grid-cols-4">
            <div className="flex items-center">
              <span className="text-sm font-medium text-slate-800">{DAY_NAMES[day]}</span>
            </div>
            <Field label="Breakfast">
              <TextInput value={m.breakfast} placeholder="e.g. Paratha, Chai" onChange={(e) => update(day, "breakfast", e.target.value)} />
            </Field>
            <Field label="Lunch">
              <TextInput value={m.lunch} placeholder="e.g. Daal Chawal" onChange={(e) => update(day, "lunch", e.target.value)} />
            </Field>
            <Field label="Dinner">
              <TextInput value={m.dinner} placeholder="e.g. Chicken Karahi" onChange={(e) => update(day, "dinner", e.target.value)} />
            </Field>
          </div>
        );
      })}
    </div>
  );
}

// ---------- Links ----------

export function LinksEditor({
  links,
  onChange,
}: {
  links: SavedLink[];
  onChange: (next: SavedLink[]) => void;
}) {
  function update(id: string, patch: Partial<SavedLink>) {
    onChange(links.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  }

  return (
    <div className="space-y-3">
      {links.length === 0 ? (
        <p className="text-sm text-slate-500">No links added yet.</p>
      ) : (
        links.map((l) => (
          <div key={l.id} className="flex flex-col gap-2 rounded-md border border-slate-200 p-3 sm:flex-row sm:items-end">
            <div className="w-full sm:w-56">
              <Field label="Label">
                <TextInput value={l.label} placeholder="e.g. Google Classroom" onChange={(e) => update(l.id, { label: e.target.value })} />
              </Field>
            </div>
            <div className="flex-1">
              <Field label="URL">
                <TextInput value={l.url} placeholder="https://…" onChange={(e) => update(l.id, { url: e.target.value })} />
              </Field>
            </div>
            <DangerButton type="button" onClick={() => onChange(links.filter((x) => x.id !== l.id))}>
              Remove
            </DangerButton>
          </div>
        ))
      )}
      <SecondaryButton type="button" onClick={() => onChange([...links, { id: uid(), label: "", url: "" }])}>
        Add link
      </SecondaryButton>
    </div>
  );
}

// ---------- Preferences ----------

export function PreferencesForm({
  settings,
  onChange,
}: {
  settings: Settings;
  onChange: (next: Settings) => void;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Remind me before each lecture (minutes)" hint="A reminder appears this many minutes before class starts.">
        <TextInput
          type="number"
          min={0}
          max={180}
          value={settings.lectureReminderMinutes}
          onChange={(e) => onChange({ ...settings, lectureReminderMinutes: Math.max(0, Number(e.target.value) || 0) })}
        />
      </Field>
      <Field label="Remind me about assignments due within (hours)" hint="Pending assignments due inside this window show as reminders.">
        <TextInput
          type="number"
          min={1}
          max={720}
          value={settings.assignmentReminderHours}
          onChange={(e) => onChange({ ...settings, assignmentReminderHours: Math.max(1, Number(e.target.value) || 1) })}
        />
      </Field>
      <div>
        <span className="mb-1 block text-sm font-medium text-slate-700">Meals to track</span>
        <div className="flex gap-4 pt-2">
          {(["breakfast", "lunch", "dinner"] as const).map((meal) => (
            <label key={meal} className="flex items-center gap-1.5 text-sm text-slate-700">
              <input
                type="checkbox"
                className="h-4 w-4 accent-blue-600"
                checked={settings.mealsToTrack[meal]}
                onChange={(e) =>
                  onChange({ ...settings, mealsToTrack: { ...settings.mealsToTrack, [meal]: e.target.checked } })
                }
              />
              {meal[0].toUpperCase() + meal.slice(1)}
            </label>
          ))}
        </div>
      </div>
      <div>
        <span className="mb-1 block text-sm font-medium text-slate-700">Quiet hours</span>
        <div className="flex items-center gap-2 pt-1">
          <TextInput
            type="time"
            value={settings.quietHoursStart}
            onChange={(e) => onChange({ ...settings, quietHoursStart: e.target.value })}
            aria-label="Quiet hours start"
          />
          <span className="text-sm text-slate-500">to</span>
          <TextInput
            type="time"
            value={settings.quietHoursEnd}
            onChange={(e) => onChange({ ...settings, quietHoursEnd: e.target.value })}
            aria-label="Quiet hours end"
          />
        </div>
        <p className="mt-1 text-xs text-slate-500">Reminders are held during quiet hours.</p>
      </div>
    </div>
  );
}
