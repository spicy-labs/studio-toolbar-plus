import { useState, useEffect } from "react";
import {
  Modal,
  Text,
  Stack,
  Group,
  Button,
  Loader,
  Select,
  Alert,
  ScrollArea,
} from "@mantine/core";
import {
  IconAlertCircle,
  IconDownload,
  IconFileText,
} from "@tabler/icons-react";
import { appStore } from "../modalStore";
import { getStudio } from "../studio/studioAdapter";
import { getCurrentDocumentState } from "../studio/documentHandler";
import { getSelected } from "../studio/frameHandler";

interface OutTemplateModalProps {
  opened: boolean;
  onClose: () => void;
}

interface OutputSetting {
  id: string;
  name: string;
  type: string;
  description: string;
  default: boolean;
  watermark: boolean;
  watermarkText: string;
  dataSourceEnabled: boolean;
}

interface OutputSettingsResponse {
  pageSize: number;
  links: Record<string, any>;
  data: OutputSetting[];
}

interface TaskResponse {
  links: {
    taskInfo: string;
  };
  data: {
    taskId: string;
  };
}

interface TaskInfoResponse {
  links?: {
    download?: string;
  };
  data: {
    taskId: string;
  };
}

interface ErrorDetail {
  Type: string;
  Details: string;
}

interface ErrorContainer {
  errors: ErrorRecord[];
  url: string;
}

function emptyErrorContainer(): ErrorContainer {
  return {
    errors: [],
    url: "",
  };
}

interface ErrorRecord {
  RecordId: string;
  ErrorList: ErrorDetail[];
}

