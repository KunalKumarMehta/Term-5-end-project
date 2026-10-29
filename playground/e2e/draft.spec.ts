import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

declare global {
  interface Window {
    said: string[];
  }
}

const KEY = "whynorun:draft:v1";
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

const header = (page: Page) => page.getByRole("banner");
const results = (page: Page) => page.getByRole("region", { name: "Results" });
const source = (page: Page) => page.locator("#set-source");
const toast = (page: Page) => page.locator("#toasts");
const confirm = (page: Page) => page.getByRole("alertdialog");
const scenarioTabs = (page: Page) =>
  page.getByRole("tablist", { name: "Scenarios" }).getByRole("tab");
const pin = (page: Page, key: string) =>
  results(page).getByRole("button", { name: `Pin ${key}`, exact: true });
const tray = (page: Page) =>
  results(page).getByRole("button", {
    name: /pinned · Save as Behaviour test…$/,
  });
const stored = (page: Page, key = KEY) =>
  page.evaluate((key) => localStorage.getItem(key), key);
/** Waits out the 500 ms autosave after the last change. */
const saved = (page: Page) =>
  expect(header(page)).toContainText(/Draft · saved \d+ \w{3} \d\d:\d\d/);

async function paste(page: Page, yaml = CI) {
  await header(page).getByRole("button", { name: "Paste" }).click();
  const dialog = page.getByRole("dialog", { name: "Paste a GitHub workflow" });
  await dialog.getByLabel("YAML").fill(yaml);
  await dialog.getByRole("button", { name: "Add file" }).click();
}

/** Seeds the draft before the page loads (spec #17, seam 3). */
const seed = (page: Page, value: string, key = KEY) =>
  page.addInitScript(
    ([key, value]) => {
      // Only on the first load, so a reload reads what the page wrote.
      if (!sessionStorage.getItem("seeded")) {
        sessionStorage.setItem("seeded", "1");
        localStorage.setItem(key!, value!);
      }
    },
    [key, value],
  );

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

test("reloading restores the imported Workflow set, both Scenarios with their source tags, and the pins, and says so once", async ({
  page,
}) => {
  await github(page);
  await page.goto("./");
  await expect(header(page)).not.toContainText("Draft");
  await page.getByLabel("Simulation date").fill("2026-12-03");
  await header(page).getByRole("button", { name: "Import repo" }).click();
  const form = page.getByRole("form", { name: "Import a public repo" });
  await form.getByLabel("owner/repo or github.com link").fill("o/r");
  await form.getByRole("button", { name: "Import", exact: true }).click();
  await expect(toast(page)).toHaveText("Imported o/r @ abc1234 · 1 loaded");

  // Scenario 2 sets the visibility; the token default stays assumed in both.
  await header(page).getByLabel("Compare").check();
  await page.getByLabel("Visibility").selectOption("private");
  await page.getByLabel("Scenario label").fill("Private");
  await page.getByLabel("Scenario label").press("Enter");
  await expect(results(page)).toContainText("ci.yml › build");
  await pin(page, "ci.yml › build").first().click();
  await expect(tray(page)).toHaveText("1 pinned · Save as Behaviour test…");
  await saved(page);

  await page.reload();
  await expect(source(page)).toHaveText("o/r @ abc1234 (main)");
  await expect(header(page)).toContainText(/Draft · saved/);
  await expect(scenarioTabs(page)).toHaveText(["Scenario 1", "Private"]);
  await expect(page.getByLabel("Simulation date")).toHaveValue("2026-12-03");
  await expect(page.getByLabel("Visibility")).toHaveAccessibleDescription(
    "⤓ imported",
  );
  await expect(page.getByLabel("Token default")).toHaveAccessibleDescription(
    "assumed",
  );
  await scenarioTabs(page).nth(1).click();
  await expect(page.getByLabel("Visibility")).toHaveAccessibleDescription(
    "set",
  );
  await expect(
    page.getByLabel("Visibility").locator("option:checked"),
  ).toHaveText("private");
  await expect(page.getByLabel("Default branch")).toHaveAccessibleDescription(
    "⤓ imported",
  );
  await expect(tray(page)).toHaveText("1 pinned · Save as Behaviour test…");
  await expect(pin(page, "ci.yml › build").first()).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  // One announcement at load; the first run after the restore stays silent.
  await page.waitForTimeout(1000);
  expect(await page.evaluate(() => window.said)).toEqual([
    expect.stringMatching(/^Restored your draft, saved \d+ \w{3} \d\d:\d\d$/),
  ]);
});

