import type { NextConfig } from "next";

// GitHub Pages serves the site under /Student_Dashboard/, so the base path
// is only set when building for Pages (GITHUB_PAGES=true in the workflow).
// Local builds and other hosts keep the root path.
const nextConfig: NextConfig = {
  output: "export",
  basePath: process.env.GITHUB_PAGES === "true" ? "/Student_Dashboard" : "",
  trailingSlash: true,
  /* config options here */
  // Cache Components (and its PPR) cannot run in static export mode,
  // so they stay off for the GitHub Pages build. The app is fully
  // client-side, so nothing here depends on them.
  cacheComponents: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
