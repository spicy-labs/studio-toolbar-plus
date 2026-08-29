// Per-environment SDK version override.
// Stored in localStorage so it is accessible from the page-injected bundle
// (chrome.* APIs are unavailable in the main world).

import { fetchWithAuth } from "./fetchWithAuth";

export type StudioVersionOverride = {
  sdkVersion: string; // full semver e.g. "1.42.0"
  // The engine that pairs with sdkVersion, as available-sdk-versions reported it
  // (e.g. "2.25.0", and sometimes only "2.15"). Sent on output requests so the
  // render server uses the same engine the tab is running. Absent on overrides
  // stored before this existed — those get no output injection.
  engineVersion?: string;
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

// POST /grafx/api/v1/environment/{envId}/output/{format} generates an output.
// The format list is deliberate: "/output/settings/png" is a different endpoint
// (creating output settings) and must not match.
const OUTPUT_URL_RE =
  /\/grafx\/api\/v1\/environment\/([^/]+)\/output\/(?:jpg|png|mp4|gif|pdf|html)\/?(?:[?#]|$)/;

export function getEnvFromOutputUrl(url: string): string | null {
  const match = url.match(OUTPUT_URL_RE);
  return match ? match[1] : null;
}

// Overwrite engineVersion on an output request body. An override is an explicit
// instruction from the user, so it wins over whatever the app put there.
// Returns null when the body is not a JSON object — nothing to rewrite.
export function withEngineVersion(
  bodyText: string,
  engineVersion: string,
): string | null {
  try {
    const parsed = JSON.parse(bodyText);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null;
    }
    parsed.engineVersion = engineVersion;
    return JSON.stringify(parsed);
  } catch {
    return null;
  }
}

// Compare two "1.46"-style public SDK versions. Returns -1 / 0 / 1, or null when
// either side is unparseable ("latest", "", a build channel name).
// Lexical comparison is wrong here — "1.9" > "1.46" as strings but is the older
// release — so each segment is compared numerically.
// Inputs may carry a patch segment ("1.46.0"); only major.minor is compared,
// because major.minor is all sdkVersionPublic ever gives us.
export function compareSdkPublic(a: string, b: string): number | null {
  const parse = (v: string): [number, number] | null => {
    const [major, minor] = String(v ?? "").split(".");
    const majorNum = Number(major);
    const minorNum = minor == null ? 0 : Number(minor);
    if (!Number.isFinite(majorNum) || !Number.isFinite(minorNum)) return null;
    if (major === "" || major == null) return null;
    if (minor === "") return null;
    return [majorNum, minorNum];
  };
  const left = parse(a);
  const right = parse(b);
  if (!left || !right) return null;
  if (left[0] !== right[0]) return left[0] < right[0] ? -1 : 1;
  if (left[1] !== right[1]) return left[1] < right[1] ? -1 : 1;
  return 0;
}

// The four save routes we care about. Each is anchored with `/?(?:[?#]|$)` — the
// same trick OUTPUT_URL_RE uses — so a sub-path can never match: without it,
// /templates/{id} would also satisfy the create matcher and /templates/{id}/preview
// (a read-only render) would look like an update and get blocked.
// These are path-only tests. The CALLER checks the HTTP method: PUT for update,
// POST for create. There are no PATCH routes on either resource, so method+path
// is a complete classification.
// The `(?!import` lookahead keeps /templates/import and /components/import out:
// they sit where an id would and would otherwise read as an update of a template
// literally named "import".
const TEMPLATE_UPDATE_URL_RE =
  /\/grafx\/api\/v1\/environment\/([^/]+)\/templates\/(?!import(?:[/?#]|$))([^/]+)\/?(?:[?#]|$)/;
const TEMPLATE_CREATE_URL_RE =
  /\/grafx\/api\/v1\/environment\/([^/]+)\/templates\/?(?:[?#]|$)/;
const COMPONENT_UPDATE_URL_RE =
  /\/grafx\/api\/v1\/environment\/([^/]+)\/components\/(?!import(?:[/?#]|$))([^/]+)\/?(?:[?#]|$)/;
const COMPONENT_CREATE_URL_RE =
  /\/grafx\/api\/v1\/environment\/([^/]+)\/components\/?(?:[?#]|$)/;

// PUT /grafx/api/v1/environment/{envId}/templates/{templateId}
export function getEnvFromTemplateUpdateUrl(url: string): string | null {
  const match = url.match(TEMPLATE_UPDATE_URL_RE);
  return match ? match[1] : null;
}

// POST /grafx/api/v1/environment/{envId}/templates
export function getEnvFromTemplateCreateUrl(url: string): string | null {
  const match = url.match(TEMPLATE_CREATE_URL_RE);
  return match ? match[1] : null;
}

// PUT /grafx/api/v1/environment/{envId}/components/{componentId}
export function getEnvFromComponentUpdateUrl(url: string): string | null {
  const match = url.match(COMPONENT_UPDATE_URL_RE);
  return match ? match[1] : null;
}

// POST /grafx/api/v1/environment/{envId}/components
export function getEnvFromComponentCreateUrl(url: string): string | null {
  const match = url.match(COMPONENT_CREATE_URL_RE);
  return match ? match[1] : null;
}

// Does this request body carry a document, or is it just a metadata edit?
// Callers treat "unknown" as BLOCK — we fail closed, because a false negative
// here means a silently corrupted template while the UI claims it protected you.
export function classifySave(
  kind: "template" | "component",
  bodyText: string | null | undefined,
): "save" | "rename" | "unknown" {
  // A rename can never carry a document: the backend rejects `?name=` together
  // with a body, so an absent body means metadata-only.
  if (bodyText == null || bodyText.trim() === "") return "rename";

  let parsed: unknown;
  try {
    parsed = JSON.parse(bodyText);
  } catch {
    // Blob, gzip, FormData — anything non-empty we cannot read. Fail closed.
    return "unknown";
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return "unknown";
  }
  const body = parsed as Record<string, unknown>;

  if (kind === "template") {
    // The `||` is LOAD-BEARING — do not "simplify" it to a single key. Legacy
    // documents carry one without the other: engine fixtures 0.0.25–0.1.3 have
    // engineVersion only, 0.2.0–0.2.4 have documentVersion only.
    if ("documentVersion" in body || "engineVersion" in body) return "save";
    // A template body we cannot recognise might still be a document. Block.
    return "unknown";
  }

  // Components discriminate on key presence alone: a rename omits `content`
  // entirely, so this survives the object-vs-string ambiguity in `content`
  // (the API types claim string, the backend enforces object).
  return "content" in body ? "save" : "rename";
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
  engineVersion?: string,
): StudioVersionOverride {
  const override: StudioVersionOverride = {
    sdkVersion,
    engineVersion,
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

// Unlike its sibling below, this keeps the baseUrl parameter: the endpoint
// lives on the env-less base (see envlessBase), so the caller-provided URL is
// transformed rather than taken straight from fetchWithAuth's config.
export async function fetchAvailableSdkVersions(
  baseUrl: string,
): Promise<AvailableSdkVersions> {
  const res = await fetchWithAuth(
    `${envlessBase(baseUrl)}settings/available-sdk-versions`,
    {
      absoluteUrl: true,
      headers: { "Content-Type": "application/json" },
    },
  );
  if (!res.ok) {
    throw new Error(`Failed to fetch available SDK versions: ${res.status}`);
  }
  return res.json();
}

export async function fetchCurrentSettings(): Promise<{
  sdkVersionPublic: string;
}> {
  const res = await fetchWithAuth("settings", {
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch settings: ${res.status}`);
  }
  return res.json();
}
