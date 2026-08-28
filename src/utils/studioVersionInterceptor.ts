import {
  getEnvFromOutputUrl,
  getEnvFromSettingsUrl,
  getOverride,
  toPublicVersion,
  withEngineVersion,
} from "./studioVersion";

// NOTE: in the packaged extension this module never installs — interceptor-bootstrap.js
// runs at document_start and claims INTERCEPTOR_FLAG long before this bundle loads, so
// IT is the production implementation and any behaviour change must be made there too.
// This copy still runs in the test harness and in any context without the bootstrap.
const INTERCEPTOR_FLAG = "__studioVersionInterceptorInstalled";
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

function extractUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

function extractMethod(input: RequestInfo | URL, init?: RequestInit): string {
  if (init?.method) return init.method;
  if (input instanceof Request) return input.method;
  return "GET";
}

// Rewrite the outgoing body so the render server uses the tab's engine instead of
// resolving the environment default server-side. Returns the (possibly unchanged)
// fetch arguments; anything unexpected passes through untouched and is counted as
// a skip.
async function applyEngineVersion(
  input: RequestInfo | URL,
  init: RequestInit | undefined,
  engineVersion: string,
  state: InterceptorState,
): Promise<[RequestInfo | URL, RequestInit | undefined]> {
  try {
    if (typeof init?.body === "string") {
      const body = withEngineVersion(init.body, engineVersion);
      if (body === null) {
        state.output.skipped += 1;
        return [input, init];
      }
      state.output.injected += 1;
      state.output.lastEngineVersion = engineVersion;
      return [input, { ...init, body }];
    }

    if (input instanceof Request && init?.body == null) {
      const text = await input.clone().text();
      const body = withEngineVersion(text, engineVersion);
      if (body === null) {
        state.output.skipped += 1;
        return [input, init];
      }
      const rewritten = new Request(input, { body });
      state.output.injected += 1;
      state.output.lastEngineVersion = engineVersion;
      return [rewritten, init];
    }
  } catch {
    // fall through — a failed rewrite must never fail the export itself
  }

  state.output.skipped += 1;
  return [input, init];
}

export function installStudioVersionInterceptor(): void {
  const w = window as any;
  if (w[INTERCEPTOR_FLAG]) return;
  w[INTERCEPTOR_FLAG] = true;

  const state = getState();
  const origFetch = window.fetch.bind(window);

  const patchedFetch = async function (
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> {
    let requestInput = input;
    let requestInit = init;

    const requestUrl = extractUrl(input);
    const outputEnvId = getEnvFromOutputUrl(requestUrl);
    if (outputEnvId && extractMethod(input, init).toUpperCase() === "POST") {
      // Gate on the boot snapshot, never on storage. localStorage is shared
      // across tabs: a tab that booted clean must keep exporting on the default
      // engine even while another tab holds an override, or its export would
      // silently diverge from the preview it is showing — with no banner, since
      // that tab has no snapshot. For the same reason the engine we send is the
      // one this tab is running, not whatever storage currently says.
      const snapshot = state.appliedOverride;
      if (snapshot?.engineVersion && snapshot.envId === outputEnvId) {
        [requestInput, requestInit] = await applyEngineVersion(
          input,
          init,
          snapshot.engineVersion,
          state,
        );
      }
    }

    const response = await origFetch(requestInput as any, requestInit);

    const url = extractUrl(requestInput);
    const envId = getEnvFromSettingsUrl(url);
    if (!envId) return response;

    // A failed call isn't Studio booting — if it were latched here, a retried
    // boot call would apply the override without being recognised as the boot.
    if (!response.ok) return response;

    const isBootSettingsCall = !state.bootSettingsCallSeen;
    state.bootSettingsCallSeen = true;

    const override = getOverride(envId);
    if (!override) return response;

    try {
      const cloned = response.clone();
      const data = await cloned.json();
      if (data && typeof data === "object" && "sdkVersionPublic" in data) {
        if (typeof data.sdkVersionPublic === "string") {
          state.observedDefaults[envId] = data.sdkVersionPublic;
        }
        data.sdkVersionPublic = toPublicVersion(override.sdkVersion);
        const headers = new Headers(response.headers);
        headers.set("content-type", "application/json");
        const rewrittenResponse = new Response(JSON.stringify(data), {
          status: response.status,
          statusText: response.statusText,
          headers,
        });
        if (isBootSettingsCall) {
          state.appliedOverride = {
            envId,
            sdkVersion: override.sdkVersion,
            engineVersion: override.engineVersion,
            expiresAt: override.expiresAt,
          };
        }
        return rewrittenResponse;
      }
    } catch {
      // fall through and return the original response
    }

    return response;
  };

  window.fetch = patchedFetch as unknown as typeof window.fetch;
}
