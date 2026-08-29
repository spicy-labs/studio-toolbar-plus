// Typed, read-only accessor layer over `window.__studioVersionInterceptorState`.
//
// `interceptor-bootstrap.js` is the SOLE implementation of the fetch interceptor: it
// runs at document_start in the MAIN world and claims the install flag long before
// this bundle loads. It owns the /settings rewrite, the output engine injection and
// the save-blocking state machine, and it publishes everything it knows on the shared
// window state object — which is the only channel between the two, since both live in
// the page's main world.
//
// This module deliberately contains NO behaviour. Do not reintroduce a second
// implementation here: a hand-mirrored copy of the bootstrap's state machine would
// drift silently, with no equivalence check to catch it. Any behaviour change belongs
// in interceptor-bootstrap.js, covered by test/scenarios/interceptor-bootstrap.test.ts.
//
// Every accessor must tolerate the bootstrap never having run (an older bootstrap, or
// a context where it was not injected): read sane defaults, and never throw.
const STATE_KEY = "__studioVersionInterceptorState";

export type AppliedOverrideSnapshot = {
  envId: string;
  sdkVersion: string;
  engineVersion?: string;
  expiresAt: number;
};

export type OutputEngineState = {
  // Output requests we rewrote to carry the override's engine.
  injected: number;
  // Output requests that went out unmodified while an override was active —
  // the app changed shape under us and the export will render on the
  // environment default. Surfaced so a wrong answer is never silent.
  skipped: number;
  lastEngineVersion: string | null;
};

// A save the bootstrap is holding: the request has not been sent, and its fetch
// promise stays pending until forceSave/cancelSave settles it.
export type PendingSave = {
  id: string;
  kind: "template" | "component";
  isCreate: boolean;
  overrideVersion: string;
  defaultVersion: string | null;
};

export type SaveState = { blocked: number; forced: number; observed: number };

type InterceptorState = {
  // Storage self-expires, so this is the source of truth for what Studio loaded with.
  appliedOverride: AppliedOverrideSnapshot | null;
  // The environment's real default version, per env, as the server reported it
  // before we rewrote it. Nothing else can tell us this — the version modal's own
  // /settings call is intercepted too, so it reads our override back to itself.
  observedDefaults: Record<string, string>;
  // Only Studio's boot-time /settings call defines what the page loaded with. Later
  // calls hit the same URL — the version modal fetches it too — and must not be able
  // to redefine the snapshot, or a tab running the default version would report an
  // override applied in another tab.
  bootSettingsCallSeen: boolean;
  output: OutputEngineState;
  pendingSave: PendingSave | null;
  save: SaveState;
  // Published by the bootstrap. Absent when the bootstrap never ran or predates
  // the save-blocking feature — callers must treat them as optional.
  forceSave?: (id: string) => Promise<{ ok: boolean; status: number }>;
  cancelSave?: (id: string) => void;
};

// interceptor-bootstrap.js installs the real patch at document_start, long before
// this bundle loads, and records what it saw here. Both live in the page's main
// world, so this window object is the one place either side can read.
function getState(): InterceptorState {
  const w = window as any;
  if (!w[STATE_KEY]) {
    w[STATE_KEY] = {
      appliedOverride: null,
      observedDefaults: {},
      bootSettingsCallSeen: false,
      output: { injected: 0, skipped: 0, lastEngineVersion: null },
      pendingSave: null,
      save: { blocked: 0, forced: 0, observed: 0 },
    } satisfies InterceptorState;
  }
  return w[STATE_KEY] as InterceptorState;
}

export function getObservedDefaultVersion(envId: string): string | null {
  return getState().observedDefaults[envId] ?? null;
}

export function getAppliedOverride(): AppliedOverrideSnapshot | null {
  return getState().appliedOverride;
}

export function getOutputEngineState(): OutputEngineState {
  return getState().output;
}

export function getPendingSave(): PendingSave | null {
  return getState().pendingSave ?? null;
}

export function getSaveState(): SaveState {
  return getState().save ?? { blocked: 0, forced: 0, observed: 0 };
}

// Release a held save to the server. Resolves to {ok: false, status: 0} when the
// bootstrap is absent or too old to publish forceSave — never throws, because a
// throw here would leave the editor's save promise pending forever, which is the
// exact failure this feature exists to prevent.
export async function forceSave(
  id: string,
): Promise<{ ok: boolean; status: number }> {
  const fn = getState().forceSave;
  if (typeof fn !== "function") return { ok: false, status: 0 };
  try {
    return await fn(id);
  } catch {
    return { ok: false, status: 0 };
  }
}

// Settle a held save with the synthetic 409. A no-op when the bootstrap is absent.
export function cancelSave(id: string): void {
  const fn = getState().cancelSave;
  if (typeof fn !== "function") return;
  try {
    fn(id);
  } catch {
    // a failed cancel must never propagate into the caller's UI handler
  }
}
