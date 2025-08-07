import React from "react";
import {
  Stack,
  Text,
  Alert,
  SimpleGrid,
  Button,
  Group,
  Tooltip,
  ActionIcon,
} from "@mantine/core";
import {
  IconDownload,
  IconUpload,
  IconAlertCircle,
  IconFileDownload,
  IconFileUpload,
  IconSettings,
} from "@tabler/icons-react";

interface InitialScreenProps {
  error: string | null;
  onDownload: () => void;
  onUpload: () => void;
  onJsonDownload: () => void;
  onJsonUpload: () => void;
  onDefaultSettings: () => void;
}

export function InitialScreen({
  error,
  onDownload,
  onUpload,
  onJsonDownload,
  onJsonUpload,
  onDefaultSettings,
}: InitialScreenProps) {
  return (
    <Stack gap="xl">
      <Text size="md" style={{ textAlign: "center", marginBottom: "1rem" }}>
        Choose an action for document management.
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

      <SimpleGrid cols={2} spacing="xl" style={{ marginTop: "1rem" }}>
        <Button
          onClick={onDownload}
          color="blue"
          fullWidth
          size="lg"
          style={{
            height: "80px",
            fontSize: "1rem",
            fontWeight: 500,
          }}
        >
          <Group gap="md" style={{ flexDirection: "column" }}>
            <IconDownload size={28} />
            <span>Download</span>
          </Group>
        </Button>

        <Button
          onClick={onUpload}
          color="green"
          fullWidth
          size="lg"
          style={{
            height: "80px",
            fontSize: "1rem",
            fontWeight: 500,
          }}
        >
          <Group gap="md" style={{ flexDirection: "column" }}>
            <IconUpload size={28} />
            <span>Upload</span>
          </Group>
        </Button>
      </SimpleGrid>

      {/* Quick Actions */}
      <Stack gap="xs" mt="md">
        <Text size="sm" fw={500} c="dimmed">
          Quick Actions:
        </Text>
        <Group justify="space-between">
          <Group justify="flex-start">
            <Tooltip label="Download document JSON">
              <ActionIcon
                onClick={onJsonDownload}
                color="gray"
                variant="subtle"
                size="lg"
              >
                <IconFileDownload size={20} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label="Upload document JSON">
              <ActionIcon
                onClick={onJsonUpload}
                color="gray"
                variant="subtle"
                size="lg"
              >
                <IconFileUpload size={20} />
              </ActionIcon>
            </Tooltip>
          </Group>
          <Tooltip label="Default Settings">
            <ActionIcon
              onClick={onDefaultSettings}
              color="gray"
              variant="subtle"
              size="lg"
            >
              <IconSettings size={20} />
            </ActionIcon>
          </Tooltip>
        </Group>
      </Stack>
    </Stack>
  );
}
