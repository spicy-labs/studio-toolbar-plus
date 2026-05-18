import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Anchor,
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

type Props = {
  opened: boolean;
  onClose: () => void;
};

export function StudioVersionModal({ opened, onClose }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentVersion, setCurrentVersion] = useState<string | null>(null);
  const [available, setAvailable] = useState<AvailableSdkVersions | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [savedExpiresAt, setSavedExpiresAt] = useState<number | null>(null);
  const [envId, setEnvId] = useState<string | null>(null);

  useEffect(() => {
    if (!opened) return;
    setError(null);
    setLoading(true);

    (async () => {
      try {
        const studioResult = await getStudio();
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
        setEnvId(slug);

        const [settings, avail] = await Promise.all([
          fetchCurrentSettings(baseUrl, token),
          fetchAvailableSdkVersions(baseUrl, token),
        ]);
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
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    })();
  }, [opened, envId]);

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

  const handleApply = () => {
    if (!envId || !selected || !available) return;
    const sdkVersion = available[selected]?.sdkVersion;
    if (!sdkVersion) return;
    const override = setOverride(envId, sdkVersion);
    setSavedExpiresAt(override.expiresAt);
  };

  const handleClear = () => {
    if (!envId) return;
    clearOverride(envId);
    setSavedExpiresAt(null);
    setSelected(null);
  };

  const remainingMinutes = savedExpiresAt
    ? Math.max(0, Math.ceil((savedExpiresAt - Date.now()) / 60000))
    : null;

  return (
    <Modal
      opened={opened}
      onClose={onClose}
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

        {!loading && !error && (
          <>
            <Text>
              This template is loaded in{" "}
              <Text span fw={700}>
                {currentVersion ?? "unknown"}
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

            {savedExpiresAt && selected && available?.[selected] && (
              <Alert color="blue">
                Override active for {remainingMinutes} more minute
                {remainingMinutes === 1 ? "" : "s"}. Studio will load this
                template in {toPublicVersion(available[selected].sdkVersion)} on
                next reload.{" "}
                <Anchor
                  component="button"
                  type="button"
                  onClick={() => window.location.reload()}
                >
                  Reload Editor
                </Anchor>
              </Alert>
            )}

            <Group justify="space-between" mt="md">
              <Button variant="subtle" color="gray" onClick={handleClear}>
                Clear override
              </Button>
              <Group>
                <Button variant="default" onClick={onClose}>
                  Close
                </Button>
                <Button onClick={handleApply} disabled={!selected}>
                  Apply for 60 min
                </Button>
              </Group>
            </Group>
          </>
        )}
      </Stack>
    </Modal>
  );
}
