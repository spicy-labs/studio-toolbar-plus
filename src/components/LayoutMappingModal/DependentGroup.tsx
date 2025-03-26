import {
  Stack,
  Group,
  ActionIcon,
  Grid,
  Text,
  Card,
  MultiSelect,
} from "@mantine/core";
import {
  IconTrashFilled,
  IconPlus,
  IconX,
  IconCopy,
} from "@tabler/icons-react";
import type {
  DependentGroup as DependentGroupType,
  DependentVar,
  ImageVariable,
  LayoutMap,
} from "../../types/layoutConfigTypes";
import { useAppStore } from "../../modalStore";
import { DependentGroupSetValue } from "./DependentGroupSetValue";

interface DependentGroupProps {
  dependentGroup: DependentGroupType;
  groupIndex: number;
  variableConfig: ImageVariable;
  layoutMap: LayoutMap;
}

export const DependentGroup: React.FC<DependentGroupProps> = ({
  dependentGroup,
  groupIndex,
  variableConfig,
  layoutMap,
}) => {
  const bgColor = groupIndex % 2 === 0 ? "#5b575b" : "#335760";

  const { state, effects, raiseError } = useAppStore();

  // Function to open the modal for adding variables to an existing group
  const handleAddDependentToGroup = (groupIndex: number) => {
    effects.modal.dependentModal.setCurrentImageVariableId(variableConfig.id);
    effects.modal.setCurrentSelectedMapId(layoutMap.id);
    effects.modal.dependentModal.setCurrentGroupIndex(groupIndex);
    effects.modal.dependentModal.setIsOpen(true);
  };

  // Function to handle removing a group
  const handleRemoveGroup = (groupIndex: number) => {
    effects.studio.layoutImageMapping.removeDependentGroup({
      groupIndex,
      imageVariableId: variableConfig.id,
      mapId: layoutMap.id,
    });
  };

  const handleCopyGroup = (groupIndex: number) => {
    effects.studio.layoutImageMapping.copyDependentGroup({
      groupIndex,
      imageVariableId: variableConfig.id,
      mapId: layoutMap.id,
    });
  };

  console.log(dependentGroup, groupIndex, variableConfig);

  // Function to get variable details by ID
  const getVariableById = (id: string) => {
    return state.studio.document.variables.find((v) => v.id === id);
  };
  return (
    <Stack
      key={groupIndex}
      style={{
        backgroundColor: bgColor,
        padding: "10px",
        borderRadius: "5px",
        marginBottom: "10px",
        gap: "8px",
      }}
    >
      <Group align="center" justify="space-between">
        <Text fw={500} size="sm" ta="center">
          Group {groupIndex + 1}
        </Text>
        <Group gap="xs">
          <ActionIcon
            variant="subtle"
            size="lg"
            radius="xl"
            onClick={() => handleCopyGroup(groupIndex)}
          >
            <IconCopy />
          </ActionIcon>
          <ActionIcon
            variant="subtle"
            size="lg"
            color="red"
            radius="xl"
            onClick={() => handleRemoveGroup(groupIndex)}
          >
            <IconTrashFilled />
          </ActionIcon>
        </Group>
      </Group>

      {/* Grid of dependent variables */}
      <Grid gutter="xs">
        {dependentGroup.dependents.map((dependent, depIndex) => {
          const depVariable = getVariableById(dependent.variableId);
          return (
            <Grid.Col key={depIndex} span={4}>
              <Card
                shadow="sm"
                padding="xs"
                radius="md"
                style={{
                  minHeight: "100px",
                  height: "auto",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center",
                  position: "relative", // Add relative positioning
                }}
              >
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
                  onClick={() => {
                    effects.studio.layoutImageMapping.removeDependent({
                      imageVariableId: variableConfig.id,
                      dependentGroupIndex: groupIndex,
                      dependent,
                      mapId: layoutMap.id,
                    });
                  }}
                >
                  <IconX />
                </ActionIcon>
                <Text fw={500} size="sm" ta="center">
                  {depVariable?.name || "Unknown"}
                </Text>
                <Text size="xs" c="dimmed" ta="center">
                  {depVariable?.type || "Unknown"}
                </Text>

                {depVariable?.type === "list" && (
                  <MultiSelect
                    size="xs"
                    data={depVariable.items.map((item) => ({
                      value: item.value,
                      label: item.displayValue || item.value,
                    }))}
                    value={dependent.values}
                    onChange={(newValues) => {
                      effects.studio.layoutImageMapping.updateDependent({
                        mapId: layoutMap.id,
                        imageVariableId: variableConfig.id,
                        dependentGroupIndex: groupIndex,
                        dependent: {
                          ...dependent,
                          values: newValues,
                        },
                      });
                    }}
                    placeholder="Select values"
                    style={{ marginTop: "5px" }}
                  />
                )}

                {depVariable?.type === "boolean" && (
                  <MultiSelect
                    size="xs"
                    data={[
                      { value: "true", label: "TRUE" },
                      { value: "false", label: "FALSE" },
                    ]}
                    value={dependent.values}
                    onChange={(newValues) => {
                      effects.studio.layoutImageMapping.updateDependent({
                        mapId: layoutMap.id,
                        imageVariableId: variableConfig.id,
                        dependentGroupIndex: groupIndex,
                        dependent: {
                          ...dependent,
                          values: newValues,
                        },
                      });
                    }}
                    placeholder="Select values"
                    style={{ marginTop: "5px" }}
                  />
                )}
              </Card>
            </Grid.Col>
          );
        })}

        {/* Add new dependent variable to this group */}
        <Grid.Col span={4}>
          <Card
            shadow="sm"
            padding="xs"
            radius="md"
            style={{
              minHeight: "100px",
              height: "auto",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              border: "1px dashed #ccc",
              cursor: "pointer",
            }}
            onClick={() => handleAddDependentToGroup(groupIndex)}
          >
            <ActionIcon variant="transparent" size="xl">
              <IconPlus />
            </ActionIcon>
          </Card>
        </Grid.Col>
      </Grid>

      {/* Value section with variable values */}
      <DependentGroupSetValue
        groupIndex={groupIndex}
        imageVariableId={variableConfig.id}
        mapId={layoutMap.id}
        variableValue={dependentGroup.variableValue}
      />
    </Stack>
  );
};
