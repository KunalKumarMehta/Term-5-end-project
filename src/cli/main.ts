export function main(argv: string[]): number {
  if (argv.length === 1 && argv[0] === "--version") {
    process.stdout.write(`whynorun ${__VERSION__}\n`);
    return 0;
  }
  process.stderr.write("usage: whynorun --version\n");
  return 2;
}
