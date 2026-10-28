import { expect, test, type Page } from "@playwright/test";

const results = (page: Page) => page.getByRole("region", { name: "Results" });
const header = (page: Page) => page.getByRole("banner");
const source = (page: Page) => page.locator("#set-source");
const toast = (page: Page) => page.locator("#toasts");
const confirm = (page: Page) => page.getByRole("alertdialog");
const tabs = (page: Page) =>
  page.getByRole("tablist", { name: "Files" }).getByRole("tab");

/** A valid GitHub workflow that runs on `event`. */
const workflow = (event: string) =>
  `on: ${event}\njobs:\n  build:\n    runs-on: ubuntu-latest\n    steps:\n      - run: echo hi\n`;

const file = (name: string, text: string) => ({
  name,
  mimeType: "text/plain",
  buffer: Buffer.from(text),
});

/** Picks files with an Upload button. */
async function pick(
  page: Page,
  button: ReturnType<Page["getByRole"]>,
  files: ReturnType<typeof file>[],
) {
  const chooser = page.waitForEvent("filechooser");
  await button.click();
  await (await chooser).setFiles(files);
}

/** A folder as a tree: a string is a file's text, an object is a subfolder. */
interface Tree {
  [name: string]: string | Tree;
}

/**
 * Drops files and folders on `selector`. Playwright can't drag a real folder, so the drop
 * carries stand-ins for the browser's FileSystemEntry objects, built from `items`.
 */
async function drop(page: Page, items: Tree, selector = "body") {
  await page
    .locator(selector)
    .first()
    .evaluate((target, items) => {
      type Tree = { [name: string]: string | Tree };
      const entry = (name: string, item: string | Tree): unknown =>
        typeof item === "string"
          ? {
              isFile: true,
              isDirectory: false,
              name,
              file: (ok: (f: File) => void) => ok(new File([item], name)),
            }
          : {
              isFile: false,
              isDirectory: true,
              name,
              createReader: () => {
                let read = false;
                return {
                  readEntries: (ok: (e: unknown[]) => void) => {
                    ok(
                      read
                        ? []
                        : Object.entries(item).map(([n, i]) => entry(n, i)),
                    );
                    read = true;
                  },
                };
              },
            };
      const event = new Event("drop", { bubbles: true, cancelable: true });
      Object.defineProperty(event, "dataTransfer", {
        value: {
          types: ["Files"],
          items: Object.entries(items).map(([name, item]) => ({
            webkitGetAsEntry: () => entry(name, item),
          })),
        },
      });
      target.dispatchEvent(event);
    }, items);
}

const workflows: Tree = {
  "ci.yml": workflow("push"),
  "docs.yaml": workflow("pull_request"),
  "README.md": "# hi\n",
  shared: { "build.yml": workflow("push") },
};

test.beforeEach(async ({ page }) => {
  await page.goto("./");
  await page.getByLabel("Simulation date").fill("2026-12-03");
});

test("picked files go to .github/workflows/, and the ignored ones are counted and listed", async ({
  page,
}) => {
  await pick(page, results(page).getByRole("button", { name: "Upload" }), [
    file("ci.yml", workflow("push")),
    file("docs.yaml", workflow("pull_request")),
    file("README.md", "# hi\n"),
    file("notes.txt", "hi\n"),
  ]);

  await expect(tabs(page)).toHaveText(["ci.yml", "docs.yaml"]);
  await expect(tabs(page).first()).toHaveAttribute(
    "title",
    ".github/workflows/ci.yml",
  );
  await expect(toast(page)).toHaveText("Uploaded 2 files (2 ignored)");
  await expect(source(page)).toHaveText("Workflow set: 2 uploaded files");
  await expect(source(page)).toBeFocused();
  const summary = header(page).getByText(
    "2 loaded · 2 ignored (other types or subfolders)",
  );
  await summary.click();
  await expect(header(page).getByRole("listitem")).toHaveText([
    ".github/workflows/README.md",
    ".github/workflows/notes.txt",
  ]);
  await expect(results(page).getByRole("listitem")).toHaveText([
    "ci.yml runs root EV-0",
    "ci.yml › build runs root WN-2",
    "docs.yaml skipped root EV-0",
    "docs.yaml › build no-run root EV-0",
  ]);
});

test("an upload with no eligible files, or one unreadable file, changes nothing and says why", async ({
  page,
}) => {
  await results(page).getByRole("button", { name: "Load example" }).click();
  await confirm(page).getByRole("button", { name: "Load example" }).click();
  await expect(source(page)).toHaveText("Example");
  const upload = header(page).getByRole("button", { name: "Upload" });

  await pick(page, upload, [file("README.md", "# hi\n")]);
  await expect(header(page).getByRole("alert")).toHaveText(
    "No .yml/.yaml files directly in .github/workflows/. WhyNoRun reads only those, as GitHub does.",
  );

  await pick(page, upload, [
    file("ci.yml", workflow("push")),
    {
      name: "bad.yml",
      mimeType: "text/plain",
      buffer: Buffer.from([0xff, 0xfe, 0x6f]),
    },
  ]);
  await expect(header(page).getByRole("alert")).toHaveText(
    "Couldn’t read .github/workflows/bad.yml: it isn’t readable UTF-8 text, so nothing changed.",
  );

  await expect(source(page)).toHaveText("Example");
  await expect(tabs(page)).toHaveText(["ci.yml", "deploy.yml", "triage.yml"]);
  await expect(confirm(page)).toHaveCount(0);
});

