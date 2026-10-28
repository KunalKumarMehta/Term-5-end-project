#!/usr/bin/env node

// src/cli/main.ts
function main(argv) {
  if (argv.length === 1 && argv[0] === "--version") {
    process.stdout.write(`whynorun ${"0.0.0"}
`);
    return 0;
  }
  process.stderr.write("usage: whynorun --version\n");
  return 2;
}

// src/cli/index.ts
process.exitCode = main(process.argv.slice(2));
