import { expect, test, type Page } from "@playwright/test";

declare global {
  interface Window {
    said: string[];
  }
}

const CI = `on: push
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - run: echo hi
`;
const DOCS = CI.replace("build", "docs");

const SHA = "abc1234" + "0".repeat(33);
const SHA2 = "def5678" + "0".repeat(33);
const API = "https://api.github.com/repos/o/r";
const raw = (sha: string, name: string) =>
  `https://raw.githubusercontent.com/o/r/${sha}/.github/workflows/${name}`;

type Reply =
  | { status?: number; json?: unknown; body?: string; headers?: object }
  | "abort";

/** The answers for a public repo o/r whose default branch main is at SHA, with two workflows. */
const repo = (): Record<string, Reply | Promise<Reply>> => ({
  [API]: {
    json: {
      visibility: "public",
      created_at: "2024-05-01T10:00:00Z",
      default_branch: "main",
    },
  },
  [`${API}/commits/main`]: { json: { sha: SHA } },
  [`${API}/contents/.github/workflows?ref=${SHA}`]: {
    json: [
      { name: "ci.yml", path: ".github/workflows/ci.yml", type: "file" },
      { name: "docs.yml", path: ".github/workflows/docs.yml", type: "file" },
    ],
  },
  [raw(SHA, "ci.yml")]: { body: CI },
  [raw(SHA, "docs.yml")]: { body: DOCS },
});

/**
 * Fakes GitHub at the request layer (spec #17, seam 3): each URL gets its entry in `replies`,
 * read when the request arrives, and any other URL a 404.
 */
async function github(
  page: Page,
  replies: Record<string, Reply | Promise<Reply>>,
) {
  await page.route(
    /^https:\/\/(api\.github\.com|raw\.githubusercontent\.com)\//,
    async (route) => {
      const reply = await replies[route.request().url()];
      if (reply === "abort") return route.abort();
      const {
        status = 200,
        json,
        body,
        headers,
      } = reply ?? {
        status: 404,
        json: { message: "Not Found" },
      };
      await route.fulfill({
        status,
        headers: {
          "access-control-allow-origin": "*",
          "access-control-expose-headers":
            "retry-after, x-ratelimit-remaining, x-ratelimit-reset",
          ...headers,
        },
        ...(json === undefined ? { body } : { json }),
      });
    },
  );
}

const header = (page: Page) => page.getByRole("banner");
const results = (page: Page) => page.getByRole("region", { name: "Results" });
const source = (page: Page) => page.locator("#set-source");
const toast = (page: Page) => page.locator("#toasts");
const confirm = (page: Page) => page.getByRole("alertdialog");
const tabs = (page: Page) =>
  page.getByRole("tablist", { name: "Files" }).getByRole("tab");
const form = (page: Page) =>
  page.getByRole("form", { name: "Import a public repo" });
const importButton = (page: Page) =>
  form(page).getByRole("button", { name: "Import", exact: true });

/** Fills the import form, opened from `opener`, and clicks Import. */
async function importRepo(
  page: Page,
  name: string,
  ref = "",
  opener = header(page).getByRole("button", { name: "Import repo" }),
) {
  await opener.click();
  await form(page).getByLabel("owner/repo or github.com link").fill(name);
  await form(page).getByLabel("Ref").fill(ref);
  await importButton(page).click();
}

async function paste(page: Page) {
  await header(page).getByRole("button", { name: "Paste" }).click();
  const dialog = page.getByRole("dialog", { name: "Paste a GitHub workflow" });
  await dialog.getByLabel("YAML").fill(CI);
  await dialog.getByRole("button", { name: "Add file" }).click();
}

test.beforeEach(async ({ page }) => {
  // Record every text the status region takes, from before load.
  await page.addInitScript(() => {
    window.said = [];
    document.addEventListener("DOMContentLoaded", () => {
      const status = document.getElementById("status")!;
      new MutationObserver(() => {
        if (status.textContent) window.said.push(status.textContent);
      }).observe(status, {
        childList: true,
        characterData: true,
        subtree: true,
      });
    });
  });
  await page.goto("./");
});

