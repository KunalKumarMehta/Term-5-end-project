// Share links (#14 §5–9, ADR 0004): the playground's state in the URL fragment, written as
// `#v1.<unpadded base64url(deflate-raw(JSON))>.0`. Anyone can craft one, so it is untrusted
// input and goes through the draft's validation (#87) before anything applies.
import type { Scenario, WorkflowFile } from "../../src/core";
import {
  ANOTHER_VERSION,
  fromDraft,
  toDraft,
  validateDraft,
  type Held,
  type Origin,
} from "./draft";
import type { Source } from "./RepoFacts";

/** Where a link waits until it has loaded, so one that couldn't finish isn't lost (#14 §9). */
export const PENDING = "whynorun:pending-link";

// #14 §6.2–3 and §8: GitHub's comment limit, and the most a link may inflate to.
export const MAX_LINK = 65_000;
const MAX_INFLATED = 1024 * 1024;

const COULDNT = "This link couldn't be opened: ";
export const CUT_OFF = "This link was cut off";

/** What a link carries (#14 §7): never the tray, the opened Test file or touched flags. */
interface Link {
  /** The Test file `version` the Scenarios are in, for ADR 0002's loaders (#14 §5). */
  version: number;
  /** An unedited import carries no files: it is imported again on open. */
  set: { files?: WorkflowFile[]; origin: Origin; edited: boolean };
  scenarios: {
    label: string;
    scenario: Scenario;
    sources: Record<string, Source>;
  }[];
  /** The open Explanation. */
  open?: { key: string; i: number };
}

export type Reference = {
  owner: string;
  repo: string;
  ref: string;
  sha: string;
};

/** A link that passed every check: what it holds, and the import to fetch for a reference link. */
export interface Opening {
  held: Held;
  open?: { key: string; i: number };
  reference?: Reference;
}

/** The link fragment for what the playground holds; the example travels as plain pasted files. */
export async function encodeLink(
  held: Held,
  open?: { key: string; i: number },
): Promise<string> {
  const draft = toDraft(held, new Date())!;
  const { origin } = draft.set;
  const edited = typeof origin === "object" && draft.set.edited;
  const link: Link = {
    version: draft.version,
    set: {
      files:
        typeof origin === "object" && !edited ? undefined : draft.set.files,
      origin: origin === "example" || !origin ? "pasted" : origin,
      edited,
    },
    scenarios: draft.scenarios.map(({ label, scenario, sources }) => ({
      label,
      scenario,
      sources,
    })),
    open,
  };
  const deflated = new Blob([JSON.stringify(link)])
    .stream()
    .pipeThrough(new CompressionStream("deflate-raw"));
  const bytes = new Uint8Array(await new Response(deflated).arrayBuffer());
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000)
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  const base64url = btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  return `#v1.${base64url}.0`;
}

/** Whether a fragment is a link at all; anything else is left alone. */
export const isLink = (fragment: string) => /^#v\d+\./.test(fragment);

/** Inflates at most MAX_INFLATED bytes, reading in chunks (#14 §6.3). */
async function inflate(bytes: Uint8Array<ArrayBuffer>): Promise<Uint8Array> {
  const reader = new Blob([bytes])
    .stream()
    .pipeThrough(new DecompressionStream("deflate-raw"))
    .getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > MAX_INFLATED) {
      void reader.cancel();
      throw new RangeError();
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let at = 0;
  for (const c of chunks) {
    out.set(c, at);
    at += c.length;
  }
  return out;
}

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/** The link's own checks, then the draft's field checks (#14 §6.4) on what it carries. */
function check(data: unknown): Opening | { error: string } {
  if (!isObject(data)) return { error: `${COULDNT}link is invalid` };
  const { set, scenarios, open } = data;
  if (!isObject(set) || set.origin === undefined)
    return { error: `${COULDNT}set is invalid` };
  const reference = isObject(set.origin) && set.edited === false;
  // An import origin that carries files must be marked edited; anything else must carry them.
  if (
    reference
      ? set.files !== undefined
      : !Array.isArray(set.files) || set.files.length === 0
  )
    return { error: `${COULDNT}set.files is invalid` };
  const checked = validateDraft({
    version: data.version,
    saved: new Date(0).toISOString(),
    set: { files: set.files ?? [], origin: set.origin, edited: set.edited },
    scenarios: Array.isArray(scenarios)
      ? scenarios.map((s: unknown) =>
          isObject(s)
            ? {
                label: s.label,
                scenario: s.scenario,
                sources: s.sources,
                touched: true,
                pins: [],
              }
            : s,
        )
      : scenarios,
  });
  if (checked.error !== undefined)
    return {
      error:
        COULDNT +
        (checked.error === ANOTHER_VERSION
          ? "its Scenarios are from another WhyNoRun version"
          : checked.error),
    };
  const { draft } = checked;
  if (
    open !== undefined &&
    !(
      isObject(open) &&
      typeof open.key === "string" &&
      open.key.length <= 300 &&
      Number.isInteger(open.i) &&
      (open.i as number) >= 0 &&
      (open.i as number) < draft.scenarios.length
    )
  )
    return { error: `${COULDNT}open is invalid` };
  return {
    held: fromDraft(draft),
    open: open as Opening["open"],
    reference: reference ? (draft.set.origin as Reference) : undefined,
  };
}

/**
 * Opens a fragment as untrusted input (#14 §6): its length is capped before decoding and its
 * inflated size while inflating, then every field is checked. On any failure nothing loads, and
 * the message names the field without its value.
 */
export async function decodeLink(
  fragment: string,
): Promise<Opening | { error: string }> {
  // Later releases keep opening older prefixes (ADR 0004); v1 is the only one so far.
  if (!fragment.startsWith("#v1."))
    return { error: `${COULDNT}it's from another WhyNoRun version` };
  if (fragment.length > MAX_LINK)
    return { error: `${COULDNT}it's longer than 65,000 characters` };
  // GFM autolinks drop trailing punctuation, so a link ends in a digit (#14 §7).
  if (!fragment.endsWith(".0")) return { error: CUT_OFF };
  const body = fragment.slice(4, -2);
  let data: unknown;
  try {
    if (!/^[A-Za-z0-9_-]*$/.test(body)) throw new SyntaxError();
    // atob, not Uint8Array.fromBase64, which became Baseline only in September 2025.
    const base64 = body.replace(/-/g, "+").replace(/_/g, "/");
    const binary = atob(base64 + "=".repeat((4 - (base64.length % 4)) % 4));
    const text = new TextDecoder("utf-8", { fatal: true }).decode(
      await inflate(Uint8Array.from(binary, (c) => c.charCodeAt(0))),
    );
    data = JSON.parse(text);
  } catch (e) {
    return {
      error:
        COULDNT +
        (e instanceof RangeError
          ? "it inflates to more than 1 MiB"
          : "it is damaged"),
    };
  }
  return check(data);
}
