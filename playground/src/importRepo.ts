import { validateScenario, type WorkflowFile } from "../../src/core";

/** The Repo facts an import reads (#7 Q6–Q9); the token default and event policy stay assumed. */
export interface ImportedFacts {
  visibility: "public" | "private" | "internal";
  predates: boolean;
  defaultBranch: string;
  repository: string;
}

/** A public repo's Workflow set, pinned to one commit. `ref` is as typed, or the default branch. */
export interface Imported {
  owner: string;
  repo: string;
  ref: string;
  sha: string;
  files: WorkflowFile[];
  ignored: string[];
  facts: ImportedFacts;
}

/** The six import failures of #12 §4, classified as addendum D orders them. */
export type Failure =
  | { kind: "repo" }
  | { kind: "ref" }
  | { kind: "folder" }
  | { kind: "none" }
  | { kind: "rate"; reset?: Date }
  | { kind: "network"; status?: number };

class Failed extends Error {
  constructor(readonly failure: Failure) {
    super(failure.kind);
  }
}

/** A 403 or 429 from either host is a rate limit when it says so (#12 addendum D). */
function limited(res: Response): Failure | undefined {
  if (res.status !== 403 && res.status !== 429) return;
  const reset = res.headers.get("x-ratelimit-reset");
  const after = res.headers.get("retry-after");
  if (res.headers.get("x-ratelimit-remaining") !== "0" && after === null)
    return;
  return {
    kind: "rate",
    reset: reset
      ? new Date(Number(reset) * 1000)
      : after
        ? new Date(Date.now() + Number(after) * 1000)
        : undefined,
  };
}

/** Fetches `url` without a token; a failed answer throws its Failure, `known` first. */
async function get(
  url: string,
  signal: AbortSignal,
  known: Record<number, Failure> = {},
): Promise<Response> {
  const res = await fetch(url, { signal });
  if (res.ok) return res;
  throw new Failed(
    known[res.status] ??
      limited(res) ?? { kind: "network", status: res.status },
  );
}

/**
 * #7 Q6–Q9: the repo, its ref resolved to a SHA, `.github/workflows` listed at that SHA, then
 * each file from raw.githubusercontent.com by SHA, all or none. Never a token. `step` gets the
 * progress line; an aborted import throws the abort.
 */
export async function importRepo(
  owner: string,
  repo: string,
  ref: string,
  step: (text: string) => void,
  signal: AbortSignal,
): Promise<Imported | Failure> {
  const api = `https://api.github.com/repos/${owner}/${repo}`;
  try {
    step("Resolving ref…");
    const about = (await (
      await get(api, signal, { 404: { kind: "repo" } })
    ).json()) as {
      visibility: string;
      created_at: string;
      default_branch: string;
    };
    const name = ref || about.default_branch;
    const { sha } = (await (
      await get(`${api}/commits/${encodeURIComponent(name)}`, signal, {
        404: { kind: "ref" },
        422: { kind: "ref" },
        409: { kind: "folder" }, // An empty repo has no commits.
      })
    ).json()) as { sha: string };
    const facts = {
      visibility: about.visibility,
      predates: about.created_at < "2026-09-17",
      defaultBranch: about.default_branch,
      repository: `${owner}/${repo}`,
    };
    // GitHub's answers become Scenario values, so they get the Scenario's checks.
    if (
      !/^[0-9a-f]{40}$/.test(sha) ||
      validateScenario({
        event: { name: "push" },
        repo: { date: "2000-01-01", ...facts },
      }).length > 0
    )
      return { kind: "network" };

    step("Listing workflows…");
    const listed = (await (
      await get(`${api}/contents/.github/workflows?ref=${sha}`, signal, {
        404: { kind: "folder" },
      })
    ).json()) as { name: string; type: string }[];
    // As GitHub does, only .yml/.yaml files directly in the folder count (#7 Q2).
    const eligible = listed.filter(
      (e) => e.type === "file" && /^[^/]+\.ya?ml$/.test(e.name),
    );
    if (eligible.length === 0) return { kind: "none" };

    let done = 0;
    step(`Downloading 0/${eligible.length}…`);
    const files = await Promise.all(
      eligible.map(async ({ name }) => {
        const path = `.github/workflows/${name}`;
        const res = await get(
          `https://raw.githubusercontent.com/${owner}/${repo}/${sha}/.github/workflows/${encodeURIComponent(name)}`,
          signal,
        );
        const text = await res.text();
        step(`Downloading ${++done}/${eligible.length}…`);
        return { path, text };
      }),
    );
    return {
      owner,
      repo,
      ref: name,
      sha,
      files: files.sort((a, b) => (a.path < b.path ? -1 : 1)),
      ignored: listed
        .filter((e) => !eligible.includes(e))
        .map((e) => `.github/workflows/${e.name}`),
      facts: facts as ImportedFacts,
    };
  } catch (e) {
    if (signal.aborted) throw e;
    // A fetch that throws, or an answer of the wrong shape.
    return e instanceof Failed ? e.failure : { kind: "network" };
  }
}
