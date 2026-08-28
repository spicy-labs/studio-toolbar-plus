import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Group,
  Loader,
  Modal,
  Select,
  Stack,
  Text,
} from "@mantine/core";
import {
  clearOverride,
  fetchAvailableSdkVersions,
  fetchCurrentSettings,
  getEnvFromBaseUrl,
  getOverride,
  setOverride,
  toPublicVersion,
  type AvailableSdkVersions,
} from "../utils/studioVersion";
import { getStudio } from "../studio/studioAdapter";
import {
  getAppliedOverride,
  getObservedDefaultVersion,
} from "../utils/studioVersionInterceptor";

type Props = {
  opened: boolean;
  onClose: () => void;
};

type View = "picker" | "confirmApply" | "confirmClear";

export function StudioVersionModal({ opened, onClose }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentVersion, setCurrentVersion] = useState<string | null>(null);
  const [available, setAvailable] = useState<AvailableSdkVersions | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [savedExpiresAt, setSavedExpiresAt] = useState<number | null>(null);
  const [envId, setEnvId] = useState<string | null>(null);
  const [view, setView] = useState<View>("picker");

  useEffect(() => {
    if (!opened) return;
    setView("picker");
    setError(null);
    setLoading(true);

    let cancelled = false;

    (async () => {
      try {
        const studioResult = await getStudio();
        if (cancelled) return;
        if (!studioResult.isOk()) {
          throw new Error(
            studioResult.error?.message || "Failed to get studio",
          );
        }
        const token = (
          await studioResult.value.configuration.getValue("GRAFX_AUTH_TOKEN")
        ).parsedData;
        const baseUrl = (
          await studioResult.value.configuration.getValue("ENVIRONMENT_API")
        ).parsedData;

        if (!token || !baseUrl) {
          throw new Error("Failed to get authentication token or base URL");
        }

        // Derive the env slug from the API base URL — this matches the slug
        // the interceptor sees on /settings calls (which is NOT the same as
        // the env id in the page URL).
        const slug = getEnvFromBaseUrl(baseUrl);
        if (!slug) {
          throw new Error(
            `Could not parse env from ENVIRONMENT_API: ${baseUrl}`,
          );
        }

        const [settings, avail] = await Promise.all([
          fetchCurrentSettings(baseUrl, token),
          fetchAvailableSdkVersions(baseUrl, token),
        ]);
        if (cancelled) return;

        setEnvId(slug);
        setCurrentVersion(settings.sdkVersionPublic);
        setAvailable(avail);

        const existing = getOverride(slug);
        if (existing) {
          // Map the stored sdkVersion back to an entry key, preferring an
          // explicit "x.y" key over "latest".
          const matchingKey =
            Object.keys(avail).find(
              (k) => k !== "latest" && avail[k].sdkVersion === existing.sdkVersion,
            ) ??
            Object.keys(avail).find(
              (k) => avail[k].sdkVersion === existing.sdkVersion,
            ) ??
            null;
          setSelected(matchingKey);
          setSavedExpiresAt(existing.expiresAt);
        } else {
          setSelected(null);
          setSavedExpiresAt(null);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [opened]);

  const options = useMemo(() => {
    if (!available) return [];
    // Use the entry key as the option value so "latest" and its mirrored version
    // (e.g. "1.42" both pointing to 1.42.0) stay distinct.
    const toOption = (key: string) => {
      const entry = available[key];
      return {
        value: key,
        label: `${key} — sdk ${entry.sdkVersion} / engine ${entry.engineVersion}`,
      };
    };

    const result: { value: string; label: string }[] = [];
    if (available.latest) result.push(toOption("latest"));

    const rest = Object.keys(available)
      .filter((k) => k !== "latest")
      .sort((a, b) => {
        // Reverse order — newest first (1.42 before 1.41 before 1.40, etc.)
        const aParts = a.split(".").map(Number);
        const bParts = b.split(".").map(Number);
        for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
          const diff = (bParts[i] ?? 0) - (aParts[i] ?? 0);
          if (diff !== 0) return diff;
        }
        return 0;
      });

    for (const key of rest) result.push(toOption(key));
    return result;
  }, [available]);

  const selectedSdkVersion = selected
    ? available?.[selected]?.sdkVersion
    : undefined;

  const handleConfirmApply = () => {
    if (!envId || !selectedSdkVersion) return;
    setOverride(envId, selectedSdkVersion);
    window.location.reload();
  };

  const handleConfirmClear = () => {
    if (!envId) return;
    clearOverride(envId);
    window.location.reload();
  };

  const publicVersion = selectedSdkVersion
    ? toPublicVersion(selectedSdkVersion)
    : null;

  // The environment's real default. Our own fetchCurrentSettings is intercepted
  // when an override is stored, so `currentVersion` can be the override read back
  // to us — only the interceptor knows what the server actually said.
  const defaultVersion = envId ? getObservedDefaultVersion(envId) : null;

  // What this tab is genuinely running: the override if it was applied at boot,
  // otherwise the environment default. The fetched value is the last resort,
  // correct only when nothing was ever rewritten.
  const snapshot = getAppliedOverride();
  const loadedVersion =
    snapshot && snapshot.envId === envId
      ? toPublicVersion(snapshot.sdkVersion)
      : (defaultVersion ?? currentVersion);

  const handleClose = () => {
    setView("picker");
    onClose();
  };

  const showConfirmApply = () => {
    if (!envId || !selectedSdkVersion) return;
    setView("confirmApply");
  };

  const showConfirmClear = () => {
    if (!envId || !savedExpiresAt) return;
    setView("confirmClear");
  };

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      title="Studio Version"
      centered
      size="md"
    >
      <Stack>
        {loading && (
          <Group>
            <Loader size="sm" />
            <Text size="sm">Loading version info…</Text>
          </Group>
        )}

        {error && (
          <Alert color="red" title="Error">
            {error}
          </Alert>
        )}

        {!loading && !error && view === "picker" && (
          <>
            <Text>
              This template is loaded in{" "}
              <Text span fw={700}>
                {loadedVersion ?? "unknown"}
              </Text>
            </Text>

            <Select
              label="Load this template in"
              description="Override applies to this environment for 60 minutes."
              placeholder="Pick a version"
              data={options}
              value={selected}
              onChange={setSelected}
              searchable
              clearable
            />

            <Group justify="space-between" mt="md">
              <Button
                variant="subtle"
                color="gray"
                onClick={showConfirmClear}
                disabled={!envId || !savedExpiresAt}
              >
                Clear override
              </Button>
              <Group>
                <Button variant="default" onClick={handleClose}>
                  Close
                </Button>
                <Button
                  onClick={showConfirmApply}
                  disabled={!envId || !selected || !selectedSdkVersion}
                >
                  Apply
                </Button>
              </Group>
            </Group>
          </>
        )}

        {!loading &&
          !error &&
          view === "confirmApply" &&
          publicVersion && (
            <>
              <Text fw={700}>Reload in {publicVersion}?</Text>
              <Text>
                This template will reload in{" "}
                <Text span fw={700}>
                  {publicVersion}
                </Text>{" "}
                for the next 60 minutes. Unsaved changes will be lost.
              </Text>
              <Group justify="flex-end" mt="md">
                <Button variant="default" onClick={() => setView("picker")}>
                  Cancel
                </Button>
                <Button onClick={handleConfirmApply}>
                  Reload in {publicVersion}
                </Button>
              </Group>
            </>
          )}

        {!loading && !error && view === "confirmClear" && (
          <>
            <Text fw={700}>Reload without the override?</Text>
            <Text>
              This template will reload in{" "}
              {defaultVersion ? (
                <>
                  <Text span fw={700}>
                    {defaultVersion}
                  </Text>
                  .
                </>
              ) : (
                "the default version."
              )}{" "}
              Unsaved changes will be lost.
            </Text>
            <Group justify="flex-end" mt="md">
              <Button variant="default" onClick={() => setView("picker")}>
                Cancel
              </Button>
              <Button onClick={handleConfirmClear}>Reload and clear</Button>
            </Group>
          </>
        )}
      </Stack>
    </Modal>
  );
}
