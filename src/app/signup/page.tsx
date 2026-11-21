// Sign up — Supabase email/password when configured, local demo profile otherwise.

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { Card, Field, Notice, PrimaryButton, TextInput } from "@/components/ui";

export default function SignupPage() {
  const { user, loading, mode, signUp, signInDemo } = useAuth();
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user) router.replace("/");
  }, [user, loading, router]);

  async function handleSupabaseSignup() {
    setBusy(true);
    setError(null);
    setInfo(null);
    const res = await signUp(email.trim(), password, displayName.trim() || email.split("@")[0]);
    setBusy(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    if (res.needsConfirmation) {
      setInfo("Account created. Check your email to confirm it, then log in.");
      return;
    }
    router.push("/");
  }

  function handleDemoSignup() {
    signInDemo(displayName.trim() || "Demo Student", email.trim());
    router.push("/");
  }

  return (
    <div className="mx-auto max-w-md pt-8">
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Create your account</h1>
      <p className="mt-1 text-sm text-slate-500">
        One account, your own timetable, mess menu, assignments and notes.
      </p>

      <Card className="mt-6">
        <div className="space-y-4 px-5 py-6">
          {mode === "demo" ? (
            <Notice tone="blue">
              Demo mode — Supabase is not configured, so this creates a profile in this browser only. Your
              data never leaves this device. Connect Supabase (see README) for real accounts.
            </Notice>
          ) : null}

          {error ? <Notice tone="amber">{error}</Notice> : null}
          {info ? <Notice tone="green">{info}</Notice> : null}

          <Field label="Your name">
            <TextInput value={displayName} placeholder="e.g. Husnain Sattar" onChange={(e) => setDisplayName(e.target.value)} />
          </Field>
          <Field label="Email">
            <TextInput type="email" value={email} placeholder="you@example.com" onChange={(e) => setEmail(e.target.value)} />
          </Field>
          {mode === "supabase" ? (
            <Field label="Password" hint="At least 6 characters.">
              <TextInput
                type="password"
                value={password}
                placeholder="Choose a password"
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void handleSupabaseSignup();
                }}
              />
            </Field>
          ) : null}

          {mode === "demo" ? (
            <PrimaryButton className="w-full" onClick={handleDemoSignup}>
              Create demo profile
            </PrimaryButton>
          ) : (
            <PrimaryButton
              className="w-full"
              onClick={handleSupabaseSignup}
              disabled={busy || !email || password.length < 6}
            >
              {busy ? "Creating account…" : "Sign up"}
            </PrimaryButton>
          )}

          <p className="text-center text-sm text-slate-500">
            Already have an account?{" "}
            <Link href="/login" className="font-medium text-blue-600 hover:text-blue-700">
              Log in
            </Link>
          </p>
        </div>
      </Card>
    </div>
  );
}
