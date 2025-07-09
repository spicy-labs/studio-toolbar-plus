import {
  Modal,
  Text,
  Stack,
  Group,
  Button,
  Switch,
  Title,
  ScrollArea,
} from "@mantine/core";

export type AppConfig = {
  showSnapshot: boolean;
  showFramePositionViewer: boolean;
  showLayoutManager: boolean;
  showMagicLayouts: boolean;
  showAspectLock: boolean;
  showLayoutImageMapper: boolean;
  showUploadDownload: boolean;
  showTestError: boolean;
  showConnectorCleanup: boolean;
  showManualCropManager: boolean;
  showOutTemplate: boolean;
};

export const defaultConfig: AppConfig = {
  showSnapshot: false,
  showFramePositionViewer: false,
  showLayoutManager: false,
  showMagicLayouts: true,
  showAspectLock: true,
  showLayoutImageMapper: true,
  showUploadDownload: true,
  showTestError: false,
  showConnectorCleanup: false,
  showManualCropManager: true,
  showOutTemplate: true,
};

interface ToolbarSettingsModalProps {
  opened: boolean;
  onClose: () => void;
  config: AppConfig;
  onConfigChange: (config: AppConfig) => void;
  onReloadConfig: () => void;
}

export function ToolbarSettingsModal({
  opened,
  onClose,
  config,
  onConfigChange,
  onReloadConfig,
}: ToolbarSettingsModalProps) {
  const handleToggle = (key: keyof AppConfig, value: boolean) => {
    const newConfig = { ...config, [key]: value };
    onConfigChange(newConfig);
  };

  const handleSave = () => {
    // Save to localStorage
    localStorage.setItem("tempUserConfig", JSON.stringify(config));
    onClose();
    // Reload the config without refreshing the page
    onReloadConfig();
  };

  const handleReset = () => {
    onConfigChange(defaultConfig);
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Toolbar Settings"
      centered
      size="md"
    >
      <Stack>
        <Text size="sm" c="dimmed">
          Configure which tools are visible in the toolbar.
        </Text>

        <ScrollArea.Autosize mah={400}>
          <Stack gap="md">
            <Title order={5}>Available Tools</Title>

            <Switch
              label="Snapshot Image Position"
              description="Tool for capturing frame snapshots"
              checked={config.showSnapshot}
              onChange={(event) =>
                handleToggle("showSnapshot", event.currentTarget.checked)
              }
            />

            <Switch
              label="Frame Position Viewer"
              description="View and analyze frame positions"
              checked={config.showFramePositionViewer}
              onChange={(event) =>
                handleToggle(
                  "showFramePositionViewer",
                  event.currentTarget.checked
                )
              }
            />

            <Switch
              label="Layout Manager"
              description="Manage layout properties and hierarchy"
              checked={config.showLayoutManager}
              onChange={(event) => handleToggle("showLayoutManager", false)}
            />

            <Switch
              label="Magic Layouts"
              description="Automated layout generation and management"
              checked={config.showMagicLayouts}
              onChange={(event) =>
                handleToggle("showMagicLayouts", event.currentTarget.checked)
              }
            />

            <Switch
              label="Aspect Lock"
              description="Lock aspect ratios for layouts"
              checked={config.showAspectLock}
              onChange={(event) =>
                handleToggle("showAspectLock", event.currentTarget.checked)
              }
            />

            <Switch
              label="Layout Image Mapper"
              description="Map images to layout variables"
              checked={config.showLayoutImageMapper}
              onChange={(event) =>
                handleToggle(
                  "showLayoutImageMapper",
                  event.currentTarget.checked
                )
              }
            />

            <Switch
              label="Upload/Download Document"
              description="Upload and download document JSON"
              checked={config.showUploadDownload}
              onChange={(event) =>
                handleToggle("showUploadDownload", event.currentTarget.checked)
              }
            />

            <Switch
              label="Test Error"
              description="Test error handling functionality"
              checked={config.showTestError}
              onChange={(event) =>
                handleToggle("showTestError", event.currentTarget.checked)
              }
            />

            <Switch
              label="Connector Cleanup"
              description="Manage and remove unused connectors"
              checked={config.showConnectorCleanup}
              onChange={(event) =>
                handleToggle(
                  "showConnectorCleanup",
                  event.currentTarget.checked
                )
              }
            />

            <Switch
              label="Manual Crop Manager"
              description="Manage manual crops for layouts and connectors"
              checked={config.showManualCropManager}
              onChange={(event) =>
                handleToggle(
                  "showManualCropManager",
                  event.currentTarget.checked
                )
              }
            />

            <Switch
              label="Out Template"
              description="Generate output files from templates"
              checked={config.showOutTemplate}
              onChange={(event) =>
                handleToggle("showOutTemplate", event.currentTarget.checked)
              }
            />
          </Stack>
        </ScrollArea.Autosize>

        <Group justify="space-between" mt="xl">
          <Button variant="subtle" onClick={handleReset}>
            Reset to Default
          </Button>
          <Group>
            <Button variant="default" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleSave}>Save & Apply</Button>
          </Group>
        </Group>
      </Stack>
    </Modal>
  );
}
