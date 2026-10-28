import { readFileSync } from "node:fs";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const { version } = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
) as { version: string };

export default defineConfig({
  base: "/whynorun/",
  plugins: [react()],
  define: { __VERSION__: JSON.stringify(version) },
  build: { license: { fileName: "THIRD_PARTY_LICENSES.md" } },
});
