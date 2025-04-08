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
} from "@mantine/core";
import { Tree } from "@mantine/core";
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
  const [treeData, setTreeData] = useState<{ value: string; label: string; children?: any[] }[]>([]);
  const [selectedLayout, setSelectedLayout] = useState<LayoutNode | null>(null);
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

        setLayouts(layoutNodes);
        
        // Build tree structure
        const tree = buildLayoutTree(layoutNodes);
        setTreeData(tree);
        
      } catch (error) {
        raiseError(error instanceof Error ? error : new Error(String(error)));
      }
    };

    if (opened) {
      fetchLayouts();
    }
  }, [opened, raiseError]);

  // Build tree structure from flat layout list
  const buildLayoutTree = (layoutNodes: LayoutNode[]) => {
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

    // Convert to the format expected by Mantine Tree
    return rootNodes.map(convertToTreeNode);
  };

  // Convert our layout node to Mantine Tree node format
  const convertToTreeNode = (node: LayoutNode): { value: string; label: string; children?: any[] } => {
    return {
      value: node.id,
      label: node.name,
      children: node.children ? node.children.map(convertToTreeNode) : undefined
    };
  };

  // Handle node selection
  const handleNodeSelect = (event: React.SyntheticEvent<HTMLUListElement>) => {
    // Get the selected node value from the event
    const target = event.target as HTMLElement;
    const nodeElement = target.closest('[data-tree-value]');
    if (nodeElement) {
      const nodeValue = nodeElement.getAttribute('data-tree-value');
      if (nodeValue) {
        const layout = layouts.find(l => l.id === nodeValue);
        if (layout) {
          setSelectedLayout(layout);
        }
      }
    }
  };

  // Handle saving changes to a layout
  const handleSaveLayout = async () => {
    if (!selectedLayout || !studio) return;

    try {
      const update: ResizableLayoutPropertiesUpdate = {
        enabled: { value: selectedLayout.resizable },
        minWidth: selectedLayout.minWidth !== undefined ? { value: String(selectedLayout.minWidth) } : undefined,
        maxWidth: selectedLayout.maxWidth !== undefined ? { value: String(selectedLayout.maxWidth) } : undefined,
        minHeight: selectedLayout.minHeight !== undefined ? { value: String(selectedLayout.minHeight) } : undefined,
        maxHeight: selectedLayout.maxHeight !== undefined ? { value: String(selectedLayout.maxHeight) } : undefined,
        // lockAspectRatio is not in the SDK type, so we'll omit it
      };

      const result = await updateLayoutResizable(studio, selectedLayout.id, update);
      
      if (!result.isOk()) {
        raiseError(
          new Error(result.error?.message || "Failed to update layout")
        );
        return;
      }

      // Update the local state
      setLayouts(layouts.map(layout =>
        layout.id === selectedLayout.id ? selectedLayout : layout
      ));
    } catch (error) {
      raiseError(error instanceof Error ? error : new Error(String(error)));
    }
  };

  // Handle changes to the selected layout properties
  const handleLayoutChange = (property: keyof LayoutNode, value: any) => {
    if (!selectedLayout) return;
    
    setSelectedLayout({
      ...selectedLayout,
      [property]: value
    });
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Layout Manager"
      size="xl"
      fullScreen
    >
      <Group align="flex-start" style={{ height: "calc(100vh - 120px)" }}>
        {/* Left side - Tree */}
        <Box style={{ width: "30%", height: "100%", overflowY: "auto" }}>
          <Title order={4} mb="md">Layouts</Title>
          <Tree
            data={treeData}
            onSelect={handleNodeSelect}
          />
        </Box>

        {/* Right side - Layout properties */}
        <Box style={{ width: "70%", height: "100%", overflowY: "auto" }}>
          {selectedLayout ? (
            <Stack>
              <Title order={4}>{selectedLayout.name}</Title>
              
              <Group>
                <Switch
                  label="Available"
                  checked={selectedLayout.available}
                  onChange={(event) => handleLayoutChange('available', event.currentTarget.checked)}
                />
                
                <Switch
                  label="Resizable"
                  checked={selectedLayout.resizable}
                  onChange={(event) => handleLayoutChange('resizable', event.currentTarget.checked)}
                />
              </Group>
              
              <Group grow>
                <NumberInput
                  label="Min Width"
                  value={selectedLayout.minWidth !== null ? selectedLayout.minWidth : undefined}
                  onChange={(value) => handleLayoutChange('minWidth', value)}
                  disabled={!selectedLayout.resizable}
                />
                
                <NumberInput
                  label="Max Width"
                  value={selectedLayout.maxWidth !== null ? selectedLayout.maxWidth : undefined}
                  onChange={(value) => handleLayoutChange('maxWidth', value)}
                  disabled={!selectedLayout.resizable}
                />
              </Group>
              
              <Group grow>
                <NumberInput
                  label="Min Height"
                  value={selectedLayout.minHeight !== null ? selectedLayout.minHeight : undefined}
                  onChange={(value) => handleLayoutChange('minHeight', value)}
                  disabled={!selectedLayout.resizable}
                />
                
                <NumberInput
                  label="Max Height"
                  value={selectedLayout.maxHeight !== null ? selectedLayout.maxHeight : undefined}
                  onChange={(value) => handleLayoutChange('maxHeight', value)}
                  disabled={!selectedLayout.resizable}
                />
              </Group>
              
              <Checkbox
                label="Lock Aspect Ratio"
                checked={selectedLayout.lockAspectRatio}
                onChange={(event) => handleLayoutChange('lockAspectRatio', event.currentTarget.checked)}
                disabled={!selectedLayout.resizable}
              />
              
              <NumberInput
                label="Percentage"
                value={selectedLayout.percentage}
                onChange={(value) => handleLayoutChange('percentage', value)}
                min={1}
                max={100}
                step={1}
              />
              
              <Group justify="flex-end" mt="xl">
                <Button onClick={handleSaveLayout} color="blue">
                  Save Changes
                </Button>
              </Group>
            </Stack>
          ) : (
            <Text>Select a layout to view and edit its properties</Text>
          )}
        </Box>
      </Group>
    </Modal>
  );
}
