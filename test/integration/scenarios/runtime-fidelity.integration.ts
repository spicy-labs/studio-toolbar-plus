/**
 * Real-engine ports of the shared runtime cases (test/harness/cases/runtime.ts)
 * — the same scenarios the Bun mock asserts, run through the engine's QuickJS
 * action sandbox instead of the mock. Any divergence between this suite and the
 * Bun suite is a harness-fidelity finding.
 *
 * The cases cover `${ref}` substitution + `String.replace`/`replaceAll`
 * transforms, `$$`/`$&` replacement semantics (most likely to differ V8↔qjs),
 * single-pass substitution, positional multi-dependent matching, and match
 * precedence. Every target is an image variable, so read-back values are the
 * wrapped `imageValue(...)` shape (see image-write.gate.ts).
 *
 * Not ported (they stay Bun-only): build-time assertions and no-match /
 * error-collection cases, which the read-back-only harness cannot observe.
 */

import { expect, test, type Page } from "@playwright/test";

import { RUNTIME_CASES } from "../../harness/cases/runtime";
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

for (const c of RUNTIME_CASES) {
  test(`${c.group}: ${c.name}`, async () => {
    const result = await runIntegration(editor, c.build());
    expect(result.values).toEqual(c.expected);
  });
}
