// DEMO SEED DATA — clearly marked as demo.
// This is Husnain Sattar's real BCS-7E timetable and assignments, used only so
// a new user (or anyone trying the app) sees a realistic dashboard out of the
// box. Every student replaces it with their own data during onboarding or from
// Settings. Nothing here is hardcoded as "the" data — it is just the seed.

import type { AppState } from "./types";
import { DEFAULT_SETTINGS } from "./types";

export const DEMO_LECTURES = [
  { day: 1, subject: "Parallel and Distributed Computing", teacher: "Ms. Mahzaib", room: "R-8", start: "10:15", end: "11:40" },
  { day: 1, subject: "Professional Practices in IT", teacher: "Mr. Hassan", room: "R-13", start: "12:45", end: "13:45" },
  { day: 1, subject: "Data Science", teacher: "Dr. Rabia", room: "Seminar Hall", start: "15:15", end: "16:40" },
  { day: 2, subject: "Parallel and Distributed Computing", teacher: "Ms. Mahzaib", room: "R-5", start: "08:45", end: "10:10" },
  { day: 2, subject: "Compiler Construction", teacher: "Dr. Tayyab", room: "R-30", start: "10:15", end: "11:40" },
  { day: 3, subject: "PPIT Seminar", teacher: "Dr. Usman, Mr. Muiz, Mr. Hassan", room: "Auditorium", start: "11:45", end: "14:15" },
  { day: 3, subject: "Professional Practices in IT", teacher: "Mr. Hassan", room: "R-32", start: "14:15", end: "15:45" },
  { day: 4, subject: "Compiler Construction", teacher: "Dr. Tayyab", room: "R-32", start: "10:15", end: "11:40" },
  { day: 4, subject: "Data Science", teacher: "Dr. Rabia", room: "Seminar Hall", start: "15:15", end: "16:40" },
];

export const DEMO_ASSIGNMENTS = [
  { course: "Compiler Construction", title: "CC Assignment 5", due: "2026-11-26" },
  { course: "Professional Practices in IT", title: "PPIT Seminar Report", due: "2026-12-01" },
  { course: "Professional Practices in IT", title: "PPIT Presentation — Slides Submission", due: "2026-12-04" },
  { course: "Compiler Construction", title: "CC Project", due: null },
];

// Placeholder weekly mess menu — edit it in Settings to match your hostel.
export const DEMO_MESS_MENU: Record<number, { breakfast: string; lunch: string; dinner: string }> = {
  0: { breakfast: "Paratha, Omelette, Chai", lunch: "Daal Chawal", dinner: "Chicken Karahi, Roti" },
  1: { breakfast: "Bread, Egg, Chai", lunch: "Aloo Gosht, Roti", dinner: "Daal Mash, Rice" },
  2: { breakfast: "Paratha, Chai", lunch: "Chicken Biryani, Raita", dinner: "Mix Sabzi, Roti" },
  3: { breakfast: "Bread, Egg, Chai", lunch: "Daal Chana, Rice", dinner: "Beef Qorma, Roti" },
  4: { breakfast: "Paratha, Omelette, Chai", lunch: "Aloo Palak, Roti", dinner: "Chicken Pulao, Salad" },
  5: { breakfast: "Halwa Puri, Chai", lunch: "—", dinner: "Daal, Rice" },
  6: { breakfast: "Bread, Egg, Chai", lunch: "Chicken Karahi, Roti", dinner: "Mix Daal, Rice" },
};

export const DEMO_LINKS = [
  { label: "Google Classroom", url: "https://classroom.google.com" },
  { label: "Mess Attendance Form", url: "https://forms.gle/UxMZ3fyf5zcCh8gt7" },
];

export const DEMO_NOTE = {
  title: "PDC — MPI Basics",
  content: `Message Passing Interface (MPI) is the standard for parallel programs that run on distributed memory machines. Each process has its own memory and its own rank, and processes talk to each other only by sending messages.

MPI_Send and MPI_Recv are the basic blocking calls. A blocking send does not return until the message data is safe to reuse, and a blocking receive does not return until the message has arrived. If every process sends first and nobody receives, the program deadlocks — all processes wait forever. The usual fix is to order the calls, use MPI_Sendrecv, or use non-blocking calls (MPI_Isend / MPI_Irecv) with MPI_Wait.

Collective operations involve all processes in a communicator. MPI_Bcast sends one value from the root to everyone. MPI_Reduce combines values from all processes (sum, max, and so on) onto the root. MPI_Scatter splits an array across processes and MPI_Gather collects the pieces back.

Performance is measured with speedup and efficiency. Speedup is serial time divided by parallel time. Amdahl's law says the serial fraction of a program limits the maximum speedup, no matter how many processes you add. Communication overhead, load imbalance, and serial sections are the three usual reasons a parallel program is slower than expected.`,
};

function uid(prefix: string, n: number): string {
  return `demo-${prefix}-${n}`;
}

export function buildDemoState(): AppState {
  return {
    lectures: DEMO_LECTURES.map((l, i) => ({ ...l, id: uid("lecture", i + 1) })),
    assignments: DEMO_ASSIGNMENTS.map((a, i) => ({
      ...a,
      id: uid("assignment", i + 1),
      status: "pending" as const,
    })),
    messMenus: [0, 1, 2, 3, 4, 5, 6].map((day) => ({
      day,
      ...DEMO_MESS_MENU[day],
    })),
    messStatus: {
      // Saturday 21 Nov 2026 — breakfast, lunch and dinner booked.
      "2026-11-21": { breakfast: true, lunch: true, dinner: true },
    },
    links: DEMO_LINKS.map((l, i) => ({ ...l, id: uid("link", i + 1) })),
    settings: {
      ...DEFAULT_SETTINGS,
      lectureReminderMinutes: 30,
      assignmentReminderHours: 48,
      onboardingDone: true,
      demoData: true,
    },
    notes: [
      {
        id: uid("note", 1),
        title: DEMO_NOTE.title,
        content: DEMO_NOTE.content,
        createdAt: "2026-11-21T10:00:00.000Z",
        folder: "PDC",
        tags: ["MPI", "parallel"],
      },
    ],
  };
}
