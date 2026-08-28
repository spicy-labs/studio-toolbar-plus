import {
  getEnvFromSettingsUrl,
  getOverride,
  toPublicVersion,
} from "./studioVersion";

const INTERCEPTOR_FLAG = "__studioVersionInterceptorInstalled";

export type AppliedOverrideSnapshot = {
  envId: string;
  sdkVersion: string;
  expiresAt: number;
};

// Storage self-expires, so this is the source of truth for what Studio loaded with.
let appliedOverride: AppliedOverrideSnapshot | null = null;

// Only Studio's boot-time /settings call defines what the page loaded with. Later
// calls hit the same URL — the version modal fetches it too — and must not be able
// to redefine the snapshot, or a tab running the default version would report an
// override applied in another tab.
let bootSettingsCallSeen = false;

// The environment's real default version, per env, as the server reported it
// before we rewrote it. Nothing else can tell us this — the version modal's own
// /settings call is intercepted too, so it reads our override back to itself.
const observedDefaults = new Map<string, string>();

export function getObservedDefaultVersion(envId: string): string | null {
  return observedDefaults.get(envId) ?? null;
}

export function getAppliedOverride(): AppliedOverrideSnapshot | null {
  return appliedOverride;
}

function extractUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

export function installStudioVersionInterceptor(): void {
  const w = window as any;
  if (w[INTERCEPTOR_FLAG]) return;
  w[INTERCEPTOR_FLAG] = true;

  const origFetch = window.fetch.bind(window);

  const patchedFetch = async function (
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> {
    const response = await origFetch(input as any, init);

    const url = extractUrl(input);
    const envId = getEnvFromSettingsUrl(url);
    if (!envId) return response;

    // A failed call isn't Studio booting — if it were latched here, a retried
    // boot call would apply the override without being recognised as the boot.
    if (!response.ok) return response;

    const isBootSettingsCall = !bootSettingsCallSeen;
    bootSettingsCallSeen = true;

    const override = getOverride(envId);
    if (!override) return response;

    try {
      const cloned = response.clone();
      const data = await cloned.json();
      if (data && typeof data === "object" && "sdkVersionPublic" in data) {
        if (typeof data.sdkVersionPublic === "string") {
          observedDefaults.set(envId, data.sdkVersionPublic);
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
          appliedOverride = {
            envId,
            sdkVersion: override.sdkVersion,
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