test("Import repo in the empty state imports a github.com link pinned to the default branch's SHA, silently, and marks the facts it read as imported", async ({
  page,
}) => {
  await github(page, repo());
  await page.getByLabel("Simulation date").fill("2026-12-03");
  // Only the owner and repo are read from a link, never a ref (#7).
  await importRepo(
    page,
    "https://github.com/o/r/tree/feature/x",
    "",
    results(page).getByRole("button", { name: "Import repo" }),
  );

  await expect(toast(page)).toHaveText("Imported o/r @ abc1234 · 2 loaded");
  await expect(source(page)).toHaveText("o/r @ abc1234 (main)");
  await expect(tabs(page)).toHaveText(["ci.yml", "docs.yml"]);
  // #12 addendum E: success moves focus from Cancel to the first file tab.
  await expect(tabs(page).first()).toBeFocused();
  await expect(form(page)).toHaveCount(0);
  await expect(results(page)).toContainText("ci.yml › build runs");
  await expect(results(page)).toContainText("docs.yml › docs runs");

  for (const [label, value] of [
    ["Visibility", "public"],
    ["Created before 2026-09-17", "yes"],
  ] as const)
    await expect(page.getByLabel(label).locator("option:checked")).toHaveText(
      value,
    );
  await expect(page.getByLabel("Default branch")).toHaveValue("main");
  await expect(page.getByLabel("owner/repo (optional)")).toHaveValue("o/r");
  for (const label of [
    "Visibility",
    "Created before 2026-09-17",
    "Default branch",
  ])
    await expect(page.getByLabel(label)).toHaveAccessibleDescription(
      "⤓ imported",
    );
  await expect(page.locator("#repo-visibility-source")).toHaveAttribute(
    "title",
    "o/r @ abc1234",
  );
  await expect(page.locator("#repo-repository-source")).toHaveText(
    "⤓ imported",
  );
  // The token default and event policy need admin sign-in, so they stay assumed.
  for (const label of ["Token default", "Event policy"])
    await expect(page.getByLabel(label)).toHaveAccessibleDescription("assumed");

  // The import's start speaks once; its first run stays silent, as the toast speaks.
  await page.waitForTimeout(1000);
  expect(await page.evaluate(() => window.said)).toEqual(["Importing o/r…"]);
});

const failures: {
  trigger: string;
  replies: Record<string, Reply>;
  ref?: string;
  under: string;
  message: string;
}[] = [
  {
    trigger: "a 404 on the repo",
    replies: { [API]: { status: 404, json: {} } },
    under: "#import-repo-error",
    message:
      "Not found or private. Private repos aren’t supported. Paste or upload instead.",
  },
  {
    trigger: "a 404 on the ref",
    replies: { [`${API}/commits/nope`]: { status: 404, json: {} } },
    ref: "nope",
    under: "#import-ref-error",
    message: "No branch, tag or commit named nope. Paste or upload instead.",
  },
  {
    trigger: "a 422 on the ref",
    replies: { [`${API}/commits/nope`]: { status: 422, json: {} } },
    ref: "nope",
    under: "#import-ref-error",
    message: "No branch, tag or commit named nope. Paste or upload instead.",
  },
  {
    trigger: "a 404 on the folder",
    replies: {
      [`${API}/contents/.github/workflows?ref=${SHA}`]: {
        status: 404,
        json: {},
      },
    },
    under: "#import-ref-error",
    message: "No GitHub workflows at this ref. Paste or upload instead.",
  },
  {
    trigger: "a 409 for an empty repo",
    replies: { [`${API}/commits/main`]: { status: 409, json: {} } },
    under: "#import-ref-error",
    message: "No GitHub workflows at this ref. Paste or upload instead.",
  },
  {
    trigger: "a folder with nothing eligible",
    replies: {
      [`${API}/contents/.github/workflows?ref=${SHA}`]: {
        json: [
          { name: "README.md", type: "file" },
          { name: "old", type: "dir" },
        ],
      },
    },
    under: "#import-ref-error",
    message:
      "No .yml/.yaml files directly in .github/workflows/. Paste or upload instead.",
  },
  {
    trigger: "a 403 with no rate-limit headers",
    replies: { [API]: { status: 403, json: {} } },
    under: "#import-error",
    message: "Couldn’t reach GitHub (403). Retry Paste or upload instead.",
  },
  {
    trigger: "a 502 on a file download",
    replies: { [raw(SHA, "docs.yml")]: { status: 502, body: "" } },
    under: "#import-error",
    message: "Couldn’t reach GitHub (502). Retry Paste or upload instead.",
  },
  {
    trigger: "a fetch that throws",
    replies: { [`${API}/commits/main`]: "abort" },
    under: "#import-error",
    message: "Couldn’t reach GitHub. Retry Paste or upload instead.",
  },
];

for (const { trigger, replies, ref, under, message } of failures)
  test(`${trigger} shows its message under its field, focuses it, and leaves the set as it was`, async ({
    page,
  }) => {
    await github(page, { ...repo(), ...replies });
    await paste(page);
    await importRepo(page, "o/r", ref);
    await expect(form(page).locator(under)).toHaveText(message);
    await expect(
      form(page)
        .locator(under)
        .getByRole("button")
        .or(page.locator(under.replace("-error", ""))),
    ).toBeFocused();
    await expect(source(page)).toHaveText("Workflow set: 1 pasted file");
    await expect(tabs(page)).toHaveText(["untitled.yml"]);
  });

