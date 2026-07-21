import { expect, test, type Page } from "@playwright/test";

import { scenario } from "../../harness/builder";
import { EditorPage } from "../harness/editor-page";
import { runIntegration } from "../harness/run-integration";

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

test("target B referencing ${A}: A declared first", async () => {
  const b = scenario();
  const a = b.shortTextVar("A", "original_A");
  const bVar = b.shortTextVar("B", "original_B");
  b.map("L1", a, [b.alwaysRun("new_A")]);
  b.map("L1", bVar, [b.alwaysRun({ ref: a })]);
  b.state({ A: "original_A", B: "original_B" }, "L1");

  const result = await runIntegration(editor, b.build());
  expect(result.values.A).toBe("new_A");
  // The real engine defers action writes until the pass ends, so B reads old A.
  expect(result.values.B).toBe("original_A");
});

test("target B referencing ${A}: B declared first", async () => {
  const b = scenario();
  const bVar = b.shortTextVar("B", "original_B");
  const a = b.shortTextVar("A", "original_A");
  b.map("L1", bVar, [b.alwaysRun({ ref: a })]);
  b.map("L1", a, [b.alwaysRun("new_A")]);
  b.state({ A: "original_A", B: "original_B" }, "L1");

  const result = await runIntegration(editor, b.build());
  expect(result.values.A).toBe("new_A");
  // B runs before A, so it reads A's original value. This result is expected
  // under both inline and deferred writes — it confirms consistency but does
  // not independently prove deferral (only test 1 above does that).
  expect(result.values.B).toBe("original_A");
});
