import { deflateRawSync } from "node:zlib";
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
const SHA = "abc1234" + "0".repeat(33);
const API = "https://api.github.com/repos/o/r";

/** Fakes GitHub at the request layer (spec #17, seam 3): public repo o/r with one workflow. */
async function github(page: Page) {
  const replies: Record<string, { json?: unknown; body?: string }> = {
    [API]: {
      json: {
        visibility: "public",
        created_at: "2024-05-01T10:00:00Z",
        default_branch: "main",
      },
    },
    [`${API}/commits/${SHA}`]: { json: { sha: SHA } },
    [`${API}/commits/main`]: { json: { sha: SHA } },
    [`${API}/contents/.github/workflows?ref=${SHA}`]: {
      json: [
        { name: "ci.yml", path: ".github/workflows/ci.yml", type: "file" },
      ],
    },
    [`https://raw.githubusercontent.com/o/r/${SHA}/.github/workflows/ci.yml`]: {
      body: CI,
    },
  };
  await page.route(
    /^https:\/\/(api\.github\.com|raw\.githubusercontent\.com)\//,
    async (route) => {
      const reply = replies[route.request().url()];
      await route.fulfill({
        status: reply ? 200 : 404,
        headers: { "access-control-allow-origin": "*" },
        ...(reply?.body === undefined
          ? { json: reply?.json ?? {} }
          : { body: reply.body }),
      });
    },
  );
}

/** A link written independently of the playground: `#v1.<unpadded base64url(deflate-raw)>.0`. */
const link = (json: string) =>
  `./#v1.${deflateRawSync(Buffer.from(json)).toString("base64url")}.0`;

/** A link's JSON for a pasted set, with Scenario 1's own fields. */
const pasted = (files: string, scenario: string) =>
  `{"version":1,"set":{"origin":"pasted","edited":false,"files":${files}},
    "scenarios":[{"label":"Scenario 1","sources":{},"scenario":${scenario}}]}`;
const CI_FILES = JSON.stringify([
  { path: ".github/workflows/ci.yml", text: CI },
]);
const PUSH = '{"event":{"name":"push"},"repo":{"date":"2026-12-03"}}';

const header = (page: Page) => page.getByRole("banner");
const results = (page: Page) => page.getByRole("region", { name: "Results" });
const source = (page: Page) => page.locator("#set-source");
const toast = (page: Page) => page.locator("#toasts");
const confirm = (page: Page) => page.getByRole("alertdialog");
const share = (page: Page) => page.getByRole("dialog", { name: "Share link" });
const scenarioTabs = (page: Page) =>
  page.getByRole("tablist", { name: "Scenarios" }).getByRole("tab");
const said = (page: Page) => page.evaluate(() => window.said);

async function paste(page: Page, yaml = CI) {
  await header(page).getByRole("button", { name: "Paste" }).click();
  const dialog = page.getByRole("dialog", { name: "Paste a GitHub workflow" });
  await dialog.getByLabel("YAML").fill(yaml);
  await dialog.getByRole("button", { name: "Add file" }).click();
}

/** Text that deflate can't shrink much: `n` pseudo-random hex digits, the same every run. */
function noise(n: number) {
  // xorshift32: 32-bit integer steps, so no float rounding shortens its cycle.
  let x = 1;
  let s = "";
  for (let i = 0; i < n; i++) {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    s += (x & 15).toString(16);
  }
  return s;
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
});

