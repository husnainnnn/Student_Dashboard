// Per-user data store, client-side only.
//  - Demo mode (no Supabase env vars): everything in localStorage, keyed by
//    user id. Runs out of the box with zero setup.
//  - Supabase mode: the same state syncs to Supabase tables (one row per
//    entity, user_id = auth.uid()). If the tables do not exist yet (schema
//    not run), it falls back to localStorage and shows a warning — the app
//    never breaks because of a missing backend.

"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useAuth } from "./auth";
import { getSupabase } from "./supabase";
import { buildDemoState } from "./demo-data";
import type {
  AppState,
  Assignment,
  Lecture,
  MessDayStatus,
  MessMenu,
  Note,
  SavedLink,
  Settings,
} from "./types";
import { emptyState } from "./types";

function localKey(userId: string): string {
  return `sd-data-${userId}`;
}

function uid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export { uid };

interface DataContextValue {
  state: AppState;
  ready: boolean;
  cloudError: string | null;
  // lectures
  addLecture: (l: Omit<Lecture, "id">) => void;
  updateLecture: (id: string, l: Omit<Lecture, "id">) => void;
  deleteLecture: (id: string) => void;
  setLectures: (ls: Lecture[]) => void;
  // assignments
  addAssignment: (a: Omit<Assignment, "id" | "status">) => void;
  updateAssignment: (id: string, a: Partial<Assignment>) => void;
  deleteAssignment: (id: string) => void;
  setAssignments: (as: Assignment[]) => void;
  // mess
  setMessMenus: (ms: MessMenu[]) => void;
  setMessStatus: (dateKey: string, s: MessDayStatus) => void;
  // links
  addLink: (label: string, url: string) => void;
  deleteLink: (id: string) => void;
  setLinks: (ls: SavedLink[]) => void;
  // notes
  addNote: (title: string, content: string) => void;
  deleteNote: (id: string) => void;
  // settings + setup
  updateSettings: (patch: Partial<Settings>) => void;
  setSettings: (s: Settings) => void;
  loadDemoData: () => void;
  clearAllData: () => void;
  replaceState: (s: AppState) => void;
}

const DataContext = createContext<DataContextValue | null>(null);

// ---------- Supabase mapping ----------

type Row = Record<string, unknown>;

function toLecture(r: Row): Lecture {
  return { id: String(r.id), day: Number(r.day), subject: String(r.subject), teacher: String(r.teacher ?? ""), room: String(r.room ?? ""), start: String(r.start_time), end: String(r.end_time) };
}
function toAssignment(r: Row): Assignment {
  return { id: String(r.id), course: String(r.course), title: String(r.title), due: (r.due_date as string | null) ?? null, status: (r.status as Assignment["status"]) ?? "pending" };
}
function toMessMenu(r: Row): MessMenu {
  return { day: Number(r.day), breakfast: String(r.breakfast ?? ""), lunch: String(r.lunch ?? ""), dinner: String(r.dinner ?? "") };
}
function toLink(r: Row): SavedLink {
  return { id: String(r.id), label: String(r.label), url: String(r.url) };
}
function toNote(r: Row): Note {
  return { id: String(r.id), title: String(r.title), content: String(r.content ?? ""), createdAt: String(r.created_at ?? new Date().toISOString()) };
}

