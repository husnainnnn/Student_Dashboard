// Base path of the deployed site, derived in the browser.
// The site is served at / locally and at /Student_Dashboard/ on GitHub
// Pages. Pages that need a static file from public/ (the timetable
// template, the pdf.js worker) build their URL with this prefix.

export function appBasePath(): string {
  if (typeof window === "undefined") return "";
  const parts = window.location.pathname.split("/").filter(Boolean);
  // This app's pages live one level deep (/timetable, /onboarding, ...),
  // so the last segment is the page and whatever is left is the base path.
  parts.pop();
  return parts.length ? `/${parts.join("/")}` : "";
}

// Known app routes, used to normalise the browser pathname.
// usePathname() returns the deployed path including the base path and the
// trailing slash (e.g. "/Student_Dashboard/onboarding/"), so comparing it
// against a bare route ("/onboarding") never matches on GitHub Pages.
// normalizePathname() strips both and returns the bare route.
const KNOWN_ROUTES = [
  "/login",
  "/signup",
  "/onboarding",
  "/timetable",
  "/assignments",
  "/mess",
  "/notes",
  "/reminders",
  "/settings",
];

export function normalizePathname(pathname: string | null): string {
  if (!pathname) return "/";
  const trimmed = pathname.replace(/\/+$/, "") || "/";
  if (trimmed === "/") return "/";
  for (const route of KNOWN_ROUTES) {
    if (trimmed === route || trimmed.endsWith(route)) return route;
  }
  return "/";
}
