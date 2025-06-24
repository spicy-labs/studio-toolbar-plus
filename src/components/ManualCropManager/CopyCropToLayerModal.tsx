import React, { useState, useEffect, useMemo } from "react";
import {
  Modal,
  Box,
  TextInput,
  Group,
  ActionIcon,
  Button,
  ScrollArea,
  Text,
  Checkbox,
  Collapse,
  Stack,
  Loader,
  Center,
} from "@mantine/core";
import {
  IconSearch,
  IconChevronDown,
  IconChevronRight,
  IconCrop,
} from "@tabler/icons-react";
import { appStore } from "../../modalStore";
import { getStudio } from "../../studio/studioAdapter";
import { getAllLayouts } from "../../studio/layoutHandler";
import { getManualCropsFromDocByConnector } from "../../studio-adapter/getManualCropsFromDocByConnector";
import type { Layout } from "@chili-publish/studio-sdk";
import type { ManualCrop } from "../../studio-adapter/manualCropTypes";

interface LayoutNode {
  id: string;
  name: string;
  parentId?: string;
  children: LayoutNode[];
  isExpanded: boolean;
  hasManualCrops: boolean;
  level: number;
}

interface CopyCropToLayerModalProps {
  opened: boolean;
  onClose: () => void;
  sourceLayoutId: string;
  checkedCrops: ManualCrop[];
  selectedConnectorId: string;
  onCopy: (
    targetLayoutIds: string[],
    checkedCrops: ManualCrop[]
  ) => Promise<void>;
}