async function loadFromSupabase(userId: string): Promise<AppState | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const [lec, asg, menus, status, links, notes, settings] = await Promise.all([
    supabase.from("lectures").select("*").eq("user_id", userId),
    supabase.from("assignments").select("*").eq("user_id", userId),
    supabase.from("mess_menus").select("*").eq("user_id", userId),
    supabase.from("mess_status").select("*").eq("user_id", userId),
    supabase.from("links").select("*").eq("user_id", userId),
    supabase.from("notes").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
    supabase.from("user_settings").select("*").eq("user_id", userId).maybeSingle(),
  ]);
  for (const res of [lec, asg, menus, status, links, notes, settings]) {
    if (res.error) throw new Error(res.error.message);
  }
  const state = emptyState();
  state.lectures = ((lec.data ?? []) as Row[]).map(toLecture).sort((a, b) => a.day - b.day || a.start.localeCompare(b.start));
  state.assignments = ((asg.data ?? []) as Row[]).map(toAssignment);
  const menuMap = new Map<number, MessMenu>();
  ((menus.data ?? []) as Row[]).map(toMessMenu).forEach((m) => menuMap.set(m.day, m));
  state.messMenus = [0, 1, 2, 3, 4, 5, 6].map((day) => menuMap.get(day) ?? { day, breakfast: "", lunch: "", dinner: "" });
  state.messStatus = {};
  ((status.data ?? []) as Row[]).forEach((r) => {
    state.messStatus[String(r.date)] = { breakfast: Boolean(r.breakfast), lunch: Boolean(r.lunch), dinner: Boolean(r.dinner) };
  });
  state.links = ((links.data ?? []) as Row[]).map(toLink);
  state.notes = ((notes.data ?? []) as Row[]).map(toNote);
  if (settings.data && (settings.data as Row).settings) {
    state.settings = { ...(settings.data as Row).settings as Settings };
  }
  // No rows at all yet = brand-new user, not an error.
  return state;
}

async function syncTable(
  supabase: NonNullable<ReturnType<typeof getSupabase>>,
  table: string,
  userId: string,
  rows: Row[]
): Promise<void> {
  if (rows.length > 0) {
    const { error } = await supabase.from(table).upsert(rows, { onConflict: "id" });
    if (error) throw new Error(error.message);
  }
  const ids = rows.map((r) => String(r.id));
  let q = supabase.from(table).delete().eq("user_id", userId);
  if (ids.length > 0) q = q.not("id", "in", `(${ids.map((i) => `"${i}"`).join(",")})`);
  const { error } = await q;
  if (error) throw new Error(error.message);
}

async function saveToSupabase(userId: string, state: AppState): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;
  await syncTable(supabase, "lectures", userId, state.lectures.map((l) => ({ id: l.id, user_id: userId, day: l.day, subject: l.subject, teacher: l.teacher, room: l.room, start_time: l.start, end_time: l.end })));
  await syncTable(supabase, "assignments", userId, state.assignments.map((a) => ({ id: a.id, user_id: userId, course: a.course, title: a.title, due_date: a.due, status: a.status })));
  await syncTable(supabase, "mess_menus", userId, state.messMenus.map((m) => ({ id: `${userId}-menu-${m.day}`, user_id: userId, day: m.day, breakfast: m.breakfast, lunch: m.lunch, dinner: m.dinner })));
  await syncTable(supabase, "mess_status", userId, Object.entries(state.messStatus).map(([date, s]) => ({ id: `${userId}-status-${date}`, user_id: userId, date, breakfast: s.breakfast, lunch: s.lunch, dinner: s.dinner })));
  await syncTable(supabase, "links", userId, state.links.map((l) => ({ id: l.id, user_id: userId, label: l.label, url: l.url })));
  await syncTable(supabase, "notes", userId, state.notes.map((n) => ({ id: n.id, user_id: userId, title: n.title, content: n.content, created_at: n.createdAt })));
  const { error } = await supabase.from("user_settings").upsert({ user_id: userId, settings: state.settings }, { onConflict: "user_id" });
  if (error) throw new Error(error.message);
}

// ---------- Provider ----------

