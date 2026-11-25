// Shared types for the Student Dashboard.
// Day of week follows JavaScript Date.getDay(): 0 = Sunday ... 6 = Saturday.

export interface Lecture {
  id: string;
  day: number; // 0-6
  subject: string;
  teacher: string;
  room: string;
  start: string; // "HH:MM" 24h
  end: string; // "HH:MM" 24h
}

export type AssignmentStatus = "pending" | "submitted" | "missing";

export interface Assignment {
  id: string;
  course: string;
  title: string;
  due: string | null; // ISO date "YYYY-MM-DD" or null when no due date yet
  status: AssignmentStatus;
}

export interface MessMenu {
  day: number; // 0-6
  breakfast: string;
  lunch: string;
  dinner: string;
}

export interface MessDayStatus {
  breakfast: boolean;
  lunch: boolean;
  dinner: boolean;
}

export interface SavedLink {
  id: string;
  label: string;
  url: string;
}

export interface LectureReminderOverride {
  enabled: boolean;
  minutesBefore: number;
}

export interface AssignmentReminderOverride {
  enabled: boolean;
  hoursBefore: number;
}

export interface Settings {
  lectureReminderMinutes: number;
  assignmentReminderHours: number;
  // Per-lecture overrides, keyed by lecture id. Missing entry = use the
  // global lectureReminderMinutes above. An entry with enabled: false
  // silences reminders for that lecture entirely.
  lectureReminders?: Record<string, LectureReminderOverride>;
  // Per-assignment overrides, keyed by assignment id. Same rules as above;
  // hoursBefore counts back from the end of the due day.
  assignmentReminders?: Record<string, AssignmentReminderOverride>;
  mealsToTrack: { breakfast: boolean; lunch: boolean; dinner: boolean };
  quietHoursEnabled: boolean;
  quietHoursStart: string; // "HH:MM"
  quietHoursEnd: string; // "HH:MM"
  onboardingDone: boolean;
  demoData: boolean; // true when the current data is the demo seed
}

export interface Note {
  id: string;
  title: string;
  content: string;
  createdAt: string; // ISO timestamp
  folder?: string; // e.g. "PDC" — empty means no folder
  tags?: string[]; // e.g. ["MPI", "parallel"]
}

export interface AppState {
  lectures: Lecture[];
  assignments: Assignment[];
  messMenus: MessMenu[];
  messStatus: Record<string, MessDayStatus>; // key: "YYYY-MM-DD"
  links: SavedLink[];
  settings: Settings;
  notes: Note[];
}

export const DEFAULT_SETTINGS: Settings = {
  lectureReminderMinutes: 30,
  assignmentReminderHours: 48,
  lectureReminders: {},
  assignmentReminders: {},
  mealsToTrack: { breakfast: true, lunch: true, dinner: true },
  quietHoursEnabled: true,
  quietHoursStart: "22:00",
  quietHoursEnd: "07:00",
  onboardingDone: false,
  demoData: false,
};

export function emptyState(): AppState {
  return {
    lectures: [],
    assignments: [],
    messMenus: [0, 1, 2, 3, 4, 5, 6].map((day) => ({
      day,
      breakfast: "",
      lunch: "",
      dinner: "",
    })),
    messStatus: {},
    links: [],
    settings: { ...DEFAULT_SETTINGS },
    notes: [],
  };
}
