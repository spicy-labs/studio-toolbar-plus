import React, { useState } from "react";
import {
  Box,
  Group,
  Text,
  Paper,
  Stack,
  ActionIcon,
  Modal,
  Button,
} from "@mantine/core";
import {
  IconChevronRight,
  IconChevronDown,
  IconGripVertical,
} from "@tabler/icons-react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
} from "@dnd-kit/core";
import type {
  DragEndEvent,
  DragStartEvent,
  DragOverEvent,
} from "@dnd-kit/core";

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

interface LayoutOrganizerTreeProps {
  layouts: LayoutNode[];
  toggleLayoutExpanded: (layoutId: string) => void;
  onReparentLayout?: (
    childId: string,
    oldParentId: string | undefined,
    newParentId: string,
  ) => void;
}

export function LayoutOrganizerTree({
  layouts,
  toggleLayoutExpanded,
  onReparentLayout,
}: LayoutOrganizerTreeProps) {
  // We only need to track the active layout for the drag overlay
  const [activeLayout, setActiveLayout] = useState<LayoutNode | null>(null);
  const [overLayoutId, setOverLayoutId] = useState<string | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [reparentInfo, setReparentInfo] = useState<{
    childId: string;
    oldParentId: string | undefined;
    newParentId: string;
    childName: string;
    newParentName: string;
  } | null>(null);

  // Configure DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Start dragging after moving 8px
      },
    }),
  );

  // Find a layout by ID in the tree
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

  // Find the parent of a layout
  const findParentOf = (
    childId: string,
    nodes: LayoutNode[],
  ): LayoutNode | null => {
    for (const node of nodes) {
      if (node.children?.some((child) => child.id === childId)) return node;
      if (node.children) {
        const found = findParentOf(childId, node.children);
        if (found) return found;
      }
    }
    return null;
  };

  // Handle drag start
  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const draggedLayout = findLayoutById(active.id as string, layouts);

    if (draggedLayout) {
      setActiveLayout(draggedLayout);
    }
  };

  // Handle drag end
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    // Reset the over layout ID
    setOverLayoutId(null);

    if (!over || active.id === over.id) {
      setActiveLayout(null);
      return;
    }

    // Extract the target layout ID from the droppable ID
    let targetId = over.id as string;
    const match = targetId.toString().match(/^droppable-(.+)$/);
    if (match) {
      targetId = match[1];
    }

    const draggedLayout = findLayoutById(active.id as string, layouts);
    const targetLayout = findLayoutById(targetId, layouts);

    if (!draggedLayout || !targetLayout) {
      setActiveLayout(null);
      return;
    }

    // Don't allow dragging to a child of the dragged layout
    const isTargetChildOfDragged = (
      target: LayoutNode,
      dragged: LayoutNode,
    ): boolean => {
      if (!dragged.children) return false;

      for (const child of dragged.children) {
        if (child.id === target.id) return true;
        if (isTargetChildOfDragged(target, child)) return true;
      }

      return false;
    };

    // Don't allow dragging the root layout (top parent with no parentId)
    if (!draggedLayout.parentId) {
      setActiveLayout(null);
      return;
    }

    // Don't allow dragging to a child of the dragged layout
    if (isTargetChildOfDragged(targetLayout, draggedLayout)) {
      setActiveLayout(null);
      return;
    }

    // Find the current parent
    const currentParent = findParentOf(draggedLayout.id, layouts);

    // Show confirmation modal
    setReparentInfo({
      childId: draggedLayout.id,
      oldParentId: currentParent?.id,
      newParentId: targetLayout.id,
      childName: draggedLayout.name,
      newParentName: targetLayout.name,
    });
    setShowConfirmModal(true);

    // Reset active state
    setActiveLayout(null);
  };

  // Handle reparent confirmation
  const handleConfirmReparent = () => {
    if (reparentInfo && onReparentLayout) {
      onReparentLayout(
        reparentInfo.childId,
        reparentInfo.oldParentId,
        reparentInfo.newParentId,
      );
    }
    setShowConfirmModal(false);
    setReparentInfo(null);
  };

  // Handle drag over
  const handleDragOver = (event: DragOverEvent) => {
    const { over } = event;

    if (over) {
      // Extract the layout ID from the droppable ID
      const match = over.id.toString().match(/^droppable-(.+)$/);
      if (match) {
        setOverLayoutId(match[1]);
      }
    } else {
      setOverLayoutId(null);
    }
  };

  // Recursive function to render the tree
  const renderLayoutTree = (layouts: LayoutNode[]) => {
    return layouts.map((layout) => (
      <React.Fragment key={layout.id}>
        <LayoutItem
          layout={layout}
          toggleLayoutExpanded={toggleLayoutExpanded}
          isDraggable={!!layout.parentId} // Only layouts with a parentId are draggable
          isOver={layout.id === overLayoutId}
        />
        {layout.isExpanded && layout.children && layout.children.length > 0 && (
          <Box ml={40}>{renderLayoutTree(layout.children)}</Box>
        )}
      </React.Fragment>
    ));
  };

  return (
    <>
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <Stack>{renderLayoutTree(layouts)}</Stack>

        <DragOverlay>
          {activeLayout && (
            <Paper
              shadow="sm"
              p="md"
              withBorder
              style={{
                width: "100%",
                opacity: 0.8,
                backgroundColor: "#e6f7ff",
              }}
            >
              <Text>{activeLayout.name}</Text>
            </Paper>
          )}
        </DragOverlay>
      </DndContext>

      {/* Reparent Confirmation Modal */}
      <Modal
        opened={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        title="Confirm Layout Reparenting"
        centered
      >
        <Text mb="md">
          Are you sure you want to move layout "{reparentInfo?.childName}" to be
          a child of "{reparentInfo?.newParentName}"?
        </Text>
        <Text mb="md" c="orange">
          Warning: This will break inheritance and may affect the layout's
          appearance.
        </Text>
        <Group justify="flex-end" mt="xl">
          <Button variant="outline" onClick={() => setShowConfirmModal(false)}>
            Cancel
          </Button>
          <Button color="blue" onClick={handleConfirmReparent}>
            Confirm Reparent
          </Button>
        </Group>
      </Modal>
    </>
  );
}