export function DataProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [state, setState] = useState<AppState>(() => emptyState());
  const [ready, setReady] = useState(false);
  const [cloudError, setCloudError] = useState<string | null>(null);
  const loadedForRef = useRef<string | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load when the user changes.
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setState(emptyState());
      setReady(true);
      loadedForRef.current = null;
      return;
    }
    let cancelled = false;
    setReady(false);
    (async () => {
      const key = localKey(user.id);
      // Try Supabase first when configured; fall back to local on any error.
      if (getSupabase()) {
        try {
          const cloud = await loadFromSupabase(user.id);
          if (!cancelled && cloud) {
            setState(cloud);
            localStorage.setItem(key, JSON.stringify(cloud));
            setCloudError(null);
            loadedForRef.current = user.id;
            setReady(true);
            return;
          }
        } catch (e) {
          if (!cancelled) {
            setCloudError(e instanceof Error ? e.message : "Supabase is not reachable — using local data.");
          }
        }
      }
      // Local fallback (also the only path in demo mode).
      try {
        const raw = localStorage.getItem(key);
        if (raw) {
          const parsed = JSON.parse(raw) as AppState;
          if (!cancelled) setState({ ...emptyState(), ...parsed, settings: { ...emptyState().settings, ...parsed.settings } });
        } else {
          if (!cancelled) setState(emptyState());
        }
      } catch {
        if (!cancelled) setState(emptyState());
      }
      if (!cancelled) {
        loadedForRef.current = user.id;
        setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, authLoading]);

  // Persist (debounced) after the initial load.
  useEffect(() => {
    if (!ready || !user || loadedForRef.current !== user.id) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      localStorage.setItem(localKey(user.id), JSON.stringify(state));
      if (getSupabase()) {
        saveToSupabase(user.id, state).catch((e: unknown) => {
          setCloudError(e instanceof Error ? e.message : "Could not save to Supabase — data is kept locally.");
        });
      }
    }, 400);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [state, ready, user]);

  const update = useCallback((fn: (prev: AppState) => AppState) => {
    setState((prev) => fn(prev));
  }, []);

  const value: DataContextValue = {
    state,
    ready,
    cloudError,
    addLecture: (l) => update((p) => ({ ...p, lectures: [...p.lectures, { ...l, id: uid() }] })),
    updateLecture: (id, l) => update((p) => ({ ...p, lectures: p.lectures.map((x) => (x.id === id ? { ...l, id } : x)) })),
    deleteLecture: (id) => update((p) => ({ ...p, lectures: p.lectures.filter((x) => x.id !== id) })),
    setLectures: (lectures) => update((p) => ({ ...p, lectures })),
    addAssignment: (a) => update((p) => ({ ...p, assignments: [...p.assignments, { ...a, id: uid(), status: "pending" }] })),
    updateAssignment: (id, patch) => update((p) => ({ ...p, assignments: p.assignments.map((x) => (x.id === id ? { ...x, ...patch } : x)) })),
    deleteAssignment: (id) => update((p) => ({ ...p, assignments: p.assignments.filter((x) => x.id !== id) })),
    setAssignments: (assignments) => update((p) => ({ ...p, assignments })),
    setMessMenus: (messMenus) => update((p) => ({ ...p, messMenus })),
    setMessStatus: (dateKey, s) => update((p) => ({ ...p, messStatus: { ...p.messStatus, [dateKey]: s } })),
    addLink: (label, url) => update((p) => ({ ...p, links: [...p.links, { id: uid(), label, url }] })),
    deleteLink: (id) => update((p) => ({ ...p, links: p.links.filter((x) => x.id !== id) })),
    setLinks: (links) => update((p) => ({ ...p, links })),
    addNote: (title, content) => update((p) => ({ ...p, notes: [{ id: uid(), title, content, createdAt: new Date().toISOString() }, ...p.notes] })),
    deleteNote: (id) => update((p) => ({ ...p, notes: p.notes.filter((x) => x.id !== id) })),
    updateSettings: (patch) => update((p) => ({ ...p, settings: { ...p.settings, ...patch } })),
    setSettings: (settings) => update((p) => ({ ...p, settings })),
    loadDemoData: () => update(() => buildDemoState()),
    clearAllData: () => update((p) => ({ ...emptyState(), settings: { ...p.settings, demoData: false } })),
    replaceState: (s) => update(() => s),
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData(): DataContextValue {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData must be used inside DataProvider");
  return ctx;
}
