import { ActionIcon, Text, Card, Input, Select, Modal, Stack, Button, Checkbox, Group } from "@mantine/core";
import { IconX, IconGripVertical, IconWand, IconPlus } from "@tabler/icons-react";
import type { Variable, StudioList, TransformCommands } from "../../types/layoutConfigTypes";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useAppStore } from "../../modalStore";
import { useState } from "react";

// Component for a single transform command card
interface TransformCommandCardProps {
  transform: TransformCommands;
  index: number;
  onUpdate: (index: number, transform: TransformCommands) => void;
  onRemove: (index: number) => void;
}

const TransformCommandCard: React.FC<TransformCommandCardProps> = ({
  transform,
  index,
  onUpdate,
  onRemove,
}) => {
  return (
    <Card shadow="sm" padding="xs" radius="md" withBorder mb="xs">
      <Group justify="flex-end" mb="xs">
        <ActionIcon
          variant="subtle"
          color="red"
          size="sm"
          onClick={() => onRemove(index)}
        >
          <IconX size={16} />
        </ActionIcon>
      </Group>
      
      <Text size="xs" mb="xs">Find:</Text>
      <Input
        placeholder="Text to find"
        value={transform.find}
        onChange={(e) =>
          onUpdate(index, { ...transform, find: e.target.value })
        }
        mb="xs"
        size="xs"
      />
      
      <Text size="xs" mb="xs">Replace:</Text>
      <Input
        placeholder="Replacement text"
        value={transform.replace}
        onChange={(e) =>
          onUpdate(index, { ...transform, replace: e.target.value })
        }
        mb="xs"
        size="xs"
      />
      
      <Checkbox
        label="Replace All"
        checked={transform.replaceAll}
        onChange={(e) =>
          onUpdate(index, { ...transform, replaceAll: e.target.checked })
        }
        size="xs"
      />
    </Card>
  );
};

export interface SortableCardProps {
  id: string;
  value: string | Variable;
  groupIndex: number;
  imageVariableId: string;
  mapId: string;
  onRemove: () => void;
  getDisplayValue: (value: string | Variable) => string;
}

