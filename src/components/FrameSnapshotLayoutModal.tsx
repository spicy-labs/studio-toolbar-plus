import React, { useEffect, useState, useRef, KeyboardEvent } from "react";
import {
  Modal,
  Text,
  Card,
  Table,
  ActionIcon,
  Group,
  Title,
  Stack,
  ScrollArea,
  Button,
  Loader,
  Center,
  TextInput,
  NumberInput,
} from "@mantine/core";
import { IconTrash, IconPencil } from "@tabler/icons-react";
import { loadFrameLayoutMapsFromDoc, removeFrameLayouyMap, saveImageSizingMappingToAction } from "../studio/studioAdapter";
import { getAllLayouts } from "../studio/layoutHandler";
import { appStore } from "../modalStore";
import type { FrameLayoutMap } from "../types/toolbarEnvelope";
// Enhanced type with layout name
interface EnhancedFrameLayoutMap extends FrameLayoutMap {
  layoutName: string;
}

interface FrameSnapshotLayoutModalProps {
  opened: boolean;
  onClose: () => void;
}

// Type for tracking which cell is being hovered or edited
type EditableCell = {
  layoutIndex: number;
  snapshotIndex: number;
  field: 'imageName' | 'x' | 'y' | 'width' | 'height' | null;
};

export function FrameSnapshotLayoutModal({
  opened,
  onClose,
}: FrameSnapshotLayoutModalProps) {
  const [frameLayoutMaps, setFrameLayoutMaps] = useState<EnhancedFrameLayoutMap[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const [hoveredCell, setHoveredCell] = useState<EditableCell | null>(null);
  const [editingCell, setEditingCell] = useState<EditableCell | null>(null);
  const [editValue, setEditValue] = useState<string | number>('');
  const inputRef = useRef<HTMLInputElement>(null);
  const raiseError = appStore(store => store.raiseError);

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

  const handleRemoveFrameLayout = async (frameId: string, imageName:string, layoutId: string) => {
    try {
      setIsRemoving(true);
      await removeFrameLayouyMap(frameId, imageName, layoutId);

      // Reload the frame layouts after successful removal
      await loadFrameLayouts();
    } catch (error) {
      raiseError(error instanceof Error ? error : new Error(String(error)));
    } finally {
      setIsRemoving(false);
    }
  };

  const handleUpdateActions = async () => {
    setIsLoading(true);
    const result = await saveImageSizingMappingToAction(frameLayoutMaps);

    if (result.isError()) {
      raiseError(result.error)
    }
    setIsLoading(false);
    onClose();
  };

  // Handle cell hover
  const handleCellHover = (layoutIndex: number, snapshotIndex: number, field: EditableCell['field']) => {
    if (editingCell) return; // Don't change hover state while editing
    setHoveredCell({ layoutIndex, snapshotIndex, field });
  };

  // Handle cell hover exit
  const handleCellLeave = () => {
    if (editingCell) return; // Don't change hover state while editing
    setHoveredCell(null);
  };

  // Start editing a cell
  const handleEditStart = (layoutIndex: number, snapshotIndex: number, field: EditableCell['field']) => {
    if (!field) return;

    const snapshot = frameLayoutMaps[layoutIndex].frameSnapshots[snapshotIndex];
    setEditingCell({ layoutIndex, snapshotIndex, field });
    setEditValue(snapshot[field]);

    // Focus the input after it renders
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        inputRef.current.select();
      }
    }, 10);
  };

  // Save the edited value
  const handleSaveEdit = () => {
    if (!editingCell) return;

    const { layoutIndex, snapshotIndex, field } = editingCell;

    // Create a deep copy of the frameLayoutMaps
    const updatedMaps = JSON.parse(JSON.stringify(frameLayoutMaps));

    // Update the value
    if (field === 'imageName') {
      updatedMaps[layoutIndex].frameSnapshots[snapshotIndex][field] = String(editValue);
    } else {

      if (field === 'x' || field === 'y' || field === 'width' || field === 'height') {
        const numValue = Number(editValue);
        if (!isNaN(numValue)) {
          updatedMaps[layoutIndex].frameSnapshots[snapshotIndex][field] = numValue;
        }
      }
    }

    // Update state
    setFrameLayoutMaps(updatedMaps);
    setEditingCell(null);
    setEditValue('');
  };

  // Handle keyboard events while editing
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSaveEdit();
    } else if (e.key === 'Escape') {
      setEditingCell(null);
      setEditValue('');
    }
  };

  // Check if a cell is being hovered
  const isCellHovered = (layoutIndex: number, snapshotIndex: number, field: EditableCell['field']) => {
    return hoveredCell?.layoutIndex === layoutIndex &&
           hoveredCell?.snapshotIndex === snapshotIndex &&
           hoveredCell?.field === field;
  };

  // Check if a cell is being edited
  const isCellEditing = (layoutIndex: number, snapshotIndex: number, field: EditableCell['field']) => {
    return editingCell?.layoutIndex === layoutIndex &&
           editingCell?.snapshotIndex === snapshotIndex &&
           editingCell?.field === field;
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Frame Position Viewer"
      fullScreen
      centered
    >
      <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 120px)' }}>
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
                frameLayoutMaps.map((frameLayoutMap, frameLayoutMapIndex) => (
                  <Card key={frameLayoutMap.layoutId} shadow="sm" padding="md" radius="md" withBorder>
                    <Card.Section withBorder inheritPadding py="xs">
                      <Title order={4}>{frameLayoutMap.layoutName || `Layout ID: ${frameLayoutMap.layoutId}`}</Title>
                    </Card.Section>

                    {frameLayoutMap.frameSnapshots.length === 0 ? (
                      <Text mt="md">No frame snapshots for this layout.</Text>
                    ) : (
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
                          {frameLayoutMap.frameSnapshots.map((snapshot, snapshotIndex) => (
                            <Table.Tr key={snapshot.frameId}>
                              <Table.Td
                                onMouseEnter={() => handleCellHover(frameLayoutMapIndex, snapshotIndex, 'imageName')}
                                onMouseLeave={handleCellLeave}
                                style={{ position: 'relative' }}
                              >
                                {isCellEditing(frameLayoutMapIndex, snapshotIndex, 'imageName') ? (
                                  <TextInput
                                    ref={inputRef}
                                    value={editValue}
                                    onChange={(e) => setEditValue(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    onBlur={handleSaveEdit}
                                    size="xs"
                                    style={{ width: '100%' }}
                                  />
                                ) : (
                                  <>
                                    {snapshot.imageName}
                                    {isCellHovered(frameLayoutMapIndex, snapshotIndex, 'imageName') && (
                                      <ActionIcon
                                        size="xs"
                                        variant="subtle"
                                        color="blue"
                                        style={{ position: 'absolute', right: '5px', top: '50%', transform: 'translateY(-50%)' }}
                                        onClick={() => handleEditStart(frameLayoutMapIndex, snapshotIndex, 'imageName')}
                                      >
                                        <IconPencil size={14} />
                                      </ActionIcon>
                                    )}
                                  </>
                                )}
                              </Table.Td>
                              <Table.Td
                                onMouseEnter={() => handleCellHover(frameLayoutMapIndex, snapshotIndex, 'x')}
                                onMouseLeave={handleCellLeave}
                                style={{ position: 'relative' }}
                              >
                                {isCellEditing(frameLayoutMapIndex, snapshotIndex, 'x') ? (
                                  <NumberInput
                                    ref={inputRef}
                                    value={Number(editValue)}
                                    onChange={(val) => setEditValue(val || 0)}
                                    onKeyDown={handleKeyDown}
                                    onBlur={handleSaveEdit}
                                    size="xs"
                                    style={{ width: '100%' }}
                                  />
                                ) : (
                                  <>
                                    {snapshot.x}
                                    {isCellHovered(frameLayoutMapIndex, snapshotIndex, 'x') && (
                                      <ActionIcon
                                        size="xs"
                                        variant="subtle"
                                        color="blue"
                                        style={{ position: 'absolute', right: '5px', top: '50%', transform: 'translateY(-50%)' }}
                                        onClick={() => handleEditStart(frameLayoutMapIndex, snapshotIndex, 'x')}
                                      >
                                        <IconPencil size={14} />
                                      </ActionIcon>
                                    )}
                                  </>
                                )}
                              </Table.Td>
                              <Table.Td
                                onMouseEnter={() => handleCellHover(frameLayoutMapIndex, snapshotIndex, 'y')}
                                onMouseLeave={handleCellLeave}
                                style={{ position: 'relative' }}
                              >
                                {isCellEditing(frameLayoutMapIndex, snapshotIndex, 'y') ? (
                                  <NumberInput
                                    ref={inputRef}
                                    value={Number(editValue)}
                                    onChange={(val) => setEditValue(val || 0)}
                                    onKeyDown={handleKeyDown}
                                    onBlur={handleSaveEdit}
                                    size="xs"
                                    style={{ width: '100%' }}
                                  />
                                ) : (
                                  <>
                                    {snapshot.y}
                                    {isCellHovered(frameLayoutMapIndex, snapshotIndex, 'y') && (
                                      <ActionIcon
                                        size="xs"
                                        variant="subtle"
                                        color="blue"
                                        style={{ position: 'absolute', right: '5px', top: '50%', transform: 'translateY(-50%)' }}
                                        onClick={() => handleEditStart(frameLayoutMapIndex, snapshotIndex, 'y')}
                                      >
                                        <IconPencil size={14} />
                                      </ActionIcon>
                                    )}
                                  </>
                                )}
                              </Table.Td>
                              <Table.Td
                                onMouseEnter={() => handleCellHover(frameLayoutMapIndex, snapshotIndex, 'width')}
                                onMouseLeave={handleCellLeave}
                                style={{ position: 'relative' }}
                              >
                                {isCellEditing(frameLayoutMapIndex, snapshotIndex, 'width') ? (
                                  <NumberInput
                                    ref={inputRef}
                                    value={Number(editValue)}
                                    onChange={(val) => setEditValue(val || 0)}
                                    onKeyDown={handleKeyDown}
                                    onBlur={handleSaveEdit}
                                    size="xs"
                                    style={{ width: '100%' }}
                                  />
                                ) : (
                                  <>
                                    {snapshot.width}
                                    {isCellHovered(frameLayoutMapIndex, snapshotIndex, 'width') && (
                                      <ActionIcon
                                        size="xs"
                                        variant="subtle"
                                        color="blue"
                                        style={{ position: 'absolute', right: '5px', top: '50%', transform: 'translateY(-50%)' }}
                                        onClick={() => handleEditStart(frameLayoutMapIndex, snapshotIndex, 'width')}
                                      >
                                        <IconPencil size={14} />
                                      </ActionIcon>
                                    )}
                                  </>
                                )}
                              </Table.Td>
                              <Table.Td
                                onMouseEnter={() => handleCellHover(frameLayoutMapIndex, snapshotIndex, 'height')}
                                onMouseLeave={handleCellLeave}
                                style={{ position: 'relative' }}
                              >
                                {isCellEditing(frameLayoutMapIndex, snapshotIndex, 'height') ? (
                                  <NumberInput
                                    ref={inputRef}
                                    value={Number(editValue)}
                                    onChange={(val) => setEditValue(val || 0)}
                                    onKeyDown={handleKeyDown}
                                    onBlur={handleSaveEdit}
                                    size="xs"
                                    style={{ width: '100%' }}
                                  />
                                ) : (
                                  <>
                                    {snapshot.height}
                                    {isCellHovered(frameLayoutMapIndex, snapshotIndex, 'height') && (
                                      <ActionIcon
                                        size="xs"
                                        variant="subtle"
                                        color="blue"
                                        style={{ position: 'absolute', right: '5px', top: '50%', transform: 'translateY(-50%)' }}
                                        onClick={() => handleEditStart(frameLayoutMapIndex, snapshotIndex, 'height')}
                                      >
                                        <IconPencil size={14} />
                                      </ActionIcon>
                                    )}
                                  </>
                                )}
                              </Table.Td>
                              <Table.Td>
                                <Group>
                                  <ActionIcon
                                    color="red"
                                    variant="subtle"
                                    onClick={() => handleRemoveFrameLayout(snapshot.frameId, snapshot.imageName, frameLayoutMap.layoutId)}
                                    disabled={isRemoving || isLoading}
                                  >
                                    <IconTrash size={16} />
                                  </ActionIcon>
                                </Group>
                              </Table.Td>
                            </Table.Tr>
                          ))}
                        </Table.Tbody>
                      </Table>
                    )}
                  </Card>
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
          <Button onClick={onClose} disabled={isRemoving}>Close</Button>
        </Group>
      </div>
    </Modal>
  );
}
