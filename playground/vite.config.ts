import { readFileSync } from "node:fs";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const { version } = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
) as { version: string };

// #14 §6.6. CodeMirror 6 injects <style> elements, hence 'unsafe-inline' for styles.
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "connect-src https://api.github.com https://raw.githubusercontent.com",
  "object-src 'none'",
  "base-uri 'none'",
].join("; ");

export default defineConfig({
  base: "/whynorun/",
  plugins: [
    react(),
    {
      // Build only: the dev server's React refresh preamble is an inline script.
      name: "whynorun-csp",
      apply: "build",
      transformIndexHtml: () => [
        {
          tag: "meta",
          attrs: { "http-equiv": "Content-Security-Policy", content: CSP },
          injectTo: "head-prepend",
        },
      ],
    },
  ],
  define: { __VERSION__: JSON.stringify(version) },
  build: { license: { fileName: "THIRD_PARTY_LICENSES.md" } },
});
