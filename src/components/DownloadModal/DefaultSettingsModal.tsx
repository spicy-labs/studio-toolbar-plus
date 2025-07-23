import React, { useState, useEffect } from "react";
import {
  Modal,
  Stack,
  Text,
  Alert,
  Checkbox,
  Button,
  Group,
  Title,
  Tooltip,
  ActionIcon,
} from "@mantine/core";
import { IconAlertCircle, IconCircleX } from "@tabler/icons-react";
import { appStore } from "../../modalStore";
import {
  saveToolbarDataToDoc,
  loadToolbarDataFromDoc,
} from "../../studio/studioAdapter";
import { ImageBrowser, ImageBrowserMode } from "../ImageBrowser";
import type { DefaultDownloadSettings } from "../../types/toolbarEnvelope";
import type { ImageBrowserFolderSelection } from "../ImageBrowser";

interface DefaultSettingsModalProps {
  opened: boolean;
  onClose: () => void;
}

export function DefaultSettingsModal({
  opened,
  onClose,
}: DefaultSettingsModalProps) {
  const raiseError = appStore((store) => store.raiseError);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [folderBrowserOpened, setFolderBrowserOpened] = useState(false);
  const [defaultSettings, setDefaultSettings] =
    useState<DefaultDownloadSettings>({
      includeFonts: true,
      includeGrafxMedia: false,
      includeSmartCrops: false,
      removeToolbarData: false,
      removeUnusedConnectors: false,
      useOriginalFontFileNames: false,
      addTimestamp: true,
    });

  // Load existing default settings when modal opens
  useEffect(() => {
    if (opened) {
      loadDefaultSettings();
    }
  }, [opened]);

  const loadDefaultSettings = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const toolbarDataResult = await loadToolbarDataFromDoc();
      if (toolbarDataResult.isOk()) {
        const toolbarData = toolbarDataResult.value;
        if (toolbarData.defaultDownloadSettings) {
          setDefaultSettings(toolbarData.defaultDownloadSettings);
        }
      } else {
        // If loading fails, keep the default values
        console.warn("Failed to load toolbar data, using defaults");
      }
    } catch (error) {
      console.warn("Error loading default settings:", error);
      // Keep default values on error
    } finally {
      setIsLoading(false);
    }
  };

  const handleSettingChange = (
    setting: keyof DefaultDownloadSettings,
    value: boolean,
  ) => {
    setDefaultSettings((prev) => ({
      ...prev,
      [setting]: value,
    }));

    // Clear smart crops connector selection when smart crops is unchecked
    if (setting === "includeSmartCrops" && !value) {
      setDefaultSettings((prev) => ({
        ...prev,
        smartCropsConnectorSelection: undefined,
      }));
    }
  };

  // Handle folder selection from ImageBrowser
  const handleFolderSelection = (
    selection: ImageBrowserFolderSelection | null,
  ) => {
    setDefaultSettings((prev) => ({
      ...prev,
      smartCropsConnectorSelection: selection || undefined,
    }));
    setFolderBrowserOpened(false);
  };

  // Handle removing a specific folder path
  const handleRemoveFolderPath = (pathToRemove: string) => {
    setDefaultSettings((prev) => {
      if (!prev.smartCropsConnectorSelection) return prev;

      const updatedFolders =
        prev.smartCropsConnectorSelection.selectedFolders.filter(
          (path) => path !== pathToRemove,
        );

      if (updatedFolders.length === 0) {
        return {
          ...prev,
          smartCropsConnectorSelection: undefined,
        };
      }

      return {
        ...prev,
        smartCropsConnectorSelection: {
          ...prev.smartCropsConnectorSelection,
          selectedFolders: updatedFolders,
        },
      };
    });
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);

    try {
      const saveResult = await saveToolbarDataToDoc(
        "defaultDownloadSettings",
        defaultSettings,
      );
      if (saveResult.isOk()) {
        onClose();
      } else {
        setError(
          saveResult.error?.message || "Failed to save default settings",
        );
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      setError(errorMessage);
      raiseError(error instanceof Error ? error : new Error(errorMessage));
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    setError(null);
    onClose();
  };

  return (
    <>
      <Modal
        opened={opened}
        onClose={handleClose}
        title="Default Download Settings for Template"
        size="lg"
        styles={{
          title: {
            fontSize: "1.5rem",
            fontWeight: 600,
          },
        }}
      >
        <Stack gap="xl">
          <Text size="md" style={{ textAlign: "center", marginBottom: "1rem" }}>
            Configure default settings for downloads with this template. These
            settings will be used as defaults when you start a new download with
            this template.
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

          {isLoading ? (
            <Text size="sm" c="dimmed" style={{ textAlign: "center" }}>
              Loading current settings...
            </Text>
          ) : (
            <Stack gap="md">
              <Checkbox
                label="Include fonts"
                checked={defaultSettings.includeFonts}
                onChange={(event) =>
                  handleSettingChange(
                    "includeFonts",
                    event.currentTarget.checked,
                  )
                }
              />

              {defaultSettings.includeFonts && (
                <Checkbox
                  label="Use original font file names (Default: unchecked because duplicate font names will cause false positives of missing files during upload)"
                  checked={defaultSettings.useOriginalFontFileNames}
                  onChange={(event) =>
                    handleSettingChange(
                      "useOriginalFontFileNames",
                      event.currentTarget.checked,
                    )
                  }
                  style={{ marginLeft: "40px" }}
                />
              )}

              <Group gap="xs">
                <Checkbox
                  label="Include GraFx Media"
                  checked={defaultSettings.includeGrafxMedia}
                  onChange={(event) =>
                    handleSettingChange(
                      "includeGrafxMedia",
                      event.currentTarget.checked,
                    )
                  }
                />
                {defaultSettings.includeGrafxMedia && (
                  <Text size="sm" c="red">
                    Not implemented
                  </Text>
                )}
              </Group>

              <Stack gap="xs">
                <Checkbox
                  label="Include smart crops"
                  checked={defaultSettings.includeSmartCrops}
                  onChange={(event) =>
                    handleSettingChange(
                      "includeSmartCrops",
                      event.currentTarget.checked,
                    )
                  }
                />
                {defaultSettings.includeSmartCrops && (
                  <Stack gap="xs" style={{ marginLeft: "1.5rem" }}>
                    <Button
                      variant="outline"
                      size="sm"
                      style={{ width: "fit-content" }}
                      onClick={() => setFolderBrowserOpened(true)}
                    >
                      Add folders
                    </Button>
                    {defaultSettings.smartCropsConnectorSelection &&
                      defaultSettings.smartCropsConnectorSelection
                        .selectedFolders.length > 0 && (
                        <Stack gap="xs">
                          <Text size="xs" fw={500}>
                            Selected folders:
                          </Text>
                          {defaultSettings.smartCropsConnectorSelection.selectedFolders.map(
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
                                  onClick={() => handleRemoveFolderPath(path)}
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
                label="Add timestamp to folder name"
                checked={defaultSettings.addTimestamp}
                onChange={(event) =>
                  handleSettingChange(
                    "addTimestamp",
                    event.currentTarget.checked,
                  )
                }
              />

              <Checkbox
                label="Remove Toolbar data"
                checked={defaultSettings.removeToolbarData}
                onChange={(event) =>
                  handleSettingChange(
                    "removeToolbarData",
                    event.currentTarget.checked,
                  )
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
                  checked={defaultSettings.removeUnusedConnectors}
                  onChange={(event) =>
                    handleSettingChange(
                      "removeUnusedConnectors",
                      event.currentTarget.checked,
                    )
                  }
                />
              </Tooltip>
            </Stack>
          )}

          <Group justify="space-between" mt="xl">
            <Button variant="default" onClick={handleClose} disabled={isSaving}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              color="blue"
              loading={isSaving}
              disabled={isLoading}
            >
              Save Default Settings
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Image Browser Modal */}
      <ImageBrowser
        opened={folderBrowserOpened}
        mode={ImageBrowserMode.FolderSelection}
        initialSelection={defaultSettings.smartCropsConnectorSelection}
        onClose={handleFolderSelection}
      />
    </>
  );
}
