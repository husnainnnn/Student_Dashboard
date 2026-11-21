// Log in — Supabase email/password when configured, local demo profile otherwise.

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { Card, Field, Notice, PrimaryButton, TextInput } from "@/components/ui";

export default function LoginPage() {
  const { user, loading, mode, signIn, signInDemo } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user) router.replace("/");
  }, [user, loading, router]);

  async function handleSupabaseLogin() {
    setBusy(true);
    setError(null);
    const res = await signIn(email.trim(), password);
    setBusy(false);
    if (res.error) setError(res.error);
    else router.push("/");
  }

  function handleDemoLogin() {
    signInDemo(displayName.trim() || "Demo Student", email.trim());
    router.push("/");
  }

  return (
    <div className="mx-auto max-w-md pt-8">
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Log in</h1>
      <p className="mt-1 text-sm text-slate-500">Welcome back to your Student Dashboard.</p>

      <Card className="mt-6">
        <div className="space-y-4 px-5 py-6">
          {mode === "demo" ? (
            <Notice tone="blue">
              Demo mode — Supabase is not configured, so this creates a profile in this browser only. Your
              data never leaves this device. Connect Supabase (see README) for real accounts.
            </Notice>
          ) : null}

          {mode === "demo" ? (
            <>
              <Field label="Your name">
                <TextInput value={displayName} placeholder="e.g. Husnain Sattar" onChange={(e) => setDisplayName(e.target.value)} />
              </Field>
              <Field label="Email (optional)">
                <TextInput type="email" value={email} placeholder="you@example.com" onChange={(e) => setEmail(e.target.value)} />
              </Field>
              <PrimaryButton className="w-full" onClick={handleDemoLogin}>
                Continue
              </PrimaryButton>
            </>
          ) : (
            <>
              {error ? <Notice tone="amber">{error}</Notice> : null}
              <Field label="Email">
                <TextInput type="email" value={email} placeholder="you@example.com" onChange={(e) => setEmail(e.target.value)} />
              </Field>
              <Field label="Password">
                <TextInput
                  type="password"
                  value={password}
                  placeholder="Your password"
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void handleSupabaseLogin();
                  }}
                />
              </Field>
              <PrimaryButton className="w-full" onClick={handleSupabaseLogin} disabled={busy || !email || !password}>
                {busy ? "Logging in…" : "Log in"}
              </PrimaryButton>
            </>
          )}

          <p className="text-center text-sm text-slate-500">
            No account yet?{" "}
            <Link href="/signup" className="font-medium text-blue-600 hover:text-blue-700">
              Sign up
            </Link>
          </p>
        </div>
      </Card>
    </div>
  );
}
