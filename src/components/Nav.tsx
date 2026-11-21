// Top navigation. Text links only — no icons, no gradients.

"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { useData } from "@/lib/store";

const LINKS = [
  { href: "/", label: "Today" },
  { href: "/timetable", label: "Timetable" },
  { href: "/assignments", label: "Assignments" },
  { href: "/mess", label: "Mess" },
  { href: "/notes", label: "Notes" },
  { href: "/reminders", label: "Reminders" },
  { href: "/settings", label: "Settings" },
];

export default function Nav() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading, mode, signOut } = useAuth();
  const { state } = useData();

  if (pathname === "/login" || pathname === "/signup" || pathname === "/onboarding") {
    return null;
  }

  async function handleSignOut() {
    await signOut();
    router.push("/login");
  }

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
        <Link href="/" className="text-base font-semibold tracking-tight text-slate-900">
          Student<span className="text-blue-600"> Dashboard</span>
        </Link>
        <nav className="flex flex-1 flex-wrap items-center gap-1 overflow-x-auto">
          {LINKS.map((l) => {
            const active = pathname === l.href;
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                  active ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>
        <div className="flex items-center gap-3">
          {state.settings.demoData ? (
            <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-800">
              Demo data
            </span>
          ) : null}
          {mode === "demo" ? (
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
              Demo mode
            </span>
          ) : null}
          {loading ? null : user ? (
            <>
              <span className="hidden text-sm text-slate-600 sm:inline">{user.displayName}</span>
              <button onClick={handleSignOut} className="rounded-md px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100">
                Log out
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className="rounded-md px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100">
                Log in
              </Link>
              <Link href="/signup" className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700">
                Sign up
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
