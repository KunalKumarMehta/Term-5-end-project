// Generates the core's types and validators from the hand-written schemas, their source of truth.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import Ajv from "ajv";
import standaloneCode from "ajv/dist/standalone/index.js";
import { compileFromFile } from "json-schema-to-typescript";

const read = (file) => JSON.parse(readFileSync(file, "utf8"));
const scenario = read("schemas/scenario.schema.json");
mkdirSync("src/core/generated", { recursive: true });

for (const name of ["scenario", "test-file"]) {
  const banner = `// Generated from schemas/${name}.schema.json by scripts/gen-types.mjs. Don't edit.`;
  const ts = await compileFromFile(`schemas/${name}.schema.json`, {
    bannerComment: banner,
    cwd: "schemas",
  });
  writeFileSync(`src/core/generated/${name}.ts`, ts);

  // Precompiled, because the playground's CSP blocks the new Function that Ajv.compile needs.
  const ajv = new Ajv({ allErrors: true, code: { source: true, esm: true } });
  // A Test file's scenario: is the Scenario schema, by $ref.
  if (name !== "scenario") ajv.addSchema(scenario);
  const schema = read(`schemas/${name}.schema.json`);
  const validator = standaloneCode(ajv, ajv.compile(schema)).replaceAll(
    // Ajv's runtime helper is CommonJS; this counts code points just as it does.
    'require("ajv/dist/runtime/ucs2length").default',
    "((s) => [...s].length)",
  );
  if (validator.includes("require(")) {
    console.error(
      "The standalone validator needs a runtime import; inline it.",
    );
    process.exit(1);
  }
  writeFileSync(
    `src/core/generated/validate-${name}.ts`,
    `${banner}\n// @ts-nocheck\n${validator}\n`,
  );
}