interface LayoutItemProps {
  layout: LayoutNode;
  toggleLayoutExpanded: (layoutId: string) => void;
  isDraggable?: boolean;
  isOver?: boolean;
}

function LayoutItem({
  layout,
  toggleLayoutExpanded,
  isDraggable = true,
  isOver = false,
}: LayoutItemProps) {
  const hasChildren = layout.children && layout.children.length > 0;
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: layout.id,
    disabled: !isDraggable,
  });

  // Set up droppable
  const { isOver: isOverDrop, setNodeRef: setDroppableRef } = useDroppable({
    id: `droppable-${layout.id}`,
    data: { layoutId: layout.id },
  });

  // Combine the refs
  const setRefs = (node: HTMLElement | null) => {
    setNodeRef(node);
    setDroppableRef(node);
  };

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
      }
    : undefined;

  // Determine if this item is being hovered over for dropping
  const isDropTarget = isOverDrop || isOver;

  return (
    <Paper
      ref={setRefs}
      shadow="xs"
      p="md"
      withBorder
      style={{
        marginBottom: "8px",
        backgroundColor: isDropTarget
          ? "#ffeeee" // Light red background when being hovered for drop
          : !layout.parentId
            ? "#e6f7ff" // Distinct blue background for top-level layout
            : undefined,
        cursor: isDraggable ? "grab" : "default",
        borderColor: isDropTarget
          ? "#ff6b6b"
          : !layout.parentId
            ? "#4dabf7"
            : undefined,
        borderWidth: isDropTarget || !layout.parentId ? "2px" : "1px",
        ...style,
      }}
      {...attributes}
      {...listeners}
    >
      <Group justify="space-between">
        <Group>
          {hasChildren && (
            <ActionIcon
              onClick={(e) => {
                e.stopPropagation(); // Prevent drag when clicking expand button
                toggleLayoutExpanded(layout.id);
              }}
              variant="subtle"
              size="sm"
            >
              {layout.isExpanded ? (
                <IconChevronDown size={16} />
              ) : (
                <IconChevronRight size={16} />
              )}
            </ActionIcon>
          )}
          <Text fw={!layout.parentId ? "bold" : "normal"}>{layout.name}</Text>
          {isDraggable && (
            <IconGripVertical
              size={14}
              color="gray"
              style={{ marginLeft: 5 }}
            />
          )}
        </Group>

        <Group>
          <Text size="xs" c="dimmed">
            ID: {layout.id}
          </Text>
          {layout.parentId && (
            <Text size="xs" c="dimmed">
              Parent ID: {layout.parentId}
            </Text>
          )}
          {hasChildren && (
            <Text size="xs" c="dimmed">
              Children: {layout.children ? layout.children.length : 0}
            </Text>
          )}
        </Group>
      </Group>
    </Paper>
  );
}
