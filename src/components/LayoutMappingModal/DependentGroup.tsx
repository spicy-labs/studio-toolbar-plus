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
  TargetVariable,
  LayoutMap,
} from "../../types/layoutConfigTypes";
import { appStore } from "../../modalStore";
import { DependentGroupSetValue } from "./DependentGroupSetValue";

interface DependentGroupProps {
  dependentGroup: DependentGroupType;
  groupIndex: number;
  variableConfig: TargetVariable;
  layoutMap: LayoutMap;
}

export const DependentGroup: React.FC<DependentGroupProps> = ({
  dependentGroup,
  groupIndex,
  variableConfig,
  layoutMap,
}) => {
  const bgColor = groupIndex % 2 === 0 ? "#5b575b" : "#335760";

  const variables = appStore((state) => state.state.studio.document.variables);
  const raiseError = appStore((state) => state.raiseError);

  // Modal effects
  const setCurrentImageVariableId = appStore(
    (state) => state.effects.modal.dependentModal.setCurrentTargetVariableId,
  );
  const setCurrentSelectedMapId = appStore(
    (state) => state.effects.modal.setCurrentSelectedMapId,
  );
  const setCurrentGroupIndex = appStore(
    (state) => state.effects.modal.dependentModal.setCurrentGroupIndex,
  );
  const setIsOpen = appStore(
    (state) => state.effects.modal.dependentModal.setIsOpen,
  );

  // Layout mapping effects
  const removeDependentGroup = appStore(
    (state) => state.effects.studio.layoutImageMapping.removeDependentGroup,
  );
  const copyDependentGroup = appStore(
    (state) => state.effects.studio.layoutImageMapping.copyDependentGroup,
  );
  const removeDependent = appStore(
    (state) => state.effects.studio.layoutImageMapping.removeDependent,
  );
  const updateDependent = appStore(
    (state) => state.effects.studio.layoutImageMapping.updateDependent,
  );

  // Function to open the modal for adding variables to an existing group
  const handleAddDependentToGroup = (groupIndex: number) => {
    setCurrentImageVariableId(variableConfig.id);
    setCurrentSelectedMapId(layoutMap.id);
    setCurrentGroupIndex(groupIndex);
    setIsOpen(true);
  };

  // Function to handle removing a group
  const handleRemoveGroup = (groupIndex: number) => {
    removeDependentGroup({
      groupIndex,
      targetVariableId: variableConfig.id,
      mapId: layoutMap.id,
    });
  };

  const handleCopyGroup = (groupIndex: number) => {
    copyDependentGroup({
      groupIndex,
      targetVariableId: variableConfig.id,
      mapId: layoutMap.id,
    });
  };

  console.log(dependentGroup, groupIndex, variableConfig);

  // Function to get variable details by ID
  const getVariableById = (id: string) => {
    return variables.find((v) => v.id === id);
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
                    removeDependent({
                      targetVariableId: variableConfig.id,
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
                      updateDependent({
                        mapId: layoutMap.id,
                        targetVariableId: variableConfig.id,
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
                      updateDependent({
                        mapId: layoutMap.id,
                        targetVariableId: variableConfig.id,
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
        targetVariableId={variableConfig.id}
        mapId={layoutMap.id}
        variableValue={dependentGroup.variableValue}
      />
    </Stack>
  );
};