test("Copy link, opened in a fresh context, imports the repo again and shows “Opened shared playground” with both Scenarios and the Explanation", async ({
  page,
  context,
  browser,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await github(page);
  await page.goto("./");
  await expect(
    header(page).getByRole("button", { name: "Copy link" }),
  ).toBeDisabled();
  await page.getByLabel("Simulation date").fill("2026-12-03");
  await header(page).getByRole("button", { name: "Import repo" }).click();
  const form = page.getByRole("form", { name: "Import a public repo" });
  await form.getByLabel("owner/repo or github.com link").fill("o/r");
  await form.getByRole("button", { name: "Import", exact: true }).click();
  await expect(toast(page)).toHaveText("Imported o/r @ abc1234 · 1 loaded");
  await header(page).getByLabel("Compare").check();
  await page.getByLabel("Visibility").selectOption("private");
  await page.getByLabel("Scenario label").fill("Private");
  await page.getByLabel("Scenario label").press("Enter");
  await results(page)
    .locator('[data-key="ci.yml › build"][data-scenario="1"]')
    .click();

  await header(page).getByRole("button", { name: "Copy link" }).click();
  await expect(share(page)).toContainText(
    "Anyone with this link sees these files and Scenarios",
  );
  const url = await share(page).getByLabel("Link").inputValue();
  expect(url).toMatch(/\/whynorun\/#v1\.[A-Za-z0-9_-]+\.0$/);
  // An unedited import travels as its reference, not its files.
  expect(url.length).toBeLessThan(1000);
  await share(page).getByRole("button", { name: "Copy", exact: true }).click();
  await expect(toast(page)).toHaveText("Link copied");
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(url);

  const teammate = await (await browser.newContext()).newPage();
  await teammate.addInitScript(() => {
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
  await github(teammate);
  await teammate.goto(url);
  await expect(toast(teammate)).toHaveText("Opened shared playground");
  // The fragment is gone, so a reload doesn't open it again.
  expect(new URL(teammate.url()).hash).toBe("");
  await expect(source(teammate)).toHaveText("o/r @ abc1234 (main)");
  await expect(scenarioTabs(teammate)).toHaveText(["Scenario 1", "Private"]);
  await expect(
    teammate.getByRole("region", { name: "Explanation" }),
  ).toContainText("Private: ci.yml › build runs");
  await expect(teammate.getByLabel("Visibility")).toHaveAccessibleDescription(
    "⤓ imported",
  );
  await scenarioTabs(teammate).nth(1).click();
  await expect(teammate.getByLabel("Visibility")).toHaveAccessibleDescription(
    "set",
  );
  await teammate.waitForTimeout(1000);
  expect(await said(teammate)).toEqual([
    "Opened shared playground: o/r @ abc1234",
  ]);
});

/** Loads the page afresh at `url`: a goto that changes only the fragment is a hashchange. */
async function load(page: Page, url: string) {
  await page.goto("about:blank");
  await page.goto(url);
}

test("a crafted invalid link loads nothing and names the bad field without its value", async ({
  page,
}) => {
  await page.goto(
    link(
      pasted(
        JSON.stringify([
          { path: ".github/workflows/../../evil.yml", text: CI },
        ]),
        PUSH,
      ),
    ),
  );
  await expect(header(page)).toContainText(
    "This link couldn't be opened: set.files[0].path is invalid",
  );
  await expect(header(page)).not.toContainText("evil");
  await expect(results(page)).toContainText("No Workflow set yet");
  expect(new URL(page.url()).hash).toBe("");
  await page.waitForTimeout(500);
  expect(await said(page)).toEqual([
    "This link couldn't be opened: set.files[0].path is invalid",
  ]);
});

test("a crafted oversized link loads nothing and says why: past 65,000 characters, a file past 256 KiB, or inflating past 1 MiB", async ({
  page,
}) => {
  await page.goto(`./#v1.${"A".repeat(65_000)}.0`);
  await expect(header(page)).toContainText(
    "This link couldn't be opened: it's longer than 65,000 characters",
  );
  await expect(results(page)).toContainText("No Workflow set yet");

  // 300 KiB of one character deflates to a short link, so only the field check stops it.
  const big = JSON.stringify([
    { path: ".github/workflows/ci.yml", text: "#".repeat(300 * 1024) },
  ]);
  await load(page, link(pasted(big, PUSH)));
  await expect(header(page)).toContainText(
    "This link couldn't be opened: set.files[0].text is invalid",
  );

  await load(page, link(`"${" ".repeat(2 * 1024 * 1024)}"`));
  await expect(header(page)).toContainText(
    "This link couldn't be opened: it inflates to more than 1 MiB",
  );
  await expect(results(page)).toContainText("No Workflow set yet");
});

test("a link that lost its tail says “This link was cut off”, above the restored draft", async ({
  page,
}) => {
  await page.goto("./");
  await paste(page);
  await expect(header(page)).toContainText("Draft · saved");
  await load(page, link(pasted(CI_FILES, PUSH)).slice(0, -5));
  await expect(header(page)).toContainText("This link was cut off");
  await expect(source(page)).toHaveText("Workflow set: 1 pasted file");
  await page.waitForTimeout(500);
  expect(await said(page)).toEqual([
    "This link was cut off. Restored your draft",
  ]);
});

test("the prototype-pollution input loaded through a link gives the core's Verdicts and leaves Object.prototype alone (#14 §6.7)", async ({
  page,
}) => {
  const job = (id: string, condition: string) =>
    `  ${id}:\n    if: ${condition}\n    runs-on: x\n    steps:\n      - run: echo\n`;
  const yaml =
    "on: pull_request\njobs:\n" +
    job("ctor", "vars.CONSTRUCTOR == 'a'") +
    job("proto", "vars.__proto__ == 'b'") +
    job("payload", "github.event.__proto__.x == 'c'");
  // Written as JSON text, where __proto__ is an own key, as anyone could craft it.
  await page.goto(
    link(
      pasted(
        JSON.stringify([{ path: ".github/workflows/pr.yml", text: yaml }]),
        `{"event":{"name":"pull_request","payload":{"__proto__":{"x":"c"}}},
          "repo":{"date":"2026-12-03","vars":{"CONSTRUCTOR":"a","__proto__":"b"}}}`,
      ),
    ),
  );
  await expect(toast(page)).toHaveText("Opened shared playground");
  for (const id of ["ctor", "proto", "payload"])
    await expect(
      results(page).locator(`[data-key="pr.yml › ${id}"]`),
    ).toContainText(`pr.yml › ${id} runs`);
  expect(
    await page.evaluate(() => [
      ({} as Record<string, unknown>).x === undefined,
      Object.getPrototypeOf({}) === Object.prototype,
    ]),
  ).toEqual([true, true]);
});

test("opening a link over a draft asks first, with Keep my draft as the default; a link through hashchange opens once accepted", async ({
  page,
}) => {
  await page.goto("./");
  await paste(page);
  await expect(header(page)).toContainText("Draft · saved");
  const shared = link(
    `{"version":1,"set":{"origin":"uploaded","edited":false,"files":${CI_FILES}},
      "scenarios":[{"label":"Shared","sources":{},"scenario":${PUSH}}],
      "open":{"key":"ci.yml › build","i":0}}`,
  );

  await load(page, shared);
  await expect(confirm(page)).toContainText(
    "Open the shared playground (1 file, 1 Scenario)?",
  );
  await expect(confirm(page)).toContainText("It replaces your 1 pasted file.");
  await expect(
    confirm(page).getByRole("button", { name: "Keep my draft" }),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(source(page)).toHaveText("Workflow set: 1 pasted file");
  await expect(source(page)).toBeFocused();
  // Kept: the link is forgotten, so a reload restores the draft without asking.
  await page.reload();
  await expect(source(page)).toHaveText("Workflow set: 1 pasted file");
  await page.waitForTimeout(500);
  await expect(confirm(page)).toHaveCount(0);

  await page.evaluate((hash) => (location.hash = hash), shared.slice(2));
  await confirm(page).getByRole("button", { name: "Open link" }).click();
  await expect(toast(page)).toHaveText("Opened shared playground");
  await expect(source(page)).toHaveText("Workflow set: 1 uploaded file");
  await expect(scenarioTabs(page)).toHaveText(["Shared"]);
  await expect(page.getByRole("region", { name: "Explanation" })).toContainText(
    "ci.yml › build runs",
  );
  expect(new URL(page.url()).hash).toBe("");
  // The draft now holds the link's work.
  await expect(header(page)).toContainText("Draft · saved");
  await page.reload();
  await expect(scenarioTabs(page)).toHaveText(["Shared"]);
});

test("the share popover warns past 4,000 characters, with Copy anyway, and refuses past 65,000", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("./");
  await paste(page, `${CI}# ${noise(8000)}\n`);
  await header(page).getByRole("button", { name: "Copy link" }).click();
  await expect(share(page)).toContainText(
    /Long link \(\d,\d{3} characters\): some chat apps cut links over 4,000/,
  );
  await expect(
    share(page).getByRole("button", { name: "Copy", exact: true }),
  ).toHaveCount(0);
  await share(page).getByRole("button", { name: "Copy anyway" }).click();
  await expect(toast(page)).toHaveText("Link copied");

  await header(page).getByRole("button", { name: "Paste" }).click();
  const dialog = page.getByRole("dialog", { name: "Paste a GitHub workflow" });
  await dialog.getByLabel("Path").fill(".github/workflows/big.yml");
  await dialog.getByLabel("YAML").fill(`${CI}# ${noise(140_000)}\n`);
  await dialog.getByRole("button", { name: "Add file" }).click();
  await header(page).getByRole("button", { name: "Copy link" }).click();
  await expect(share(page)).toContainText(
    "Too big for a link. Share the .github/workflows files themselves.",
  );
  await expect(share(page).getByLabel("Link")).toHaveCount(0);
  await expect(share(page).getByRole("button", { name: /Copy/ })).toHaveCount(
    0,
  );
});

test("a reference link whose import fails changes nothing, keeps the link pending for Retry and a reload, and Dismiss forgets it", async ({
  page,
}) => {
  let up = false;
  await github(page);
  // The newest route runs first: until GitHub is `up`, every request fails.
  await page.route(
    /^https:\/\/(api\.github\.com|raw\.githubusercontent\.com)\//,
    (route) => (up ? route.fallback() : route.abort()),
  );
  await page.goto("./");
  await paste(page);
  await expect(header(page)).toContainText("Draft · saved");
  const reference = link(
    `{"version":1,"set":{"origin":{"owner":"o","repo":"r","ref":"main","sha":"${SHA}"},"edited":false},
      "scenarios":[{"label":"Shared","sources":{},"scenario":${PUSH}}]}`,
  );

  await load(page, reference);
  await confirm(page).getByRole("button", { name: "Open link" }).click();
  const failed = header(page).getByText(
    "The shared playground couldn't load: Couldn’t reach GitHub.",
  );
  await expect(failed).toBeVisible();
  await expect(source(page)).toHaveText("Workflow set: 1 pasted file");

  await page.reload();
  await confirm(page).getByRole("button", { name: "Open link" }).click();
  await expect(failed).toBeVisible();

  up = true;
  await header(page).getByRole("button", { name: "Retry" }).click();
  await expect(toast(page)).toHaveText("Opened shared playground");
  await expect(source(page)).toHaveText("o/r @ abc1234 (main)");
  await expect(failed).toBeHidden();

  up = false;
  await load(page, reference);
  await confirm(page).getByRole("button", { name: "Open link" }).click();
  await expect(failed).toBeVisible();
  await header(page).getByRole("button", { name: "Dismiss" }).click();
  await page.reload();
  await expect(source(page)).toHaveText("o/r @ abc1234 (main)");
  await page.waitForTimeout(500);
  await expect(failed).toBeHidden();
});