export function OutTemplateModal({ opened, onClose }: OutTemplateModalProps) {
  const raiseError = appStore((store) => store.raiseError);
  const [loading, setLoading] = useState(true);
  const [outputSettings, setOutputSettings] = useState<OutputSetting[]>([]);
  const [selectedSettingId, setSelectedSettingId] = useState<string>("");
  const [isCreatingOutput, setIsCreatingOutput] = useState(false);
  const [isPolling, setIsPolling] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState<string>("");
  const [taskSucceeded, setTaskSucceeded] = useState(false);
  const [errors, setErrors] = useState<ErrorContainer>(emptyErrorContainer());
  const [hasError, setHasError] = useState(false);

  // Helper function to get environment ID from URL
  const getEnvironmentId = (): string | null => {
    try {
      const urlPath = window.location.href;
      const environmentIdMatch = urlPath.match(
        /environments\/([\w-]+)\/studio/,
      );
      return environmentIdMatch ? environmentIdMatch[1] : null;
    } catch (error) {
      console.error("Failed to extract environment ID from URL:", error);
      return null;
    }
  };

  // Helper function to get localStorage key for selected setting
  const getStorageKey = (): string | null => {
    const environmentId = getEnvironmentId();
    return environmentId
      ? `tempOutTemplate_selectedSettingId_${environmentId}`
      : null;
  };

  // Helper function to save selected setting to localStorage
  const saveSelectedSetting = (settingId: string) => {
    const storageKey = getStorageKey();
    if (storageKey) {
      localStorage.setItem(storageKey, settingId);
    }
  };

  // Helper function to load selected setting from localStorage
  const loadSelectedSetting = (): string | null => {
    const storageKey = getStorageKey();
    return storageKey ? localStorage.getItem(storageKey) : null;
  };

  // Reset state when modal opens
  useEffect(() => {
    if (opened) {
      setLoading(true);
      setOutputSettings([]);
      setSelectedSettingId("");
      setIsCreatingOutput(false);
      setIsPolling(false);
      setDownloadUrl("");
      setTaskSucceeded(false);
      setErrors(emptyErrorContainer());
      setHasError(false);
      fetchOutputSettings();
    }
  }, [opened]);

  const fetchOutputSettings = async () => {
    try {
      const studioResult = await getStudio();
      if (!studioResult.isOk()) {
        raiseError(
          new Error(studioResult.error?.message || "Failed to get studio"),
        );
        return;
      }

      // Get token and baseUrl from configuration
      const token = (
        await studioResult.value.configuration.getValue("GRAFX_AUTH_TOKEN")
      ).parsedData;
      const baseUrl = (
        await studioResult.value.configuration.getValue("ENVIRONMENT_API")
      ).parsedData;

      // Call the output/settings endpoint
      const response = await fetch(`${baseUrl}output/settings`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(
          `Failed to fetch output settings: ${response.statusText}`,
        );
      }

      const settingsData: OutputSettingsResponse = await response.json();
      setOutputSettings(settingsData.data);

      // Try to load previously selected setting from localStorage
      const savedSettingId = loadSelectedSetting();
      const savedSettingExists =
        savedSettingId &&
        settingsData.data.some((setting) => setting.id === savedSettingId);

      if (savedSettingExists) {
        // Use saved setting if it exists in the current settings
        setSelectedSettingId(savedSettingId);
      } else {
        // Fall back to default selection logic
        const defaultSetting = settingsData.data.find(
          (setting) => setting.default,
        );
        if (defaultSetting) {
          setSelectedSettingId(defaultSetting.id);
        } else if (settingsData.data.length > 0) {
          setSelectedSettingId(settingsData.data[0].id);
        }
      }
    } catch (error) {
      raiseError(error instanceof Error ? error : new Error(String(error)));
    } finally {
      setLoading(false);
    }
  };

  const handleCreateOutput = async () => {
    if (!selectedSettingId) {
      raiseError(new Error("Please select an output setting"));
      return;
    }

    setIsCreatingOutput(true);
    setErrors(emptyErrorContainer());

    try {
      const studioResult = await getStudio();
      if (!studioResult.isOk()) {
        raiseError(
          new Error(studioResult.error?.message || "Failed to get studio"),
        );
        return;
      }

      // Get document JSON from getCurrentDocumentState
      const documentResult = await getCurrentDocumentState(studioResult.value);
      if (!documentResult.isOk()) {
        raiseError(
          new Error(
            documentResult.error?.message || "Failed to get document state",
          ),
        );
        return;
      }

      // Get selected layout from getSelected
      const selectedResult = await getSelected(studioResult.value);
      if (!selectedResult.isOk()) {
        raiseError(
          new Error(
            selectedResult.error?.message || "Failed to get selected layout",
          ),
        );
        return;
      }

      const documentJson = documentResult.value as any;
      const selectedLayout = selectedResult.value as any;

      // Get engine version from document JSON
      const engineVersion = documentJson.engineVersion;
      if (!engineVersion) {
        raiseError(new Error("Engine version not found in document"));
        return;
      }

      // Get the selected output setting
      const selectedSetting = outputSettings.find(
        (s) => s.id === selectedSettingId,
      );
      if (!selectedSetting) {
        raiseError(new Error("Selected output setting not found"));
        return;
      }

      // Get token and baseUrl from configuration
      const token = (
        await studioResult.value.configuration.getValue("GRAFX_AUTH_TOKEN")
      ).parsedData as string;
      const baseUrl = (
        await studioResult.value.configuration.getValue("ENVIRONMENT_API")
      ).parsedData as string;

      if (!token || !baseUrl) {
        raiseError(new Error("Failed to get authentication token or base URL"));
        return;
      }

      // Determine the endpoint based on setting type
      const endpointMap: Record<string, string> = {
        JPG: "output/jpg",
        PNG: "output/png",
        PDF: "output/pdf",
        GIF: "output/gif",
        MP4: "output/mp4",
      };

      const endpoint = endpointMap[selectedSetting.type];
      if (!endpoint) {
        raiseError(
          new Error(`Unsupported output type: ${selectedSetting.type}`),
        );
        return;
      }

      // Create the request body
      const requestBody = {
        documentContent: documentJson,
        layoutsToExport: [selectedLayout.id],
        outputSettingsId: selectedSettingId,
        engineVersion: engineVersion,
      };

      // Call the output endpoint
      const outputResponse = await fetch(`${baseUrl}${endpoint}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      if (!outputResponse.ok) {
        if (outputResponse.status === 500) {
          await handleOutputError(outputResponse, token);
        } else {
          throw new Error(
            `Output creation failed: ${outputResponse.statusText}`,
          );
        }
        return;
      }

      const taskResponse: TaskResponse = await outputResponse.json();

      // Start polling the task
      await pollTaskStatus(taskResponse.links.taskInfo, token);
    } catch (error) {
      setHasError(true);
      raiseError(error instanceof Error ? error : new Error(String(error)));
    } finally {
      setIsCreatingOutput(false);
    }
  };

  const handleOutputError = async (response: Response, token: string) => {
    // Stop all spinners immediately
    setIsCreatingOutput(false);
    setIsPolling(false);
    setHasError(true);

    try {
      const errorResponse = await response.json();
      const errorReportUrl = errorResponse.detail?.split("Error report: ")[1];
      if (errorReportUrl) {
        // Fetch error details from the error report URL
        const errorReportResponse = await fetch(errorReportUrl, {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        });

        if (errorReportResponse.ok) {
          const errorData: ErrorContainer = {
            errors: await errorReportResponse.json(),
            url: errorReportUrl,
          };
          setErrors(errorData);
        } else {
          raiseError(
            new Error(
              `Failed to fetch error details: ${errorReportResponse.statusText}`,
            ),
          );
        }
      } else {
        raiseError(new Error("Output creation failed with unknown error"));
      }
    } catch (error) {
      raiseError(error instanceof Error ? error : new Error(String(error)));
    }
  };

  const pollTaskStatus = async (taskInfoUrl: string, token: string) => {
    setIsPolling(true);

    const poll = async (): Promise<void> => {
      try {
        const response = await fetch(taskInfoUrl, {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        });

        if (response.status === 202) {
          // Still processing, continue polling
          setTimeout(poll, 1000);
        } else if (response.status === 200) {
          // Task completed
          const taskInfo: TaskInfoResponse = await response.json();
          if (taskInfo.links?.download) {
            setDownloadUrl(taskInfo.links.download);
            setTaskSucceeded(true);
          } else {
            raiseError(
              new Error("Task completed but no download link available"),
            );
          }
          setIsPolling(false);
        } else if (response.status === 500) {
          await handleOutputError(response, token);
        } else {
          setIsPolling(false);
          setHasError(true);
          throw new Error(`Task polling failed: ${response.statusText}`);
        }
      } catch (error) {
        setIsPolling(false);
        setHasError(true);
        raiseError(error instanceof Error ? error : new Error(String(error)));
      }
    };

    poll();
  };

  const handleDownload = async () => {
    if (!downloadUrl) return;

    try {
      const studioResult = await getStudio();
      if (!studioResult.isOk()) {
        raiseError(
          new Error(studioResult.error?.message || "Failed to get studio"),
        );
        return;
      }

      // Get token from configuration
      const token = (
        await studioResult.value.configuration.getValue("GRAFX_AUTH_TOKEN")
      ).parsedData;

      // Fetch the file with authorization
      const response = await fetch(downloadUrl, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Download failed: ${response.statusText}`);
      }

      // Get the filename from the Content-Disposition header or URL
      const contentDisposition = response.headers.get("Content-Disposition");
      let filename = "output-file";

      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(
          /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/,
        );
        if (filenameMatch && filenameMatch[1]) {
          filename = filenameMatch[1].replace(/['"]/g, "");
        }
      } else {
        // Try to extract filename from URL
        const urlParts = downloadUrl.split("/");
        const lastPart = urlParts[urlParts.length - 1];
        if (lastPart && lastPart.includes(".")) {
          filename = lastPart;
        }
      }

      // Create blob and download
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      raiseError(error instanceof Error ? error : new Error(String(error)));
    }
  };

  const downloadErrorsAsMarkdown = () => {
    if (errors.errors.length === 0) return;

    // Generate markdown content
    let markdownContent = "# Output Errors Report\n\n";
    markdownContent += `Generated on: ${new Date().toLocaleString()}\n\n`;
    markdownContent += `Error Report URL: ${errors.url}\n\n`;

    errors.errors.forEach((record, recordIndex) => {
      markdownContent += `## Record ${record.RecordId}\n\n`;
      record.ErrorList.forEach((error, errorIndex) => {
        markdownContent += `### Error ${errorIndex + 1}\n\n`;
        markdownContent += `**Type:** ${error.Type}\n\n`;
        markdownContent += `**Details:** ${error.Details}\n\n`;
      });
      if (recordIndex < errors.errors.length - 1) {
        markdownContent += "---\n\n";
      }
    });

    // Create and download the file
    const blob = new Blob([markdownContent], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `output-errors-${new Date().toISOString().split("T")[0]}.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const downloadDocumentState = async () => {
    try {
      const studioResult = await getStudio();
      if (!studioResult.isOk()) {
        raiseError(
          new Error(studioResult.error?.message || "Failed to get studio"),
        );
        return;
      }

      // Get document JSON from getCurrentDocumentState
      const documentResult = await getCurrentDocumentState(studioResult.value);
      if (!documentResult.isOk()) {
        raiseError(
          new Error(
            documentResult.error?.message || "Failed to get document state",
          ),
        );
        return;
      }

      const documentJson = documentResult.value;

      // Create and download the JSON file
      const jsonString = JSON.stringify(documentJson, null, 2);
      const blob = new Blob([jsonString], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `document-state-${new Date().toISOString().split("T")[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      raiseError(error instanceof Error ? error : new Error(String(error)));
    }
  };

  const selectData = outputSettings.map((setting) => ({
    value: setting.id,
    label: setting.name,
  }));

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Output Template"
      centered
      size="50%"
      styles={{
        content: {
          minHeight: "400px",
        },
        body: {
          padding: "2rem",
        },
        header: {
          padding: "1.5rem 2rem 1rem 2rem",
        },
        title: {
          fontSize: "1.5rem",
          fontWeight: 600,
        },
      }}
    >
      <Stack gap="xl">
        {loading ? (
          <Group justify="center" style={{ minHeight: "200px" }}>
            <Loader size="lg" />
            <Text>Loading output settings...</Text>
          </Group>
        ) : (
          <>
            <Select
              label="Output Settings"
              placeholder="Select an output setting"
              data={selectData}
              value={selectedSettingId}
              onChange={(value) => {
                const newValue = value || "";
                setSelectedSettingId(newValue);
                if (newValue) {
                  saveSelectedSetting(newValue);
                }
              }}
              disabled={isCreatingOutput || isPolling}
            />

            {!taskSucceeded && !isPolling && !hasError && (
              <Button
                onClick={handleCreateOutput}
                loading={isCreatingOutput}
                disabled={!selectedSettingId || isCreatingOutput}
                fullWidth
                size="lg"
                style={{
                  height: "60px",
                  fontSize: "1.1rem",
                  fontWeight: 500,
                }}
              >
                Create Output
              </Button>
            )}

            {isPolling && (
              <Group justify="center" style={{ minHeight: "100px" }}>
                <Loader size="lg" />
                <Text>Processing output...</Text>
              </Group>
            )}

            {hasError && (
              <Alert
                icon={<IconAlertCircle size="2rem" />}
                title="Error During Output"
                color="red"
                style={{
                  marginTop: "1rem",
                  textAlign: "center",
                }}
                styles={{
                  title: {
                    fontSize: "1.5rem",
                    fontWeight: 600,
                  },
                  message: {
                    fontSize: "1.1rem",
                  },
                }}
              >
                <Text size="lg" style={{ marginTop: "0.5rem" }}>
                  The output process encountered an error. Please check the
                  error details below and try again.
                </Text>
                {errors.errors.length > 0 && (
                  <Group
                    gap="md"
                    justify="center"
                    style={{ marginTop: "1rem" }}
                  >
                    <Button
                      onClick={downloadErrorsAsMarkdown}
                      leftSection={<IconDownload size={16} />}
                      variant="outline"
                      color="red"
                      size="sm"
                    >
                      Download Error Report
                    </Button>
                    <Button
                      onClick={downloadDocumentState}
                      leftSection={<IconFileText size={16} />}
                      variant="outline"
                      color="red"
                      size="sm"
                    >
                      Download Document State
                    </Button>
                  </Group>
                )}
              </Alert>
            )}

            {taskSucceeded && downloadUrl && (
              <Stack gap="md">
                <Text size="lg" style={{ textAlign: "center", color: "green" }}>
                  Task Succeeded
                </Text>
                <Button
                  onClick={handleDownload}
                  leftSection={<IconDownload size={20} />}
                  fullWidth
                  size="lg"
                  color="green"
                  style={{
                    height: "60px",
                    fontSize: "1.1rem",
                    fontWeight: 500,
                  }}
                >
                  Download Output
                </Button>
              </Stack>
            )}

            {errors.errors.length > 0 && (
              <Alert
                icon={<IconAlertCircle size="1rem" />}
                title="Output Errors"
                color="red"
                style={{ marginTop: "1rem" }}
              >
                <ScrollArea.Autosize mah={200}>
                  <Stack gap="sm">
                    {errors.errors.map((record, recordIndex) => (
                      <div key={recordIndex}>
                        <Text size="sm" fw={600}>
                          Record {record.RecordId}:
                        </Text>
                        <Stack gap="xs" style={{ marginLeft: "1rem" }}>
                          {record.ErrorList.map((error, errorIndex) => (
                            <Text key={errorIndex} size="sm">
                              • {error.Type}: {error.Details}
                            </Text>
                          ))}
                        </Stack>
                      </div>
                    ))}
                  </Stack>
                </ScrollArea.Autosize>
              </Alert>
            )}
          </>
        )}
      </Stack>
    </Modal>
  );
}
