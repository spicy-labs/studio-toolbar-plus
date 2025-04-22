import React, { useState, useEffect } from "react";
import { Modal, Text, Stack, Button, Group, TextInput, Alert } from "@mantine/core";
import type { CopyAndReplaceModalProps, EnhancedFrameSnapshot } from "./types";

export function CopyAndReplaceModal({
  opened,
  onClose,
  snapshots,
  layoutId,
  existingSnapshots,
  onAddCopy
}: CopyAndReplaceModalProps) {
  const [searchText, setSearchText] = useState("");
  const [replaceText, setReplaceText] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [previewSnapshot, setPreviewSnapshot] = useState<EnhancedFrameSnapshot | null>(null);
  const [previewNewName, setPreviewNewName] = useState("");
  const [isPreviewNameDifferent, setIsPreviewNameDifferent] = useState(false);

  // Reset state when modal opens
  useEffect(() => {
    if (opened) {
      setSearchText("");
      setReplaceText("");
      setErrors({});
      setIsLoading(false);

      // Set the preview snapshot to the first selected snapshot
      if (snapshots.length > 0) {
        setPreviewSnapshot(snapshots[0]);
        setPreviewNewName(snapshots[0].imageName);
        setIsPreviewNameDifferent(false);
      }
    }
  }, [opened, snapshots]);

  // Update preview when search or replace text changes
  useEffect(() => {
    if (previewSnapshot) {
      const newName = previewSnapshot.imageName.replace(new RegExp(searchText, 'g'), replaceText);
      setPreviewNewName(newName);
      setIsPreviewNameDifferent(newName !== previewSnapshot.imageName);
    }
  }, [searchText, replaceText, previewSnapshot]);

  // Handle search text change
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchText(e.target.value);
  };

  // Handle replace text change
  const handleReplaceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setReplaceText(e.target.value);
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

    // Process each snapshot
    snapshots.forEach(snapshot => {
      const newName = snapshot.imageName.replace(new RegExp(searchText, 'g'), replaceText);

      // Skip if name didn't change
      if (newName === snapshot.imageName) {
        return;
      }

      // Check if name already exists in the snapshots
      const nameExists = existingSnapshots.some(s => s.imageName === newName);

      if (nameExists) {
        newErrors[snapshot.uniqueId] = `Name "${newName}" already exists`;
        hasErrors = true;
      }
    });

    if (hasErrors) {
      setErrors(newErrors);
      setIsLoading(false);
      return;
    }

    // Create copies with new names
    snapshots.forEach(snapshot => {
      const newName = snapshot.imageName.replace(new RegExp(searchText, 'g'), replaceText);

      // Skip if name didn't change
      if (newName === snapshot.imageName) {
        return;
      }

      // Call the onAddCopy function with the new name
      onAddCopy(snapshot, newName);
    });

    // Close the modal
    setIsLoading(false);
    onClose();
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Copy and Replace"
      centered
    >
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

        {previewSnapshot && (
          <Alert
            color={isPreviewNameDifferent ? "green" : "red"}
            title="Name Preview"
          >
            <Text size="sm">Original: {previewSnapshot.imageName}</Text>
            <Text size="sm">New: {previewNewName}</Text>
            <Text size="sm" fw={700}>
              Is name different: {isPreviewNameDifferent ? "Yes" : "No"}
            </Text>
          </Alert>
        )}

        {Object.keys(errors).length > 0 && Object.keys(errors).some(key => key !== 'searchText') && (
          <Alert color="red" title="Validation Errors">
            {Object.entries(errors)
              .filter(([key]) => key !== 'searchText')
              .map(([key, error]) => (
                <Text key={key} size="sm">{error}</Text>
              ))}
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
