// App shell: providers, navigation, and the auth/onboarding gate.
// Client component — auth state lives in the browser (Supabase session or a
// local demo profile), so the static shell renders first and the gate runs
// after hydration.

"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AuthProvider, useAuth } from "@/lib/auth";
import { DataProvider, useData } from "@/lib/store";
import Nav from "./Nav";

const PUBLIC_PATHS = ["/login", "/signup", "/onboarding"];

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const { state, ready } = useData();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading || !ready) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (!state.settings.onboardingDone && pathname !== "/onboarding") {
      router.replace("/onboarding");
    }
  }, [user, loading, ready, state.settings.onboardingDone, pathname, router]);

  if (loading || !ready) {
    return (
      <div className="py-16 text-center text-sm text-slate-500">Loading your dashboard…</div>
    );
  }
  if (!user) return null;
  if (!state.settings.onboardingDone && pathname !== "/onboarding") return null;
  return <>{children}</>;
}

export default function Shell({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <DataProvider>
        <Nav />
        <main className="mx-auto w-full max-w-6xl px-4 py-6">{children}</main>
        <footer className="border-t border-slate-200 py-4">
          <p className="mx-auto max-w-6xl px-4 text-xs text-slate-400">
            Student Dashboard — your timetable, assignments, mess and notes in one place.
          </p>
        </footer>
      </DataProvider>
    </AuthProvider>
  );
}

export { PUBLIC_PATHS };
