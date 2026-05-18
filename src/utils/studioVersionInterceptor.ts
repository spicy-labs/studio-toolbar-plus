import {
  getEnvFromSettingsUrl,
  getOverride,
  toPublicVersion,
} from "./studioVersion";

const INTERCEPTOR_FLAG = "__studioVersionInterceptorInstalled";

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
    if (!envId || !response.ok) return response;

    const override = getOverride(envId);
    if (!override) return response;

    try {
      const cloned = response.clone();
      const data = await cloned.json();
      if (data && typeof data === "object" && "sdkVersionPublic" in data) {
        data.sdkVersionPublic = toPublicVersion(override.sdkVersion);
        const headers = new Headers(response.headers);
        headers.set("content-type", "application/json");
        return new Response(JSON.stringify(data), {
          status: response.status,
          statusText: response.statusText,
          headers,
        });
      }
    } catch {
      // fall through and return the original response
    }

    return response;
  };

  window.fetch = patchedFetch as unknown as typeof window.fetch;
}
