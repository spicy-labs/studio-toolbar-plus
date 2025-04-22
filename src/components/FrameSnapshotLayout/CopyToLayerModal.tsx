import React, { useState, useEffect } from "react";
import { Modal, Text, Stack, Button, Select, Group } from "@mantine/core";
import { getAllLayouts } from "../../studio/layoutHandler";
import { appStore } from "../../modalStore";
import type { CopyToLayerModalProps } from "./types";

export function CopyToLayerModal({
  opened,
  onClose,
  snapshots,
  sourceLayoutId,
  frameLayoutMaps,
  onUpdateFrameLayoutMaps
}: CopyToLayerModalProps) {
  const [layouts, setLayouts] = useState<{ value: string; label: string }[]>([]);
  const [selectedLayoutId, setSelectedLayoutId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const raiseError = appStore(store => store.raiseError);

  // Load available layouts when modal opens
  useEffect(() => {
    if (opened) {
      loadAvailableLayouts();
    }
  }, [opened]);

  // Load available layouts from Studio
  const loadAvailableLayouts = async () => {
    try {
      const layoutsResult = await getAllLayouts(window.SDK);
      if (!layoutsResult.isOk()) {
        raiseError(
          new Error(layoutsResult.error?.message || "Failed to load layouts")
        );
        return;
      }

      // Filter out the source layout
      const filteredLayouts = layoutsResult.value
        .filter(layout => layout.id !== sourceLayoutId)
        .map(layout => ({
          value: layout.id,
          label: layout.name || "Unnamed Layout"
        }));

      setLayouts(filteredLayouts);

      // Set the first layout as default if available
      if (filteredLayouts.length > 0) {
        setSelectedLayoutId(filteredLayouts[0].value);
      }
    } catch (error) {
      raiseError(error instanceof Error ? error : new Error(String(error)));
    }
  };

  // Handle copying snapshots to selected layout
  const handleCopy = () => {
    if (!selectedLayoutId) {
      raiseError(new Error("No layout selected"));
      return;
    }

    setIsLoading(true);
    try {
      // Create a deep copy of the frameLayoutMaps to work with
      const updatedFrameLayoutMaps = [...frameLayoutMaps];

      // Find or create a frame layout map for the target layout
      let targetLayoutMap = updatedFrameLayoutMaps.find(map => map.layoutId === selectedLayoutId);

      if (!targetLayoutMap) {
        // Create a new layout map if it doesn't exist
        // Find the layout name from the layouts array
        const layoutName = layouts.find(l => l.value === selectedLayoutId)?.label || "Unknown Layout";

        targetLayoutMap = {
          layoutId: selectedLayoutId,
          layoutName,
          frameSnapshots: []
        };
        updatedFrameLayoutMaps.push(targetLayoutMap);
      }

      // Copy snapshots to the target layout
      for (const snapshot of snapshots) {
        // Generate a unique ID if not already present
        const uniqueId = snapshot.uniqueId || `${snapshot.frameId}_${snapshot.imageName}`;

        // Check if a snapshot with the same uniqueId already exists
        const existingIndex = targetLayoutMap.frameSnapshots.findIndex(
          s => s.id === uniqueId
        );

        if (existingIndex !== -1) {
          // Replace existing snapshot
          targetLayoutMap.frameSnapshots[existingIndex] = {
            frameId: snapshot.frameId,
            imageName: snapshot.imageName,
            x: snapshot.x,
            y: snapshot.y,
            width: snapshot.width,
            height: snapshot.height,
            id: uniqueId // Include the unique ID
          };
        } else {
          // Add new snapshot
          targetLayoutMap.frameSnapshots.push({
            frameId: snapshot.frameId,
            imageName: snapshot.imageName,
            x: snapshot.x,
            y: snapshot.y,
            width: snapshot.width,
            height: snapshot.height,
            id: uniqueId // Include the unique ID
          });
        }
      }

      // Update the frame layout maps in the parent component
      onUpdateFrameLayoutMaps(updatedFrameLayoutMaps);

      // Close modal on success
      onClose();
    } catch (error) {
      raiseError(error instanceof Error ? error : new Error(String(error)));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Copy to Layer"
      centered
    >
      <Stack>
        <Text size="sm">
          Select a layout to copy {snapshots.length} snapshot{snapshots.length !== 1 ? 's' : ''} to:
        </Text>

        <Select
          label="Target Layout"
          placeholder="Select a layout"
          data={layouts}
          value={selectedLayoutId}
          onChange={setSelectedLayoutId}
          searchable
          required
        />

        <Group justify="flex-end" mt="md">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleCopy}
            loading={isLoading}
            disabled={!selectedLayoutId}
          >
            Copy
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
