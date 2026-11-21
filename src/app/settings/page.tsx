// Settings — edit everything the onboarding wizard collected, any time:
// timetable, mess menu, links, reminder preferences, and data management.

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RequireAuth } from "@/components/Shell";
import { useAuth } from "@/lib/auth";
import { useData } from "@/lib/store";
import { LinksEditor, MessMenuEditor, PreferencesForm, TimetableEditor } from "@/components/editors";
import { Card, CardHeader, DangerButton, Notice, PrimaryButton, SecondaryButton } from "@/components/ui";

export default function SettingsPage() {
  return (
    <RequireAuth>
      <Settings />
    </RequireAuth>
  );
}

function Settings() {
  const { user, mode, signOut } = useAuth();
  const { state, setLectures, setMessMenus, setLinks, setSettings, updateSettings, loadDemoData, clearAllData } =
    useData();
  const router = useRouter();
  const [confirmClear, setConfirmClear] = useState(false);

  async function handleSignOut() {
    await signOut();
    router.push("/login");
  }

  function restartSetup() {
    updateSettings({ onboardingDone: false });
    router.push("/onboarding");
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Settings</h1>
        <p className="mt-1 text-sm text-slate-500">Everything you set up during onboarding, editable any time.</p>
      </div>

      <Card>
        <CardHeader title="Account" />
        <div className="space-y-1 px-5 py-4 text-sm">
          <p className="text-slate-900">
            <span className="font-medium">Signed in as:</span> {user?.displayName} ({user?.email})
          </p>
          <p className="text-slate-500">
            {mode === "supabase"
              ? "Supabase account — your data syncs to your Supabase project."
              : "Demo mode — no Supabase configured, so data stays in this browser only. Connect Supabase (see README) for real multi-user accounts."}
          </p>
          <div className="pt-2">
            <SecondaryButton onClick={handleSignOut}>Log out</SecondaryButton>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader title="Timetable" subtitle="Your weekly lectures" />
        <div className="px-5 py-4">
          <TimetableEditor lectures={state.lectures} onChange={setLectures} />
        </div>
      </Card>

      <Card>
        <CardHeader title="Mess menu" subtitle="Breakfast, lunch and dinner for each day" />
        <div className="px-5 py-4">
          <MessMenuEditor menus={state.messMenus} onChange={setMessMenus} />
        </div>
      </Card>

      <Card>
        <CardHeader title="Important links" subtitle="Classroom, mess form, anything else you open often" />
        <div className="px-5 py-4">
          <LinksEditor links={state.links} onChange={setLinks} />
        </div>
      </Card>

      <Card>
        <CardHeader title="Reminder preferences" subtitle="The app follows these rules" />
        <div className="px-5 py-4">
          <PreferencesForm settings={state.settings} onChange={setSettings} />
        </div>
      </Card>

      <Card>
        <CardHeader title="Your data" />
        <div className="space-y-3 px-5 py-4">
          {state.settings.demoData ? (
            <Notice tone="amber">
              You are currently using demo data. Replace it by editing the sections above, or load it again
              below.
            </Notice>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <SecondaryButton onClick={loadDemoData}>Load demo data</SecondaryButton>
            <SecondaryButton onClick={restartSetup}>Restart setup wizard</SecondaryButton>
            {confirmClear ? (
              <>
                <DangerButton onClick={() => { clearAllData(); setConfirmClear(false); }}>
                  Yes, clear everything
                </DangerButton>
                <SecondaryButton onClick={() => setConfirmClear(false)}>Cancel</SecondaryButton>
              </>
            ) : (
              <DangerButton onClick={() => setConfirmClear(true)}>Clear all data</DangerButton>
            )}
          </div>
          <p className="text-xs text-slate-500">
            “Clear all data” removes your timetable, assignments, mess menu, links and notes for this account.
            It cannot be undone.
          </p>
        </div>
      </Card>

      <div className="pb-2">
        <PrimaryButton onClick={() => router.push("/")}>Back to dashboard</PrimaryButton>
      </div>
    </div>
  );
}
