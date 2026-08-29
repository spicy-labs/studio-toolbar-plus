import { getStudio } from "../studio/studioAdapter";
import { getAllMediaConnectors } from "../studio/mediaConnectorHandler";

async function getAuthConfig() {
  const studioResult = await getStudio();
  if (!studioResult.isOk()) {
    throw new Error(studioResult.error?.message || "Failed to get studio");
  }
  const studio = studioResult.value;

  const token = (
    await studio.configuration.getValue("GRAFX_AUTH_TOKEN")
  ).parsedData as string;
  const baseUrl = (
    await studio.configuration.getValue("ENVIRONMENT_API")
  ).parsedData as string;

  if (!token || !baseUrl) {
    throw new Error("Failed to get authentication token or base URL");
  }

  return { studio, token, baseUrl };
}

// Forces a token refresh by firing a throwaway media-connector query so the
// engine's 401 handler runs onAuthExpired and writes a fresh GRAFX_AUTH_TOKEN
// into the configuration. This depends on engine behavior, not a public API.
// If the environment has no media connectors, no refresh is triggered and the
// stale token is returned unchanged — the caller's single retry then fails
// with the same 401.
async function forceTokenRefresh(): Promise<string> {
  const { studio } = await getAuthConfig();

  const connectorsResult = await getAllMediaConnectors(studio);
  if (connectorsResult.isOk() && connectorsResult.value.length > 0) {
    const connectorId = connectorsResult.value[0].id;
    try {
      await studio.mediaConnector.query(connectorId, {
        pageSize: 1,
        filter: [""],
        collection: "",
        pageToken: "",
      });
    } catch {
      // The query itself may fail — that's fine, the engine's 401 handler
      // will have already triggered onAuthExpired and refreshed the token.
    }
  }

  const refreshed = await getAuthConfig();
  return refreshed.token;
}

type FetchWithAuthOptions = RequestInit & {
  absoluteUrl?: boolean;
};

export async function fetchWithAuth(
  pathOrUrl: string,
  init?: FetchWithAuthOptions,
): Promise<Response> {
  const { absoluteUrl, ...fetchInit } = init ?? {};

  const { token, baseUrl } = await getAuthConfig();
  const url = absoluteUrl ? pathOrUrl : `${baseUrl}${pathOrUrl}`;

  const headers = new Headers(fetchInit.headers);
  headers.set("Authorization", `Bearer ${token}`);

  const response = await fetch(url, { ...fetchInit, headers });

  // A 401 gets one refresh-and-retry; a still-failing 401 is returned to the
  // caller as an ordinary non-ok Response (callers no longer see a dedicated
  // AuthorizationError — that type was removed when auth handling moved here).
  if (response.status === 401) {
    const newToken = await forceTokenRefresh();
    headers.set("Authorization", `Bearer ${newToken}`);
    return fetch(url, { ...fetchInit, headers });
  }

  return response;
}

export async function getAuthToken(): Promise<string> {
  const { token } = await getAuthConfig();
  return token;
}

export async function getBaseUrl(): Promise<string> {
  const { baseUrl } = await getAuthConfig();
  return baseUrl;
}

export { forceTokenRefresh };
