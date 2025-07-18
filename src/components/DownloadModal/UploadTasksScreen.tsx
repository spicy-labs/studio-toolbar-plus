import React, { useState } from "react";
import {
  Stack,
  Text,
  Alert,
  Checkbox,
  Button,
  Group,
} from "@mantine/core";
import { IconAlertCircle } from "@tabler/icons-react";

interface UploadTasksScreenProps {
  error: string | null;
  onBack: () => void;
  onContinue: () => void;
}

export function UploadTasksScreen({
  error,
  onBack,
  onContinue,
}: UploadTasksScreenProps) {
  const [dontShowAgain, setDontShowAgain] = useState(false);

  const handleContinue = () => {
    if (dontShowAgain) {
      localStorage.setItem("tempSlowUploadInstructions", "true");
    }
    onContinue();
  };

  return (
    <Stack gap="xl">
      <Text size="md" style={{ textAlign: "center", marginBottom: "1rem" }}>
        Upload Instructions
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

      <Text size="md" style={{ textAlign: "center" }}>
        Please choose the folder that contains your package.json.
      </Text>

      <Checkbox
        label="Don't show this message again"
        checked={dontShowAgain}
        onChange={(event) => setDontShowAgain(event.currentTarget.checked)}
      />

      <Group justify="space-between" mt="xl">
        <Button variant="default" onClick={onBack}>
          Back
        </Button>
        <Button onClick={handleContinue} color="green">
          Continue
        </Button>
      </Group>
    </Stack>
  );
}
