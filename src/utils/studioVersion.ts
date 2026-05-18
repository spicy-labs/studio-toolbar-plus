// Per-environment SDK version override.
// Stored in localStorage so it is accessible from the page-injected bundle
// (chrome.* APIs are unavailable in the main world).

export type StudioVersionOverride = {
  sdkVersion: string; // full semver e.g. "1.42.0"
  expiresAt: number; // epoch ms
};

export type AvailableSdkVersions = Record<
  string,
  { sdkVersion: string; engineVersion: string }
>;

const OVERRIDE_TTL_MS = 60 * 60 * 1000; // 60 minutes
const OVERRIDE_KEY_PREFIX = "studio_version_override_";

export function overrideKey(envId: string): string {
  return `${OVERRIDE_KEY_PREFIX}${envId}`;
}

// "1.42.0" -> "1.42" (drop the patch segment to match sdkVersionPublic format)
export function toPublicVersion(fullVersion: string): string {
  const [major, minor] = fullVersion.split(".");
  if (minor == null) return fullVersion;
  return `${major}.${minor}`;
}

export function getEnvFromSettingsUrl(url: string): string | null {
  // /grafx/api/v1/environment/{envId}/settings
  const match = url.match(/\/grafx\/api\/v1\/environment\/([^/]+)\/settings/);
  return match ? match[1] : null;
}

export function getEnvFromBaseUrl(baseUrl: string): string | null {
  // ENVIRONMENT_API ends like ".../grafx/api/v1/environment/{envId}/"
  const match = baseUrl.match(/\/environment\/([^/]+)\/?$/);
  return match ? match[1] : null;
}

export function getOverride(envId: string): StudioVersionOverride | null {
  try {
    const key = overrideKey(envId);
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StudioVersionOverride;
    if (!parsed.sdkVersion || typeof parsed.expiresAt !== "number") return null;
    if (parsed.expiresAt < Date.now()) {
      localStorage.removeItem(key);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function setOverride(
  envId: string,
  sdkVersion: string,
): StudioVersionOverride {
  const override: StudioVersionOverride = {
    sdkVersion,
    expiresAt: Date.now() + OVERRIDE_TTL_MS,
  };
  localStorage.setItem(overrideKey(envId), JSON.stringify(override));
  return override;
}

export function clearOverride(envId: string): void {
  localStorage.removeItem(overrideKey(envId));
}

// ENVIRONMENT_API ends like ".../grafx/api/v1/environment/{envId}/".
// The available-sdk-versions endpoint sits at ".../grafx/api/v1/environment/settings/available-sdk-versions"
// (no envId in path) so we strip the env segment.
function envlessBase(baseUrl: string): string {
  return baseUrl.replace(/\/environment\/[^/]+\/?$/, "/environment/");
}

export async function fetchAvailableSdkVersions(
  baseUrl: string,
  token: string,
): Promise<AvailableSdkVersions> {
  const res = await fetch(
    `${envlessBase(baseUrl)}settings/available-sdk-versions`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    },
  );
  if (!res.ok) {
    throw new Error(`Failed to fetch available SDK versions: ${res.status}`);
  }
  return res.json();
}

export async function fetchCurrentSettings(
  baseUrl: string,
  token: string,
): Promise<{ sdkVersionPublic: string }> {
  const res = await fetch(`${baseUrl}settings`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch settings: ${res.status}`);
  }
  return res.json();
}