for (const [folder, items] of [
  [".github", { ".github": { workflows } }],
  ["workflows", { workflows }],
  ["repo root", { repo: { "package.json": "{}", ".github": { workflows } } }],
] as const)
  test(`dropping the ${folder} folder loads the files directly in .github/workflows/ and lists the rest`, async ({
    page,
  }) => {
    await drop(page, items);

    await expect(tabs(page)).toHaveText(["ci.yml", "docs.yaml"]);
    await expect(tabs(page).nth(1)).toHaveAttribute(
      "title",
      ".github/workflows/docs.yaml",
    );
    await expect(toast(page)).toHaveText("Uploaded 2 files (2 ignored)");
    await header(page)
      .getByText("2 loaded · 2 ignored (other types or subfolders)")
      .click();
    await expect(header(page).getByRole("listitem")).toHaveText([
      ".github/workflows/README.md",
      ".github/workflows/shared/build.yml",
    ]);
    await expect(results(page).getByRole("listitem")).toHaveText([
      "ci.yml runs root EV-0",
      "ci.yml › build runs root WN-2",
      "docs.yaml skipped root EV-0",
      "docs.yaml › build no-run root EV-0",
    ]);
  });

test("the editor is part of the drop zone, and a loose Test file is left for Open test", async ({
  page,
}) => {
  await drop(page, { "docs.yml": workflow("pull_request") });
  await expect(tabs(page)).toHaveText(["docs.yml"]);

  await drop(page, { "push.test.yml": "version: 1\n" }, ".cm-content");
  await expect(header(page).getByRole("alert")).toHaveText(
    "push.test.yml is a Test file. Opening Test files isn’t supported yet, so nothing changed.",
  );
  await expect(tabs(page)).toHaveText(["docs.yml"]);

  await drop(page, { workflows }, ".cm-content");
  await expect(tabs(page)).toHaveText(["ci.yml", "docs.yaml"]);
  await expect(header(page).getByRole("alert")).toHaveCount(0);
});

test("uploading over typed work asks first, then replaces the set without announcing its first run", async ({
  page,
}) => {
  await header(page).getByRole("button", { name: "Paste" }).click();
  const paste = page.getByRole("dialog", { name: "Paste a GitHub workflow" });
  await paste.getByLabel("YAML").fill(workflow("push"));
  await paste.getByRole("button", { name: "Add file" }).click();
  await expect(source(page)).toHaveText("Workflow set: 1 pasted file");
  const rows = results(page).getByRole("listitem");
  await expect(rows).toHaveText([
    "untitled.yml runs root EV-0",
    "untitled.yml › build runs root WN-2",
  ]);

  const upload = header(page).getByRole("button", { name: "Upload" });
  const files = [
    file("ci.yml", workflow("push")),
    file("docs.yml", workflow("pull_request")),
  ];
  await pick(page, upload, files);
  await expect(confirm(page)).toContainText("It replaces your 1 pasted file.");
  await confirm(page).getByRole("button", { name: "Keep my draft" }).click();
  await expect(source(page)).toBeFocused();
  await expect(source(page)).toHaveText("Workflow set: 1 pasted file");

  await page.evaluate(() => {
    const said: string[] = [];
    (window as unknown as { said: string[] }).said = said;
    const status = document.getElementById("status")!;
    new MutationObserver(() => said.push(status.textContent ?? "")).observe(
      status,
      { childList: true, characterData: true, subtree: true },
    );
  });
  await pick(page, upload, files);
  await confirm(page).getByRole("button", { name: "Upload" }).click();
  await expect(source(page)).toHaveText("Workflow set: 2 uploaded files");
  await expect(source(page)).toBeFocused();
  await expect(toast(page)).toHaveText("Uploaded 2 files");
  await expect(rows).toHaveText([
    "ci.yml runs root EV-0",
    "ci.yml › build runs root WN-2",
    "docs.yml skipped root EV-0",
    "docs.yml › build no-run root EV-0",
  ]);
  // Longer than the 300 ms debounce, so an announcement would have landed (#12 addendum E).
  await page.waitForTimeout(1000);
  expect(
    await page.evaluate(() => (window as unknown as { said: string[] }).said),
  ).toEqual([]);

  // Editing the uploaded files is typed work too.
  await page
    .getByRole("textbox", { name: "YAML of .github/workflows/ci.yml" })
    .click();
  await page.keyboard.press("ControlOrMeta+A");
  await page.keyboard.type("on: pull_request");
  await expect(source(page)).toHaveText(
    "Workflow set: 2 uploaded files · edited",
  );
  await drop(page, { workflows });
  await expect(confirm(page)).toContainText(
    "It replaces your edits to the uploaded files.",
  );
});
