import React, { useState } from "react";
import { Group, MultiSelect, Checkbox, Tree, Drawer, Button, getTreeExpandedState, useTree } from "@mantine/core";
import type { TreeNodeData as MantineTreeNodeData } from "@mantine/core";
import { IconChevronDown } from "@tabler/icons-react";
import type { LayoutMap } from "../../types/layoutConfigTypes.ts";
import type { Layout } from "../../types/docStateTypes.ts";
import { useAppStore } from "../../modalStore.ts";

// Extended TreeNodeData with disabled property
interface TreeNodeData extends MantineTreeNodeData {
  disabled?: boolean;
}

type LayoutMultiSelectProps = {
  layoutConfig: LayoutMap;
  showButton: boolean;
  // onChange: (updatedLayouts: Layout[]) => void;
};

// Helper function to convert document layouts to tree data format
const buildTreeData = (
  documentLayouts: Layout[],
  selectedLayoutIds: string[],
  disabledLayoutIds: string[]
): TreeNodeData[] => {
  // Create a map to organize layouts by parent
  const layoutsByParent: Record<string, Layout[]> = {};
  
  // Group layouts by parentId
  documentLayouts.forEach((layout) => {
    const parentId = layout.parentId || "root";
    if (!layoutsByParent[parentId]) {
      layoutsByParent[parentId] = [];
    }
    layoutsByParent[parentId].push(layout);
  });
  
  // Recursive function to build the tree
  const buildNodes = (parentId: string = "root"): TreeNodeData[] => {
    const children = layoutsByParent[parentId] || [];
    return children.map((layout) => ({
      value: layout.id,
      label: layout.name,
      disabled: disabledLayoutIds.includes(layout.id),
      children: buildNodes(layout.id),
    }));
  };
  
  return buildNodes();
};

export const LayoutMultiSelect: React.FC<LayoutMultiSelectProps> = ({
  layoutConfig,
  showButton,
  // onChange
}) => {
  const { state, effects: events } = useAppStore();
  const [drawerOpened, setDrawerOpened] = useState(false);
  const [selectedLayouts, setSelectedLayouts] = useState<string[]>(
    state.studio.layoutImageMapping.find((lc) => lc.id === layoutConfig.id)?.layoutIds || []
  );
  
  // Get all layout IDs that are already assigned to other LayoutMaps
  const assignedToOtherMaps = state.studio.layoutImageMapping
    .filter((map) => map.id !== layoutConfig.id) // Exclude current map
    .flatMap((map) => map.layoutIds); // Get all layout IDs from other maps

  const handleMultiSelectChange = (updateLayoutIds: string[]) => {
    events.studio.layoutImageMapping.setLayoutIds({
      mapId: layoutConfig.id,
      layoutIds: updateLayoutIds,
    });
  };
  
  const handleSave = () => {
    handleMultiSelectChange(selectedLayouts);
    setDrawerOpened(false);
  };
  
  const handleToggleLayout = (layoutId: string) => {
    setSelectedLayouts((prev) => {
      if (prev.includes(layoutId)) {
        return prev.filter((id) => id !== layoutId);
      } else {
        return [...prev, layoutId];
      }
    });
  };
  
  // Build tree data from layouts
  const treeData = buildTreeData(
    state.studio.document.layouts,
    selectedLayouts,
    assignedToOtherMaps
  );
  
  // Custom render function for tree nodes
  const renderTreeNode = ({
    node,
    expanded,
    hasChildren,
    elementProps
  }: {
    node: TreeNodeData;
    expanded: boolean;
    hasChildren: boolean;
    elementProps: React.HTMLAttributes<HTMLDivElement>;
  }) => {
    const isDisabled = node.disabled;
    const isChecked = selectedLayouts.includes(node.value);
    
    return (
      <Group gap="xs" {...elementProps}>
        <Checkbox.Indicator
          checked={isChecked}
          disabled={isDisabled}
          onClick={(e) => {
            e.stopPropagation();
            if (!isDisabled) {
              handleToggleLayout(node.value);
            }
          }}
        />
        
        <Group gap={5} style={{
          color: isDisabled ? 'var(--mantine-color-gray-6)' : undefined,
          cursor: isDisabled ? 'not-allowed' : 'pointer'
        }}>
          <span>{node.label}</span>
          
          {hasChildren && (
            <IconChevronDown
              size={14}
              color={isDisabled ? 'var(--mantine-color-gray-6)' : undefined}
              style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
            />
          )}
        </Group>
      </Group>
    );
  };

  return (
    <>
      <Group>
        <MultiSelect
          data={state.studio.document.layouts.map((layout) => {
            return {
              value: layout.id,
              label: layout.name,
              disabled: assignedToOtherMaps.includes(layout.id),
            };
          })}
          value={
            state.studio.layoutImageMapping.find((lc) => lc.id === layoutConfig.id)
              ?.layoutIds
          }
          onChange={handleMultiSelectChange}
          placeholder="Select layouts"
          searchable
          clearable
          styles={{
            root: {
              width: showButton ? "80%" : "100%",
            },
          }}
        />

        {showButton && (
          <Button onClick={() => setDrawerOpened(true)}>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              width="24"
              height="24"
              strokeWidth="2"
            >
              <path d="M13 5h8"></path>
              <path d="M13 9h5"></path>
              <path d="M13 15h8"></path>
              <path d="M13 19h5"></path>
              <path d="M3 4m0 1a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1z"></path>
              <path d="M3 14m0 1a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1z"></path>
            </svg>
            <span style={{ marginLeft: "10px" }}>Open Selector</span>
          </Button>
        )}
      </Group>
      
      <Drawer
        opened={drawerOpened}
        onClose={() => setDrawerOpened(false)}
        title="Select Layouts"
        position="right"
        size="md"
        padding="md"
      >
        <div style={{ marginBottom: "20px" }}>
          <Tree
            data={treeData}
            renderNode={renderTreeNode}
            expandOnClick={true}
          />
        </div>
        
        <Button fullWidth onClick={handleSave}>
          Save
        </Button>
      </Drawer>
    </>
  );
};
