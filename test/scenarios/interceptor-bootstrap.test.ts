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

  return { window, calls };
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