export function CopyCropToLayerModal({
  opened,
  onClose,
  sourceLayoutId,
  checkedCrops,
  selectedConnectorId,
  onCopy,
}: CopyCropToLayerModalProps) {
  const [layouts, setLayouts] = useState<LayoutNode[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [expandedLayouts, setExpandedLayouts] = useState<Set<string>>(
    new Set()
  );
  const [selectedLayoutIds, setSelectedLayoutIds] = useState<string[]>([]);
  const raiseError = appStore((store) => store.raiseError);

  // Load layouts on component mount
  useEffect(() => {
    if (opened) {
      loadLayouts();
      setSelectedLayoutIds([]);
      setSearchQuery("");
    }
  }, [opened]);

  // Update manual crop indicators when connector changes
  useEffect(() => {
    if (selectedConnectorId && opened) {
      updateManualCropIndicators();
    }
  }, [selectedConnectorId, opened]);

  const loadLayouts = async () => {
    try {
      setIsLoading(true);
      const studioResult = await getStudio();
      if (!studioResult.isOk()) {
        raiseError(
          new Error("Failed to get studio: " + studioResult.error?.message)
        );
        return;
      }

      const layoutsResult = await getAllLayouts(studioResult.value);

      if (!layoutsResult.isOk()) {
        raiseError(
          new Error("Failed to load layouts: " + layoutsResult.error?.message)
        );
        return;
      }

      const layoutsData = layoutsResult.value as Layout[];
      const layoutNodes = buildLayoutTree(layoutsData);
      setLayouts(layoutNodes);
    } catch (error) {
      raiseError(
        error instanceof Error ? error : new Error("Failed to load layouts")
      );
    } finally {
      setIsLoading(false);
    }
  };

  const updateManualCropIndicators = async () => {
    if (!selectedConnectorId) return;

    try {
      const studioResult = await getStudio();
      if (!studioResult.isOk()) {
        raiseError(
          new Error("Failed to get studio: " + studioResult.error?.message)
        );
        return;
      }

      const cropsResult = await getManualCropsFromDocByConnector(
        studioResult.value,
        selectedConnectorId
      );

      if (cropsResult.isError()) {
        raiseError(
          new Error(
            `Failed to load manual crops: ${cropsResult.error?.message}`
          )
        );
        return;
      }

      if (!cropsResult.isOk()) {
        raiseError(new Error("Failed to load manual crops: Invalid result"));
        return;
      }

      const cropsData = cropsResult.value;
      const layoutsWithCrops = new Set(cropsData.layouts.map((l) => l.id));

      setLayouts((prevLayouts) =>
        updateLayoutCropIndicators(prevLayouts, layoutsWithCrops)
      );
    } catch (error) {
      raiseError(
        error instanceof Error
          ? error
          : new Error("Failed to update manual crop indicators")
      );
    }
  };

  const updateLayoutCropIndicators = (
    layouts: LayoutNode[],
    layoutsWithCrops: Set<string>
  ): LayoutNode[] => {
    return layouts.map((layout) => ({
      ...layout,
      hasManualCrops: layoutsWithCrops.has(layout.id),
      children: updateLayoutCropIndicators(layout.children, layoutsWithCrops),
    }));
  };

  const buildLayoutTree = (layouts: Layout[]): LayoutNode[] => {
    const layoutMap = new Map<string, LayoutNode>();
    const rootLayouts: LayoutNode[] = [];

    // Create layout nodes
    layouts.forEach((layout) => {
      layoutMap.set(layout.id, {
        id: layout.id,
        name: layout.name,
        parentId: layout.parentId,
        children: [],
        isExpanded: false,
        hasManualCrops: false,
        level: 0,
      });
    });

    // Build tree structure
    layouts.forEach((layout) => {
      const node = layoutMap.get(layout.id)!;
      if (layout.parentId) {
        const parent = layoutMap.get(layout.parentId);
        if (parent) {
          parent.children.push(node);
          node.level = parent.level + 1;
        }
      } else {
        rootLayouts.push(node);
      }
    });

    return rootLayouts;
  };

  const filteredLayouts = useMemo(() => {
    if (!searchQuery.trim()) return layouts;

    const filterLayouts = (layouts: LayoutNode[]): LayoutNode[] => {
      return layouts.reduce((acc: LayoutNode[], layout) => {
        const matchesSearch = layout.name
          .toLowerCase()
          .includes(searchQuery.toLowerCase());
        const filteredChildren = filterLayouts(layout.children);

        if (matchesSearch || filteredChildren.length > 0) {
          acc.push({
            ...layout,
            children: filteredChildren,
            isExpanded: filteredChildren.length > 0 ? true : layout.isExpanded,
          });
        }

        return acc;
      }, []);
    };

    return filterLayouts(layouts);
  }, [layouts, searchQuery]);

  const toggleLayoutExpanded = (layoutId: string) => {
    setExpandedLayouts((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(layoutId)) {
        newSet.delete(layoutId);
      } else {
        newSet.add(layoutId);
      }
      return newSet;
    });
  };

  const expandAll = () => {
    const allLayoutIds = new Set<string>();
    const collectIds = (layouts: LayoutNode[]) => {
      layouts.forEach((layout) => {
        if (layout.children.length > 0) {
          allLayoutIds.add(layout.id);
        }
        collectIds(layout.children);
      });
    };
    collectIds(layouts);
    setExpandedLayouts(allLayoutIds);
  };

  const collapseAll = () => {
    setExpandedLayouts(new Set());
  };

  const deselectAll = () => {
    setSelectedLayoutIds([]);
  };

  const toggleLayoutSelection = (layoutId: string) => {
    // Don't allow selection of the source layout
    if (layoutId === sourceLayoutId) return;

    const newSelection = selectedLayoutIds.includes(layoutId)
      ? selectedLayoutIds.filter((id) => id !== layoutId)
      : [...selectedLayoutIds, layoutId];
    setSelectedLayoutIds(newSelection);
  };

  const handleCopy = async () => {
    try {
      await onCopy(selectedLayoutIds, checkedCrops);
      onClose();
    } catch (error) {
      raiseError(
        error instanceof Error ? error : new Error("Failed to copy crops")
      );
    }
  };

  if (isLoading) {
    return (
      <Modal
        opened={opened}
        onClose={onClose}
        title="Copy Crops to Layouts"
        size="lg"
      >
        <Center style={{ height: 400 }}>
          <Loader size="sm" />
        </Center>
      </Modal>
    );
  }

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Copy Crops to Layouts"
      size="lg"
    >
      <Box style={{ height: 500, display: "flex", flexDirection: "column" }}>
        {/* Search and Controls */}
        <Box
          p="md"
          style={{ borderBottom: "1px solid var(--mantine-color-gray-3)" }}
        >
          <Stack gap="xs">
            <TextInput
              placeholder="Search layouts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              leftSection={<IconSearch size={16} />}
              size="sm"
            />
            <Group gap="xs">
              <Button variant="subtle" size="xs" onClick={expandAll}>
                Expand All
              </Button>
              <Button variant="subtle" size="xs" onClick={collapseAll}>
                Collapse All
              </Button>
              <Button variant="subtle" size="xs" onClick={deselectAll}>
                Deselect All
              </Button>
            </Group>
          </Stack>
        </Box>

        {/* Layout Tree */}
        <ScrollArea style={{ flex: 1 }}>
          <Box p="md">
            <CopyLayoutTree
              layouts={filteredLayouts}
              selectedLayoutIds={selectedLayoutIds}
              expandedLayouts={expandedLayouts}
              sourceLayoutId={sourceLayoutId}
              onToggleExpanded={toggleLayoutExpanded}
              onToggleSelection={toggleLayoutSelection}
            />
          </Box>
        </ScrollArea>

        {/* Footer with buttons */}
        <Group
          justify="space-between"
          p="md"
          style={{ borderTop: "1px solid var(--mantine-color-gray-3)" }}
        >
          <Text size="sm">Layouts Selected: {selectedLayoutIds.length}</Text>
          <Group gap="md">
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
            <Button
              onClick={handleCopy}
              disabled={selectedLayoutIds.length === 0}
              color="blue"
            >
              Copy
            </Button>
          </Group>
        </Group>
      </Box>
    </Modal>
  );
}

