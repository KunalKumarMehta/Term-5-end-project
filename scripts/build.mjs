// Builds dist/ from scratch: the CLI bundle plus the licences of every package bundled into it.
import { build } from "esbuild";
import { readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const readJson = (file) => JSON.parse(readFileSync(file, "utf8"));
const { version } = readJson("package.json");

rmSync("dist", { recursive: true, force: true });

const { metafile } = await build({
  entryPoints: ["src/cli/index.ts"],
  outfile: "dist/whynorun.mjs",
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  define: { __VERSION__: JSON.stringify(version) },
  metafile: true,
});

// The innermost node_modules/<name>/ (or node_modules/@scope/name/) of each bundled input.
const packageDirs = new Set();
for (const input of Object.keys(metafile.inputs)) {
  const match = input.match(/^(.*node_modules\/(?:@[^/]+\/)?[^/]+)\//);
  if (match) packageDirs.add(match[1]);
}

const sections = [];
const missing = [];
for (const dir of packageDirs) {
  const pkg = readJson(join(dir, "package.json"));
  const id = `${pkg.name}@${pkg.version}`;
  const file = readdirSync(dir).find((f) => /^(licen[cs]e|copying)/i.test(f));
  if (!file) {
    missing.push(id);
    continue;
  }
  const text = readFileSync(join(dir, file), "utf8").trim();
  sections.push(`## ${id} (${pkg.license})\n\n\`\`\`text\n${text}\n\`\`\`\n`);
}

if (missing.length > 0) {
  console.error(
    `No licence text found for bundled packages: ${missing.join(", ")}`,
  );
  process.exit(1);
}

sections.sort();
writeFileSync(
  "dist/THIRD_PARTY_LICENSES.md",
  [
    "# Third-party licences\n",
    "Packages bundled into `dist/whynorun.mjs`.\n",
    ...(sections.length > 0 ? sections : ["None.\n"]),
  ].join("\n"),
);
