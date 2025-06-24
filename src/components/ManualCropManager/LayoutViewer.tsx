import { useState, useEffect, useMemo, useCallback } from "react";
import {
  Box,
  TextInput,
  Group,
  ActionIcon,
  Button,
  ScrollArea,
  Text,
  Checkbox,
  Stack,
  Loader,
  Center,
  Popover,
  MultiSelect,
  Tooltip,
} from "@mantine/core";
import {
  IconSearch,
  IconChevronDown,
  IconChevronRight,
  IconCrop,
  IconFilter,
  IconFilterFilled,
  IconEyeClosed,
} from "@tabler/icons-react";
import { appStore } from "../../modalStore";
import { getStudio } from "../../studio/studioAdapter";
import { getAllLayouts } from "../../studio/layoutHandler";
import { getManualCropsFromDocByConnector } from "../../studio-adapter/getManualCropsFromDocByConnector";
import type { Layout } from "@chili-publish/studio-sdk";

interface LayoutNode {
  id: string;
  name: string;
  parentId?: string;
  children: LayoutNode[];
  isExpanded: boolean;
  hasManualCrops: boolean;
  level: number;
  isVisible?: boolean;
  isFilteredParent?: boolean; // Parent shown only because it has filtered children
}

interface LayoutViewerProps {
  selectedLayoutIds: string[];
  onSelectionChange: (layoutIds: string[]) => void;
  selectedConnectorId: string;
  onRefreshFunctionReady?: (refreshFn: () => void) => void;
}

