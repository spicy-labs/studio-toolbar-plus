import React, { useState } from "react";
import { Modal, Text, Stack, Button, Group, TextInput } from "@mantine/core";
import type { CopyAndAddRowModalProps } from "./types";

export function CopyAndAddRowModal({
  opened,
  onClose,
  snapshot,
  layoutId,
  existingSnapshots,
  onAddCopy
}: CopyAndAddRowModalProps) {
  const [newName, setNewName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Reset state when modal opens
  React.useEffect(() => {
    if (opened) {
      setNewName(snapshot.imageName);
      setError(null);
      setIsLoading(false);
    }
  }, [opened, snapshot]);

  // Handle name change
  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewName(e.target.value);
    setError(null);
  };

  // Handle create button click
  const handleCreate = () => {
    // Validate name is not empty
    if (!newName.trim()) {
      setError("Name cannot be empty");
      return;
    }

    // Check if name already exists in the snapshots
    const nameExists = existingSnapshots.some(s =>
      s.imageName === newName.trim()
    );

    if (nameExists) {
      setError("Name already exists");
      return;
    }

    setIsLoading(true);

    // Call the onAddCopy function with the new name
    onAddCopy(snapshot, newName.trim());

    // Close the modal
    setIsLoading(false);
    onClose();
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Copy and Add Row"
      centered
    >
      <Stack>
        <Text size="sm">
          Enter a name for the new snapshot:
        </Text>

        <TextInput
          label="Name"
          placeholder="Enter name"
          value={newName}
          onChange={handleNameChange}
          error={error}
          required
          autoFocus
        />

        <Group justify="flex-end" mt="md">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            loading={isLoading}
            disabled={!newName.trim()}
          >
            Create
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
