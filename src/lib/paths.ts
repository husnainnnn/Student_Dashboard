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
