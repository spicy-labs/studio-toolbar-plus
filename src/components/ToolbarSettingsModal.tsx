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
  ActionIcon,
} from "@mantine/core";
import {
  IconBugFilled,
  IconInfoCircle,
  IconRosetteDiscountCheckFilled,
  IconRosetteFilled,
  IconCircleRectangleFilled,
  IconRadioactiveFilled,
  IconBug,
  IconMapBolt,
  IconArrowsTransferUpDown,
  IconCameraPlus,
  IconPhotoCog,
  IconListTree,
  IconPlaystationSquare,
  IconSparkles,
  IconPlug,
  IconCrop,
  IconDownload,
  IconPhotoSearch,
} from "@tabler/icons-react";
import { useState, useEffect } from "react";
import type {
  AppConfig,
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

const disclaimer = (
  <>
    The Toolbar is released under the MIT license and is primarily supported by
    the community. Individual apps may have varying support focus. Apps marked
    with the{" "}
    <IconRosetteDiscountCheckFilled
      style={{ display: "inline", verticalAlign: "middle" }}
      size={16}
    />{" "}
    icon indicate active sponsorship.
  </>
);

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
        tooltip: "Still used, no sponsorship",
      },
      sponsored: {
        icon: <IconRosetteDiscountCheckFilled size={16} color="green" />,
        tooltip: "Still used, under active sponsorship",
      },
      deprecated: {
        icon: <IconCircleRectangleFilled size={16} color="red" />,
        tooltip:
          "Not used, deprecated; scheduled for removal in future versions",
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

  // Tool configuration mapping for icons and handlers
  const toolConfig = {
    showSnapshot: {
      icon: <IconCameraPlus size={16} />,
      handler: () => {
        // Simulate opening the snapshot tool
        console.log("Opening Snapshot Image Position tool");
      },
    },
    showFramePositionViewer: {
      icon: <IconPhotoCog size={16} />,
      handler: () => {
        console.log("Opening Frame Position Viewer tool");
      },
    },
    showLayoutManager: {
      icon: <IconListTree size={16} />,
      handler: () => {
        console.log("Opening Layout Manager tool");
      },
    },
    showMagicLayouts: {
      icon: <IconSparkles size={16} />,
      handler: () => {
        console.log("Opening Magic Layouts tool");
      },
    },
    showAspectLock: {
      icon: <IconPlaystationSquare size={16} />,
      handler: () => {
        console.log("Opening Aspect Lock tool");
      },
    },
    showLayoutImageMapper: {
      icon: <IconMapBolt size={16} />,
      handler: () => {
        console.log("Opening Layout Image Mapper tool");
      },
    },
    showUploadDownload: {
      icon: <IconArrowsTransferUpDown size={16} />,
      handler: () => {
        console.log("Opening Upload/Download tool");
      },
    },
    showTestError: {
      icon: <IconBug size={16} />,
      handler: () => {
        console.log("Opening Test Error tool");
      },
    },
    showConnectorCleanup: {
      icon: <IconPlug size={16} />,
      handler: () => {
        console.log("Opening Connector Cleanup tool");
      },
    },
    showManualCropManager: {
      icon: <IconCrop size={16} />,
      handler: () => {
        console.log("Opening Manual Crop Manager tool");
      },
    },
    showConnectorFolderBrowser: {
      icon: <IconPhotoSearch size={16} />,
      handler: () => {
        console.log("Opening Image Browser tool");
      },
    },
    showOutput: {
      icon: <IconDownload size={16} />,
      handler: () => {
        console.log("Opening Output tool");
      },
    },
  };

  // Helper function to get tool action icon
  const getToolActionIcon = (appKey: string) => {
    const tool = toolConfig[appKey as keyof typeof toolConfig];
    if (!tool) return null;

    return (
      <Tooltip
        label={`Run ${appKey
          .replace("show", "")
          .replace(/([A-Z])/g, " $1")
          .trim()}`}
        position="left"
        withArrow
      >
        <ActionIcon
          variant="subtle"
          color="blue"
          size="sm"
          onClick={tool.handler}
          aria-label={`Run ${appKey}`}
        >
          {tool.icon}
        </ActionIcon>
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
                (_error) => {
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
      size="md"
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
                      </Alert>
                    );
                  }
                }
                return null;
              })()}

            <Text size="sm" c="dimmed">
              Configure which tools are visible in the toolbar.
              <br />
              <br />
              {disclaimer}
            </Text>

            <Title order={5}>Available Tools</Title>
            <ScrollArea.Autosize mah={400}>
              <Stack gap="md">
                <Group justify="space-between" align="center">
                  <Group gap="xs" style={{ flex: 1 }}>
                    {getToolActionIcon("showSnapshot")}
                    <Text>Snapshot Image Position</Text>
                    {getStatusIcon("showSnapshot")}
                  </Group>
                  <Switch
                    checked={config.showSnapshot}
                    onChange={(event) =>
                      handleToggle("showSnapshot", event.currentTarget.checked)
                    }
                    aria-label="Toggle Snapshot Image Position"
                  />
                </Group>
                <Text size="xs" c="dimmed" ml={32}>
                  Tool for capturing frame snapshots
                </Text>

                <Group justify="space-between" align="center">
                  <Group gap="xs" style={{ flex: 1 }}>
                    {getToolActionIcon("showFramePositionViewer")}
                    <Text>Frame Position Viewer</Text>
                    {getStatusIcon("showFramePositionViewer")}
                  </Group>
                  <Switch
                    checked={config.showFramePositionViewer}
                    onChange={(event) =>
                      handleToggle(
                        "showFramePositionViewer",
                        event.currentTarget.checked,
                      )
                    }
                    aria-label="Toggle Frame Position Viewer"
                  />
                </Group>
                <Text size="xs" c="dimmed" ml={32}>
                  View and analyze frame positions
                </Text>

                <Group justify="space-between" align="center">
                  <Group gap="xs" style={{ flex: 1 }}>
                    {getToolActionIcon("showLayoutManager")}
                    <Text>Layout Manager</Text>
                    {getStatusIcon("showLayoutManager")}
                  </Group>
                  <Switch
                    checked={config.showLayoutManager}
                    onChange={(event) =>
                      handleToggle(
                        "showLayoutManager",
                        event.currentTarget.checked,
                      )
                    }
                    aria-label="Toggle Layout Manager"
                  />
                </Group>
                <Text size="xs" c="dimmed" ml={32}>
                  Manage layout properties and hierarchy
                </Text>

                <Group justify="space-between" align="center">
                  <Group gap="xs" style={{ flex: 1 }}>
                    {getToolActionIcon("showMagicLayouts")}
                    <Text>Magic Layouts</Text>
                    {getStatusIcon("showMagicLayouts")}
                  </Group>
                  <Switch
                    checked={config.showMagicLayouts}
                    onChange={(event) =>
                      handleToggle(
                        "showMagicLayouts",
                        event.currentTarget.checked,
                      )
                    }
                    aria-label="Toggle Magic Layouts"
                  />
                </Group>
                <Text size="xs" c="dimmed" ml={32}>
                  Automated layout generation and management
                </Text>

                <Group justify="space-between" align="center">
                  <Group gap="xs" style={{ flex: 1 }}>
                    {getToolActionIcon("showAspectLock")}
                    <Text>Aspect Lock</Text>
                    {getStatusIcon("showAspectLock")}
                  </Group>
                  <Switch
                    checked={config.showAspectLock}
                    onChange={(event) =>
                      handleToggle(
                        "showAspectLock",
                        event.currentTarget.checked,
                      )
                    }
                    aria-label="Toggle Aspect Lock"
                  />
                </Group>
                <Text size="xs" c="dimmed" ml={32}>
                  Lock aspect ratios for layouts
                </Text>

                <Group justify="space-between" align="center">
                  <Group gap="xs" style={{ flex: 1 }}>
                    {getToolActionIcon("showLayoutImageMapper")}
                    <Text>Layout Variable Mapper</Text>
                    {getStatusIcon("showLayoutImageMapper")}
                  </Group>
                  <Switch
                    checked={config.showLayoutImageMapper}
                    onChange={(event) =>
                      handleToggle(
                        "showLayoutImageMapper",
                        event.currentTarget.checked,
                      )
                    }
                    aria-label="Toggle Layout Variable Mapper"
                  />
                </Group>
                <Text size="xs" c="dimmed" ml={32}>
                  Map variable values to layout variables
                </Text>

                <Group justify="space-between" align="center">
                  <Group gap="xs" style={{ flex: 1 }}>
                    {getToolActionIcon("showUploadDownload")}
                    <Text>Upload/Download Document</Text>
                    {getStatusIcon("showUploadDownload")}
                  </Group>
                  <Switch
                    checked={config.showUploadDownload}
                    onChange={(event) =>
                      handleToggle(
                        "showUploadDownload",
                        event.currentTarget.checked,
                      )
                    }
                    aria-label="Toggle Upload/Download Document"
                  />
                </Group>
                <Text size="xs" c="dimmed" ml={32}>
                  Upload and download document JSON
                </Text>

                <Group justify="space-between" align="center">
                  <Group gap="xs" style={{ flex: 1 }}>
                    {getToolActionIcon("showTestError")}
                    <Text>Test Error</Text>
                    {getStatusIcon("showTestError")}
                  </Group>
                  <Switch
                    checked={config.showTestError}
                    onChange={(event) =>
                      handleToggle("showTestError", event.currentTarget.checked)
                    }
                    aria-label="Toggle Test Error"
                  />
                </Group>
                <Text size="xs" c="dimmed" ml={32}>
                  Test error handling functionality
                </Text>

                <Group justify="space-between" align="center">
                  <Group gap="xs" style={{ flex: 1 }}>
                    {getToolActionIcon("showConnectorCleanup")}
                    <Text>Connector Cleanup</Text>
                    {getStatusIcon("showConnectorCleanup")}
                  </Group>
                  <Switch
                    checked={config.showConnectorCleanup}
                    onChange={(event) =>
                      handleToggle(
                        "showConnectorCleanup",
                        event.currentTarget.checked,
                      )
                    }
                    aria-label="Toggle Connector Cleanup"
                  />
                </Group>
                <Text size="xs" c="dimmed" ml={32}>
                  Manage and remove unused connectors
                </Text>

                <Group justify="space-between" align="center">
                  <Group gap="xs" style={{ flex: 1 }}>
                    {getToolActionIcon("showManualCropManager")}
                    <Text>Manual Crop Manager</Text>
                    {getStatusIcon("showManualCropManager")}
                  </Group>
                  <Switch
                    checked={config.showManualCropManager}
                    onChange={(event) =>
                      handleToggle(
                        "showManualCropManager",
                        event.currentTarget.checked,
                      )
                    }
                    aria-label="Toggle Manual Crop Manager"
                  />
                </Group>
                <Text size="xs" c="dimmed" ml={32}>
                  Manage manual crops for layouts and connectors
                </Text>

                <Group justify="space-between" align="center">
                  <Group gap="xs" style={{ flex: 1 }}>
                    {getToolActionIcon("showConnectorFolderBrowser")}
                    <Text>Image Browser</Text>
                    {getStatusIcon("showConnectorFolderBrowser")}
                  </Group>
                  <Switch
                    checked={config.showConnectorFolderBrowser}
                    onChange={(event) =>
                      handleToggle(
                        "showConnectorFolderBrowser",
                        event.currentTarget.checked,
                      )
                    }
                    aria-label="Toggle Image Browser"
                  />
                </Group>
                <Text size="xs" c="dimmed" ml={32}>
                  Browse and select images from connectors
                </Text>

                <Group justify="space-between" align="center">
                  <Group gap="xs" style={{ flex: 1 }}>
                    {getToolActionIcon("showOutput")}
                    <Text>Output</Text>
                    {getStatusIcon("showOutput")}
                  </Group>
                  <Switch
                    checked={config.showOutput}
                    onChange={(event) =>
                      handleToggle("showOutput", event.currentTarget.checked)
                    }
                    aria-label="Toggle Output"
                  />
                </Group>
                <Text size="xs" c="dimmed" ml={32}>
                  Generate output files from layouts
                </Text>
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