test("an owner/repo or a ref that fails the check is refused before any request", async ({
  page,
}) => {
  let requests = 0;
  await page.route(/^https:\/\/api\.github\.com\//, (route) => {
    requests++;
    return route.abort();
  });
  await importRepo(page, "o/r/x");
  await expect(form(page).locator("#import-repo-error")).toHaveText(
    "Use the form owner/repo, e.g. acme/app",
  );
  await expect(
    form(page).getByLabel("owner/repo or github.com link"),
  ).toBeFocused();
  await form(page).getByLabel("owner/repo or github.com link").fill("o/r");
  await form(page).getByLabel("Ref").fill("feature..x");
  await importButton(page).click();
  await expect(form(page).locator("#import-ref-error")).toHaveText(
    "A ref can’t contain spaces, .. or any of ~^:?*[\\",
  );
  expect(requests).toBe(0);
});

test("Retry after a network failure runs the whole import again", async ({
  page,
}) => {
  const replies = { ...repo(), [API]: { status: 503, json: {} } as Reply };
  await github(page, replies);
  await importRepo(page, "o/r");
  await expect(form(page).locator("#import-error")).toContainText("(503)");
  replies[API] = repo()[API] as Reply;
  await form(page).getByRole("button", { name: "Retry" }).click();
  await expect(toast(page)).toHaveText("Imported o/r @ abc1234 · 2 loaded");
});

test.describe("in Kolkata", () => {
  test.use({ timezoneId: "Asia/Kolkata", locale: "en-GB" });

  test("a rate limit shows the reset time in local time, from x-ratelimit-reset or retry-after", async ({
    page,
  }) => {
    const replies = repo();
    // 08:35 UTC is 14:05 in Kolkata.
    replies[API] = {
      status: 403,
      json: {},
      headers: {
        "x-ratelimit-remaining": "0",
        "x-ratelimit-reset": String(Date.UTC(2026, 9, 29, 8, 35) / 1000),
      },
    };
    await github(page, replies);
    await importRepo(page, "o/r");
    await expect(form(page).locator("#import-repo-error")).toHaveText(
      "GitHub allows 60 requests an hour without sign-in, and they’re used up until 14:05. Paste or upload instead.",
    );
    // Import stays enabled, and nothing retries by itself.
    await expect(importButton(page)).toBeEnabled();

    await page.clock.setFixedTime(new Date(Date.UTC(2026, 9, 29, 9, 0)));
    replies[API] = {
      status: 429,
      json: {},
      headers: { "retry-after": "600" },
    };
    await importButton(page).click();
    await expect(form(page).locator("#import-repo-error")).toContainText(
      "used up until 14:40.",
    );
  });
});

test("Cancel restores focus to Import, and the answers that arrive later change nothing", async ({
  page,
}) => {
  let release!: () => void;
  const held = new Promise<void>((ok) => (release = ok));
  const replies = repo();
  replies[raw(SHA, "docs.yml")] = held.then(() => ({ body: DOCS }));
  await github(page, replies);
  await paste(page);
  await importRepo(page, "o/r");

  const cancel = form(page).getByRole("button", { name: "Cancel" });
  await expect(cancel).toBeFocused();
  await expect(form(page)).toContainText("Downloading 1/2…");
  // The current set stays usable while the import runs (#12 §3).
  await expect(tabs(page)).toHaveText(["untitled.yml"]);
  await cancel.click();
  await expect(importButton(page)).toBeFocused();
  await expect(
    form(page).getByLabel("owner/repo or github.com link"),
  ).toHaveValue("o/r");

  release();
  await page.waitForTimeout(500);
  await expect(source(page)).toHaveText("Workflow set: 1 pasted file");
  await expect(toast(page)).toHaveText("Pasted untitled.yml");
});

test("an import over a pasted set asks first, and edits made during the import are named", async ({
  page,
}) => {
  let release!: () => void;
  const held = new Promise<void>((ok) => (release = ok));
  const replies = repo();
  replies[raw(SHA, "docs.yml")] = held.then(() => ({ body: DOCS }));
  await github(page, replies);
  await paste(page);
  await importRepo(page, "o/r");
  await expect(form(page)).toContainText("Downloading 1/2…");
  await page
    .getByRole("textbox", { name: "YAML of .github/workflows/untitled.yml" })
    .click();
  await page.keyboard.type("# mine\n");
  release();

  await expect(confirm(page)).toContainText(
    "Replace the edits you made during the import?",
  );
  await expect(confirm(page)).toContainText("It replaces your 1 pasted file.");
  await confirm(page).getByRole("button", { name: "Import" }).click();
  await expect(source(page)).toHaveText("o/r @ abc1234 (main)");
  await expect(source(page)).toBeFocused();
});

