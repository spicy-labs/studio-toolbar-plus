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
import { IconChevronDown, IconChevronRight } from '@tabler/icons-react';
import { useAppStore } from "../modalStore";
import { getAllLayouts, updateLayoutResizable } from "../studio/layoutHandler";
import { getStudio } from "../studio/studioAdapter";
import type SDK from "@chili-publish/studio-sdk";
import type { Layout, ResizableLayoutPropertiesUpdate } from "@chili-publish/studio-sdk";

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

export function LayoutManagerModal({ opened, onClose }: LayoutManagerModalProps) {
  const [layouts, setLayouts] = useState<LayoutNode[]>([]);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [studio, setStudio] = useState<SDK | null>(null);
  const { raiseError } = useAppStore();

  // Fetch layouts when modal opens
  useEffect(() => {
    const fetchLayouts = async () => {
      try {
        const studioResult = await getStudio();
        if (!studioResult.isOk()) {
          raiseError(
            new Error(studioResult.error?.message || "Failed to get studio")
          );
          return;
        }
        
        setStudio(studioResult.value);
        
        const layoutsResult = await getAllLayouts(studioResult.value);
        if (!layoutsResult.isOk()) {
          raiseError(
            new Error(layoutsResult.error?.message || "Failed to get layouts")
          );
          return;
        }

        // Transform layouts into our internal format
        const layoutNodes: LayoutNode[] = layoutsResult.value.map((layout: Layout) => ({
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
        }));

        // Build tree structure
        const rootNodes = buildLayoutTree(layoutNodes);
        setLayouts(rootNodes);
        
      } catch (error) {
        raiseError(error instanceof Error ? error : new Error(String(error)));
      }
    };

    if (opened) {
      fetchLayouts();
    }
  }, [opened, raiseError]);

  // Build tree structure from flat layout list
  const buildLayoutTree = (layoutNodes: LayoutNode[]): LayoutNode[] => {
    // First, create a map of all nodes
    const nodeMap = new Map<string, LayoutNode>();
    layoutNodes.forEach(node => {
      nodeMap.set(node.id, { ...node, children: [] });
    });

    // Then build the tree structure
    const rootNodes: LayoutNode[] = [];
    
    nodeMap.forEach(node => {
      if (!node.parentId) {
        // This is a root node
        rootNodes.push(node);
      } else {
        // This is a child node
        const parent = nodeMap.get(node.parentId);
        if (parent) {
          if (!parent.children) {
            parent.children = [];
          }
          parent.children.push(node);
        }
      }
    });

    return rootNodes;
  };

  // Toggle node expansion
  const toggleNodeExpansion = (nodeId: string) => {
    setExpandedNodes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(nodeId)) {
        newSet.delete(nodeId);
      } else {
        newSet.add(nodeId);
      }
      return newSet;
    });
  };

  // Handle saving changes to a layout
  const handleSaveLayout = async (layout: LayoutNode) => {
    if (!studio) return;

    try {
      const update: ResizableLayoutPropertiesUpdate = {
        enabled: { value: layout.resizable },
        minWidth: layout.minWidth !== undefined ? { value: String(layout.minWidth) } : undefined,
        maxWidth: layout.maxWidth !== undefined ? { value: String(layout.maxWidth) } : undefined,
        minHeight: layout.minHeight !== undefined ? { value: String(layout.minHeight) } : undefined,
        maxHeight: layout.maxHeight !== undefined ? { value: String(layout.maxHeight) } : undefined,
        // lockAspectRatio is not in the SDK type, so we'll omit it
      };

      const result = await updateLayoutResizable(studio, layout.id, update);
      
      if (!result.isOk()) {
        raiseError(
          new Error(result.error?.message || "Failed to update layout")
        );
        return;
      }

      // Success notification could be added here
    } catch (error) {
      raiseError(error instanceof Error ? error : new Error(String(error)));
    }
  };

  // Handle changes to layout properties
  const handleLayoutChange = (layoutId: string, property: keyof LayoutNode, value: any) => {
    // Update the layout in the tree structure
    const updateLayoutInTree = (nodes: LayoutNode[]): LayoutNode[] => {
      return nodes.map(node => {
        if (node.id === layoutId) {
          return { ...node, [property]: value };
        }
        if (node.children) {
          return { ...node, children: updateLayoutInTree(node.children) };
        }
        return node;
      });
    };
    
    setLayouts(updateLayoutInTree(layouts));
  };

  // Recursive component to render a layout node and its children
  const LayoutNodeCard = ({ node }: { node: LayoutNode }) => {
    const isExpanded = expandedNodes.has(node.id);
    const hasChildren = node.children && node.children.length > 0;
    
    return (
      <Box mb="sm">
        <Card shadow="sm" p="md" radius="md" withBorder>
          <Stack>
            {/* Header with expand/collapse control */}
            <Group justify="space-between">
              <Group>
                {hasChildren && (
                  <Box
                    style={{ cursor: 'pointer' }}
                    onClick={() => toggleNodeExpansion(node.id)}
                  >
                    {isExpanded ? <IconChevronDown size={16} /> : <IconChevronRight size={16} />}
                  </Box>
                )}
                <Title order={5}>{node.name}</Title>
              </Group>
            </Group>
            
            {/* Layout properties */}
            <Group>
              <Switch
                label="Available"
                checked={node.available}
                onChange={(event) => handleLayoutChange(node.id, 'available', event.currentTarget.checked)}
              />
              
              <Switch
                label="Resizable"
                checked={node.resizable}
                onChange={(event) => handleLayoutChange(node.id, 'resizable', event.currentTarget.checked)}
              />
            </Group>
            
            <Group>
              <NumberInput
                label="Min Width"
                value={node.minWidth !== null ? node.minWidth : undefined}
                onChange={(value) => handleLayoutChange(node.id, 'minWidth', value)}
                disabled={!node.resizable}
                style={{ width: '80px' }}
              />
              
              <NumberInput
                label="Max Width"
                value={node.maxWidth !== null ? node.maxWidth : undefined}
                onChange={(value) => handleLayoutChange(node.id, 'maxWidth', value)}
                disabled={!node.resizable}
                style={{ width: '80px' }}
              />
            
              <NumberInput
                label="Min Height"
                value={node.minHeight !== null ? node.minHeight : undefined}
                onChange={(value) => handleLayoutChange(node.id, 'minHeight', value)}
                disabled={!node.resizable}
                style={{ width: '80px' }}
              />
              
              <NumberInput
                label="Max Height"
                value={node.maxHeight !== null ? node.maxHeight : undefined}
                onChange={(value) => handleLayoutChange(node.id, 'maxHeight', value)}
                disabled={!node.resizable}
                style={{ width: '80px' }}
              />
            </Group>
            
            <Checkbox
              label="Lock Aspect Ratio"
              checked={node.lockAspectRatio}
              onChange={(event) => handleLayoutChange(node.id, 'lockAspectRatio', event.currentTarget.checked)}
              disabled={!node.resizable}
            />
            
            {node.lockAspectRatio && (
              <NumberInput
                label="Percentage"
                value={node.percentage}
                onChange={(value) => handleLayoutChange(node.id, 'percentage', value)}
                min={0}
                max={50}
                step={1}
                style={{ width: '60px' }}
              />
            )}
            
            <Group justify="flex-end" mt="xs">
              <Button onClick={() => handleSaveLayout(node)} color="blue" size="sm">
                Save Changes
              </Button>
            </Group>
          </Stack>
        </Card>
        
        {/* Render children if expanded */}
        {hasChildren && isExpanded && (
          <Box ml={30} mt="xs">
            {node.children!.map(childNode => (
              <LayoutNodeCard key={childNode.id} node={childNode} />
            ))}
          </Box>
        )}
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
      <Box style={{ height: "calc(100vh - 120px)", overflowY: "auto", padding: "16px" }}>
        <Title order={4} mb="md">Layouts</Title>
        
        {/* Render the layout tree */}
        <Stack>
          {layouts.map(node => (
            <LayoutNodeCard key={node.id} node={node} />
          ))}
        </Stack>
      </Box>
    </Modal>
  );
}
