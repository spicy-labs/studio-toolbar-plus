import React, { useState, useMemo } from "react";
import { Card, Table, Title, Group, ActionIcon } from "@mantine/core";
import {
  IconTrash,
  IconCopy,
  IconCopyPlus,
  IconReplace,
  IconDeselect,
} from "@tabler/icons-react";
import { FrameSnapshotRow } from "./FrameSnapshotRow";
import { CopyToLayerModal } from "./CopyToLayerModal";
import { CopyAndAddRowModal } from "./CopyAndAddRowModal";
import { CopyAndReplaceModal } from "./CopyAndReplaceModal";
import type { FrameLayoutCardProps, EnhancedFrameSnapshot } from "./types";

export function FrameLayoutCard({
  layoutMap,
  onRemoveSnapshot,
  onEditCell,
  frameLayoutMaps,
  onUpdateFrameLayoutMaps,
}: FrameLayoutCardProps) {
  const [checkedSnapshots, setCheckedSnapshots] = useState<
    Record<string, boolean>
  >({});
  const [copyModalOpened, setCopyModalOpened] = useState(false);
  const [copyAndAddRowModalOpened, setCopyAndAddRowModalOpened] =
    useState(false);
  const [copyAndReplaceModalOpened, setCopyAndReplaceModalOpened] =
    useState(false);

  // Handle checkbox change
  const handleCheckChange = (snapshotKey: string, isChecked: boolean) => {
    setCheckedSnapshots((prev) => ({
      ...prev,
      [snapshotKey]: isChecked,
    }));
  };

  // Get checked snapshots
  const getCheckedSnapshots = (): EnhancedFrameSnapshot[] => {
    return layoutMap.snapshots.filter(
      (snapshot) => checkedSnapshots[snapshot.uniqueId],
    );
  };

  // Delete all checked snapshots
  const deleteCheckedSnapshots = async () => {
    const checked = getCheckedSnapshots();
    for (const snapshot of checked) {
      // Make sure uniqueId is available
      if (snapshot.uniqueId) {
        await onRemoveSnapshot(layoutMap.layoutId, snapshot.uniqueId);
      }
    }
    // Clear checked snapshots after deletion
    setCheckedSnapshots({});
  };

  // Deselect all rows
  const deselectAllRows = () => {
    setCheckedSnapshots({});
  };

  // Check if any snapshots are checked
  const hasCheckedSnapshots = Object.values(checkedSnapshots).some(Boolean);

  // Get the number of checked snapshots
  const checkedSnapshotsCount =
    Object.values(checkedSnapshots).filter(Boolean).length;

  // Get the single selected snapshot when exactly one is selected
  const singleSelectedSnapshot = useMemo(() => {
    if (checkedSnapshotsCount === 1) {
      const selectedKey = Object.keys(checkedSnapshots).find(
        (key) => checkedSnapshots[key],
      );
      return layoutMap.snapshots.find(
        (snapshot) => snapshot.uniqueId === selectedKey,
      );
    }
    return null;
  }, [checkedSnapshots, layoutMap.snapshots]);

  // Handle adding a copy of a snapshot with a new name
  const handleAddCopy = (snapshot: EnhancedFrameSnapshot, newName: string) => {
    // Create a deep copy of the frameLayoutMaps to work with
    const updatedFrameLayoutMaps = [...frameLayoutMaps];

    // Find the current layout map
    const currentLayoutMap = updatedFrameLayoutMaps.find(
      (map) => map.layoutId === layoutMap.layoutId,
    );

    if (!currentLayoutMap) return;

    // Generate a unique ID for the new snapshot
    const uniqueId = `${snapshot.frameId}_${newName}`;

    // Create a new snapshot with the new name
    const newSnapshot = {
      frameId: snapshot.frameId,
      imageName: newName,
      x: snapshot.x,
      y: snapshot.y,
      width: snapshot.width,
      height: snapshot.height,
      id: uniqueId, // Add the id property used by the system
      uniqueId: uniqueId, // Add the uniqueId property used by the UI
    };

    // Add the new snapshot to the layout
    if (!currentLayoutMap.frameSnapshots) {
      currentLayoutMap.frameSnapshots = [];
    }

    currentLayoutMap.frameSnapshots.push(newSnapshot);

    // Update the frame layout maps
    onUpdateFrameLayoutMaps(updatedFrameLayoutMaps);
  };
  return (
    <Card
      key={layoutMap.layoutId}
      shadow="sm"
      padding="md"
      radius="md"
      withBorder
    >
      <Card.Section withBorder inheritPadding py="xs">
        <Group justify="space-between">
          <Title order={4}>{layoutMap.layoutName}</Title>
          <Group>
            {hasCheckedSnapshots && (
              <>
                <ActionIcon
                  color="red"
                  variant="filled"
                  onClick={deleteCheckedSnapshots}
                  title="Delete selected"
                >
                  <IconTrash size={16} />
                </ActionIcon>
                <ActionIcon
                  color="blue"
                  variant="filled"
                  onClick={() => setCopyModalOpened(true)}
                  title="Copy to layer"
                >
                  <IconCopy size={16} />
                </ActionIcon>
                {checkedSnapshotsCount === 1 && (
                  <ActionIcon
                    color="blue"
                    variant="filled"
                    onClick={() => setCopyAndAddRowModalOpened(true)}
                    title="Copy and add row"
                  >
                    <IconCopyPlus size={16} />
                  </ActionIcon>
                )}
                <ActionIcon
                  color="blue"
                  variant="filled"
                  onClick={() => setCopyAndReplaceModalOpened(true)}
                  title="Copy and replace"
                >
                  <IconReplace size={16} />
                </ActionIcon>
                <ActionIcon
                  color="blue"
                  variant="filled"
                  onClick={deselectAllRows}
                  title="Deselect all"
                >
                  <IconDeselect size={16} />
                </ActionIcon>
              </>
            )}
          </Group>
        </Group>
      </Card.Section>

      <Table mt="md" striped highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Image Name</Table.Th>
            <Table.Th>X</Table.Th>
            <Table.Th>Y</Table.Th>
            <Table.Th>Width</Table.Th>
            <Table.Th>Height</Table.Th>
            <Table.Th>Actions</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {layoutMap.snapshots.map((snapshot) => (
            <FrameSnapshotRow
              key={snapshot.uniqueId}
              snapshot={snapshot}
              layoutId={layoutMap.layoutId}
              onRemoveSnapshot={onRemoveSnapshot}
              onEditCell={onEditCell}
              onCheckChange={handleCheckChange}
              isChecked={!!checkedSnapshots[snapshot.uniqueId]}
            />
          ))}
        </Table.Tbody>
      </Table>

      {/* Copy to Layer Modal */}
      <CopyToLayerModal
        opened={copyModalOpened}
        onClose={() => setCopyModalOpened(false)}
        snapshots={getCheckedSnapshots()}
        sourceLayoutId={layoutMap.layoutId}
        frameLayoutMaps={frameLayoutMaps}
        onUpdateFrameLayoutMaps={onUpdateFrameLayoutMaps}
      />

      {/* Copy and Add Row Modal */}
      {singleSelectedSnapshot && (
        <CopyAndAddRowModal
          opened={copyAndAddRowModalOpened}
          onClose={() => setCopyAndAddRowModalOpened(false)}
          snapshot={singleSelectedSnapshot}
          layoutId={layoutMap.layoutId}
          existingSnapshots={layoutMap.snapshots}
          onAddCopy={handleAddCopy}
        />
      )}

      {/* Copy and Replace Modal */}
      <CopyAndReplaceModal
        opened={copyAndReplaceModalOpened}
        onClose={() => setCopyAndReplaceModalOpened(false)}
        snapshots={getCheckedSnapshots()}
        layoutId={layoutMap.layoutId}
        existingSnapshots={layoutMap.snapshots}
        onAddCopy={handleAddCopy}
      />
    </Card>
  );
}
