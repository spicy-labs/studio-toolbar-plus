import React, { useEffect, useState, useMemo, useCallback } from "react";
import {
  Modal,
  Text,
  Group,
  Stack,
  ScrollArea,
  Button,
  Loader,
  Center,
  Switch,
} from "@mantine/core";
import { IconSortAscendingLetters } from "@tabler/icons-react";
import {
  loadFrameLayoutMapsFromDoc,
  saveImageSizingMappingToAction,
  saveFrameLayoutMapsToDoc
} from "../../studio/studioAdapter";
import { getAllLayouts } from "../../studio/layoutHandler";
import { appStore } from "../../modalStore";
import { FrameLayoutCard } from "./FrameLayoutCard";
import type { FrameSnapshotLayoutModalProps, EnhancedFrameLayoutMap } from "./types";
import type { FrameLayoutMap } from "../../types/toolbarEnvelope";

export function FrameSnapshotLayoutModal({
  opened,
  onClose,
}: FrameSnapshotLayoutModalProps) {
  const [frameLayoutMaps, setFrameLayoutMaps] = useState<EnhancedFrameLayoutMap[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  // We removed the editState since it's now managed at the row level
  const raiseError = appStore(store => store.raiseError);

  // Memoize the table data structure
  const tableData = useMemo(() => {
    return frameLayoutMaps.map((frameLayoutMap, layoutIndex) => {
      // Get snapshots and generate unique IDs
      let snapshots = frameLayoutMap.frameSnapshots.map((snapshot, snapshotIndex) => {
        // Generate a unique ID from frameId and imageName if not already present
        const uniqueId =  `${snapshot.frameId}_${snapshot.imageName}`;
        return {
          ...snapshot,
          uniqueId,
        };
      });


      // Sort snapshots alphabetically by imageName if enabled
      snapshots = [...snapshots].sort((a, b) =>
        a.imageName.localeCompare(b.imageName)
      );

      return {
        layoutId: frameLayoutMap.layoutId,
        layoutName: frameLayoutMap.layoutName,
        snapshots
      };
    });
  }, [frameLayoutMaps]);

  const sortAlphabetically = (maps: EnhancedFrameLayoutMap[]) => {
    return maps.map(map => {
      map.frameSnapshots = [...map.frameSnapshots].sort((a, b) =>
          a.imageName.localeCompare(b.imageName)
        );
      } 
    );
}

// Handle editing a cell
const handleEditCell = useCallback((layoutId:string, key: string, value: string | number) => {
  if (!key) return;

  const [uniqueId, field] = key.split(':');

  setFrameLayoutMaps(prev => {
    const next = [...prev];
    const frameSnapshot = next.find(map => map.layoutId === layoutId)?.frameSnapshots.find(s => s.uniqueId === uniqueId);

    if (!frameSnapshot) return prev;

    if (field === 'imageName') {
      // Check if name already exist on a frameSnapshot
      const nameExists = next.some(map => map.frameSnapshots.some(s => s.imageName === value && s.uniqueId !== uniqueId));
      if (nameExists) return prev;
      const stringValue = String(value).trim();
      // Check if stringValue is empty
      if (stringValue === '') return prev;
      frameSnapshot.imageName = String(value);
    } else {
      frameSnapshot[field as 'x' | 'y' | 'width' | 'height'] = Number(value);
    }

    return next;
  });
}, []);

const loadFrameLayouts = async () => {
  setIsLoading(true);
  try {
    // Load frame layout maps
    const frameLayoutsResult = await loadFrameLayoutMapsFromDoc();
    if (!frameLayoutsResult.isOk()) {
      raiseError(
        new Error(frameLayoutsResult.error?.message || "Failed to load frame layouts")
      );
      return;
    }

    // Get all layouts to find layout names
    const layoutsResult = await getAllLayouts(window.SDK);
    if (!layoutsResult.isOk()) {
      raiseError(
        new Error(layoutsResult.error?.message || "Failed to load layouts")
      );
      return;
    }

    // Create a map of layout IDs to layout names
    const layoutMap = new Map<string, string>();
    layoutsResult.value.forEach((layout: { id: string; name?: string }) => {
      layoutMap.set(layout.id, layout.name || "Unnamed Layout");
    });

    // Enhance frame layout maps with layout names
    const enhancedFrameLayoutMaps = frameLayoutsResult.value.map(frameLayoutMap => ({
      ...frameLayoutMap,
      frameSnapshots: frameLayoutMap.frameSnapshots.map(snapshot => ({
        ...snapshot,
        uniqueId: `${snapshot.frameId}_${snapshot.imageName}`
      })),
      layoutName: layoutMap.get(frameLayoutMap.layoutId) || "Unknown Layout"
    })) as EnhancedFrameLayoutMap[];

    setFrameLayoutMaps(enhancedFrameLayoutMaps);
  } catch (error) {
    raiseError(error instanceof Error ? error : new Error(String(error)));
  } finally {
    setIsLoading(false);
  }
};

useEffect(() => {
  if (opened) {
    loadFrameLayouts();
  }
}, [opened]);

const handleRemoveFrameLayout = async (layoutId: string, uniqueId: string) => {
  // Note: frameId and imageName parameters are kept for backward compatibility with the interface
  try {
    setIsRemoving(true);

    // Use uniqueId to find and remove the snapshot
    setFrameLayoutMaps(prev => {
      const next = [...prev];
      // Find the layout containing the snapshot with this uniqueId
      for (let i = 0; i < next.length; i++) {
        const layout = next[i];
        if (layout.layoutId === layoutId) {
          // Find the snapshot with the matching uniqueId
          const snapshotIndex = layout.frameSnapshots.findIndex(s => s.uniqueId === uniqueId);
          if (snapshotIndex !== -1) {
            // Remove the snapshot from the array
            layout.frameSnapshots.splice(snapshotIndex, 1);
            break;
          }
        }
      }
      return next;
    });
  } catch (error) {
    raiseError(error instanceof Error ? error : new Error(String(error)));
  } finally {
    setIsRemoving(false);
  }
};

// Helper function to clean up frame layout maps
const cleanupFrameLayoutMaps = useCallback((): FrameLayoutMap[] => {
  return frameLayoutMaps.map(map => {
    // Create a new object without the layoutName property
    const { layoutName, ...cleanMap } = map;

    // Sort frameSnapshots alphabetically by imageName
    const sortedSnapshots = [...cleanMap.frameSnapshots].sort((a, b) =>
      a.imageName.localeCompare(b.imageName)
    );

    return {
      ...cleanMap,
      frameSnapshots: sortedSnapshots
    };
  });
}, [frameLayoutMaps]);

// Save cleaned frame layout maps
const saveCleanedFrameLayoutMaps = useCallback(async () => {
  const cleanFrameLayoutMaps = cleanupFrameLayoutMaps();
  return await saveFrameLayoutMapsToDoc(cleanFrameLayoutMaps);
}, [cleanupFrameLayoutMaps]);

const handleUpdateActions = async () => {
  setIsLoading(true);
  try {
    // 1. Save the cleaned frame layout maps
    const saveResult = await saveCleanedFrameLayoutMaps();

    if (!saveResult.isOk()) {
      raiseError(new Error(saveResult.error?.message || "Failed to save frame layout maps"));
      return;
    }

    // 2. Update actions with the cleaned maps
    const result = await saveImageSizingMappingToAction(cleanupFrameLayoutMaps());

    if (result.isError()) {
      raiseError(result.error);
    }
  } catch (error) {
    raiseError(error instanceof Error ? error : new Error(String(error)));
  } finally {
    setIsLoading(false);
    onClose();
  }
};

// Clean up and save frame layout maps before closing
const handleCleanupAndClose = async () => {
  setIsLoading(true);
  try {
    // Save the cleaned frame layout maps
    const saveResult = await saveCleanedFrameLayoutMaps();

    if (!saveResult.isOk()) {
      raiseError(new Error(saveResult.error?.message || "Failed to save frame layout maps"));
    }
  } catch (error) {
    raiseError(error instanceof Error ? error : new Error(String(error)));
  } finally {
    setIsLoading(false);
    // Always call onClose, even if there was an error
    onClose();
  }
};

return (
  <Modal
    opened={opened}
    onClose={handleCleanupAndClose}
    title="Frame Position Viewer"
    fullScreen
    centered
  >
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 120px)' }}>
      <Group justify="flex-end" mb="md">
      </Group>
      <ScrollArea style={{ flex: 1 }}>
        {isLoading ? (
          <Center style={{ height: '100%', width: '100%' }}>
            <Loader size="lg" />
          </Center>
        ) : (
          <Stack>
            {frameLayoutMaps.length === 0 ? (
              <Text>No frame layouts found.</Text>
            ) : (
              tableData.map(layout => (
                <FrameLayoutCard
                  key={layout.layoutId}
                  layoutMap={layout}
                  onRemoveSnapshot={handleRemoveFrameLayout}
                  onEditCell={handleEditCell}
                  frameLayoutMaps={frameLayoutMaps}
                  onUpdateFrameLayoutMaps={setFrameLayoutMaps}
                  />
            ))
              )}
          </Stack>
        )}
      </ScrollArea>
      <Group justify="flex-end" mt="md">
        <Button
          onClick={handleUpdateActions}
          color="blue"
          disabled={isLoading || isRemoving}
          loading={isLoading || isRemoving}
        >
          Update Actions
        </Button>
        <Button onClick={handleCleanupAndClose} disabled={isRemoving}>Close</Button>
      </Group>
    </div>
  </Modal>
);
}
