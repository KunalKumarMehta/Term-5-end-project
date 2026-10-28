import { isLoaded, type WorkflowFile } from "../../src/core";

/** A file an upload or drop found, placed at its path from the repo root. */
interface Found {
  path: string;
  read: () => Promise<ArrayBuffer>;
}

export type Upload =
  | { files: WorkflowFile[]; ignored: string[] }
  | { error: "none" }
  | { error: "unreadable"; path: string }
  | { error: "test"; name: string };

/** Files picked one at a time go to `.github/workflows/<filename>` (#12 §5). */
export const fromPicked = (files: Iterable<File>) =>
  load(
    [...files].map((f) => ({
      path: `.github/workflows/${f.name}`,
      read: () => f.arrayBuffer(),
    })),
  );

/** A drop: loose files are placed like picked ones, folders are searched (#12 §5). */
export async function fromDropped(entries: FileSystemEntry[]): Promise<Upload> {
  const only = entries.length === 1 ? entries[0]! : undefined;
  // shortcut: a loose Test file is refused until #83 routes it to Open test.
  if (only?.isFile && /\.test\.ya?ml$/.test(only.name))
    return { error: "test", name: only.name };
  const found: Found[] = [];
  for (const entry of entries) {
    if (isFile(entry)) found.push(foundFile(entry, ".github/workflows"));
    else if (isDirectory(entry)) {
      const workflows = await workflowsIn(entry);
      if (workflows) await walk(workflows, ".github/workflows", found);
    }
  }
  return load(found);
}

const isFile = (e: FileSystemEntry): e is FileSystemFileEntry => e.isFile;
const isDirectory = (e: FileSystemEntry): e is FileSystemDirectoryEntry =>
  e.isDirectory;

/** A repo root's `.github/workflows/`, a `.github` folder's `workflows/`, or a `workflows` folder itself. */
async function workflowsIn(dir: FileSystemDirectoryEntry) {
  const github = await child(dir, ".github");
  if (github) return child(github, "workflows");
  if (dir.name === ".github") return child(dir, "workflows");
  return dir.name === "workflows" ? dir : undefined;
}

async function child(dir: FileSystemDirectoryEntry, name: string) {
  return (await list(dir)).find(
    (e): e is FileSystemDirectoryEntry => isDirectory(e) && e.name === name,
  );
}

async function list(dir: FileSystemDirectoryEntry) {
  const reader = dir.createReader();
  const all: FileSystemEntry[] = [];
  // readEntries returns a batch at a time, and an empty batch at the end.
  for (;;) {
    const batch = await new Promise<FileSystemEntry[]>((ok, fail) =>
      reader.readEntries(ok, fail),
    );
    if (batch.length === 0) return all;
    all.push(...batch);
  }
}

async function walk(dir: FileSystemDirectoryEntry, at: string, found: Found[]) {
  for (const entry of await list(dir)) {
    if (isFile(entry)) found.push(foundFile(entry, at));
    else if (isDirectory(entry))
      await walk(entry, `${at}/${entry.name}`, found);
  }
}

const foundFile = (entry: FileSystemFileEntry, at: string): Found => ({
  path: `${at}/${entry.name}`,
  read: () =>
    new Promise<File>((ok, fail) => entry.file(ok, fail)).then((f) =>
      f.arrayBuffer(),
    ),
});

/** Keeps what GitHub reads, all or none: one unreadable file loads nothing (#12 §5). */
async function load(found: Found[]): Promise<Upload> {
  const byPath = new Map(found.map((f) => [f.path, f]));
  const paths = [...byPath.keys()].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const eligible = paths.filter(isLoaded);
  if (eligible.length === 0) return { error: "none" };
  const decoder = new TextDecoder("utf-8", { fatal: true });
  const files: WorkflowFile[] = [];
  for (const path of eligible) {
    try {
      files.push({
        path,
        text: decoder.decode(await byPath.get(path)!.read()),
      });
    } catch {
      return { error: "unreadable", path };
    }
  }
  return { files, ignored: paths.filter((p) => !isLoaded(p)) };
}