test("Re-import refreshes only the imported facts and keeps facts the Maintainer set; Reset restores the imported files; Upload marks the facts set", async ({
  page,
}) => {
  const replies = repo();
  replies[`${API}/contents/.github/workflows?ref=${SHA}`] = {
    json: [
      { name: "ci.yml", type: "file" },
      { name: "docs.yml", type: "file" },
      { name: "README.md", type: "file" },
    ],
  };
  await github(page, replies);
  await page.getByLabel("Simulation date").fill("2026-12-03");
  await importRepo(page, "o/r");
  await expect(toast(page)).toHaveText(
    "Imported o/r @ abc1234 · 2 loaded · 1 ignored",
  );

  // The Maintainer sets one imported fact; changing a value makes it set.
  await page.getByLabel("Visibility").selectOption("private");
  await expect(page.getByLabel("Visibility")).toHaveAccessibleDescription(
    "set",
  );

  // An edit marks the set, and Re-import (here to a new ref) asks first.
  await page
    .getByRole("textbox", { name: "YAML of .github/workflows/ci.yml" })
    .click();
  await page.keyboard.type("# mine\n");
  await expect(source(page)).toHaveText(
    "o/r @ abc1234 (main) · edited since import",
  );
  replies[API] = {
    json: {
      visibility: "public",
      created_at: "2026-10-01T10:00:00Z",
      default_branch: "trunk",
    },
  };
  replies[`${API}/commits/v2`] = { json: { sha: SHA2 } };
  replies[`${API}/contents/.github/workflows?ref=${SHA2}`] = {
    json: [{ name: "ci.yml", type: "file" }],
  };
  replies[raw(SHA2, "ci.yml")] = { body: CI };
  await header(page).getByRole("button", { name: "Re-import" }).click();
  await expect(
    form(page).getByLabel("owner/repo or github.com link"),
  ).toHaveValue("o/r");
  await expect(form(page).getByLabel("Ref")).toHaveValue("main");
  await form(page).getByLabel("Ref").fill("v2");
  await page.evaluate(() => window.said.splice(0));
  await importButton(page).click();
  await expect(confirm(page)).toContainText(
    "It replaces your edits to the imported files.",
  );
  await confirm(page).getByRole("button", { name: "Re-import" }).click();
  await expect(toast(page)).toHaveText("Re-imported @ def5678");
  await expect(source(page)).toHaveText("o/r @ def5678 (v2)");
  await expect(tabs(page)).toHaveText(["ci.yml"]);

  await expect(
    page.getByLabel("Visibility").locator("option:checked"),
  ).toHaveText("private");
  await expect(page.getByLabel("Visibility")).toHaveAccessibleDescription(
    "set",
  );
  await expect(page.getByLabel("Default branch")).toHaveValue("trunk");
  await expect(page.getByLabel("Default branch")).toHaveAccessibleDescription(
    "⤓ imported",
  );
  const predates = page.getByLabel("Created before 2026-09-17");
  await expect(predates.locator("option:checked")).toHaveText("no");
  await expect(predates).toHaveAccessibleDescription("⤓ imported");
  await expect(page.locator("#repo-visibility-source")).toHaveText("set");
  await page.waitForTimeout(1000);
  expect(await page.evaluate(() => window.said)).toEqual(["Importing o/r…"]);

  // Reset restores the imported files, under the confirm rule, silently.
  await page
    .getByRole("textbox", { name: "YAML of .github/workflows/ci.yml" })
    .click();
  await page.keyboard.type("# mine\n");
  await header(page).getByRole("button", { name: "Reset" }).click();
  await expect(confirm(page)).toContainText(
    "It replaces your edits to the imported files.",
  );
  await confirm(page).getByRole("button", { name: "Reset" }).click();
  await expect(toast(page)).toHaveText("Reset to imported files");
  await expect(source(page)).toHaveText("o/r @ def5678 (v2)");

  // Upload over the import keeps the fact values but marks them set.
  const chooser = page.waitForEvent("filechooser");
  await header(page).getByRole("button", { name: "Upload" }).click();
  await (
    await chooser
  ).setFiles([
    { name: "ci.yml", mimeType: "text/plain", buffer: Buffer.from(CI) },
  ]);
  await expect(source(page)).toHaveText("Workflow set: 1 uploaded file");
  await expect(page.getByLabel("Default branch")).toHaveValue("trunk");
  await expect(page.getByLabel("Default branch")).toHaveAccessibleDescription(
    "set",
  );
  await expect(page.locator("#repo-repository-source")).toHaveText("set");
});