export function LayoutViewer({
  selectedLayoutIds,
  onSelectionChange,
  selectedConnectorId,
  onRefreshFunctionReady,
}: LayoutViewerProps) {
  const [layouts, setLayouts] = useState<LayoutNode[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [expandedLayouts, setExpandedLayouts] = useState<Set<string>>(
    new Set()
  );
  const [isInitialized, setIsInitialized] = useState(false);
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [isFilterPopoverOpen, setIsFilterPopoverOpen] = useState(false);
  const raiseError = appStore((store) => store.raiseError);

  // Load expanded layouts from sessionStorage on component mount
  useEffect(() => {
    const storedExpanded = sessionStorage.getItem(
      "tempManualCropManager_layoutsExpanded"
    );
    if (storedExpanded) {
      try {
        const expandedIds = JSON.parse(storedExpanded) as string[];
        setExpandedLayouts(new Set(expandedIds));
      } catch (error) {
        // If parsing fails, just use empty set
        setExpandedLayouts(new Set());
      }
    }
    setIsInitialized(true);
  }, []);

  // Load filters from localStorage on component mount
  useEffect(() => {
    const storedFilters = localStorage.getItem(
      "tempManualCropManager_layoutViewerFilters"
    );
    if (storedFilters) {
      try {
        const filters = JSON.parse(storedFilters) as string[];
        setActiveFilters(filters);
      } catch (error) {
        // If parsing fails, just use empty array
        setActiveFilters([]);
      }
    }
  }, []);

  // Load layouts on component mount
  useEffect(() => {
    loadLayouts();
  }, []);

  // Save expanded layouts to sessionStorage whenever they change (only after initialization)
  useEffect(() => {
    if (isInitialized) {
      const expandedIds = Array.from(expandedLayouts);
      sessionStorage.setItem(
        "tempManualCropManager_layoutsExpanded",
        JSON.stringify(expandedIds)
      );
    }
  }, [expandedLayouts, isInitialized]);

  // Save filters to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem(
      "tempManualCropManager_layoutViewerFilters",
      JSON.stringify(activeFilters)
    );
  }, [activeFilters]);

  // Update manual crop indicators when connector changes
  useEffect(() => {
    if (selectedConnectorId) {
      updateManualCropIndicators();
    }
  }, [selectedConnectorId]);

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

  const updateManualCropIndicators = useCallback(async () => {
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
  }, [selectedConnectorId, raiseError]);

  // Expose refresh function to parent component
  useEffect(() => {
    if (onRefreshFunctionReady) {
      onRefreshFunctionReady(updateManualCropIndicators);
    }
  }, [onRefreshFunctionReady, updateManualCropIndicators]);

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
        // Use availableForUser property to determine visibility
        isVisible: (layout as any).availableForUser !== false,
        isFilteredParent: false,
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

  const applyFilters = (
    layouts: LayoutNode[],
    filters: string[]
  ): LayoutNode[] => {
    const hasVisibleFilter = filters.includes("Visible");
    const hasManualCropsFilter = filters.includes("With Manual Crops");

    const filterLayouts = (layouts: LayoutNode[]): LayoutNode[] => {
      return layouts.reduce((acc: LayoutNode[], layout) => {
        const filteredChildren = filterLayouts(layout.children);

        // Check if layout matches filters
        let matchesFilters = true;

        if (hasVisibleFilter && !layout.isVisible) {
          matchesFilters = false;
        }

        if (hasManualCropsFilter && !layout.hasManualCrops) {
          matchesFilters = false;
        }

        // Include layout if it matches filters OR if it has children that match
        if (matchesFilters || filteredChildren.length > 0) {
          acc.push({
            ...layout,
            children: filteredChildren,
            // Mark as filtered parent if it doesn't match filters but has filtered children
            isFilteredParent: !matchesFilters && filteredChildren.length > 0,
          });
        }

        return acc;
      }, []);
    };

    return filterLayouts(layouts);
  };

  const filteredLayouts = useMemo(() => {
    let processedLayouts = layouts;

    // Apply active filters
    if (activeFilters.length > 0) {
      processedLayouts = applyFilters(layouts, activeFilters);
    }

    // Apply search filter
    if (!searchQuery.trim()) return processedLayouts;

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

    return filterLayouts(processedLayouts);
  }, [layouts, searchQuery, activeFilters]);

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
    onSelectionChange([]);
  };

  const toggleLayoutSelection = (layoutId: string) => {
    const newSelection = selectedLayoutIds.includes(layoutId)
      ? selectedLayoutIds.filter((id) => id !== layoutId)
      : [...selectedLayoutIds, layoutId];
    onSelectionChange(newSelection);
  };

  const toggleChildrenSelection = (layout: LayoutNode) => {
    const allChildIds = getAllChildIds(layout);
    const allChildrenSelected = allChildIds.every((id) =>
      selectedLayoutIds.includes(id)
    );

    if (allChildrenSelected) {
      // Unselect all children
      const newSelection = selectedLayoutIds.filter(
        (id) => !allChildIds.includes(id)
      );
      onSelectionChange(newSelection);
    } else {
      // Select all children
      const newSelection = [...new Set([...selectedLayoutIds, ...allChildIds])];
      onSelectionChange(newSelection);
    }
  };

  const getAllChildIds = (layout: LayoutNode): string[] => {
    const childIds: string[] = [];
    const collectIds = (node: LayoutNode) => {
      childIds.push(node.id);
      node.children.forEach(collectIds);
    };
    layout.children.forEach(collectIds);
    return childIds;
  };

  const getCheckboxState = (
    layout: LayoutNode
  ): "checked" | "unchecked" | "indeterminate" => {
    if (layout.children.length === 0) return "unchecked";

    const allChildIds = getAllChildIds(layout);
    const selectedChildIds = allChildIds.filter((id) =>
      selectedLayoutIds.includes(id)
    );

    if (selectedChildIds.length === 0) return "unchecked";
    if (selectedChildIds.length === allChildIds.length) return "checked";
    return "indeterminate";
  };

  if (isLoading) {
    return (
      <Center style={{ height: "100%" }}>
        <Loader size="sm" />
      </Center>
    );
  }

  return (
    <Box style={{ height: "100%", display: "flex", flexDirection: "column" }}>
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

            <Popover
              opened={isFilterPopoverOpen}
              onClose={() => setIsFilterPopoverOpen(false)}
              position="bottom-start"
              withArrow
            >
              <Popover.Target>
                <Tooltip label="Filter" position="top">
                  <ActionIcon
                    variant="subtle"
                    size="xs"
                    onClick={() => setIsFilterPopoverOpen(!isFilterPopoverOpen)}
                    color={activeFilters.length > 0 ? "yellow" : "gray"}
                  >
                    {activeFilters.length > 0 ? (
                      <IconFilterFilled size={14} />
                    ) : (
                      <IconFilter size={14} />
                    )}
                  </ActionIcon>
                </Tooltip>
              </Popover.Target>
              <Popover.Dropdown>
                <MultiSelect
                  label="Filter layouts"
                  placeholder="Select filters"
                  data={[
                    { value: "Visible", label: "Visible" },
                    { value: "With Manual Crops", label: "With Manual Crops" },
                  ]}
                  value={activeFilters}
                  onChange={setActiveFilters}
                  size="sm"
                  style={{ minWidth: 200 }}
                />
              </Popover.Dropdown>
            </Popover>
          </Group>
        </Stack>
      </Box>

      {/* Layout Tree */}
      <ScrollArea style={{ flex: 1 }}>
        <Box p="md">
          <LayoutTree
            layouts={filteredLayouts}
            selectedLayoutIds={selectedLayoutIds}
            expandedLayouts={expandedLayouts}
            onToggleExpanded={toggleLayoutExpanded}
            onToggleSelection={toggleLayoutSelection}
            onToggleChildrenSelection={toggleChildrenSelection}
            getCheckboxState={getCheckboxState}
          />
        </Box>
      </ScrollArea>
    </Box>
  );
}

