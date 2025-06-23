import React, { useState } from "react";
import { Modal, Text, Stack, Button, Group, TextInput } from "@mantine/core";
import type { ManualCrop } from "../../studio-adapter/manualCropTypes";

interface CopyAndAddRowModalProps {
  opened: boolean;
  onClose: () => void;
  crop: ManualCrop;
  layoutId: string;
  existingCrops: ManualCrop[];
  onAddCopy: (crop: ManualCrop, newName: string) => void;
}

export function CopyAndAddRowModal({
  opened,
  onClose,
  crop,
  layoutId,
  existingCrops,
  onAddCopy,
}: CopyAndAddRowModalProps) {
  const [newName, setNewName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Reset state when modal opens
  React.useEffect(() => {
    if (opened) {
      setNewName(crop.name);
      setError(null);
      setIsLoading(false);
    }
  }, [opened, crop]);

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

    // Check if name already exists in the crops for the same frame
    const nameExists = existingCrops.some(
      (c) => c.frameId === crop.frameId && c.name === newName.trim()
    );

    if (nameExists) {
      setError("Name already exists for this frame");
      return;
    }

    setIsLoading(true);

    // Call the onAddCopy function with the new name
    onAddCopy(crop, newName.trim());

    // Close the modal
    setIsLoading(false);
    onClose();
  };

  return (
    <Modal opened={opened} onClose={onClose} title="Copy and Add Row" centered>
      <Stack>
        <Text size="sm">Enter a name for the new manual crop:</Text>

        <TextInput
          label="Asset Name"
          placeholder="Enter asset name"
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
