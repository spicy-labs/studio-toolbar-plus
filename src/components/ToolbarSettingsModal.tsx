import {
  Modal,
  Text,
  Stack,
  Group,
  Button,
  Switch,
  Title,
  ScrollArea,
  Alert,
  Tooltip,
  Loader,
  Center,
} from "@mantine/core";
import {
  IconBugFilled,
  IconInfoCircle,
  IconRosetteDiscountCheckFilled,
  IconRosetteFilled,
  IconCircleRectangleFilled,
  IconRadioactiveFilled,
} from "@tabler/icons-react";
import { useState, useEffect } from "react";
import type {
  AppConfig,
  AppStatus,
  AppInfo,
  AppConfigKeys,
  AppFullConfig,
} from "../utils/appConfig";
import { appConfigFromFullConfig, getDefaultConfig } from "../utils/appConfig";
import { checkVersions } from "../utils/checkVersions";
import { Result } from "typescript-result";

interface ToolbarSettingsModalProps {
  opened: boolean;
  onClose: () => void;
  onReloadConfig: (config: AppConfig) => void;
  updateInfo?: {
    currentVersion: string;
    latestVersion: string;
  };
}

export function ToolbarSettingsModal({
  opened,
  onClose,
  onReloadConfig,
  updateInfo,
}: ToolbarSettingsModalProps) {
  const [defaultConfig, setDefaultConfig] = useState<AppFullConfig | null>(
    null,
  );
  const [githubVersion, setGithubVersion] = useState<string | null>(null);
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [errorOnGetDefaultConfig, setErrorOnGetDefaultConfig] =
    useState<Error | null>(null);

  // Helper function to get status icon and tooltip
  const getStatusIcon = (appKey: string) => {
    if (!defaultConfig) return null;

    const appInfo = (defaultConfig as any)[appKey] as AppInfo | undefined;

    const appStatus = appInfo ? appInfo.status : "none";

    const statusConfig = {
      none: {
        icon: <IconRosetteFilled size={16} color="blue" />,
        tooltip: "Production-ready, no sponsorship",
      },
      sponsored: {
        icon: <IconRosetteDiscountCheckFilled size={16} color="green" />,
        tooltip: "Production-ready, under active sponsorship",
      },
      deprecated: {
        icon: <IconCircleRectangleFilled size={16} color="red" />,
        tooltip:
          "Production-ready but deprecated; scheduled for removal in future versions",
      },
      experimental: {
        icon: <IconRadioactiveFilled size={16} color="purple" />,
        tooltip: "Experimental; may cause issues or instability",
      },
    };

    const config = statusConfig[appStatus as keyof typeof statusConfig];
    if (!config) return null;

    return (
      <Tooltip label={config.tooltip} position="top" withArrow>
        {config.icon}
      </Tooltip>
    );
  };

  // Call getDefaultConfig on first launch
  useEffect(() => {
    if (opened) {
      if (!defaultConfig && !errorOnGetDefaultConfig) {
        const loadDefaultConfig = async () => {
          const result = await getDefaultConfig();
          result.fold(
            ([appConfig, githubVersion]) => {
              setDefaultConfig(appConfig);
              setGithubVersion(githubVersion);
              const localConfig = localStorage.getItem("tempUserConfig");
              Result.try(() => JSON.parse(localConfig as string)).fold(
                (parsedConfig) => {
                  setConfig({
                    ...appConfigFromFullConfig(appConfig),
                    ...(parsedConfig as AppConfig),
                  });
                },
                (error) => {
                  setConfig(appConfigFromFullConfig(appConfig));
                },
              );
            },
            (error) => setErrorOnGetDefaultConfig(error),
          );
        };
        loadDefaultConfig();
      }
    }
  }, [opened, defaultConfig, errorOnGetDefaultConfig]);

  const handleToggle = (key: AppConfigKeys, value: boolean) => {
    if (config == null) return;
    const newConfig = { ...config, [key]: value };
    setConfig(newConfig);
  };

  const handleClose = () => {
    setConfig(null);
    setDefaultConfig(null);
    setGithubVersion(null);
    setErrorOnGetDefaultConfig(null);
    onClose();
  };

  const handleSave = async () => {
    // Save to localStorage
    localStorage.setItem("tempUserConfig", JSON.stringify(config));
    if (config == null) {
      handleClose();
      return;
    }
    onReloadConfig(config);
    handleClose();
  };

  const handleReset = () => {
    if (defaultConfig) {
      localStorage.removeItem("tempUserConfig");
      onReloadConfig(appConfigFromFullConfig(defaultConfig));
    }
  };

  // Show loading spinner while config is loading
  const isLoading = (!config || !defaultConfig) && !errorOnGetDefaultConfig;

  console.log(config, defaultConfig);

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Toolbar Settings"
      centered
      size="lg"
    >
      <Stack>
        {isLoading ? (
          <Center style={{ minHeight: "400px" }}>
            <Stack align="center" gap="md">
              <Loader size="lg" />
              <Text>Loading toolbar settings...</Text>
            </Stack>
          </Center>
        ) : errorOnGetDefaultConfig ? (
          <Center style={{ minHeight: "400px" }}>
            <Alert
              variant="light"
              color="red"
              title="Error"
              icon={<IconBugFilled />}
            >
              {errorOnGetDefaultConfig.message}
            </Alert>
          </Center>
        ) : config && defaultConfig ? (
          <>
            {/* Version Comparison Alert */}
            {githubVersion &&
              updateInfo &&
              (() => {
                const versionComparison = checkVersions(
                  updateInfo.currentVersion,
                  githubVersion,
                );
                if (versionComparison.isOk()) {
                  const result = versionComparison.value;
                  const disclaimer = (
                    <>
                      The Toolbar is released under the MIT license and is
                      primarily supported by the community. Individual apps may
                      have varying support focus. Apps marked with the{" "}
                      <IconRosetteDiscountCheckFilled
                        style={{ display: "inline", verticalAlign: "middle" }}
                        size={16}
                      />{" "}
                      icon indicate active sponsorship.
                    </>
                  );

                  if (result === "equal" || result === "greater") {
                    return (
                      <Alert
                        variant="light"
                        color="green"
                        title="Up to Date"
                        icon={<IconInfoCircle />}
                      >
                        Toolbar is on most up-to-date version:{" "}
                        {updateInfo.currentVersion}
                        <br />
                        <br />
                        {disclaimer}
                      </Alert>
                    );
                  } else {
                    return (
                      <Alert
                        variant="light"
                        color="red"
                        title="Update Available"
                        icon={<IconInfoCircle />}
                      >
                        Toolbar is on an older version:
                        <br /> current: {updateInfo.currentVersion} &lt; latest:{" "}
                        {githubVersion}
                        <br />
                        <br />
                        {disclaimer}
                      </Alert>
                    );
                  }
                }
                return null;
              })()}

            <Text size="sm" c="dimmed">
              Configure which tools are visible in the toolbar.
            </Text>

            <Title order={5}>Available Tools</Title>
            <ScrollArea.Autosize mah={400}>
              <Stack gap="md">
                <Switch
                  label={
                    <Group gap="xs">
                      {getStatusIcon("showSnapshot")}
                      <Text>Snapshot Image Position</Text>
                    </Group>
                  }
                  description="Tool for capturing frame snapshots"
                  checked={config.showSnapshot}
                  onChange={(event) =>
                    handleToggle("showSnapshot", event.currentTarget.checked)
                  }
                />

                <Switch
                  label={
                    <Group gap="xs">
                      {getStatusIcon("showFramePositionViewer")}
                      <Text>Frame Position Viewer</Text>
                    </Group>
                  }
                  description="View and analyze frame positions"
                  checked={config.showFramePositionViewer}
                  onChange={(event) =>
                    handleToggle(
                      "showFramePositionViewer",
                      event.currentTarget.checked,
                    )
                  }
                />

                <Switch
                  label={
                    <Group gap="xs">
                      {getStatusIcon("showLayoutManager")}
                      <Text>Layout Manager</Text>
                    </Group>
                  }
                  description="Manage layout properties and hierarchy"
                  checked={config.showLayoutManager}
                  onChange={(event) => handleToggle("showLayoutManager", false)}
                />

                <Switch
                  label={
                    <Group gap="xs">
                      {getStatusIcon("showMagicLayouts")}
                      <Text>Magic Layouts</Text>
                    </Group>
                  }
                  description="Automated layout generation and management"
                  checked={config.showMagicLayouts}
                  onChange={(event) =>
                    handleToggle(
                      "showMagicLayouts",
                      event.currentTarget.checked,
                    )
                  }
                />

                <Switch
                  label={
                    <Group gap="xs">
                      {getStatusIcon("showAspectLock")}
                      <Text>Aspect Lock</Text>
                    </Group>
                  }
                  description="Lock aspect ratios for layouts"
                  checked={config.showAspectLock}
                  onChange={(event) =>
                    handleToggle("showAspectLock", event.currentTarget.checked)
                  }
                />

                <Switch
                  label={
                    <Group gap="xs">
                      {getStatusIcon("showLayoutImageMapper")}
                      <Text>Layout Image Mapper</Text>
                    </Group>
                  }
                  description="Map images to layout variables"
                  checked={config.showLayoutImageMapper}
                  onChange={(event) =>
                    handleToggle(
                      "showLayoutImageMapper",
                      event.currentTarget.checked,
                    )
                  }
                />

                <Switch
                  label={
                    <Group gap="xs">
                      {getStatusIcon("showUploadDownload")}
                      <Text>Upload/Download Document</Text>
                    </Group>
                  }
                  description="Upload and download document JSON"
                  checked={config.showUploadDownload}
                  onChange={(event) =>
                    handleToggle(
                      "showUploadDownload",
                      event.currentTarget.checked,
                    )
                  }
                />

                <Switch
                  label={
                    <Group gap="xs">
                      {getStatusIcon("showTestError")}
                      <Text>Test Error</Text>
                    </Group>
                  }
                  description="Test error handling functionality"
                  checked={config.showTestError}
                  onChange={(event) =>
                    handleToggle("showTestError", event.currentTarget.checked)
                  }
                />

                <Switch
                  label={
                    <Group gap="xs">
                      {getStatusIcon("showConnectorCleanup")}
                      <Text>Connector Cleanup</Text>
                    </Group>
                  }
                  description="Manage and remove unused connectors"
                  checked={config.showConnectorCleanup}
                  onChange={(event) =>
                    handleToggle(
                      "showConnectorCleanup",
                      event.currentTarget.checked,
                    )
                  }
                />

                <Switch
                  label={
                    <Group gap="xs">
                      {getStatusIcon("showManualCropManager")}
                      <Text>Manual Crop Manager</Text>
                    </Group>
                  }
                  description="Manage manual crops for layouts and connectors"
                  checked={config.showManualCropManager}
                  onChange={(event) =>
                    handleToggle(
                      "showManualCropManager",
                      event.currentTarget.checked,
                    )
                  }
                />

                <Switch
                  label={
                    <Group gap="xs">
                      {getStatusIcon("showOutput")}
                      <Text>Output</Text>
                    </Group>
                  }
                  description="Generate output files from layouts"
                  checked={config.showOutput}
                  onChange={(event) =>
                    handleToggle("showOutput", event.currentTarget.checked)
                  }
                />
              </Stack>
            </ScrollArea.Autosize>

            <Group justify="space-between" mt="xl">
              <Button variant="subtle" onClick={handleReset}>
                Reset to Default
              </Button>
              <Group>
                <Button variant="default" onClick={handleClose}>
                  Cancel
                </Button>
                <Button onClick={handleSave}>Save & Apply</Button>
              </Group>
            </Group>
          </>
        ) : null}
      </Stack>
    </Modal>
  );
}
