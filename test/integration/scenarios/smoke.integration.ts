import { expect, test, type Page } from "@playwright/test";

import { scenario } from "../../harness/builder";
import { EditorPage } from "../harness/editor-page";
import { BASE_TEMPLATE, runIntegration } from "../harness/run-integration";

let page: Page;
let editor: EditorPage;

test.beforeAll(async ({ browser }) => {
  page = await browser.newPage();
  await page.goto("/");
  editor = new EditorPage(page);
  await editor.waitForEngine();
});

test.afterAll(async () => {
  await page?.close();
});

test("engine boots and template loads", async () => {
  await editor.loadTemplate(BASE_TEMPLATE);

  const layouts = await editor.getLayouts();
  expect(layouts.length).toBeGreaterThanOrEqual(3);
  expect(layouts.map(({ name }) => name)).toEqual(
    expect.arrayContaining(["A4", "A4-A", "A4-B"]),
  );
});

test("variables can be created and read back", async () => {
  await editor.loadTemplate(BASE_TEMPLATE);
  await editor.createShortTextVariable("Greeting", "hello");

  expect(await editor.getVariableValue("Greeting")).toBe("hello");
});

test("action deploys and fires on layout select", async () => {
  await editor.loadTemplate(BASE_TEMPLATE);
  await editor.createShortTextVariable("Sentinel", "unset");
  await editor.renameLayout("A4-A", "TestLayout");
  await editor.deployAction(
    `function imageSelectionScript() {
      setVariableValue("Sentinel", "action_ran");
      return { debugData: {}, errorCollection: [] };
    }
    imageSelectionScript();`,
    [{ event: "selectedLayoutChanged" }],
  );
  await editor.enableActions();
  await editor.selectLayout("A4-B");
  await editor.selectLayout("TestLayout");

  expect(await editor.getVariableValue("Sentinel")).toBe("action_ran");
});

test("single-dependent group matching (full pipeline)", async () => {
  const b = scenario();
  const size = b.listVar("Size", ["S", "M", "L"]);
  const hero = b.shortTextVar("Hero");
  b.map("L1", hero, [
    b.group({ [size]: ["S", "M"] }, "hero_SM.png"),
    b.group({ [size]: ["L"] }, "hero_L.png"),
  ]);
  b.state({ Size: "M" }, "L1");

  const result = await runIntegration(editor, b.build());
  expect(result.values.Hero).toBe("hero_SM.png");
});

test("always-run sets value", async () => {
  const b = scenario();
  const hero = b.shortTextVar("Hero");
  b.map("L1", hero, [b.alwaysRun("always.png")]);
  b.state({}, "L1");

  const result = await runIntegration(editor, b.build());
  expect(result.values.Hero).toBe("always.png");
});
