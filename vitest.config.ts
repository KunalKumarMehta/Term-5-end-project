import { readFileSync } from "node:fs";
import { defineConfig } from "vitest/config";

const { version } = JSON.parse(readFileSync("package.json", "utf8")) as {
  version: string;
};

export default defineConfig({
  define: { __VERSION__: JSON.stringify(version) },
  test: {
    include: ["src/**/*.test.ts", "scripts/**/*.test.ts"],
    // Node can't import its JSON schema without an import attribute (actions/languageservices#387).
    server: { deps: { inline: ["@actions/workflow-parser"] } },
  },
});
