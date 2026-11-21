// Mess — weekly menu (editable), today's status, and the mess form link.

"use client";

import { useState } from "react";
import { RequireAuth } from "@/components/Shell";
import { useData } from "@/lib/store";
import { DAY_NAMES, toDateKey } from "@/lib/dates";
import { MessMenuEditor } from "@/components/editors";
import { Card, CardHeader, EmptyState, PrimaryButton, SecondaryButton } from "@/components/ui";

export default function MessPage() {
  return (
    <RequireAuth>
      <Mess />
    </RequireAuth>
  );
}

function Mess() {
  const { state, setMessMenus, setMessStatus } = useData();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(state.messMenus);
  const today = new Date();
  const todayKey = toDateKey(today);
  const status = state.messStatus[todayKey] ?? { breakfast: false, lunch: false, dinner: false };
  const todayMenu = state.messMenus.find((m) => m.day === today.getDay());
  const messFormLink = state.links.find((l) => /mess/i.test(l.label));

  function toggleMeal(meal: "breakfast" | "lunch" | "dinner") {
    setMessStatus(todayKey, { ...status, [meal]: !status[meal] });
  }

  function startEdit() {
    setDraft(state.messMenus);
    setEditing(true);
  }

  function save() {
    setMessMenus(draft);
    setEditing(false);
  }

  const days = [1, 2, 3, 4, 5, 6, 0];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Mess</h1>
          <p className="mt-1 text-sm text-slate-500">Weekly menu and today&apos;s booking status.</p>
        </div>
        {messFormLink ? (
          <a href={messFormLink.url} target="_blank" rel="noopener noreferrer">
            <PrimaryButton>Open mess form</PrimaryButton>
          </a>
        ) : null}
      </div>

      <Card>
        <CardHeader title="Today" subtitle={DAY_NAMES[today.getDay()]} />
        <div className="grid gap-3 px-5 py-4 sm:grid-cols-3">
          {(["breakfast", "lunch", "dinner"] as const).map((meal) => {
            if (!state.settings.mealsToTrack[meal]) return null;
            const booked = status[meal];
            return (
              <button
                key={meal}
                onClick={() => toggleMeal(meal)}
                className={`rounded-md border px-4 py-3 text-left ${
                  booked ? "border-blue-200 bg-blue-50" : "border-slate-200 bg-white hover:bg-slate-50"
                }`}
              >
                <span className="block text-sm font-medium capitalize text-slate-900">{meal}</span>
                <span className="mt-0.5 block text-sm text-slate-500">{todayMenu ? todayMenu[meal] || "—" : "—"}</span>
                <span className={`mt-2 block text-xs font-medium ${booked ? "text-blue-700" : "text-slate-400"}`}>
                  {booked ? "Booked" : "Not booked — tap to book"}
                </span>
              </button>
            );
          })}
        </div>
        <p className="border-t border-slate-100 px-5 py-3 text-xs text-slate-500">
          Status is saved for today only. Re-submitting before midnight changes the answer, as per hostel rules.
        </p>
      </Card>

      <div className="flex items-start justify-between gap-4">
        <h2 className="text-lg font-semibold text-slate-900">Weekly menu</h2>
        {editing ? (
          <div className="flex gap-2">
            <SecondaryButton onClick={() => setEditing(false)}>Cancel</SecondaryButton>
            <PrimaryButton onClick={save}>Save menu</PrimaryButton>
          </div>
        ) : (
          <PrimaryButton onClick={startEdit}>Edit menu</PrimaryButton>
        )}
      </div>

      {editing ? (
        <Card>
          <div className="px-5 py-4">
            <MessMenuEditor menus={draft} onChange={setDraft} />
          </div>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="px-5 py-3 font-medium text-slate-700">Day</th>
                  <th className="px-5 py-3 font-medium text-slate-700">Breakfast</th>
                  <th className="px-5 py-3 font-medium text-slate-700">Lunch</th>
                  <th className="px-5 py-3 font-medium text-slate-700">Dinner</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {days.map((day) => {
                  const m = state.messMenus.find((x) => x.day === day);
                  const isToday = day === today.getDay();
                  return (
                    <tr key={day} className={isToday ? "bg-blue-50/50" : ""}>
                      <td className="px-5 py-3 font-medium text-slate-900">
                        {DAY_NAMES[day]}
                        {isToday ? " (today)" : ""}
                      </td>
                      <td className="px-5 py-3 text-slate-600">{m?.breakfast || "—"}</td>
                      <td className="px-5 py-3 text-slate-600">{m?.lunch || "—"}</td>
                      <td className="px-5 py-3 text-slate-600">{m?.dinner || "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {state.messMenus.every((m) => !m.breakfast && !m.lunch && !m.dinner) ? (
            <EmptyState title="Menu is empty" text="Add your hostel menu with the Edit menu button." />
          ) : null}
        </Card>
      )}
    </div>
  );
}
