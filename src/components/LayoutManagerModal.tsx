import React, { useEffect, useState } from "react";
import {
  Modal,
  Text,
  Group,
  Switch,
  NumberInput,
  Stack,
  Box,
  Title,
  Checkbox,
  Button,
  Card,
  Paper,
  Collapse,
} from "@mantine/core";
import { IconChevronDown, IconChevronRight } from "@tabler/icons-react";
import { appStore } from "../modalStore";
import { getAllLayouts, updateLayoutResizable } from "../studio/layoutHandler";
import { getStudio } from "../studio/studioAdapter";
import type SDK from "@chili-publish/studio-sdk";
import type {
  Layout,
  ResizableLayoutPropertiesUpdate,
} from "@chili-publish/studio-sdk";

interface LayoutManagerModalProps {
  opened: boolean;
  onClose: () => void;
}

interface LayoutNode {
  id: string;
  name: string;
  parentId: string | undefined;
  available: boolean;
  resizable: boolean;
  minWidth: number | null | undefined;
  maxWidth: number | null | undefined;
  minHeight: number | null | undefined;
  maxHeight: number | null | undefined;
  lockAspectRatio: boolean;
  percentage: number;
  children?: LayoutNode[];
}

export function LayoutManagerModal({
  opened,
  onClose,
}: LayoutManagerModalProps) {
  const [layouts, setLayouts] = useState<LayoutNode[]>([]);
  const [studio, setStudio] = useState<SDK | null>(null);
  const raiseError = appStore((store) => store.raiseError);

  // Fetch layouts when modal opens
  useEffect(() => {
    const fetchLayouts = async () => {
      try {
        const studioResult = await getStudio();
        if (!studioResult.isOk()) {
          raiseError(
            new Error(studioResult.error?.message || "Failed to get studio"),
          );
          return;
        }

        setStudio(studioResult.value);

        const layoutsResult = await getAllLayouts(studioResult.value);
        if (!layoutsResult.isOk()) {
          raiseError(
            new Error(layoutsResult.error?.message || "Failed to get layouts"),
          );
          return;
        }

        // Transform layouts into our internal format
        const layoutNodes: LayoutNode[] = layoutsResult.value.map(
          (layout: Layout) => ({
            id: layout.id,
            name: layout.name,
            parentId: layout.parentId,
            available: true, // Default value
            resizable: layout.resizableByUser.enabled,
            minWidth: layout.resizableByUser.minWidth,
            maxWidth: layout.resizableByUser.maxWidth,
            minHeight: layout.resizableByUser.minHeight,
            maxHeight: layout.resizableByUser.maxHeight,
            lockAspectRatio: false, // Default value since it's not in the SDK
            percentage: 100, // Default value
          }),
        );

        // Sort layouts in a meaningful order (parent layouts first, then children)
        const sortedLayouts = sortLayouts(layoutNodes);
        setLayouts(sortedLayouts);
      } catch (error) {
        raiseError(error instanceof Error ? error : new Error(String(error)));
      }
    };

    if (opened) {
      fetchLayouts();
    }
  }, [opened, raiseError]);

  // Sort layouts in a meaningful order (parent layouts first, then children)
  const sortLayouts = (layoutNodes: LayoutNode[]): LayoutNode[] => {
    // Create a map for quick parent lookup
    const nodeMap = new Map<string, LayoutNode>();
    layoutNodes.forEach((node) => {
      nodeMap.set(node.id, node);
    });

    // Create a map to track depth of each node
    const depthMap = new Map<string, number>();

    // Calculate depth for each node
    const getDepth = (nodeId: string): number => {
      if (depthMap.has(nodeId)) {
        return depthMap.get(nodeId)!;
      }

      const node = nodeMap.get(nodeId);
      if (!node || !node.parentId) {
        depthMap.set(nodeId, 0);
        return 0;
      }

      const parentDepth = getDepth(node.parentId);
      const depth = parentDepth + 1;
      depthMap.set(nodeId, depth);
      return depth;
    };

    // Calculate depth for all nodes
    layoutNodes.forEach((node) => getDepth(node.id));

    // Sort by depth and then by name
    return [...layoutNodes].sort((a, b) => {
      const depthA = depthMap.get(a.id) || 0;
      const depthB = depthMap.get(b.id) || 0;

      if (depthA !== depthB) {
        return depthA - depthB;
      }

      // If same depth, sort alphabetically by name
      return a.name.localeCompare(b.name);
    });
  };

  // Handle saving changes to a layout
  const handleSaveLayout = async (layout: LayoutNode) => {
    if (!studio) return;

    try {
      const update: ResizableLayoutPropertiesUpdate = {
        enabled: { value: layout.resizable },
        minWidth:
          layout.minWidth !== undefined
            ? { value: String(layout.minWidth) }
            : undefined,
        maxWidth:
          layout.maxWidth !== undefined
            ? { value: String(layout.maxWidth) }
            : undefined,
        minHeight:
          layout.minHeight !== undefined
            ? { value: String(layout.minHeight) }
            : undefined,
        maxHeight:
          layout.maxHeight !== undefined
            ? { value: String(layout.maxHeight) }
            : undefined,
        // lockAspectRatio is not in the SDK type, so we'll omit it
      };

      const result = await updateLayoutResizable(studio, layout.id, update);

      if (!result.isOk()) {
        raiseError(
          new Error(result.error?.message || "Failed to update layout"),
        );
        return;
      }

      // Success notification could be added here
    } catch (error) {
      raiseError(error instanceof Error ? error : new Error(String(error)));
    }
  };

  // Handle changes to layout properties
  const handleLayoutChange = (
    layoutId: string,
    property: keyof LayoutNode,
    value: any,
  ) => {
    // Update the layout in the flat list
    setLayouts(
      layouts.map((node) =>
        node.id === layoutId ? { ...node, [property]: value } : node,
      ),
    );
  };

  // Component to render a layout card
  const LayoutCard = ({ node }: { node: LayoutNode }) => {
    // Get parent name if available
    const getParentInfo = () => {
      if (!node.parentId) return null;

      const parent = layouts.find((layout) => layout.id === node.parentId);
      if (!parent) return null;

      return (
        <Text size="sm" color="dimmed">
          Parent: {parent.name}
        </Text>
      );
    };

    // Calculate indentation based on parent relationships
    const getIndentation = () => {
      const parent = layouts.find((layout) => layout.id === node.parentId);
      return parent ? 20 : 0; // Indent child layouts
    };

    return (
      <Box mb="sm" ml={getIndentation()}>
        <Card shadow="sm" p="md" radius="md" withBorder>
          <Stack>
            {/* Header */}
            <Group justify="space-between">
              <Stack gap="xs">
                <Title order={5}>{node.name}</Title>
                {getParentInfo()}
              </Stack>
            </Group>

            {/* Layout properties */}
            <Group>
              <Switch
                label="Available"
                checked={node.available}
                onChange={(event) =>
                  handleLayoutChange(
                    node.id,
                    "available",
                    event.currentTarget.checked,
                  )
                }
              />

              <Switch
                label="Resizable"
                checked={node.resizable}
                onChange={(event) =>
                  handleLayoutChange(
                    node.id,
                    "resizable",
                    event.currentTarget.checked,
                  )
                }
              />
            </Group>

            <Group>
              <NumberInput
                label="Min Width"
                value={node.minWidth !== null ? node.minWidth : undefined}
                onChange={(value) =>
                  handleLayoutChange(node.id, "minWidth", value)
                }
                disabled={!node.resizable}
                style={{ width: "80px" }}
              />

              <NumberInput
                label="Max Width"
                value={node.maxWidth !== null ? node.maxWidth : undefined}
                onChange={(value) =>
                  handleLayoutChange(node.id, "maxWidth", value)
                }
                disabled={!node.resizable}
                style={{ width: "80px" }}
              />

              <NumberInput
                label="Min Height"
                value={node.minHeight !== null ? node.minHeight : undefined}
                onChange={(value) =>
                  handleLayoutChange(node.id, "minHeight", value)
                }
                disabled={!node.resizable}
                style={{ width: "80px" }}
              />

              <NumberInput
                label="Max Height"
                value={node.maxHeight !== null ? node.maxHeight : undefined}
                onChange={(value) =>
                  handleLayoutChange(node.id, "maxHeight", value)
                }
                disabled={!node.resizable}
                style={{ width: "80px" }}
              />
            </Group>

            <Checkbox
              label="Lock Aspect Ratio"
              checked={node.lockAspectRatio}
              onChange={(event) =>
                handleLayoutChange(
                  node.id,
                  "lockAspectRatio",
                  event.currentTarget.checked,
                )
              }
              disabled={!node.resizable}
            />

            {node.lockAspectRatio && (
              <NumberInput
                label="Percentage"
                value={node.percentage}
                onChange={(value) =>
                  handleLayoutChange(node.id, "percentage", value)
                }
                min={0}
                max={50}
                step={1}
                style={{ width: "60px" }}
              />
            )}

            <Group justify="flex-end" mt="xs">
              <Button
                onClick={() => handleSaveLayout(node)}
                color="blue"
                size="sm"
              >
                Save Changes
              </Button>
            </Group>
          </Stack>
        </Card>
      </Box>
    );
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Layout Manager"
      size="xl"
      fullScreen
    >
      <Box
        style={{
          height: "calc(100vh - 120px)",
          overflowY: "auto",
          padding: "16px",
        }}
      >
        <Title order={4} mb="md">
          Layouts
        </Title>

        {/* Render the flat layout stack */}
        <Stack>
          {layouts.map((node) => (
            <LayoutCard key={node.id} node={node} />
          ))}
        </Stack>
      </Box>
    </Modal>
  );
}
