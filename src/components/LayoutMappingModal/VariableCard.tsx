import {
  Paper,
  Title,
  Stack,
  Group,
  ActionIcon,
  Grid,
  Text,
  MultiSelect,
  Button,
  Card,
} from "@mantine/core";
import {
  IconTrashFilled,
  IconPlus,
  IconCaretDownFilled,
} from "@tabler/icons-react";
import { useState } from "react";
import { Result } from "typescript-result";
import type {
  ImageVariable,
  LayoutMap,
  DependentVar,
} from "../../types/layoutConfigTypes";
import { useAppStore } from "../../modalStore";
import { AddDependentModal } from "./AddDependentModal";
import { DependentGroup } from "./DependentGroup";

// Variable Card Component
interface VariableCardProps {
  variableConfig: ImageVariable;
  layoutMap: LayoutMap;
}

export const VariableCard: React.FC<VariableCardProps> = ({
  variableConfig,
  layoutMap,
}) => {
  const { state, raiseError, effects } = useAppStore();
  const [isOpen, setIsOpen] = useState(false);

  const variableImageConfig = state.studio.document.variables.find(
    (v) => v.id === variableConfig.id,
  );

  if (variableImageConfig == null) {
    raiseError(Result.error(new Error("variableDocument is null")));
    throw "ERROR - DO BETTER!!!";
  }

  // Function to open the modal for adding a new group
  const handleAddGroup = () => {
    effects.modal.dependentModal.setCurrentImageVariableId(variableConfig.id);
    effects.modal.dependentModal.setIsOpen(true);
  };

  return (
    <Paper
      key={variableConfig.id}
      styles={{ root: { margin: "15px" } }}
      shadow="sm"
      radius="lg"
      p="md"
    >
      <Group justify="space-between" onClick={() => setIsOpen(!isOpen)}>
        <Title order={5}>{variableImageConfig.name}</Title>
        <Group gap={"md"}>
          <ActionIcon
            size="lg"
            radius="xl"
            onClick={() => setIsOpen(!isOpen)}
            style={{
              transform: isOpen ? "rotate(0deg)" : "rotate(90deg)",
              transition: "transform 0.2s ease",
            }}
          >
            <IconCaretDownFilled />
          </ActionIcon>
          <ActionIcon
            size="lg"
            color="red"
            radius="xl"
            onClick={() => {
              effects.studio.layoutImageMapping.removeImageVariable({
                mapId: layoutMap.id,
                imageVariableId: variableConfig.id,
              });
            }}
          >
            <IconTrashFilled />
          </ActionIcon>
        </Group>
      </Group>
      {isOpen && (
        <>
          <Text size="small" c="dimmed">
            Type: {variableImageConfig.type}
          </Text>
          <Title order={6} mt="md">
            Dependents:
          </Title>

          {variableConfig.dependentGroup.length === 0 ? (
            <Text size="sm" c="dimmed">
              No dependents
            </Text>
          ) : (
            variableConfig.dependentGroup.map((dependentGroup, groupIndex) => {
              console.log(dependentGroup);

              return (
                <DependentGroup
                  key={groupIndex}
                  dependentGroup={dependentGroup}
                  groupIndex={groupIndex}
                  variableConfig={variableConfig}
                  layoutMap={layoutMap}
                />
              );
            })
          )}

          <Group mt="md" justify="flex-end">
            <Button variant="subtle" size="sm" onClick={handleAddGroup}>
              <Group align="center" style={{ gap: "5px" }}>
                <IconPlus size={16} />
                <Text>Add Group</Text>
              </Group>
            </Button>
          </Group>
        </>
      )}
    </Paper>
  );
};