test("two tabs: a save in one shows the other “saved over”, which then never writes on hide, and Save this tab's work takes the draft back", async ({
  page,
  context,
}) => {
  await page.goto("./");
  await paste(page);
  await saved(page);

  const other = await context.newPage();
  await other.goto("./");
  await expect(other.locator("#set-source")).toHaveText(
    "Workflow set: 1 pasted file",
  );
  await other.getByLabel("Simulation date").fill("2026-12-03");
  await saved(other);

  await expect(header(page)).toContainText(
    "Another WhyNoRun tab saved over this draft",
  );
  await expect
    .poll(() => page.evaluate(() => window.said))
    .toContain("Another WhyNoRun tab saved over this draft");
  const theirs = await stored(page);
  // Hidden after the notice, this tab keeps its hands off the draft.
  await page.evaluate(() => window.dispatchEvent(new Event("pagehide")));
  expect(await stored(page)).toBe(theirs);

  await header(page)
    .getByRole("button", { name: "Save this tab’s work" })
    .click();
  await expect(header(page)).not.toContainText("saved over");
  const mine = JSON.parse((await stored(page))!);
  expect(mine.scenarios[0].scenario.repo.date).toBe("");
  await expect(header(other)).toContainText(
    "Another WhyNoRun tab saved over this draft",
  );

  // Another page on the origin clearing storage is a cleared draft.
  await other.evaluate(() => localStorage.clear());
  await expect(header(page)).toContainText(
    "Another WhyNoRun tab cleared the saved draft",
  );
});

test("the prototype-pollution input loaded through a draft gives the core's Verdicts and leaves Object.prototype alone (#14 §6.7)", async ({
  page,
}) => {
  const job = (id: string, condition: string) =>
    `  ${id}:\n    if: ${condition}\n    runs-on: x\n    steps:\n      - run: echo\n`;
  const yaml =
    "on: pull_request\njobs:\n" +
    job("ctor", "vars.CONSTRUCTOR == 'a'") +
    job("proto", "vars.__proto__ == 'b'") +
    job("payload", "github.event.__proto__.x == 'c'");
  // Written as JSON text, where __proto__ is an own key, as another page could write it.
  await seed(
    page,
    `{"version":1,"saved":"2026-10-28T14:02:00.000Z",
      "set":{"files":[{"path":".github/workflows/pr.yml","text":${JSON.stringify(yaml)}}],"origin":"pasted","edited":false},
      "scenarios":[{"label":"Polluted","touched":true,"pins":[],"sources":{},
        "scenario":{"event":{"name":"pull_request","payload":{"__proto__":{"x":"c"}}},
          "repo":{"date":"2026-12-03","vars":{"CONSTRUCTOR":"a","__proto__":"b"}}}}]}`,
  );
  await page.goto("./");
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

test("a store that throws removes the stored draft and says “Not saving a draft in this browser”, once", async ({
  page,
}) => {
  await seed(
    page,
    JSON.stringify({
      version: 1,
      saved: "2026-10-28T14:02:00.000Z",
      set: {
        files: [{ path: ".github/workflows/ci.yml", text: CI }],
        origin: "pasted",
        edited: false,
      },
      scenarios: [
        {
          label: "Scenario 1",
          touched: true,
          pins: [],
          sources: {},
          scenario: { event: { name: "push" }, repo: { date: "" } },
        },
      ],
    }),
  );
  await page.addInitScript(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException("full", "QuotaExceededError");
    };
  });
  await page.goto("./");
  await expect(header(page)).toContainText("Draft · saved");
  await paste(page);
  await expect(header(page)).toContainText(
    "Not saving a draft in this browser",
  );
  await expect(header(page)).not.toContainText("Draft · saved");
  expect(await stored(page)).toBeNull();
  await page.getByLabel("Simulation date").fill("2026-12-03");
  await page.waitForTimeout(1000);
  const said = await page.evaluate(() => window.said);
  expect(said.filter((s) => s.includes("Not saving"))).toHaveLength(1);
});

test("a draft from another WhyNoRun version offers Download or Discard, and a newer one is never overwritten", async ({
  page,
}) => {
  const newer = '{"from":"a later WhyNoRun"}';
  await seed(page, newer, "whynorun:draft:v2");
  await page.goto("./");
  const notice = header(page).getByText(
    "A draft from another WhyNoRun version can't be opened here",
  );
  await expect(notice).toBeVisible();
  // Nothing was opened: the empty state shows.
  await expect(results(page)).toContainText("No Workflow set yet");

  const downloading = page.waitForEvent("download");
  await header(page).getByRole("button", { name: "Download" }).click();
  const download = await downloading;
  expect(download.suggestedFilename()).toBe("whynorun-draft.json");
  expect(readFileSync(await download.path(), "utf8")).toBe(newer);

  // This version saves under its own key, and Discard leaves the newer one alone.
  await paste(page);
  await saved(page);
  await header(page).getByRole("button", { name: "Discard" }).click();
  await expect(notice).toBeHidden();
  expect(await stored(page, "whynorun:draft:v2")).toBe(newer);
});

