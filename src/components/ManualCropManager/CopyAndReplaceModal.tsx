import React, { useState, useEffect } from "react";
import {
  Modal,
  Text,
  Stack,
  Button,
  Group,
  TextInput,
  Alert,
} from "@mantine/core";
import type { ManualCrop } from "../../studio-adapter/manualCropTypes";

interface CopyAndReplaceModalProps {
  opened: boolean;
  onClose: () => void;
  crops: ManualCrop[];
  layoutId: string;
  existingCrops: ManualCrop[];
  onAddCopy: (crop: ManualCrop, newName: string) => void;
}

export function CopyAndReplaceModal({
  opened,
  onClose,
  crops,
  layoutId,
  existingCrops,
  onAddCopy,
}: CopyAndReplaceModalProps) {
  const [searchText, setSearchText] = useState("");
  const [replaceText, setReplaceText] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [previewCrop, setPreviewCrop] = useState<ManualCrop | null>(null);
  const [previewNewName, setPreviewNewName] = useState("");
  const [isPreviewNameDifferent, setIsPreviewNameDifferent] = useState(false);

  // Reset state when modal opens
  useEffect(() => {
    if (opened) {
      setSearchText("");
      setReplaceText("");
      setErrors({});
      setIsLoading(false);

      // Set the preview crop to the first selected crop
      if (crops.length > 0) {
        setPreviewCrop(crops[0]);
        setPreviewNewName(crops[0].name);
        setIsPreviewNameDifferent(false);
      }
    }
  }, [opened, crops]);

  // Update preview when search or replace text changes
  useEffect(() => {
    if (previewCrop) {
      const newName = previewCrop.name.replace(
        new RegExp(searchText, "g"),
        replaceText,
      );
      setPreviewNewName(newName);
      setIsPreviewNameDifferent(newName !== previewCrop.name);
    }
  }, [searchText, replaceText, previewCrop]);

  // Handle search text change
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchText(e.target.value);
    setErrors({});
  };

  // Handle replace text change
  const handleReplaceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setReplaceText(e.target.value);
    setErrors({});
  };

  // Handle create button click
  const handleCopyAndReplace = () => {
    // Validate inputs
    if (!searchText.trim()) {
      setErrors({ searchText: "Search text cannot be empty" });
      return;
    }

    setIsLoading(true);
    const newErrors: Record<string, string> = {};
    let hasErrors = false;

    // Process each crop
    crops.forEach((crop) => {
      const newName = crop.name.replace(
        new RegExp(searchText, "g"),
        replaceText,
      );

      // Skip if name didn't change
      if (newName === crop.name) {
        return;
      }

      // Check if name already exists in the existing crops for the same frame
      const nameExists = existingCrops.some(
        (c) => c.frameId === crop.frameId && c.name === newName,
      );

      if (nameExists) {
        newErrors[`${crop.frameId}-${crop.name}`] =
          `Name "${newName}" already exists for frame ${crop.frameName}`;
        hasErrors = true;
      }
    });

    if (hasErrors) {
      setErrors(newErrors);
      setIsLoading(false);
      return;
    }

    // Create copies with new names
    crops.forEach((crop) => {
      const newName = crop.name.replace(
        new RegExp(searchText, "g"),
        replaceText,
      );

      // Skip if name didn't change
      if (newName === crop.name) {
        return;
      }

      // Call the onAddCopy function with the new name
      onAddCopy(crop, newName);
    });

    // Close the modal
    setIsLoading(false);
    onClose();
  };

  return (
    <Modal opened={opened} onClose={onClose} title="Copy and Replace" centered>
      <Stack>
        <Text size="sm">
          Enter search and replace text to create copies with modified names:
        </Text>

        <TextInput
          label="Search"
          placeholder="Text to search for"
          value={searchText}
          onChange={handleSearchChange}
          error={errors.searchText}
          required
          autoFocus
        />

        <TextInput
          label="Replace"
          placeholder="Text to replace with"
          value={replaceText}
          onChange={handleReplaceChange}
          required
        />

        {/* Preview section */}
        {previewCrop && (
          <Stack gap="xs">
            <Text size="sm" fw={500}>
              Preview:
            </Text>
            <Text size="sm" c="dimmed">
              Frame: {previewCrop.frameName}
            </Text>
            <Text size="sm">
              Original:{" "}
              <Text span c="blue">
                {previewCrop.name}
              </Text>
            </Text>
            <Text size="sm">
              New:{" "}
              <Text span c={isPreviewNameDifferent ? "green" : "dimmed"}>
                {previewNewName}
              </Text>
            </Text>
          </Stack>
        )}

        {/* Error messages */}
        {Object.keys(errors).length > 0 && (
          <Alert color="red" title="Validation Errors">
            <Stack gap="xs">
              {Object.entries(errors).map(([key, message]) => (
                <Text key={key} size="sm">
                  {message}
                </Text>
              ))}
            </Stack>
          </Alert>
        )}

        <Group justify="flex-end" mt="md">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleCopyAndReplace}
            loading={isLoading}
            disabled={!searchText.trim() || !isPreviewNameDifferent}
          >
            Copy and Replace
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