// Sortable card component that wraps each card and makes it draggable
export const DependentGroupValueSortableCard: React.FC<SortableCardProps> = ({
  id,
  value,
  groupIndex,
  imageVariableId,
  mapId,
  onRemove,
  getDisplayValue,
}) => {
  const { state, effects, raiseError } = useAppStore();
  const [transformModalOpen, setTransformModalOpen] = useState(false);
  const [transforms, setTransforms] = useState<TransformCommands[]>([]);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 1 : 0,
    minWidth: "120px",
    height: "auto",
    minHeight: "80px",
    display: "flex",
    flexDirection: "column" as const,
    justifyContent: "center",
    position: "relative" as const,
  };

  // Extract the index from the id (format: "item-{index}")
  const variableValueIndex = parseInt(id.toString().split("-")[1]);

  // Function to update the variable value
  const updateVarValue = (newValue: string | Variable) => {
    if (mapId && imageVariableId !== null && groupIndex !== null) {
      effects.studio.layoutImageMapping.updateVarValueFromDependentGroup({
        mapId,
        imageVariableId,
        groupIndex,
        variableValueIndex,
        variableValue: newValue,
      });
    } else {
      raiseError(
        new Error(
          `Failed to update variable value: mapId=${mapId}, imageVariableId=${imageVariableId}, groupIndex=${groupIndex}`,
        ),
      );
    }
  };

  // Get variables for select options, filtering out image and boolean types
  const selectOptions = state.studio.document.variables
    .filter((v) => v.type !== "image" && v.type !== "boolean")
    .map((v) => ({
      value: v.id,
      label: v.name,
    }));

  // Initialize transforms from value when modal opens
  const openTransformModal = () => {
    if (typeof value !== 'string' && value.transform) {
      setTransforms([...value.transform]);
    } else {
      setTransforms([]);
    }
    setTransformModalOpen(true);
  };

  // Update a transform at a specific index
  const updateTransform = (index: number, updatedTransform: TransformCommands) => {
    const newTransforms = [...transforms];
    newTransforms[index] = updatedTransform;
    setTransforms(newTransforms);
  };

  // Remove a transform at a specific index
  const removeTransform = (index: number) => {
    setTransforms(transforms.filter((_, i) => i !== index));
  };

  // Add a new empty transform
  const addTransform = () => {
    setTransforms([
      ...transforms,
      { find: "", replace: "", replaceAll: false, regex: false }
    ]);
  };

  // Save transforms back to the variable
  const saveTransforms = () => {
    // Filter out transforms with missing find or replace
    const validTransforms = transforms.filter(t => t.find.trim() !== "" && t.replace.trim() !== "");
    
    if (typeof value !== 'string' && value.type) {
      updateVarValue({
        ...value,
        transform: validTransforms
      });
    }
    
    setTransformModalOpen(false);
  };

  // Determine wand icon color based on transform array length
  const getWandColor = () => {
    if (typeof value !== 'string' && value.transform && value.transform.length > 0) {
      return "blue";
    }
    return "gray";
  };

  const getWandOpacity = () => {
    if (typeof value !== 'string' && value.transform && value.transform.length > 0) {
      return 1;
    }
    return 0.5;
  };

  return (
    <>
      <Card ref={setNodeRef} shadow="sm" padding="xs" radius="md" style={style}>
        <ActionIcon
          variant="subtle"
          size="sm"
          color="red"
          radius="xl"
          style={{
            position: "absolute",
            top: "5px",
            right: "5px",
          }}
          onClick={onRemove}
        >
          <IconX />
        </ActionIcon>

        {typeof value !== 'string' && (
          <ActionIcon
            variant="subtle"
            size="sm"
            opacity={getWandOpacity()}
            color={getWandColor()}
            radius="xl"
            style={{
              position: "absolute",
              top: "5px",
              right: "30px",
              
            }}
            onClick={openTransformModal}
          >
            <IconWand size={14} />
          </ActionIcon>
        )}

        <ActionIcon
          {...attributes}
          {...listeners}
          variant="subtle"
          size="md"
          style={{
            position: "absolute",
            top: "5px",
            left: "5px",
            cursor: "grab",
          }}
        >
          <IconGripVertical size={14} />
        </ActionIcon>

        <div style={{ marginTop: "20px", marginBottom: "5px" }}>
          {typeof value === "string" ? (
            <Input
              size="xs"
              value={value}
              onChange={(e) => updateVarValue(e.target.value)}
              placeholder="Enter value"
            />
          ) : value.type === "StudioList" ? (
            <Select
              size="xs"
              data={selectOptions}
              value={value.id || null}
              onChange={(newId) => {
                if (newId) {
                  updateVarValue({
                    ...value,
                    id: newId,
                  });
                }
              }}
              placeholder="Select variable"
              clearable
            />
          ) : (
            <Text size="sm" ta="center" style={{ wordBreak: "break-word" }}>
              {getDisplayValue(value)}
            </Text>
          )}
        </div>
      </Card>

      <Modal
        opened={transformModalOpen}
        onClose={() => setTransformModalOpen(false)}
        title="Transform Commands"
        centered
      >
        <Stack>
          {transforms.map((t, index) => (
            <TransformCommandCard
              key={index}
              transform={t}
              index={index}
              onUpdate={updateTransform}
              onRemove={removeTransform}
            />
          ))}
          
          <Card shadow="sm" padding="xs" radius="md" withBorder>
            <Group justify="center">
              <ActionIcon
                variant="subtle"
                color="blue"
                onClick={addTransform}
              >
                <IconPlus size={20} />
              </ActionIcon>
            </Group>
          </Card>
          
          <Group justify="flex-end" mt="md">
            <Button variant="outline" onClick={() => setTransformModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveTransforms}>
              Save
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
};
