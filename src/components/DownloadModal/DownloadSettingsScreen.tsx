import React from "react";
import {
  Stack,
  Text,
  Alert,
  TextInput,
  Checkbox,
  Button,
  Group,
  ActionIcon,
  Tooltip,
  Title,
} from "@mantine/core";
import {
  IconAlertCircle,
  IconCircleX,
  IconRadioactiveFilled,
} from "@tabler/icons-react";
import type { ImageBrowserFolderSelection } from "../ImageBrowser";

interface DownloadSettings {
  includeFonts: boolean;
  includeGrafxMedia: boolean;
  includeSmartCrops: boolean;
  removeToolbarData: boolean;
  removeUnusedConnectors: boolean;
  useOriginalFontFileNames: boolean;
  addTimestamp: boolean;
}

interface DownloadSettingsScreenProps {
  error: string | null;
  folderName: string;
  folderNameError: string;
  downloadSettings: DownloadSettings;
  fontStylesCount: number;
  connectorSelection: ImageBrowserFolderSelection | null;
  onFolderNameChange: (value: string) => void;
  onSettingChange: (setting: keyof DownloadSettings, value: boolean) => void;
  onAddFolder: () => void;
  onRemoveFolderPath: (path: string) => void;
  onBack: () => void;
  onDownload: () => void;
}

export function DownloadSettingsScreen({
  error,
  folderName,
  folderNameError,
  downloadSettings,
  fontStylesCount,
  connectorSelection,
  onFolderNameChange,
  onSettingChange,
  onAddFolder,
  onRemoveFolderPath,
  onBack,
  onDownload,
}: DownloadSettingsScreenProps) {
  return (
    <Stack gap="xl">
      <Text size="md" style={{ textAlign: "center", marginBottom: "1rem" }}>
        Download Settings
      </Text>

      {error && (
        <Alert
          icon={<IconAlertCircle size="1rem" />}
          title="Error"
          color="red"
          style={{ marginBottom: "1rem" }}
        >
          {error}
        </Alert>
      )}

      <Stack gap="md">
        <TextInput
          label="Folder Name"
          value={folderName}
          onChange={(event) => onFolderNameChange(event.currentTarget.value)}
          error={folderNameError}
          placeholder="Enter folder name"
          description="Only letters, numbers, hyphens, and underscores are allowed"
        />

        <Checkbox
          label="Add Timestamp"
          checked={downloadSettings.addTimestamp}
          onChange={(event) =>
            onSettingChange("addTimestamp", event.currentTarget.checked)
          }
        />

        <Stack gap="xs">
          <Checkbox
            label={`Include fonts${downloadSettings.includeFonts && fontStylesCount > 0 ? ` (${fontStylesCount} styles)` : ""}`}
            checked={downloadSettings.includeFonts}
            onChange={(event) =>
              onSettingChange("includeFonts", event.currentTarget.checked)
            }
          />
          {downloadSettings.includeFonts && (
            <Checkbox
              label="Use original font file names (Default: unchecked because duplicate font names will cause false positives of missing files during upload)"
              checked={downloadSettings.useOriginalFontFileNames}
              onChange={(event) =>
                onSettingChange(
                  "useOriginalFontFileNames",
                  event.currentTarget.checked,
                )
              }
              style={{ marginLeft: "40px" }}
            />
          )}
        </Stack>

        <Group gap="xs">
          <Checkbox
            label="Include GraFx Media"
            checked={downloadSettings.includeGrafxMedia}
            onChange={(event) =>
              onSettingChange("includeGrafxMedia", event.currentTarget.checked)
            }
          />
          {downloadSettings.includeGrafxMedia && (
            <Text size="sm" c="red">
              Not implemented
            </Text>
          )}
        </Group>

        <Stack gap="xs">
          <Checkbox
            label="Include smart crops"
            checked={downloadSettings.includeSmartCrops}
            onChange={(event) =>
              onSettingChange("includeSmartCrops", event.currentTarget.checked)
            }
          />
          {downloadSettings.includeSmartCrops && (
            <Stack gap="xs" style={{ marginLeft: "1.5rem" }}>
              <Button
                variant="outline"
                size="sm"
                style={{ width: "fit-content" }}
                onClick={onAddFolder}
              >
                Add folders
              </Button>
              {connectorSelection &&
                connectorSelection.selectedFolders.length > 0 && (
                  <Stack gap="xs">
                    <Text size="xs" fw={500}>
                      Selected folders:
                    </Text>
                    {connectorSelection.selectedFolders.map(
                      (path: string, index: number) => (
                        <Group
                          key={index}
                          gap="xs"
                          style={{ marginLeft: "0.5rem" }}
                        >
                          <ActionIcon
                            size="xs"
                            variant="subtle"
                            color="red"
                            onClick={() => onRemoveFolderPath(path)}
                          >
                            <IconCircleX size={12} />
                          </ActionIcon>
                          <Text size="xs" c="dimmed" style={{ flex: 1 }}>
                            {path}
                          </Text>
                        </Group>
                      ),
                    )}
                  </Stack>
                )}
            </Stack>
          )}
        </Stack>

        <Checkbox
          label="Remove Toolbar data"
          checked={downloadSettings.removeToolbarData}
          onChange={(event) =>
            onSettingChange("removeToolbarData", event.currentTarget.checked)
          }
        />
        <Title order={5}>Experimental</Title>

        <Tooltip
          label="Experimental: May cause issues with your document"
          position="right"
          withArrow
        >
          <Checkbox
            label="Remove unused Connectors"
            color="red"
            checked={downloadSettings.removeUnusedConnectors}
            onChange={(event) =>
              onSettingChange(
                "removeUnusedConnectors",
                event.currentTarget.checked,
              )
            }
          />
        </Tooltip>
      </Stack>

      <Group justify="space-between" mt="xl">
        <Button variant="default" onClick={onBack}>
          Back
        </Button>
        <Button onClick={onDownload} color="blue">
          Download
        </Button>
      </Group>
    </Stack>
  );
}
