/**
 * GATE: these must pass before any integration scenario runs (wired as a
 * Playwright project dependency in playwright.config.ts).
 *
 * They pin two engine contracts the rest of the harness — and the Bun mock's
 * `imageValue()` shape — depend on:
 *
 *   1. Setting a bare string on an image variable is a clean success that the
 *      engine stores as `{ connectorId: "", assetId: <string>, context: {} }`.
 *   2. That write does NOT throw inside an action, so it cannot abort the rest
 *      of the action pass (the production imageSelectionScript uses a single
 *      try/catch — one throw would skip every remaining variable).
 *
 * If either breaks, image-target snapshots across the Bun suite are modelling a
 * shape the engine no longer produces, so we stop before trusting them.
 */

import { expect, test, type Page } from "@playwright/test";

import { scenario } from "../../harness/builder";
import { imageValue } from "../../harness/run";
import { EditorPage } from "../harness/editor-page";
import { BASE_TEMPLATE, runIntegration } from "../harness/run-integration";

let page: Page;
let editor: EditorPage;
const consoleLines: string[] = [];

test.beforeAll(async ({ browser }) => {
  page = await browser.newPage();
  page.on("console", (msg) => consoleLines.push(`${msg.type()}: ${msg.text()}`));
  page.on("pageerror", (err) => consoleLines.push(`pageerror: ${err.message}`));
  await page.goto("/");
  editor = new EditorPage(page);
  await editor.waitForEngine();
});

test.afterAll(async () => {
  await page?.close();
});

// GATE 1: a bare string written to an image variable is stored as the wrapped
// ConnectorImageVariableSource shape — the exact contract the Bun mock mirrors.
test("image variable stores a bare string as a wrapped source object", async () => {
  await editor.loadTemplate(BASE_TEMPLATE);

  const probe = await page.evaluate(async () => {
    const sdk: any = window.SDK;
    const createResp = await sdk.variable.create("", "image");
    const id = createResp.parsedData as string;
    await sdk.variable.rename(id, "HeroImg");

    const setResp = await sdk.variable.setValue(id, "hero.png");
    const readResp = await sdk.variable.getByName("HeroImg");

    return {
      setSuccess: setResp.success,
      storedValue: readResp.parsedData?.value ?? null,
    };
  });

  // The write must not hard-reject...
  expect(probe.setSuccess).toBe(true);
  // ...and the stored shape must match what the Bun mock's imageValue() emits.
  expect(probe.storedValue).toEqual(imageValue("hero.png"));
});

// GATE 2 (the critical one): the real imageSelectionScript sets an image target
// FIRST, then a text sentinel SECOND, in one action pass under a single
// try/catch. If setting the image threw, the sentinel would never run. The
// sentinel proves the action survived the image write.
test("image write does not abort the rest of the action", async () => {
  consoleLines.length = 0;

  const b = scenario();
  // Declaration order = processing order. Image FIRST so a throw would stop
  // the sentinel that follows it.
  const hero = b.imageVar("Hero");
  const sentinel = b.shortTextVar("Sentinel", "unset");
  b.map("L1", hero, [b.alwaysRun("hero.png")]);
  b.map("L1", sentinel, [b.alwaysRun("action_ran")]);
  b.state({}, "L1");

  const result = await runIntegration(editor, b.build());

  const errorLines = consoleLines.filter((l) => /error|exception|fail/i.test(l));
  if (errorLines.length) {
    // eslint-disable-next-line no-console
    console.log("[gate] console errors during action:\n" + errorLines.join("\n"));
  }

  // The image target still lands as the wrapped shape...
  expect(result.values.Hero).toEqual(imageValue("hero.png"));
  // ...and, crucially, the sentinel that runs AFTER it is set, proving the
  // image write did not abort the action.
  expect(result.values.Sentinel).toBe("action_ran");
});
