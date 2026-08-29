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
  compareSdkPublic,
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
  const selectedEngineVersion = selected
    ? available?.[selected]?.engineVersion
    : undefined;

  const handleConfirmApply = () => {
    if (!envId || !selectedSdkVersion) return;
    setOverride(envId, selectedSdkVersion, selectedEngineVersion);
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

  // The version this environment resolves to for everyone without an override.
  // `defaultVersion` is only populated once the interceptor has actually seen and
  // rewritten a /settings response, so it is null whenever no override is stored.
  // In that state nothing was rewritten, so `currentVersion` — what our own
  // /settings fetch returned — is the genuine server value. When an override IS
  // stored the fetch is intercepted and `currentVersion` is our own override read
  // back to us, i.e. a lie; that is exactly when `defaultVersion` exists and wins.
  // So `??` is correct in both states, and this is the only trustworthy source.
  const envDefault = defaultVersion ?? currentVersion;

  // What this tab is genuinely running: the override if it was applied at boot,
  // otherwise the environment default. The fetched value is the last resort,
  // correct only when nothing was ever rewritten.
  const snapshot = getAppliedOverride();
  const loadedVersion =
    snapshot && snapshot.envId === envId
      ? toPublicVersion(snapshot.sdkVersion)
      : envDefault;

  // Direction of the pending selection relative to the environment default.
  // Negative = older, positive = newer, 0 = same, null = not comparable / nothing
  // selected. Compared on `publicVersion` rather than the option key so the
  // "latest" entry resolves to a real x.y number.
  const selectionVsDefault =
    publicVersion && envDefault
      ? compareSdkPublic(publicVersion, envDefault)
      : null;

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
            {envDefault && loadedVersion === envDefault ? (
              // Same number on both lines reads as a discrepancy where there is
              // none, so collapse to one line when they agree.
              <Text>
                This template is loaded in{" "}
                <Text span fw={700}>
                  {loadedVersion}
                </Text>
                , which is this environment's default.
              </Text>
            ) : (
              <>
                <Text>
                  This template is loaded in{" "}
                  <Text span fw={700}>
                    {loadedVersion ?? "unknown"}
                  </Text>
                </Text>
                {envDefault && (
                  <Text>
                    This environment's default is{" "}
                    <Text span fw={700}>
                      {envDefault}
                    </Text>
                  </Text>
                )}
              </>
            )}

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

            {/*
              Older and newer are deliberately styled differently. Loading an
              older version is fail-closed: a recently-saved template simply
              refuses to open and nothing is lost. Loading a newer one and saving
              rewrites the stored document in a format the default engine can
              never read again. Dressing both as warnings would train people to
              dismiss the one that actually destroys work.
            */}
            {selectionVsDefault !== null && envDefault && (
              <>
                {selectionVsDefault < 0 && (
                  <Text size="xs" c="dimmed">
                    Older than your environment's default ({envDefault}).
                    Recently-saved templates may refuse to open on this version.
                  </Text>
                )}
                {selectionVsDefault > 0 && (
                  <Text size="xs" c="yellow">
                    Newer than your environment's default ({envDefault}). If you
                    save, this template may no longer open on {envDefault}. The
                    toolbar will ask you to confirm before any save goes through.
                  </Text>
                )}
              </>
            )}

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
              {selectedEngineVersion && (
                <Text>
                  Exports requested from Run mode will render on engine{" "}
                  <Text span fw={700}>
                    {selectedEngineVersion}
                  </Text>
                  .
                  {/*
                    When the direction is unknown — the environment default was
                    never observed, or did not parse — fall back to the generic
                    caution rather than showing nothing. This is the least
                    informed state, so it is the last one that should read as
                    reassuring.
                  */}
                  {(selectionVsDefault === null || selectionVsDefault < 0) &&
                    " A document authored on a newer engine can fail to render on an older one."}
                  {selectionVsDefault !== null &&
                    selectionVsDefault > 0 &&
                    envDefault && (
                      <>
                        {" "}
                        Saving from this version can leave the template unable to
                        open on{" "}
                        <Text span fw={700}>
                          {envDefault}
                        </Text>
                        . The toolbar will ask you to confirm before any save
                        goes through.
                      </>
                    )}
                </Text>
              )}
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
