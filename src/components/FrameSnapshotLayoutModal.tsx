import React, { useEffect, useState } from "react";
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
} from "@mantine/core";
import { IconTrash } from "@tabler/icons-react";
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

export function FrameSnapshotLayoutModal({
  opened,
  onClose,
}: FrameSnapshotLayoutModalProps) {
  const [frameLayoutMaps, setFrameLayoutMaps] = useState<EnhancedFrameLayoutMap[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
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
                frameLayoutMaps.map((frameLayoutMap) => (
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
                          {frameLayoutMap.frameSnapshots.map((snapshot) => (
                            <Table.Tr key={snapshot.frameId}>
                              <Table.Td>{snapshot.imageName}</Table.Td>
                              <Table.Td>{snapshot.x}</Table.Td>
                              <Table.Td>{snapshot.y}</Table.Td>
                              <Table.Td>{snapshot.width}</Table.Td>
                              <Table.Td>{snapshot.height}</Table.Td>
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