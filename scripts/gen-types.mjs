// Generates the core's Scenario types from the hand-written schema, its source of truth.
import { mkdirSync, writeFileSync } from "node:fs";
import { compileFromFile } from "json-schema-to-typescript";

const ts = await compileFromFile("schemas/scenario.schema.json", {
  bannerComment:
    "// Generated from schemas/scenario.schema.json by scripts/gen-types.mjs. Don't edit.",
  cwd: "schemas",
});
mkdirSync("src/core/generated", { recursive: true });
writeFileSync("src/core/generated/scenario.ts", ts);