interface CopyLayoutTreeProps {
  layouts: LayoutNode[];
  selectedLayoutIds: string[];
  expandedLayouts: Set<string>;
  sourceLayoutId: string;
  onToggleExpanded: (layoutId: string) => void;
  onToggleSelection: (layoutId: string) => void;
}

function CopyLayoutTree({
  layouts,
  selectedLayoutIds,
  expandedLayouts,
  sourceLayoutId,
  onToggleExpanded,
  onToggleSelection,
}: CopyLayoutTreeProps) {
  return (
    <Stack gap="xs">
      {layouts.map((layout) => (
        <CopyLayoutTreeItem
          key={layout.id}
          layout={layout}
          selectedLayoutIds={selectedLayoutIds}
          expandedLayouts={expandedLayouts}
          sourceLayoutId={sourceLayoutId}
          onToggleExpanded={onToggleExpanded}
          onToggleSelection={onToggleSelection}
        />
      ))}
    </Stack>
  );
}

interface CopyLayoutTreeItemProps {
  layout: LayoutNode;
  selectedLayoutIds: string[];
  expandedLayouts: Set<string>;
  sourceLayoutId: string;
  onToggleExpanded: (layoutId: string) => void;
  onToggleSelection: (layoutId: string) => void;
}

function CopyLayoutTreeItem({
  layout,
  selectedLayoutIds,
  expandedLayouts,
  sourceLayoutId,
  onToggleExpanded,
  onToggleSelection,
}: CopyLayoutTreeItemProps) {
  const hasChildren = layout.children.length > 0;
  const isExpanded = expandedLayouts.has(layout.id);
  const isSelected = selectedLayoutIds.includes(layout.id);
  const isSourceLayout = layout.id === sourceLayoutId;

  return (
    <Box>
      <Group
        gap="xs"
        style={{
          paddingLeft: layout.level * 20,
          padding: "4px 8px",
          borderRadius: "4px",
          backgroundColor: isSelected
            ? "var(--mantine-color-blue-1)"
            : isSourceLayout
            ? "var(--mantine-color-gray-2)"
            : "transparent",
          opacity: isSourceLayout ? 0.5 : 1,
        }}
      >
        {hasChildren ? (
          <ActionIcon
            variant="subtle"
            size="xs"
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpanded(layout.id);
            }}
          >
            {isExpanded ? (
              <IconChevronDown size={12} />
            ) : (
              <IconChevronRight size={12} />
            )}
          </ActionIcon>
        ) : (
          <Box style={{ width: 20 }} />
        )}

        <IconCrop size={14} color={layout.hasManualCrops ? "orange" : "gray"} />

        <Text
          size="sm"
          style={{
            flex: 1,
            cursor: isSourceLayout ? "not-allowed" : "pointer",
            color: layout.hasManualCrops ? "orange" : undefined,
          }}
          onClick={() => onToggleSelection(layout.id)}
        >
          {layout.name} {isSourceLayout && "(Source - Cannot Select)"}
        </Text>
      </Group>

      {hasChildren && isExpanded && (
        <CopyLayoutTree
          layouts={layout.children}
          selectedLayoutIds={selectedLayoutIds}
          expandedLayouts={expandedLayouts}
          sourceLayoutId={sourceLayoutId}
          onToggleExpanded={onToggleExpanded}
          onToggleSelection={onToggleSelection}
        />
      )}
    </Box>
  );
}