interface LayoutTreeProps {
  layouts: LayoutNode[];
  selectedLayoutIds: string[];
  expandedLayouts: Set<string>;
  onToggleExpanded: (layoutId: string) => void;
  onToggleSelection: (layoutId: string) => void;
  onToggleChildrenSelection: (layout: LayoutNode) => void;
  getCheckboxState: (
    layout: LayoutNode
  ) => "checked" | "unchecked" | "indeterminate";
}

function LayoutTree({
  layouts,
  selectedLayoutIds,
  expandedLayouts,
  onToggleExpanded,
  onToggleSelection,
  onToggleChildrenSelection,
  getCheckboxState,
}: LayoutTreeProps) {
  return (
    <Stack gap="xs">
      {layouts.map((layout) => (
        <LayoutTreeItem
          key={layout.id}
          layout={layout}
          selectedLayoutIds={selectedLayoutIds}
          expandedLayouts={expandedLayouts}
          onToggleExpanded={onToggleExpanded}
          onToggleSelection={onToggleSelection}
          onToggleChildrenSelection={onToggleChildrenSelection}
          getCheckboxState={getCheckboxState}
        />
      ))}
    </Stack>
  );
}

interface LayoutTreeItemProps {
  layout: LayoutNode;
  selectedLayoutIds: string[];
  expandedLayouts: Set<string>;
  onToggleExpanded: (layoutId: string) => void;
  onToggleSelection: (layoutId: string) => void;
  onToggleChildrenSelection: (layout: LayoutNode) => void;
  getCheckboxState: (
    layout: LayoutNode
  ) => "checked" | "unchecked" | "indeterminate";
}

function LayoutTreeItem({
  layout,
  selectedLayoutIds,
  expandedLayouts,
  onToggleExpanded,
  onToggleSelection,
  onToggleChildrenSelection,
  getCheckboxState,
}: LayoutTreeItemProps) {
  const hasChildren = layout.children.length > 0;
  const isExpanded = expandedLayouts.has(layout.id);
  const isSelected = selectedLayoutIds.includes(layout.id);
  const checkboxState = getCheckboxState(layout);
  const isFilteredParent = layout.isFilteredParent || false;

  return (
    <Box>
      <Group
        gap="xs"
        style={{
          marginLeft: layout.level * 10,
          padding: "4px 8px",
          borderRadius: "4px",
          backgroundColor: isSelected
            ? "var(--mantine-color-blue-1)"
            : "transparent",
          opacity: isFilteredParent ? 0.5 : 1,
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

        {hasChildren && (
          <Checkbox
            checked={checkboxState === "checked"}
            indeterminate={checkboxState === "indeterminate"}
            onChange={() => onToggleChildrenSelection(layout)}
            size="sm"
            onClick={(e) => e.stopPropagation()}
            disabled={isFilteredParent}
          />
        )}

        {isFilteredParent ? (
          <IconEyeClosed size={14} color="gray" />
        ) : (
          <IconCrop
            size={14}
            color={layout.hasManualCrops ? "orange" : "gray"}
          />
        )}

        <Text
          size="sm"
          style={{
            flex: 1,
            cursor: isFilteredParent ? "default" : "pointer",
            color: layout.hasManualCrops ? "orange" : undefined,
          }}
          onClick={
            isFilteredParent ? undefined : () => onToggleSelection(layout.id)
          }
        >
          {layout.name}
        </Text>
      </Group>

      {hasChildren && isExpanded && (
        <LayoutTree
          layouts={layout.children}
          selectedLayoutIds={selectedLayoutIds}
          expandedLayouts={expandedLayouts}
          onToggleExpanded={onToggleExpanded}
          onToggleSelection={onToggleSelection}
          onToggleChildrenSelection={onToggleChildrenSelection}
          getCheckboxState={getCheckboxState}
        />
      )}
    </Box>
  );
}
