import { Group, ActionIcon, Text, Card, ScrollArea, Menu } from "@mantine/core";
import { IconPlus, IconAbc, IconList } from "@tabler/icons-react";
import type { Variable, StudioList } from "../../types/layoutConfigTypes";
import { useAppStore } from "../../modalStore";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import type { DragEndEvent } from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  horizontalListSortingStrategy,
} from "@dnd-kit/sortable";
import { DependentGroupValueSortableCard } from "./DependentGroupSortableCard";

interface DependentGroupSetValueProps {
  groupIndex: number;
  imageVariableId: string;
  mapId: string;
  variableValue: (string | Variable)[];
}

export const DependentGroupSetValue: React.FC<DependentGroupSetValueProps> = ({
  groupIndex,
  imageVariableId,
  mapId,
  variableValue,
}) => {
  const { effects } = useAppStore();

  // Set up sensors for drag and drop
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  // Function to handle removing a variable value
  const handleRemoveVarValue = (valueIndex: number) => {
    effects.studio.layoutImageMapping.removeVarValueFromDependentGroup({
      mapId,
      imageVariableId,
      groupIndex,
      variableValueIndex: valueIndex,
    });
  };

  // Function to handle adding a new string value
  const handleAddStringValue = () => {
    effects.studio.layoutImageMapping.addVarValueToDependentGroup({
      mapId,
      imageVariableId,
      groupIndex,
      variableValue: "",
    });
  };

  // Function to handle adding a new list variable
  const handleAddListVariable = () => {
    effects.studio.layoutImageMapping.addVarValueToDependentGroup({
      mapId,
      imageVariableId,
      groupIndex,
      variableValue: {
        id: null,
        type: "StudioList" as StudioList,
        transform: [],
      },
    });
  };

  // Helper function to display the value (either string or Variable)
  const getDisplayValue = (value: string | Variable): string => {
    if (typeof value === "string") {
      return value;
    } else {
      return `Variable: ${value.id}`;
    }
  };

  // Handle drag end event
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = parseInt(active.id.toString().split("-")[1]);
      const newIndex = parseInt(over.id.toString().split("-")[1]);

      // Call the store function to update the order
      effects.studio.layoutImageMapping.setIndexOfVarValueFromDependentGroup({
        mapId,
        imageVariableId,
        groupIndex,
        oldVariableValueIndex: oldIndex,
        newVariableValueIndex: newIndex,
      });
    }
  };

  return (
    <div style={{ marginTop: "10px" }}>
      <Text fw={500} size="sm" mb={5}>
        Value =
      </Text>
      <ScrollArea.Autosize maw={screen.width * 0.9}>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={variableValue.map((_, index) => `item-${index}`)}
            strategy={horizontalListSortingStrategy}
          >
            <Group gap="xs" wrap="nowrap" style={{ minWidth: "100%" }}>
              {variableValue.map((value, index) => (
                <DependentGroupValueSortableCard
                  key={`item-${index}`}
                  id={`item-${index}`}
                  value={value}
                  mapId={mapId}
                  groupIndex={groupIndex}
                  imageVariableId={imageVariableId}
                  onRemove={() => handleRemoveVarValue(index)}
                  getDisplayValue={getDisplayValue}
                />
              ))}

              {/* Add new variable value card with menu */}
              <Menu position="bottom-end" withArrow>
                <Menu.Target>
                  <Card
                    shadow="sm"
                    padding="xs"
                    radius="md"
                    style={{
                      minWidth: "80px",
                      height: "80px",
                      display: "flex",
                      justifyContent: "center",
                      alignItems: "center",
                      border: "1px dashed #ccc",
                      cursor: "pointer",
                    }}
                  >
                    <ActionIcon variant="transparent" size="lg">
                      <IconPlus />
                    </ActionIcon>
                  </Card>
                </Menu.Target>
                <Menu.Dropdown>
                  <Menu.Label>Add Value Type</Menu.Label>
                  <Menu.Item
                    leftSection={<IconAbc size={14} />}
                    onClick={handleAddStringValue}
                  >
                    String
                  </Menu.Item>
                  <Menu.Item
                    leftSection={<IconList size={14} />}
                    onClick={handleAddListVariable}
                  >
                    List Variable
                  </Menu.Item>
                </Menu.Dropdown>
              </Menu>
            </Group>
          </SortableContext>
        </DndContext>
      </ScrollArea.Autosize>
    </div>
  );
};
