import { useEffect, useState } from "react";
import {
  Modal,
  Group,
  Box,
  Title,
  Button,
  ScrollArea,
  Loader,
  Center,
} from "@mantine/core";
import { appStore } from "../modalStore";
import { getStudio } from "../studio/studioAdapter";
import {
  getCurrentDocumentState,
  loadDocumentFromJsonStr,
} from "../studio/documentHandler";
import { LayoutOrganizerTree } from "./LayoutOrganizerTree";

interface LayoutOrganizerModalProps {
  opened: boolean;
  onClose: () => void;
}

// Interface for layout node with hierarchical structure
interface LayoutNode {
  id: string;
  name: string;
  parentId?: string;
  childLayouts?: string[];
  children?: LayoutNode[];
  level: number;
  isExpanded: boolean;
  frameProperties?: {
    [frameId: string]: any;
  };
}

export function LayoutOrganizerModal({
  opened,
  onClose,
}: LayoutOrganizerModalProps) {
  const [layouts, setLayouts] = useState<LayoutNode[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [documentState, setDocumentState] = useState<any>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const raiseError = appStore((store) => store.raiseError);

  // Function to flatten the hierarchical layout structure back to an array
  const flattenLayoutHierarchy = (layouts: LayoutNode[]): any[] => {
    const result: any[] = [];

    const processLayout = (layout: LayoutNode) => {
      // Create a copy of the layout without the children and level properties
      const { children, level, isExpanded, ...layoutCopy } = layout;

      // Ensure parentId is a string or undefined, not null
      // This fixes the "Failed to parse parentId" error
      if (layoutCopy.parentId === null) {
        layoutCopy.parentId = undefined;
      }

      // Add the layout to the result
      result.push(layoutCopy);

      // Process children
      if (children) {
        for (const child of children) {
          processLayout(child);
        }
      }
    };

    // Process all root layouts
    for (const layout of layouts) {
      processLayout(layout);
    }

    return result;
  };

  // Handle modal close with saving changes if needed
  const handleClose = async () => {
    if (hasChanges && documentState) {
      setIsLoading(true);
      try {
        // Get the studio instance
        const studioResult = await getStudio();
        if (studioResult.isError()) {
          raiseError(studioResult.error);
          onClose();
          return;
        }

        const studioInstance = studioResult.value;

        // Update the document state with the modified layouts
        const updatedDocumentState = {
          ...documentState,
          layouts: flattenLayoutHierarchy(layouts),
        };

        // Convert to JSON string and load it
        try {
          // First, ensure all parentId values are strings or undefined (not null)
          const sanitizedDocumentState = {
            ...updatedDocumentState,
            layouts: updatedDocumentState.layouts.map((layout: any) => {
              const { parentId, ...rest } = layout;
              return parentId === null ? rest : { ...rest, parentId };
            }),
          };

          const jsonStr = JSON.stringify(sanitizedDocumentState);
          console.log(
            "Saving document with layouts:",
            sanitizedDocumentState.layouts,
          );

          //@ts-ignore
          window.testz = sanitizedDocumentState;

          const loadResult = await loadDocumentFromJsonStr(
            studioInstance,
            jsonStr,
          );

          if (loadResult.isError()) {
            raiseError(
              new Error(`Failed to save document: ${loadResult.error.message}`),
            );
          }
        } catch (error) {
          raiseError(
            new Error(
              `Error processing document: ${
                error instanceof Error ? error.message : String(error)
              }`,
            ),
          );
        }
      } catch (error) {
        raiseError(error instanceof Error ? error : new Error(String(error)));
      } finally {
        setIsLoading(false);
        onClose();
      }
    } else {
      onClose();
    }
  };

  // Load layouts when the modal is opened
  useEffect(() => {
    if (opened) {
      loadLayouts();
    }
  }, [opened]);

  // Load layouts from the document
  const loadLayouts = async () => {
    setIsLoading(true);
    try {
      // Get the studio instance
      const studioResult = await getStudio();
      if (studioResult.isError()) {
        raiseError(studioResult.error);
        setIsLoading(false);
        return;
      }

      const studioInstance = studioResult.value;

      // Get the current document state
      const documentResult = await getCurrentDocumentState(studioInstance);
      if (documentResult.isError()) {
        raiseError(documentResult.error);
        setIsLoading(false);
        return;
      }

      // Store the original document state
      setDocumentState(documentResult.value);

      // Reset the changes flag
      setHasChanges(false);

      // Process layouts into hierarchical structure
      const documentLayouts = documentResult.value?.layouts || [];
      const processedLayouts = processLayoutsIntoHierarchy(documentLayouts);
      setLayouts(processedLayouts);
    } catch (error) {
      raiseError(error instanceof Error ? error : new Error(String(error)));
    } finally {
      setIsLoading(false);
    }
  };

  // Process layouts into a hierarchical structure
  const processLayoutsIntoHierarchy = (layouts: any[]): LayoutNode[] => {
    // Create a map for quick lookup
    const layoutMap = new Map<string, LayoutNode>();

    // First pass: Create LayoutNode objects
    layouts.forEach((layout) => {
      layoutMap.set(layout.id, {
        id: layout.id,
        name: layout.name,
        // Ensure parentId is undefined (not null) if it doesn't exist
        parentId: layout.parentId === null ? undefined : layout.parentId,
        childLayouts: layout.childLayouts || [],
        level: 0, // Will be calculated in the next pass
        isExpanded: false, // Initially collapsed
        // Copy frameProperties if they exist
        frameProperties: layout.frameProperties
          ? { ...layout.frameProperties }
          : undefined,
      });
    });

    // Second pass: Build the hierarchy and calculate levels
    const rootLayouts: LayoutNode[] = [];

    // First identify the top-level layout (the one without a parentId)
    let topLevelLayout: LayoutNode | undefined;

    layoutMap.forEach((layout) => {
      if (!layout.parentId) {
        // This is the top-level layout
        layout.level = 0;
        topLevelLayout = layout;
        rootLayouts.push(layout);
      }
    });

    // Then process all other layouts
    layoutMap.forEach((layout) => {
      if (layout.parentId) {
        // This is a child layout
        const parent = layoutMap.get(layout.parentId);
        if (parent) {
          if (!parent.children) {
            parent.children = [];
          }
          layout.level = parent.level + 1;
          parent.children.push(layout);
        } else {
          // Parent not found but has parentId, might be an error
          // For safety, attach to top level layout if it exists
          if (topLevelLayout) {
            if (!topLevelLayout.children) {
              topLevelLayout.children = [];
            }
            layout.level = 1;
            layout.parentId = topLevelLayout.id; // Update parentId to match top level
            topLevelLayout.children.push(layout);
          } else {
            // No top level layout found, treat as root
            layout.level = 0;
            rootLayouts.push(layout);
          }
        }
      }
    });

    // Sort layouts at each level by name
    const sortLayoutsByName = (layouts: LayoutNode[]): LayoutNode[] => {
      return layouts
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((layout) => {
          if (layout.children && layout.children.length > 0) {
            layout.children = sortLayoutsByName(layout.children);
          }
          return layout;
        });
    };

    return sortLayoutsByName(rootLayouts);
  };

  // Toggle the expanded state of a layout
  const toggleLayoutExpanded = (layoutId: string) => {
    const updateLayoutExpanded = (layouts: LayoutNode[]): LayoutNode[] => {
      return layouts.map((layout) => {
        if (layout.id === layoutId) {
          return { ...layout, isExpanded: !layout.isExpanded };
        }
        if (layout.children) {
          return { ...layout, children: updateLayoutExpanded(layout.children) };
        }
        return layout;
      });
    };

    setLayouts(updateLayoutExpanded(layouts));
  };

  // Flatten the hierarchical structure for rendering
  const flattenLayouts = (
    layouts: LayoutNode[],
    visible: boolean = true,
  ): LayoutNode[] => {
    let result: LayoutNode[] = [];

    layouts.forEach((layout) => {
      // Add the current layout if it's visible
      if (visible) {
        result.push(layout);
      }

      // Add children if the layout is expanded
      if (layout.children && layout.isExpanded) {
        result = result.concat(flattenLayouts(layout.children, visible));
      }
    });

    return result;
  };

  // We use the hierarchical structure directly in the LayoutOrganizerTree component

  // Handle reparenting of layouts
  const handleReparentLayout = (
    childId: string,
    oldParentId: string | undefined,
    newParentId: string,
  ) => {
    // Create a deep copy of the layouts to work with
    const updatedLayouts = JSON.parse(JSON.stringify(layouts));

    // Find the child, old parent, and new parent layouts
    const findLayoutById = (
      id: string,
      nodes: LayoutNode[],
    ): LayoutNode | null => {
      for (const node of nodes) {
        if (node.id === id) return node;
        if (node.children) {
          const found = findLayoutById(id, node.children);
          if (found) return found;
        }
      }
      return null;
    };

    const removeChildFromParent = (
      childId: string,
      parentId: string | undefined,
      nodes: LayoutNode[],
    ) => {
      // If parentId is undefined, this is a top-level layout which can't be removed
      if (!parentId) return;

      const parent = findLayoutById(parentId, nodes);
      if (parent && parent.children) {
        parent.children = parent.children.filter(
          (child) => child.id !== childId,
        );

        // Also remove from childLayouts array if it exists
        if (parent.childLayouts) {
          parent.childLayouts = parent.childLayouts.filter(
            (id) => id !== childId,
          );
        }
      }
    };

    const addChildToParent = (
      child: LayoutNode,
      parentId: string,
      nodes: LayoutNode[],
    ) => {
      const parent = findLayoutById(parentId, nodes);
      if (parent) {
        // Update child's parentId
        child.parentId = parentId;

        // Add to parent's children array
        if (!parent.children) {
          parent.children = [];
        }
        parent.children.push(child);

        // Add to parent's childLayouts array if it exists
        if (!parent.childLayouts) {
          parent.childLayouts = [];
        }
        if (!parent.childLayouts.includes(child.id)) {
          parent.childLayouts.push(child.id);
        }
      }
    };

    // Find the child layout
    const childLayout = findLayoutById(childId, updatedLayouts);
    if (!childLayout) {
      raiseError(new Error(`Child layout with ID ${childId} not found`));
      return;
    }

    // Remove child from old parent
    if (oldParentId) {
      removeChildFromParent(childId, oldParentId, updatedLayouts);
    }

    // Add child to new parent
    addChildToParent(childLayout, newParentId, updatedLayouts);

    // Implement frame property inheritance logic
    // For each frame in the moved layout, we need to apply the inherited properties
    const applyFramePropertyInheritance = (
      childLayout: LayoutNode,
      newParentId: string,
    ) => {
      // Skip if there are no frameProperties
      if (!childLayout.frameProperties) {
        return;
      }

      // Get the old parent chain (from top to bottom)
      const getParentChain = (
        layoutId: string | undefined,
        layouts: LayoutNode[],
      ): LayoutNode[] => {
        // If layoutId is undefined, we've reached the top of the hierarchy
        if (!layoutId) return [];

        const parent = findLayoutById(layoutId, layouts);
        // If parent not found, return empty array
        if (!parent) return [];

        // Get the parent chain recursively
        const parentChain = getParentChain(parent.parentId, layouts);
        // Add the current parent to the chain
        return [...parentChain, parent];
      };

      // We don't need the old parent chain for the current implementation
      // but we might need it for more complex inheritance scenarios

      // Get new parent chain
      const newParentChain = getParentChain(newParentId, updatedLayouts);

      // For each frame in the child layout
      Object.keys(childLayout.frameProperties || {}).forEach((frameId) => {
        const frameProps = childLayout.frameProperties![frameId];

        // Create a new merged properties object by applying properties from the new parent chain
        let mergedProps = {};

        // Apply properties from the new parent chain (from top to bottom)
        for (const parent of newParentChain) {
          if (parent.frameProperties && parent.frameProperties[frameId]) {
            mergedProps = {
              ...mergedProps,
              ...parent.frameProperties[frameId],
            };
          }
        }

        // Finally, apply the child's own properties
        mergedProps = { ...mergedProps, ...frameProps };

        // Update the child's frame properties
        childLayout.frameProperties![frameId] = mergedProps;
      });

      // Recursively apply to all children of the moved layout
      if (childLayout.children) {
        for (const child of childLayout.children) {
          applyFramePropertyInheritance(child, childLayout.id);
        }
      }
    };

    // Apply frame property inheritance
    applyFramePropertyInheritance(childLayout, newParentId);

    // Update the layouts state
    setLayouts(updatedLayouts);

    // Mark that we have changes to save
    setHasChanges(true);
  };

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      title="Layout Organizer"
      size="xl"
      fullScreen
      centered
    >
      <Box
        style={{
          height: "calc(100vh - 120px)",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <Group justify="space-between" mb="md">
          <Title order={4}>Layout Hierarchy</Title>
          <Button onClick={loadLayouts} disabled={isLoading}>
            Refresh
          </Button>
        </Group>

        <ScrollArea style={{ flex: 1 }}>
          {isLoading ? (
            <Center style={{ height: "100%" }}>
              <Loader size="lg" />
            </Center>
          ) : (
            <LayoutOrganizerTree
              layouts={layouts}
              toggleLayoutExpanded={toggleLayoutExpanded}
              onReparentLayout={handleReparentLayout}
            />
          )}
        </ScrollArea>
      </Box>
    </Modal>
  );
}