test("corrupt JSON under this version's key offers Discard, and isn't overwritten until it's discarded", async ({
  page,
}) => {
  await seed(page, "{not json");
  await page.goto("./");
  await expect(header(page)).toContainText(
    "A draft from another WhyNoRun version can't be opened here",
  );
  await paste(page);
  await page.waitForTimeout(1000);
  expect(await stored(page)).toBe("{not json");
  await header(page).getByRole("button", { name: "Discard" }).click();
  await page.getByLabel("Simulation date").fill("2026-12-03");
  await saved(page);
  expect(JSON.parse((await stored(page))!).set.origin).toBe("pasted");
});

test("a draft that fails a field check loads nothing and names the field without its value (#14 §6.4)", async ({
  page,
}) => {
  await seed(
    page,
    JSON.stringify({
      version: 1,
      saved: "2026-10-28T14:02:00.000Z",
      set: {
        files: [{ path: ".github/workflows/../../evil.yml", text: CI }],
        origin: "pasted",
        edited: false,
      },
      scenarios: [
        {
          label: "Scenario 1",
          touched: true,
          pins: [],
          sources: {},
          scenario: { event: { name: "push" }, repo: { date: "" } },
        },
      ],
    }),
  );
  await page.goto("./");
  await expect(header(page)).toContainText(
    "The saved draft can't be opened: set.files[0].path is invalid",
  );
  await expect(header(page)).not.toContainText("evil");
  await expect(results(page)).toContainText("No Workflow set yet");
});

test("an opened Test file comes back on reload: its pins' statuses recomputed, and its unopened test kept verbatim for Save", async ({
  page,
}) => {
  const three = `version: 1
tests:
  - label: One
    scenario:
      event: { name: push, ref: refs/heads/main }
      repo: { date: 2026-12-03 }
    pins:
      ci.yml: { value: runs }
  - label: Two
    scenario:
      event: { name: push, ref: refs/heads/main }
      repo: { date: 2026-12-03 }
    pins:
      ci.yml › build: { value: runs, root: WN-2 }
  - label: Three
    scenario:
      event: { name: push }
      repo: { date: 2026-01-01, vars: { FLAG: "true" } } # kept as written
    pins:
      ci.yml › test: { root: WN-2 }
`;
  await page.goto("./");
  await results(page).getByRole("button", { name: "Load example" }).click();
  const chooser = page.waitForEvent("filechooser");
  await header(page).getByRole("button", { name: "Open test…" }).click();
  await (
    await chooser
  ).setFiles({
    name: "three.test.yml",
    mimeType: "text/yaml",
    buffer: Buffer.from(three),
  });
  const picker = page.getByRole("dialog", { name: "Which tests to open?" });
  await picker.getByLabel("One").check();
  await picker.getByLabel("Two").check();
  await picker.getByRole("button", { name: "Open" }).click();
  await saved(page);
  expect(JSON.parse((await stored(page))!).opened.text).toBe(three);

  await page.reload();
  await expect(scenarioTabs(page)).toHaveText(["One", "Two"]);
  await expect(
    results(page).getByRole("region", { name: "Opened Test file" }),
  ).toContainText("Test file three.test.yml");
  await expect(results(page).locator(".pin-status")).toHaveText(
    Array(2).fill("✓ matches its pin"),
  );
  await tray(page).click();
  const dialog = page.getByRole("dialog", { name: "Save as Behaviour test" });
  await expect(dialog.getByLabel("Path")).toHaveValue(
    ".github/whynorun/three.test.yml",
  );
  await expect(dialog.getByLabel("Other tests")).toHaveText(
    "Three: unchanged (not opened)",
  );
  await expect(dialog.getByLabel("Preview")).toContainText("label: Three");
});

test("Start over asks first, then clears the Workflow set, Scenarios, tray and draft, and shows the empty state", async ({
  page,
}) => {
  await page.goto("./");
  await paste(page);
  await page.getByLabel("Simulation date").fill("2026-12-03");
  await pin(page, "untitled.yml › build").click();
  await saved(page);

  await header(page).getByRole("button", { name: "Start over" }).click();
  await expect(confirm(page)).toContainText("Start over?");
  await expect(confirm(page)).toContainText("It replaces your 1 pasted file.");
  await expect(confirm(page)).toContainText(
    "It replaces your 1 pinned Verdict.",
  );
  await expect(
    confirm(page).getByRole("button", { name: "Keep my draft" }),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(source(page)).toHaveText("Workflow set: 1 pasted file");

  await header(page).getByRole("button", { name: "Start over" }).click();
  await confirm(page).getByRole("button", { name: "Start over" }).click();
  await expect(toast(page)).toHaveText("Started over");
  await expect(source(page)).toHaveText("No Workflow set");
  await expect(source(page)).toBeFocused();
  await expect(results(page)).toContainText("No Workflow set yet");
  await expect(page.getByLabel("Simulation date")).toHaveValue("");
  await expect(tray(page)).toHaveCount(0);
  await expect(header(page)).not.toContainText("Draft · saved");
  expect(await stored(page)).toBeNull();
  await page.reload();
  await expect(results(page)).toContainText("No Workflow set yet");
});
