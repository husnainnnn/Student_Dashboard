// Top navigation. Text links only — no icons, no gradients.

"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { useData } from "@/lib/store";
import { normalizePathname } from "@/lib/paths";

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
  // Live pathname carries the base path + trailing slash
  // ("/Student_Dashboard/mess/"), so compare the normalised route.
  const path = normalizePathname(pathname);
  const router = useRouter();
  const { user, loading, mode, signOut } = useAuth();
  const { state } = useData();
  const [open, setOpen] = useState(false);

  if (path === "/login" || path === "/signup" || path === "/onboarding") {
    return null;
  }

  async function handleSignOut() {
    await signOut();
    setOpen(false);
    router.push("/login");
  }

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
        <Link
          href="/"
          className="shrink-0 text-base font-semibold tracking-tight text-slate-900"
          onClick={() => setOpen(false)}
        >
          Student<span className="text-blue-600"> Dashboard</span>
        </Link>
        {/* Desktop nav — inline links. Hidden on small screens, where the
            menu button below opens the same links as a vertical list. */}
        <nav className="hidden flex-1 flex-wrap items-center gap-1 md:flex">
          {LINKS.map((l) => {
            const active = path === l.href;
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`whitespace-nowrap rounded-md px-2.5 py-1.5 text-sm font-medium ${
                  active ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>
        {/* Desktop account cluster. Hidden on small screens — the same
            controls live in the mobile menu panel. */}
        <div className="hidden items-center gap-3 md:flex">
          {state.settings.demoData ? (
            <span className="hidden rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-800 lg:inline-block">
              Demo data
            </span>
          ) : null}
          {mode === "demo" ? (
            <span className="hidden rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600 lg:inline-block">
              Demo mode
            </span>
          ) : null}
          {loading ? null : user ? (
            <>
              <span className="text-sm text-slate-600">{user.displayName}</span>
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
        {/* Mobile menu button — only below the md breakpoint. */}
        <button
          type="button"
          className="ml-auto inline-flex items-center justify-center rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 md:hidden"
          aria-expanded={open}
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? "Close" : "Menu"}
        </button>
      </div>
      {/* Mobile menu panel — the same links as a vertical list, plus the
          account controls. Only below the md breakpoint. */}
      {open ? (
        <nav className="border-t border-slate-100 px-4 pb-3 pt-2 md:hidden">
          <div className="flex flex-col gap-1">
            {LINKS.map((l) => {
              const active = path === l.href;
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className={`rounded-md px-3 py-2 text-sm font-medium ${
                    active ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  }`}
                >
                  {l.label}
                </Link>
              );
            })}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
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
                <span className="text-sm text-slate-600">{user.displayName}</span>
                <button onClick={handleSignOut} className="rounded-md px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100">
                  Log out
                </button>
              </>
            ) : (
              <>
                <Link href="/login" onClick={() => setOpen(false)} className="rounded-md px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100">
                  Log in
                </Link>
                <Link href="/signup" onClick={() => setOpen(false)} className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700">
                  Sign up
                </Link>
              </>
            )}
          </div>
        </nav>
      ) : null}
    </header>
  );
}
