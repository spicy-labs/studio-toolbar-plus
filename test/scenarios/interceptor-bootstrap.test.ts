import { describe, test, expect, beforeEach } from "bun:test";
import { readFileSync } from "node:fs";

const SRC = readFileSync("interceptor-bootstrap.js", "utf8");
const ENV = "cp-uef-142";
const OUTPUT_URL = `https://cp-uef-142.chili-publish.online/grafx/api/v1/environment/${ENV}/output/pdf`;
const SETTINGS_URL = `https://cp-uef-142.chili-publish.online/grafx/api/v1/environment/${ENV}/settings`;

type Call = { input: any; init: any };

/**
 * The bootstrap is the interceptor that actually runs in the browser — it is
 * injected at document_start, long before the toolbar bundle exists. It has no
 * imports by design, so exercise it by evaluating the file against a fake
 * window rather than by importing it.
 */
function loadBootstrap(store: Record<string, string>) {
  const calls: Call[] = [];
  const events: any[] = [];
  const localStorage = {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => {
      store[k] = v;
    },
    removeItem: (k: string) => {
      delete store[k];
    },
  };
  const window: any = {
    dispatchEvent: (event: any) => {
      events.push(event);
      return true;
    },
    fetch: (input: any, init: any) => {
      calls.push({ input, init });
      return Promise.resolve(
        new Response(JSON.stringify({ sdkVersionPublic: "1.46" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      );
    },
  };

  new Function(
    "window",
    "localStorage",
    "Request",
    "Response",
    "Headers",
    "URL",
    SRC,
  )(window, localStorage, Request, Response, Headers, URL);

  return { window, calls, events };
}

const overrideValue = (engineVersion?: string) =>
  JSON.stringify({
    sdkVersion: "1.31.0",
    engineVersion,
    expiresAt: Date.now() + 60 * 60 * 1000,
  });

const overrideKey = `studio_version_override_${ENV}`;

/**
 * Studio's boot-time /settings call is what latches the override into the tab.
 * Injection is gated on that snapshot, so an export test has to boot first —
 * exactly like the real page does.
 */
async function boot(window: any) {
  await window.fetch(SETTINGS_URL);
}

async function sentBody(calls: Call[]): Promise<any> {
  const call = calls.at(-1)!;
  if (call.input instanceof Request) return call.input.clone().json();
  return JSON.parse(call.init.body);
}

describe("interceptor bootstrap — output engine injection", () => {
  test("injects the override engine into a string body", async () => {
    const { window, calls } = loadBootstrap({
      [overrideKey]: overrideValue("2.15"),
    });

    await boot(window);
    await window.fetch(OUTPUT_URL, {
      method: "POST",
      body: JSON.stringify({ projectId: "p1", engineVersion: null }),
    });

    expect((await sentBody(calls)).engineVersion).toBe("2.15");
    expect(window.__studioVersionInterceptorState.output.injected).toBe(1);
    expect(window.__studioVersionInterceptorState.output.skipped).toBe(0);
    expect(window.__studioVersionInterceptorState.output.lastEngineVersion).toBe(
      "2.15",
    );
  });

  test("injects into a Request-object body", async () => {
    const { window, calls } = loadBootstrap({
      [overrideKey]: overrideValue("2.15"),
    });

    await boot(window);
    await window.fetch(
      new Request(OUTPUT_URL, {
        method: "POST",
        body: JSON.stringify({ projectId: "p1" }),
        headers: { "content-type": "application/json" },
      }),
    );

    const body = await sentBody(calls);
    expect(body.engineVersion).toBe("2.15");
    expect(body.projectId).toBe("p1");
    expect(window.__studioVersionInterceptorState.output.injected).toBe(1);
  });

  test("counts a skip when the body is not JSON, and still sends it", async () => {
    const { window, calls } = loadBootstrap({
      [overrideKey]: overrideValue("2.15"),
    });

    await boot(window);
    await window.fetch(OUTPUT_URL, { method: "POST", body: "not json" });

    expect(calls.at(-1)!.init.body).toBe("not json");
    expect(window.__studioVersionInterceptorState.output.injected).toBe(0);
    expect(window.__studioVersionInterceptorState.output.skipped).toBe(1);
  });

  test("leaves the body alone with no override stored", async () => {
    const { window, calls } = loadBootstrap({});

    await window.fetch(OUTPUT_URL, {
      method: "POST",
      body: JSON.stringify({ projectId: "p1" }),
    });

    expect((await sentBody(calls)).engineVersion).toBeUndefined();
    expect(window.__studioVersionInterceptorState.output.skipped).toBe(0);
  });

  test("leaves the body alone for an override with no engine recorded", async () => {
    const { window, calls } = loadBootstrap({
      [overrideKey]: overrideValue(undefined),
    });

    await boot(window);
    await window.fetch(OUTPUT_URL, {
      method: "POST",
      body: JSON.stringify({ projectId: "p1" }),
    });

    expect((await sentBody(calls)).engineVersion).toBeUndefined();
    expect(window.__studioVersionInterceptorState.output.skipped).toBe(0);
  });

  test("ignores an override that was already expired at boot", async () => {
    const { window, calls } = loadBootstrap({
      [overrideKey]: JSON.stringify({
        sdkVersion: "1.31.0",
        engineVersion: "2.15",
        expiresAt: Date.now() - 1000,
      }),
    });

    await boot(window);
    await window.fetch(OUTPUT_URL, {
      method: "POST",
      body: JSON.stringify({ projectId: "p1" }),
    });

    expect((await sentBody(calls)).engineVersion).toBeUndefined();
    expect(window.__studioVersionInterceptorState.output.skipped).toBe(0);
  });

  test("a tab that booted clean is unaffected by another tab's override", async () => {
    // localStorage is shared across tabs. This tab booted on the default engine
    // and shows no banner, so its export must not be silently redirected.
    const store: Record<string, string> = {};
    const { window, calls } = loadBootstrap(store);

    await boot(window);
    store[overrideKey] = overrideValue("2.15");

    await window.fetch(OUTPUT_URL, {
      method: "POST",
      body: JSON.stringify({ projectId: "p1" }),
    });

    expect((await sentBody(calls)).engineVersion).toBeUndefined();
    expect(window.__studioVersionInterceptorState.output.injected).toBe(0);
    expect(window.__studioVersionInterceptorState.output.skipped).toBe(0);
  });

  test("keeps injecting the engine the tab runs after the override expires", async () => {
    // The tab goes on running the overridden engine until it is reloaded, so
    // its exports must keep matching it. The banner tells the user to reload.
    const store: Record<string, string> = { [overrideKey]: overrideValue("2.15") };
    const { window, calls } = loadBootstrap(store);

    await boot(window);
    delete store[overrideKey];

    await window.fetch(OUTPUT_URL, {
      method: "POST",
      body: JSON.stringify({ projectId: "p1" }),
    });

    expect((await sentBody(calls)).engineVersion).toBe("2.15");
  });

  test("sends the engine this tab booted with, not one applied later elsewhere", async () => {
    const store: Record<string, string> = { [overrideKey]: overrideValue("2.15") };
    const { window, calls } = loadBootstrap(store);

    await boot(window);
    store[overrideKey] = overrideValue("2.29.2");

    await window.fetch(OUTPUT_URL, {
      method: "POST",
      body: JSON.stringify({ projectId: "p1" }),
    });

    expect((await sentBody(calls)).engineVersion).toBe("2.15");
  });

  test("a trailing slash is the same endpoint", async () => {
    const { window, calls } = loadBootstrap({
      [overrideKey]: overrideValue("2.15"),
    });

    await boot(window);
    await window.fetch(`${OUTPUT_URL}/`, {
      method: "POST",
      body: JSON.stringify({ projectId: "p1" }),
    });

    expect((await sentBody(calls)).engineVersion).toBe("2.15");
  });

  test("does not touch a GET to the same path", async () => {
    const { window, calls } = loadBootstrap({
      [overrideKey]: overrideValue("2.15"),
    });

    await boot(window);
    await window.fetch(OUTPUT_URL);

    expect(calls.at(-1)!.init).toBeUndefined();
    expect(window.__studioVersionInterceptorState.output.injected).toBe(0);
  });
});

describe("interceptor bootstrap — settings response rewrite still works", () => {
  test("rewrites sdkVersionPublic and records the real default", async () => {
    const { window } = loadBootstrap({
      [overrideKey]: overrideValue("2.15"),
    });

    const res = await window.fetch(SETTINGS_URL);
    expect((await res.json()).sdkVersionPublic).toBe("1.31");

    const state = window.__studioVersionInterceptorState;
    expect(state.observedDefaults[ENV]).toBe("1.46");
    expect(state.appliedOverride.sdkVersion).toBe("1.31.0");
    expect(state.appliedOverride.engineVersion).toBe("2.15");
  });

  test("only the first settings call defines the applied snapshot", async () => {
    const store: Record<string, string> = {};
    const { window } = loadBootstrap(store);

    // Boot call with no override stored — nothing latches.
    await window.fetch(SETTINGS_URL);
    store[overrideKey] = overrideValue("2.15");
    await window.fetch(SETTINGS_URL);

    expect(window.__studioVersionInterceptorState.appliedOverride).toBe(null);
  });
});

// ---------------------------------------------------------------------------
// Save blocking
// ---------------------------------------------------------------------------

const TEMPLATE_ID = "b1a2c3d4";
const TEMPLATE_UPDATE_URL = `https://cp-uef-142.chili-publish.online/grafx/api/v1/environment/${ENV}/templates/${TEMPLATE_ID}`;
const TEMPLATE_CREATE_URL = `https://cp-uef-142.chili-publish.online/grafx/api/v1/environment/${ENV}/templates`;
const COMPONENT_ID = "c0ffee01";
const COMPONENT_UPDATE_URL = `https://cp-uef-142.chili-publish.online/grafx/api/v1/environment/${ENV}/components/${COMPONENT_ID}`;

/** The environment default reported by the fake /settings response is 1.46. */
const versionedOverride = (sdkVersion: string) =>
  JSON.stringify({
    sdkVersion,
    engineVersion: "2.15",
    expiresAt: Date.now() + 60 * 60 * 1000,
  });

const DOCUMENT_BODY = JSON.stringify({
  documentVersion: "0.15.0",
  name: "poster",
});

/** Resolves to "pending" if the promise has not settled within a few ticks. */
async function settledOrPending(promise: Promise<any>) {
  const sentinel = Symbol("pending");
  const idle = new Promise((resolve) => setTimeout(() => resolve(sentinel), 5));
  const winner = await Promise.race([promise, idle]);
  return winner === sentinel ? "pending" : winner;
}

/** Boots the tab on an override NEWER than the 1.46 environment default. */
async function bootNewer(sdkVersion = "1.52.0") {
  const loaded = loadBootstrap({ [overrideKey]: versionedOverride(sdkVersion) });
  await boot(loaded.window);
  return loaded;
}

describe("interceptor bootstrap - save blocking", () => {
  test("holds a template save made under a newer override", async () => {
    const { window, calls, events } = await bootNewer();
    const before = calls.length;

    const pending = window.fetch(TEMPLATE_UPDATE_URL, {
      method: "PUT",
      body: DOCUMENT_BODY,
    });

    expect(calls.length).toBe(before);
    expect(await settledOrPending(pending)).toBe("pending");

    const state = window.__studioVersionInterceptorState;
    expect(state.save.observed).toBe(1);
    expect(state.save.blocked).toBe(1);
    expect(state.pendingSave).not.toBe(null);

    expect(events.length).toBe(1);
    expect(events[0].type).toBe("studioToolbarPlus:saveBlocked");
    expect(events[0].detail).toEqual({
      id: state.pendingSave.id,
      kind: "template",
      isCreate: false,
      overrideVersion: "1.52",
      defaultVersion: "1.46",
    });
  });

  test("Save As (POST create) is held and flagged isCreate", async () => {
    const { window, events } = await bootNewer();

    window.fetch(TEMPLATE_CREATE_URL, { method: "POST", body: DOCUMENT_BODY });

    expect(events[0].detail.isCreate).toBe(true);
    expect(events[0].detail.kind).toBe("template");
  });

  // Pins the cross-file contract with studioVersionInterceptor.ts, which types
  // the id as a string and hands it back through forceSave/cancelSave. Those
  // compare with ===, so a numeric id would fail to match the moment anything
  // on the React side normalised it, leaving the save held until the timeout.
  test("save ids are strings, and the event carries the same id as the state", async () => {
    const { window, events } = await bootNewer();

    window.fetch(TEMPLATE_UPDATE_URL, { method: "PUT", body: DOCUMENT_BODY });

    const state = window.__studioVersionInterceptorState;
    expect(typeof state.pendingSave.id).toBe("string");
    expect(events[0].detail.id).toBe(state.pendingSave.id);
  });

  test("forceSave sends the original request and resolves with the real response", async () => {
    const { window, calls } = await bootNewer();
    const before = calls.length;

    const pending = window.fetch(TEMPLATE_UPDATE_URL, {
      method: "PUT",
      body: DOCUMENT_BODY,
    });
    const state = window.__studioVersionInterceptorState;

    expect(await state.forceSave(state.pendingSave.id)).toEqual({
      ok: true,
      status: 200,
    });

    const response = await pending;
    expect(response.status).toBe(200);
    expect(calls.length).toBe(before + 1);
    expect(calls.at(-1)!.input).toBe(TEMPLATE_UPDATE_URL);
    expect(calls.at(-1)!.init.body).toBe(DOCUMENT_BODY);
    expect(state.save.forced).toBe(1);
    expect(state.pendingSave).toBe(null);
  });

  test("forceSave replays a Request object untouched, so auth headers survive", async () => {
    const { window, calls } = await bootNewer();
    const before = calls.length;

    const request = new Request(TEMPLATE_UPDATE_URL, {
      method: "PUT",
      body: DOCUMENT_BODY,
      headers: {
        authorization: "Bearer token",
        "content-type": "application/json",
      },
    });
    const pending = window.fetch(request);
    const state = window.__studioVersionInterceptorState;

    await settledOrPending(pending);
    expect(calls.length).toBe(before);
    expect(await state.forceSave(state.pendingSave.id)).toEqual({
      ok: true,
      status: 200,
    });
    await pending;

    expect(calls.length).toBe(before + 1);
    expect(calls.at(-1)!.input).toBe(request);
    expect(calls.at(-1)!.input.headers.get("authorization")).toBe(
      "Bearer token",
    );
  });

  test("cancelSave resolves a 409 whose detail names both versions", async () => {
    const { window, calls } = await bootNewer();
    const before = calls.length;

    const pending = window.fetch(TEMPLATE_UPDATE_URL, {
      method: "PUT",
      body: DOCUMENT_BODY,
    });
    const state = window.__studioVersionInterceptorState;

    expect(state.cancelSave(state.pendingSave.id)).toBe(true);

    const response = await pending;
    expect(response.status).toBe(409);
    expect(response.headers.get("content-type")).toBe("application/json");

    const body = await response.json();
    expect(typeof body.detail).toBe("string");
    expect(body.detail).toContain("1.52");
    expect(body.detail).toContain("1.46");

    expect(calls.length).toBe(before);
    expect(state.save.forced).toBe(0);
    expect(state.pendingSave).toBe(null);
  });

  test("an override equal to the environment default saves normally", async () => {
    const { window, calls, events } = await bootNewer("1.46.3");
    const before = calls.length;

    await window.fetch(TEMPLATE_UPDATE_URL, {
      method: "PUT",
      body: DOCUMENT_BODY,
    });

    expect(calls.length).toBe(before + 1);
    expect(events.length).toBe(0);
    expect(window.__studioVersionInterceptorState.save.blocked).toBe(0);
    expect(window.__studioVersionInterceptorState.save.observed).toBe(1);
  });

  test("an override older than the environment default saves normally", async () => {
    const { window, calls, events } = await bootNewer("1.31.0");
    const before = calls.length;

    await window.fetch(TEMPLATE_UPDATE_URL, {
      method: "PUT",
      body: DOCUMENT_BODY,
    });

    expect(calls.length).toBe(before + 1);
    expect(events.length).toBe(0);
    expect(window.__studioVersionInterceptorState.save.blocked).toBe(0);
  });

  test("a tab that booted clean saves normally even with an override in storage", async () => {
    const store: Record<string, string> = {};
    const { window, calls, events } = loadBootstrap(store);

    await boot(window);
    store[overrideKey] = versionedOverride("1.52.0");
    const before = calls.length;

    await window.fetch(TEMPLATE_UPDATE_URL, {
      method: "PUT",
      body: DOCUMENT_BODY,
    });

    expect(calls.length).toBe(before + 1);
    expect(events.length).toBe(0);
    expect(window.__studioVersionInterceptorState.save.observed).toBe(1);
  });

  test("blocks when the environment default was never observed (fail closed)", async () => {
    const { window, calls } = await bootNewer();
    // Should be impossible - appliedOverride and observedDefaults are written
    // in the same branch - but we must not guess past a missing default.
    delete window.__studioVersionInterceptorState.observedDefaults[ENV];
    const before = calls.length;

    const pending = window.fetch(TEMPLATE_UPDATE_URL, {
      method: "PUT",
      body: DOCUMENT_BODY,
    });

    expect(calls.length).toBe(before);
    expect(await settledOrPending(pending)).toBe("pending");
    expect(window.__studioVersionInterceptorState.save.blocked).toBe(1);
  });

  test("a rename (PUT with no body) is sent normally", async () => {
    const { window, calls, events } = await bootNewer();
    const before = calls.length;

    await window.fetch(`${TEMPLATE_UPDATE_URL}?name=renamed`, { method: "PUT" });

    expect(calls.length).toBe(before + 1);
    expect(events.length).toBe(0);
    expect(window.__studioVersionInterceptorState.save.observed).toBe(1);
  });

  test("a component rename body is sent normally", async () => {
    const { window, calls, events } = await bootNewer();
    const before = calls.length;

    await window.fetch(COMPONENT_UPDATE_URL, {
      method: "PUT",
      body: JSON.stringify({
        name: "renamed",
        defaultComponentDimensions: { width: 100, height: 100 },
      }),
    });

    expect(calls.length).toBe(before + 1);
    expect(events.length).toBe(0);
  });

  test("a component save body is blocked", async () => {
    const { window, calls, events } = await bootNewer();
    const before = calls.length;

    const pending = window.fetch(COMPONENT_UPDATE_URL, {
      method: "PUT",
      body: JSON.stringify({ name: "c", content: { pages: [] } }),
    });

    expect(calls.length).toBe(before);
    expect(await settledOrPending(pending)).toBe("pending");
    expect(events[0].detail.kind).toBe("component");
  });

  test("an unparseable non-empty body is blocked (fail closed)", async () => {
    const { window, calls } = await bootNewer();
    const before = calls.length;

    const pending = window.fetch(TEMPLATE_UPDATE_URL, {
      method: "PUT",
      body: " gzipped-bytes",
    });

    expect(calls.length).toBe(before);
    expect(await settledOrPending(pending)).toBe("pending");
    expect(window.__studioVersionInterceptorState.save.blocked).toBe(1);
  });

  test("a template body with no recognised version key is blocked", async () => {
    const { window, calls } = await bootNewer();
    const before = calls.length;

    const pending = window.fetch(TEMPLATE_UPDATE_URL, {
      method: "PUT",
      body: JSON.stringify({ pages: [] }),
    });

    expect(calls.length).toBe(before);
    expect(await settledOrPending(pending)).toBe("pending");
  });

  test("a second block while one is held is denied immediately", async () => {
    const { window, calls, events } = await bootNewer();
    const before = calls.length;

    const first = window.fetch(TEMPLATE_UPDATE_URL, {
      method: "PUT",
      body: DOCUMENT_BODY,
    });
    const second = window.fetch(TEMPLATE_UPDATE_URL, {
      method: "PUT",
      body: DOCUMENT_BODY,
    });

    const response = await second;
    expect(response.status).toBe(409);
    expect((await response.json()).detail).toContain("1.46");

    expect(await settledOrPending(first)).toBe("pending");
    expect(calls.length).toBe(before);
    expect(events.length).toBe(1);

    const state = window.__studioVersionInterceptorState;
    expect(state.save.observed).toBe(2);
    expect(state.save.blocked).toBe(1);
  });

  test("settle-once: cancelSave after forceSave is a no-op", async () => {
    const { window, calls } = await bootNewer();
    const before = calls.length;

    const pending = window.fetch(TEMPLATE_UPDATE_URL, {
      method: "PUT",
      body: DOCUMENT_BODY,
    });
    const state = window.__studioVersionInterceptorState;
    const id = state.pendingSave.id;

    expect(await state.forceSave(id)).toEqual({ ok: true, status: 200 });
    expect(state.cancelSave(id)).toBe(false);
    expect(await state.forceSave(id)).toEqual({ ok: false, status: 0 });

    expect((await pending).status).toBe(200);
    expect(calls.length).toBe(before + 1);
    expect(state.save.forced).toBe(1);
  });

  test("settle-once: forceSave after cancelSave is a no-op", async () => {
    const { window, calls } = await bootNewer();
    const before = calls.length;

    const pending = window.fetch(TEMPLATE_UPDATE_URL, {
      method: "PUT",
      body: DOCUMENT_BODY,
    });
    const state = window.__studioVersionInterceptorState;
    const id = state.pendingSave.id;

    expect(state.cancelSave(id)).toBe(true);
    expect(await state.forceSave(id)).toEqual({ ok: false, status: 0 });

    expect((await pending).status).toBe(409);
    expect(calls.length).toBe(before);
    expect(state.save.forced).toBe(0);
  });

  test("the auto-cancel timeout settles a held save nobody answered", async () => {
    const { window, calls } = await bootNewer();
    const state = window.__studioVersionInterceptorState;
    state.saveTimeoutMs = 5;
    const before = calls.length;

    const response = await window.fetch(TEMPLATE_UPDATE_URL, {
      method: "PUT",
      body: DOCUMENT_BODY,
    });

    expect(response.status).toBe(409);
    expect((await response.json()).detail).toContain("1.52");
    expect(calls.length).toBe(before);
    expect(state.pendingSave).toBe(null);
    expect(state.save.blocked).toBe(1);
  });

  test("the timeout is cleared when the save is forced", async () => {
    const { window } = await bootNewer();
    const state = window.__studioVersionInterceptorState;
    state.saveTimeoutMs = 5;

    const pending = window.fetch(TEMPLATE_UPDATE_URL, {
      method: "PUT",
      body: DOCUMENT_BODY,
    });
    state.forceSave(state.pendingSave.id);

    expect((await pending).status).toBe(200);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(state.pendingSave).toBe(null);
  });

  test("non-save routes on the same resource are untouched", async () => {
    const { window, calls } = await bootNewer();
    const before = calls.length;

    await window.fetch(`${TEMPLATE_UPDATE_URL}/preview`, {
      method: "PUT",
      body: DOCUMENT_BODY,
    });
    await window.fetch(`${TEMPLATE_CREATE_URL}/import`, {
      method: "PUT",
      body: DOCUMENT_BODY,
    });
    await window.fetch(TEMPLATE_UPDATE_URL);

    expect(calls.length).toBe(before + 3);
    expect(window.__studioVersionInterceptorState.save.observed).toBe(0);
  });
});
