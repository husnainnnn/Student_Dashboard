// Onboarding wizard — shown after signup/login. Collects everything the app
// needs, step by step: timetable, mess menu, links, and the student's own
// reminder rules. Skippable — skipping fills in clearly-marked demo data.

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RequireAuth } from "@/components/Shell";
import { useData } from "@/lib/store";
import type { AppState, Lecture, MessMenu, SavedLink, Settings } from "@/lib/types";
import { emptyState } from "@/lib/types";
import { LinksEditor, MessMenuEditor, PreferencesForm, TimetableEditor } from "@/components/editors";
import { Card, Field, Notice, PrimaryButton, SecondaryButton, TextInput } from "@/components/ui";

const STEPS = ["Welcome", "Timetable", "Mess", "Links", "Preferences", "Done"];

export default function OnboardingPage() {
  return (
    <RequireAuth>
      <Wizard />
    </RequireAuth>
  );
}

function Wizard() {
  const { state, replaceState, loadDemoData } = useData();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<AppState>(() => {
    // Start from whatever the student already has (re-running setup keeps it).
    const base = state.lectures.length > 0 || state.links.length > 0 ? state : emptyState();
    return { ...base, settings: { ...base.settings, onboardingDone: false } };
  });

  const messFormLink = draft.links.find((l) => /mess/i.test(l.label));

  function setLectures(lectures: Lecture[]) {
    setDraft((d) => ({ ...d, lectures }));
  }
  function setMessMenus(messMenus: MessMenu[]) {
    setDraft((d) => ({ ...d, messMenus }));
  }
  function setLinks(links: SavedLink[]) {
    setDraft((d) => ({ ...d, links }));
  }
  function setSettings(settings: Settings) {
    setDraft((d) => ({ ...d, settings }));
  }

  function setMessFormUrl(url: string) {
    setDraft((d) => {
      const existing = d.links.find((l) => /mess/i.test(l.label));
      if (existing) {
        return { ...d, links: d.links.map((l) => (l.id === existing.id ? { ...l, url } : l)) };
      }
      if (!url.trim()) return d;
      return {
        ...d,
        links: [...d.links, { id: `link-mess-form`, label: "Mess Attendance Form", url: url.trim() }],
      };
    });
  }

  function skip() {
    loadDemoData();
    router.push("/");
  }

  function finish() {
    replaceState({
      ...draft,
      settings: { ...draft.settings, onboardingDone: true, demoData: false },
    });
    setStep(5);
  }

  function goDashboard() {
    router.push("/");
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Set up your dashboard</h1>
        <p className="mt-1 text-sm text-slate-500">
          Step {Math.min(step + 1, 6)} of 6 · {STEPS[step]}
        </p>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-blue-600 transition-all"
            style={{ width: `${((step + 1) / 6) * 100}%` }}
          />
        </div>
      </div>

      {step === 0 ? (
        <Card>
          <div className="space-y-4 px-5 py-6">
            <h2 className="text-lg font-semibold text-slate-900">A few minutes now, a semester of reminders</h2>
            <p className="text-sm leading-relaxed text-slate-600">
              Tell the app your timetable, your mess menu, the links you open every day, and how you want to
              be reminded. It will then show you today&apos;s classes, warn you about deadlines, and keep
              your mess and notes in one place.
            </p>
            <p className="text-sm leading-relaxed text-slate-600">
              Your data is yours: it stays in this browser in demo mode, or syncs to your own Supabase
              project when connected. You can change everything later from Settings.
            </p>
            <div className="flex flex-wrap gap-2 pt-2">
              <PrimaryButton onClick={() => setStep(1)}>Set up my data</PrimaryButton>
              <SecondaryButton onClick={skip}>Skip — use demo data</SecondaryButton>
            </div>
          </div>
        </Card>
      ) : null}

      {step === 1 ? (
        <Card>
          <div className="space-y-4 px-5 py-6">
            <h2 className="text-lg font-semibold text-slate-900">Your timetable</h2>
            <p className="text-sm text-slate-500">Add each lecture with its day, time, room and teacher. You can add more later.</p>
            <TimetableEditor lectures={draft.lectures} onChange={setLectures} />
            <StepNav step={step} setStep={setStep} onSkip={skip} />
          </div>
        </Card>
      ) : null}

      {step === 2 ? (
        <Card>
          <div className="space-y-4 px-5 py-6">
            <h2 className="text-lg font-semibold text-slate-900">Mess menu</h2>
            <p className="text-sm text-slate-500">What your hostel serves each day. Leave days blank if you do not know them yet.</p>
            <MessMenuEditor menus={draft.messMenus} onChange={setMessMenus} />
            <Field label="Mess form link" hint="The Google Form (or page) where you book your mess.">
              <TextInput
                value={messFormLink?.url ?? ""}
                placeholder="https://forms.gle/…"
                onChange={(e) => setMessFormUrl(e.target.value)}
              />
            </Field>
            <StepNav step={step} setStep={setStep} onSkip={skip} />
          </div>
        </Card>
      ) : null}

      {step === 3 ? (
        <Card>
          <div className="space-y-4 px-5 py-6">
            <h2 className="text-lg font-semibold text-slate-900">Important links</h2>
            <p className="text-sm text-slate-500">Google Classroom, the mess form, your university portal — anything you open often.</p>
            <LinksEditor links={draft.links} onChange={setLinks} />
            <StepNav step={step} setStep={setStep} onSkip={skip} />
          </div>
        </Card>
      ) : null}

      {step === 4 ? (
        <Card>
          <div className="space-y-4 px-5 py-6">
            <h2 className="text-lg font-semibold text-slate-900">How should the app remind you?</h2>
            <p className="text-sm text-slate-500">
              These are your rules. The dashboard and the Reminders page follow them — lecture reminders,
              assignment warnings and quiet hours all come from here.
            </p>
            <PreferencesForm settings={draft.settings} onChange={setSettings} />
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
              <SecondaryButton onClick={skip}>Skip — use demo data</SecondaryButton>
              <div className="flex gap-2">
                <SecondaryButton onClick={() => setStep(3)}>Back</SecondaryButton>
                <PrimaryButton onClick={finish}>Finish setup</PrimaryButton>
              </div>
            </div>
          </div>
        </Card>
      ) : null}

      {step === 5 ? (
        <Card>
          <div className="space-y-4 px-5 py-6">
            <h2 className="text-lg font-semibold text-slate-900">You are set up</h2>
            <Notice tone="green">
              Your timetable, mess menu, links and reminder rules are saved. You can change any of them from
              Settings at any time.
            </Notice>
            <div className="flex gap-2">
              <PrimaryButton onClick={goDashboard}>Go to your dashboard</PrimaryButton>
            </div>
          </div>
        </Card>
      ) : null}
    </div>
  );
}

function StepNav({ step, setStep, onSkip }: { step: number; setStep: (n: number) => void; onSkip: () => void }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
      <SecondaryButton onClick={onSkip}>Skip — use demo data</SecondaryButton>
      <div className="flex gap-2">
        <SecondaryButton onClick={() => setStep(step - 1)}>Back</SecondaryButton>
        <PrimaryButton onClick={() => setStep(step + 1)}>Next</PrimaryButton>
      </div>
    </div>
  );
}
