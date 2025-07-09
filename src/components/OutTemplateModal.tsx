import { useState, useEffect, useRef } from "react";
import {
  Modal,
  Text,
  Stack,
  Group,
  Button,
  Loader,
  Grid,
  MultiSelect,
  Card,
  ActionIcon,
} from "@mantine/core";
import { appStore } from "../modalStore";
import { getStudio } from "../studio/studioAdapter";
import { getAllLayouts, getSelected } from "../studio/layoutHandler";
import { getAllVariables } from "../studio/variableHandler";
import { getCurrentDocumentState } from "../studio/documentHandler";
import { csv2json, json2csv } from "json-2-csv";
import JSZip from "jszip";
import {
  IconDownload,
  IconAlertTriangle,
  IconLoader,
} from "@tabler/icons-react";

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

interface OutputTask {
  id: string;
  outputSettingsId: string;
  outputSettingName: string;
  outputSettingType: string;
  layoutName: string;
  layoutId: string;
  status: "loading" | "success" | "error";
  downloadUrl?: string;
  errorMessage?: string;
  taskInfoUrl?: string;
}

export function OutTemplateModal({ opened, onClose }: OutTemplateModalProps) {
  const raiseError = appStore((store) => store.raiseError);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(true);
  const [outputSettings, setOutputSettings] = useState<OutputSetting[]>([]);
  const [selectedOutputIds, setSelectedOutputIds] = useState<string[]>([]);
  const [layouts, setLayouts] = useState<{ value: string; label: string }[]>(
    [],
  );
  const [selectedLayoutIds, setSelectedLayoutIds] = useState<string[]>([]);
  const [isCreatingOutput, setIsCreatingOutput] = useState(false);
  const [variableData, setVariableData] = useState<any>(null);
  const [outputTasks, setOutputTasks] = useState<OutputTask[]>([]);

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

  // Helper function to load selected outputs from localStorage
  const loadSelectedOutputs = (): string[] => {
    const environmentId = getEnvironmentId();
    if (!environmentId) return [];
    const storageKey = `tempOutTemplate_selectedOutputIds_${environmentId}`;
    const saved = localStorage.getItem(storageKey);
    return saved ? JSON.parse(saved) : [];
  };

  // Helper function to save selected outputs to localStorage
  const saveSelectedOutputs = (outputIds: string[]) => {
    const environmentId = getEnvironmentId();
    if (!environmentId) return;
    const storageKey = `tempOutTemplate_selectedOutputIds_${environmentId}`;
    localStorage.setItem(storageKey, JSON.stringify(outputIds));
  };

  // Reset state when modal opens
  useEffect(() => {
    if (opened) {
      setLoading(true);
      setOutputSettings([]);
      setSelectedOutputIds([]);
      setLayouts([]);
      setSelectedLayoutIds([]);
      setIsCreatingOutput(false);
      setVariableData(null);
      setOutputTasks([]);
      fetchOutputSettings();
      fetchLayouts();
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

      // Load previously selected outputs from localStorage
      const savedOutputIds = loadSelectedOutputs();
      setSelectedOutputIds(savedOutputIds);
    } catch (error) {
      raiseError(error instanceof Error ? error : new Error(String(error)));
    } finally {
      setLoading(false);
    }
  };

  const fetchLayouts = async () => {
    try {
      const studioResult = await getStudio();
      if (!studioResult.isOk()) {
        raiseError(
          new Error(studioResult.error?.message || "Failed to get studio"),
        );
        return;
      }

      // Get all layouts
      const layoutsResult = await getAllLayouts(studioResult.value);
      if (!layoutsResult.isOk()) {
        raiseError(
          new Error(layoutsResult.error?.message || "Failed to get layouts"),
        );
        return;
      }

      // Filter available layouts and transform to select format
      const availableLayouts = layoutsResult.value
        .filter((layout: any) => layout.available !== false)
        .map((layout: any) => ({
          value: layout.id,
          label: layout.name || "Unnamed Layout",
        }));

      setLayouts(availableLayouts);

      // Get currently selected layout and set as default
      const selectedResult = await getSelected(studioResult.value);
      selectedResult.onSuccess((selectedLayout) => {
        setSelectedLayoutIds([selectedLayout.id]);
      });
      selectedResult.onFailure((error) => {
        raiseError(
          new Error(
            error instanceof Error
              ? error.message
              : "Failed to get selected layout",
          ),
        );
      });
    } catch (error) {
      raiseError(error instanceof Error ? error : new Error(String(error)));
    }
  };

  const handleAttachVariableSheet = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const content = e.target?.result as string;

        try {
          let jsonData: any;

          if (file.name.toLowerCase().endsWith(".csv")) {
            // Convert CSV to JSON
            jsonData = csv2json(content);
          } else {
            // Parse JSON directly
            jsonData = JSON.parse(content);
          }

          setVariableData(jsonData);
          raiseError(
            new Error(`Variable sheet loaded successfully: ${file.name}`),
          );
        } catch (parseError) {
          raiseError(
            new Error(
              `Failed to parse file: ${parseError instanceof Error ? parseError.message : String(parseError)}`,
            ),
          );
        }
      };

      reader.readAsText(file);
    } catch (error) {
      raiseError(error instanceof Error ? error : new Error(String(error)));
    }

    // Reset the input value so the same file can be selected again
    if (event.target) {
      event.target.value = "";
    }
  };

  const handleDownloadVariableJSON = async () => {
    try {
      const studioResult = await getStudio();
      if (!studioResult.isOk()) {
        raiseError(
          new Error(studioResult.error?.message || "Failed to get studio"),
        );
        return;
      }

      // Get all variables
      const variablesResult = await getAllVariables(studioResult.value);
      if (!variablesResult.isOk()) {
        raiseError(
          new Error(
            variablesResult.error?.message || "Failed to get variables",
          ),
        );
        return;
      }

      // Transform variables to the required format
      const variableData = variablesResult.value.map((variable: any) => {
        let value = variable.value;

        // Handle ListVariable - use selected value
        if (variable.type === "list" && variable.selected !== undefined) {
          value = variable.selected;
        }

        return {
          [variable.name]: value,
        };
      });

      // Create and download the JSON file
      const jsonString = JSON.stringify(variableData, null, 2);
      const blob = new Blob([jsonString], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `variables-${new Date().toISOString().split("T")[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      raiseError(error instanceof Error ? error : new Error(String(error)));
    }
  };

  const handleDownloadVariableCSV = async () => {
    try {
      const studioResult = await getStudio();
      if (!studioResult.isOk()) {
        raiseError(
          new Error(studioResult.error?.message || "Failed to get studio"),
        );
        return;
      }

      // Get all variables
      const variablesResult = await getAllVariables(studioResult.value);
      if (!variablesResult.isOk()) {
        raiseError(
          new Error(
            variablesResult.error?.message || "Failed to get variables",
          ),
        );
        return;
      }

      // Transform variables to a single object with variable names as keys
      const variableObject: Record<string, any> = {};
      variablesResult.value.forEach((variable: any) => {
        let value = variable.value;

        // Handle ListVariable - use selected value
        if (variable.type === "list" && variable.selected !== undefined) {
          value = variable.selected;
        }

        variableObject[variable.name] = value;
      });

      // Convert to CSV
      const csvData = json2csv([variableObject]);

      // Create and download the CSV file
      const blob = new Blob([csvData], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `variables-${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      raiseError(error instanceof Error ? error : new Error(String(error)));
    }
  };

  const handleCreateOutput = async () => {
    if (selectedOutputIds.length === 0 || selectedLayoutIds.length === 0) {
      raiseError(
        new Error("Please select at least one output setting and one layout"),
      );
      return;
    }

    setIsCreatingOutput(true);

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

      const documentJson = documentResult.value as any;

      // Get engine version from document JSON
      const engineVersion = documentJson.engineVersion;
      if (!engineVersion) {
        raiseError(new Error("Engine version not found in document"));
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

      // Create tasks for each combination of output setting and layout
      const newTasks: OutputTask[] = [];

      for (const outputId of selectedOutputIds) {
        const outputSetting = outputSettings.find((s) => s.id === outputId);
        if (!outputSetting) continue;

        for (const layoutId of selectedLayoutIds) {
          const layout = layouts.find((l) => l.value === layoutId);
          if (!layout) continue;

          const taskId = `${outputId}-${layoutId}-${Date.now()}`;
          const task: OutputTask = {
            id: taskId,
            outputSettingsId: outputId,
            outputSettingName: outputSetting.name,
            outputSettingType: outputSetting.type,
            layoutName: layout.label,
            layoutId: layoutId,
            status: "loading",
          };

          newTasks.push(task);
        }
      }

      setOutputTasks(newTasks);

      // Start processing each task
      for (const task of newTasks) {
        processOutputTask(task, documentJson, engineVersion, token, baseUrl);
      }
    } catch (error) {
      raiseError(error instanceof Error ? error : new Error(String(error)));
    } finally {
      setIsCreatingOutput(false);
    }
  };

  const processOutputTask = async (
    task: OutputTask,
    documentJson: any,
    engineVersion: string,
    token: string,
    baseUrl: string,
  ) => {
    try {
      // Determine the endpoint based on setting type
      const endpointMap: Record<string, string> = {
        JPG: "output/jpg",
        PNG: "output/png",
        PDF: "output/pdf",
        GIF: "output/gif",
        MP4: "output/mp4",
      };

      const endpoint = endpointMap[task.outputSettingType];
      if (!endpoint) {
        updateTaskStatus(
          task.id,
          "error",
          undefined,
          `Unsupported output type: ${task.outputSettingType}`,
        );
        return;
      }

      // Create the request body
      const requestBody: any = {
        documentContent: documentJson,
        layoutsToExport: [task.layoutId],
        outputSettingsId: task.outputSettingsId, // Extract output setting ID
        engineVersion: engineVersion,
      };

      // Add variables if available
      if (variableData) {
        requestBody.variables = variableData;
      }

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
          const errorResponse = await outputResponse.json();
          updateTaskStatus(
            task.id,
            "error",
            undefined,
            errorResponse.detail || "Output creation failed",
          );
        } else {
          updateTaskStatus(
            task.id,
            "error",
            undefined,
            `Output creation failed: ${outputResponse.statusText}`,
          );
        }
        return;
      }

      const taskResponse = await outputResponse.json();

      // Update task with taskInfo URL and start polling
      updateTaskStatus(
        task.id,
        "loading",
        undefined,
        undefined,
        taskResponse.links.taskInfo,
      );
      pollTaskStatus(task.id, taskResponse.links.taskInfo, token);
    } catch (error) {
      updateTaskStatus(
        task.id,
        "error",
        undefined,
        error instanceof Error ? error.message : String(error),
      );
    }
  };

  const updateTaskStatus = (
    taskId: string,
    status: "loading" | "success" | "error",
    downloadUrl?: string,
    errorMessage?: string,
    taskInfoUrl?: string,
  ) => {
    setOutputTasks((prev) =>
      prev.map((task) =>
        task.id === taskId
          ? { ...task, status, downloadUrl, errorMessage, taskInfoUrl }
          : task,
      ),
    );
  };

  const pollTaskStatus = async (
    taskId: string,
    taskInfoUrl: string,
    token: string,
  ) => {
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
          const taskInfo = await response.json();
          if (taskInfo.links?.download) {
            updateTaskStatus(taskId, "success", taskInfo.links.download);
          } else {
            updateTaskStatus(
              taskId,
              "error",
              undefined,
              "Task completed but no download link available",
            );
          }
        } else if (response.status === 500) {
          const errorResponse = await response.json();
          updateTaskStatus(
            taskId,
            "error",
            undefined,
            errorResponse.detail || "Task failed",
          );
        } else {
          updateTaskStatus(
            taskId,
            "error",
            undefined,
            `Task polling failed: ${response.statusText}`,
          );
        }
      } catch (error) {
        updateTaskStatus(
          taskId,
          "error",
          undefined,
          error instanceof Error ? error.message : String(error),
        );
      }
    };

    poll();
  };

  const handleTaskDownload = async (task: OutputTask) => {
    if (!task.downloadUrl) return;

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
      const response = await fetch(task.downloadUrl, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Download failed: ${response.statusText}`);
      }

      // Get the filename from the Content-Disposition header or create one
      const contentDisposition = response.headers.get("Content-Disposition");
      let filename = `${task.outputSettingName}-${task.layoutName}.${task.outputSettingType.toLowerCase()}`;

      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(
          /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/,
        );
        if (filenameMatch && filenameMatch[1]) {
          filename = filenameMatch[1].replace(/['"]/g, "");
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

  const generateErrorReport = async (task: OutputTask): Promise<string> => {
    let additionalErrorDetails = "";

    // Check if error message contains an error report URL
    if (task.errorMessage && task.errorMessage.includes("Error report: ")) {
      try {
        const errorReportUrl = task.errorMessage.split("Error report: ")[1];

        // Get studio and token for authorization
        const studioResult = await getStudio();
        if (studioResult.isOk()) {
          const token = (
            await studioResult.value.configuration.getValue("GRAFX_AUTH_TOKEN")
          ).parsedData;

          if (token) {
            const response = await fetch(errorReportUrl, {
              headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
              },
            });

            if (response.ok) {
              const errorDetails = await response.text();
              additionalErrorDetails = `\n\n## Detailed Error Report\n\`\`\`\n${errorDetails}\n\`\`\``;
            }
          }
        }
      } catch (error) {
        // If fetching additional details fails, continue with basic report
        console.warn("Failed to fetch additional error details:", error);
      }
    }

    return (
      `# Error Report for ${task.outputSettingName} - ${task.layoutName}\n\n` +
      `**Task ID:** ${task.id}\n` +
      `**Output Setting:** ${task.outputSettingName}\n` +
      `**Output Type:** ${task.outputSettingType}\n` +
      `**Layout:** ${task.layoutName}\n` +
      `**Layout ID:** ${task.layoutId}\n` +
      `**Error Message:** ${task.errorMessage || "Unknown error"}\n` +
      `**Task Info URL:** ${task.taskInfoUrl || "Not available"}\n` +
      `**Generated:** ${new Date().toLocaleString()}\n\n` +
      `## Additional Details\n` +
      `This error occurred during the output generation process. ` +
      `Please review the error message above and check your template configuration.\n\n` +
      `If the issue persists, please contact support with this error report.` +
      additionalErrorDetails
    );
  };

  const handleErrorReportDownload = async (task: OutputTask) => {
    if (task.status !== "error") {
      raiseError(new Error("Task is not in error state"));
      return;
    }

    try {
      const errorReport = await generateErrorReport(task);

      // Create and download the error report file
      const blob = new Blob([errorReport], { type: "text/markdown" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `error-report-${task.outputSettingName}-${task.layoutName}-${new Date().toISOString().split("T")[0]}.md`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      raiseError(error instanceof Error ? error : new Error(String(error)));
    }
  };

  const handleDownloadAllErrors = async () => {
    const errorTasks = outputTasks.filter((task) => task.status === "error");
    if (errorTasks.length === 0) return;

    try {
      const zip = new JSZip();

      // Generate error reports for all tasks using the shared function
      for (let index = 0; index < errorTasks.length; index++) {
        const task = errorTasks[index];
        const errorReport = await generateErrorReport(task);
        zip.file(`error-report-${index + 1}.md`, errorReport);
      }

      const zipBlob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(zipBlob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `output-errors-${new Date().toISOString().split("T")[0]}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      raiseError(error instanceof Error ? error : new Error(String(error)));
    }
  };

  const handleDownloadDocumentState = async () => {
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

  const hasErrors = outputTasks.some((task) => task.status === "error");
  const allTasksComplete =
    outputTasks.length > 0 &&
    outputTasks.every((task) => task.status !== "loading");
  const hasTasksProcessing = outputTasks.some(
    (task) => task.status === "loading",
  );

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      withCloseButton={false}
      centered
      size="75%"
      styles={{
        content: {
          minHeight: "600px",
        },
        body: {
          padding: "2rem",
        },
      }}
    >
      {loading ? (
        <Group justify="center" style={{ minHeight: "400px" }}>
          <Loader size="lg" />
          <Text>Loading output settings...</Text>
        </Group>
      ) : (
        <Grid>
          {/* Output Settings */}
          <Grid.Col span={6}>
            <Stack gap="md">
              <Text size="xl" fw={600}>
                Output Settings
              </Text>
              <Text c="dimmed">
                Pick your output settings to output the template.
              </Text>

              {hasTasksProcessing ? (
                <Group justify="center" style={{ minHeight: "300px" }}>
                  <Loader size="lg" />
                  <Text>Tasks Processing</Text>
                </Group>
              ) : (
                <>
                  {/* Output Settings MultiSelect */}
                  <MultiSelect
                    label="Output Settings"
                    placeholder="Select output settings"
                    data={outputSettings.map((setting) => ({
                      value: setting.id,
                      label: setting.name,
                    }))}
                    value={selectedOutputIds}
                    onChange={(values) => {
                      setSelectedOutputIds(values);
                      saveSelectedOutputs(values);
                    }}
                  />

                  {/* Selected Layouts MultiSelect */}
                  <MultiSelect
                    label="Selected Layouts"
                    placeholder="Select layouts"
                    data={layouts}
                    value={selectedLayoutIds}
                    onChange={setSelectedLayoutIds}
                  />

                  {/* Action Buttons */}
                  <Stack gap="sm">
                    {/* <Group gap="sm">
                      <Button
                        variant="default"
                        color="gray"
                        size="sm"
                        onClick={handleAttachVariableSheet}
                      >
                        Attach Variable Sheet (JSON, CSV)
                      </Button>
                      <Button
                        variant="default"
                        color="gray"
                        size="sm"
                        onClick={handleDownloadVariableJSON}
                      >
                        Download Variable JSON
                      </Button>
                      <Button
                        variant="default"
                        color="gray"
                        size="sm"
                        onClick={handleDownloadVariableCSV}
                      >
                        Download Variable CSV
                      </Button>
                    </Group> */}

                    <Button
                      size="lg"
                      disabled={
                        selectedOutputIds.length === 0 ||
                        selectedLayoutIds.length === 0
                      }
                      loading={isCreatingOutput}
                      onClick={handleCreateOutput}
                      style={{
                        height: "60px",
                        fontSize: "1.1rem",
                        fontWeight: 500,
                      }}
                    >
                      Create Output
                    </Button>
                  </Stack>
                </>
              )}
            </Stack>
          </Grid.Col>
          {/* Output Tasks */}
          <Grid.Col span={6}>
            <Stack gap="md">
              <Text size="xl" fw={600}>
                Output Tasks
              </Text>
              {isCreatingOutput && (
                <Group justify="center" style={{ minHeight: "100px" }}>
                  <Loader size="lg" />
                  <Text>Creating Output...</Text>
                </Group>
              )}
              {outputTasks.length === 0 && !isCreatingOutput ? (
                <Text c="dimmed">No tasks created yet</Text>
              ) : (
                <Stack gap="sm">
                  {outputTasks.map((task) => (
                    <Card key={task.id} withBorder padding="sm">
                      <Group justify="space-between" align="center">
                        <Stack gap={4} style={{ flex: 1 }}>
                          <Text size="sm" fw={500}>
                            {task.outputSettingType} - {task.layoutName}
                          </Text>
                          <Text size="xs" c="dimmed">
                            {task.outputSettingName}
                          </Text>
                        </Stack>

                        {task.status === "loading" && (
                          <ActionIcon size="lg" variant="light" loading>
                            <IconLoader size={16} />
                          </ActionIcon>
                        )}

                        {task.status === "success" && (
                          <Button
                            size="sm"
                            variant="light"
                            color="green"
                            onClick={() => handleTaskDownload(task)}
                            leftSection={<IconDownload size={16} />}
                          >
                            Download File
                          </Button>
                        )}

                        {task.status === "error" && (
                          <Button
                            size="sm"
                            variant="light"
                            color="red"
                            title={task.errorMessage}
                            onClick={() => handleErrorReportDownload(task)}
                            leftSection={<IconAlertTriangle size={16} />}
                          >
                            Download Report
                          </Button>
                        )}
                      </Group>
                    </Card>
                  ))}

                  {/* Error handling buttons */}
                  {hasErrors && (
                    <Group gap="sm" style={{ marginTop: "1rem" }}>
                      <Button
                        variant="outline"
                        color="red"
                        size="sm"
                        onClick={handleDownloadAllErrors}
                      >
                        Download All Error Reports
                      </Button>
                      <Button
                        variant="outline"
                        color="gray"
                        size="sm"
                        onClick={handleDownloadDocumentState}
                      >
                        Download Document State
                      </Button>
                    </Group>
                  )}

                  {/* All tasks complete message */}
                  {allTasksComplete && (
                    <Group justify="center" style={{ marginTop: "1rem" }}>
                      <Text size="lg" c="green" fw={500}>
                        All tasks completed
                      </Text>
                      <Button onClick={onClose}>Close Modal</Button>
                    </Group>
                  )}
                </Stack>
              )}
            </Stack>
          </Grid.Col>
        </Grid>
      )}

      {/* Hidden file input for variable sheet upload */}
      <input
        type="file"
        ref={fileInputRef}
        style={{ display: "none" }}
        accept=".json,.csv"
        onChange={handleFileChange}
      />
    </Modal>
  );
}
