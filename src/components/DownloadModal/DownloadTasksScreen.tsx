import React from "react";
import {
  Stack,
  Text,
  List,
  Loader,
  Tooltip,
  Button,
  Group,
} from "@mantine/core";
import {
  IconCircleCheckFilled,
  IconInfoCircleFilled,
  IconExclamationCircle,
  IconLoader,
} from "@tabler/icons-react";

interface DownloadFile {
  id: string;
  name: string;
  status: "pending" | "downloading" | "complete" | "error";
  error?: string;
}

interface TaskItem {
  id: string;
  name: string;
  type:
    | "download"
    | "query_folder"
    | "get_vision"
    | "smart_crops"
    | "package_processing"
    | "font_upload"
    | "smart_crop_upload"
    | "document_load";
  status: "pending" | "processing" | "complete" | "error" | "info";
  error?: string;
  tooltip?: string;
}

interface DownloadTasksScreenProps {
  downloadFiles: DownloadFile[];
  tasks: TaskItem[];
  uploadTasks: TaskItem[];
  onClose: () => void;
}

export function DownloadTasksScreen({
  downloadFiles,
  tasks,
  uploadTasks,
  onClose,
}: DownloadTasksScreenProps) {
  // Combine download files, tasks, and upload tasks for display
  const allTasks = [
    ...downloadFiles.map((file) => ({
      id: file.id,
      name: `Downloading: ${file.name}`,
      type: "download" as const,
      status:
        file.status === "downloading" ? ("processing" as const) : file.status,
      error: file.error,
    })),
    ...tasks,
    ...uploadTasks,
  ];

  const allComplete = allTasks.every(
    (task) =>
      task.status === "complete" ||
      task.status === "error" ||
      task.status === "info"
  );

  return (
    <Stack gap="xl">
      <Text size="md" style={{ textAlign: "center", marginBottom: "1rem" }}>
        Processing Tasks
      </Text>
      <Group justify="center" mt="xl">
        <Button
          onClick={onClose}
          color="blue"
          disabled={!allComplete}
          leftSection={!allComplete ? <IconLoader size={16} /> : undefined}
        >
          Done
        </Button>
      </Group>
      <List spacing="md" size="sm">
        {allTasks.map((task) => (
          <List.Item
            key={task.id}
            icon={
              task.status === "pending" || task.status === "processing" ? (
                <Loader size="sm" />
              ) : task.status === "complete" ? (
                <Tooltip label="Successfully completed">
                  <IconCircleCheckFilled size={20} color="green" />
                </Tooltip>
              ) : task.status === "info" ? (
                <Tooltip label={task.tooltip || "Information"}>
                  <IconInfoCircleFilled size={20} color="blue" />
                </Tooltip>
              ) : (
                <Tooltip label={task.error || "Task failed"}>
                  <IconExclamationCircle size={20} color="red" />
                </Tooltip>
              )
            }
          >
            <Text size="sm">{task.name}</Text>
          </List.Item>
        ))}
      </List>
    </Stack>
  );
}
