// Generates the core's Scenario types and validator from the hand-written schema, its source of truth.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import Ajv from "ajv";
import standaloneCode from "ajv/dist/standalone/index.js";
import { compileFromFile } from "json-schema-to-typescript";

const banner =
  "// Generated from schemas/scenario.schema.json by scripts/gen-types.mjs. Don't edit.";
const ts = await compileFromFile("schemas/scenario.schema.json", {
  bannerComment: banner,
  cwd: "schemas",
});
mkdirSync("src/core/generated", { recursive: true });
writeFileSync("src/core/generated/scenario.ts", ts);

// Precompiled, because the playground's CSP blocks the new Function that Ajv.compile needs.
const schema = JSON.parse(readFileSync("schemas/scenario.schema.json", "utf8"));
const ajv = new Ajv({ allErrors: true, code: { source: true, esm: true } });
const validator = standaloneCode(ajv, ajv.compile(schema)).replaceAll(
  // Ajv's runtime helper is CommonJS; this counts code points just as it does.
  'require("ajv/dist/runtime/ucs2length").default',
  "((s) => [...s].length)",
);
if (validator.includes("require(")) {
  console.error("The standalone validator needs a runtime import; inline it.");
  process.exit(1);
}
writeFileSync(
  "src/core/generated/validate-scenario.ts",
  `${banner}\n// @ts-nocheck\n${validator}\n`,
);
