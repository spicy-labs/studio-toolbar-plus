import {
  Paper,
  Group,
  Title,
  ActionIcon,
  Divider,
  Button,
  Modal,
  Text,
} from "@mantine/core";
import { useState } from "react";
import type { LayoutMap } from "../../types/layoutConfigTypes";
import { LayoutMultiSelect } from "./LayoutMultiSelect";
import { VariableCard } from "./VariableCard";
import { EditableTitle } from "./EditableTitle";
import {
  IconCaretDownFilled,
  IconPlus,
  IconCopy,
  IconTrashFilled,
} from "@tabler/icons-react";
import { appStore } from "../../modalStore";

// Layout Config Section Component
interface LayoutConfigSectionProps {
  mapConfig: LayoutMap;
  index: number;
  // onAddVariable: () => void;
  // onAddDependent: (configId: string, variableId: string) => void;
}

export const LayoutConfigSection: React.FC<LayoutConfigSectionProps> = ({
  mapConfig,
  index,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const addLayoutMapFromCopy = appStore(
    (store) => store.effects.studio.layoutImageMapping.addLayoutMapFromCopy
  );
  const setIsImageVariableMappingModalOpen = appStore(
    (store) => store.effects.modal.setIsTargetVariableMappingModalOpen
  );
  const setCurrentSelectedMapId = appStore(
    (store) => store.effects.modal.setCurrentSelectedMapId
  );
  const setCurrentAddImageMappingSelectedVariables = appStore(
    (store) => store.effects.modal.setCurrentAddImageMappingSelectedVariables
  );
  const deleteLayoutMap = appStore(
    (store) => store.effects.studio.layoutImageMapping.deleteLayoutMap
  );
  const updateLayoutMapName = appStore(
    (store) => store.effects.studio.layoutImageMapping.updateLayoutMapName
  );

  // Helper function to get display name with fallback
  const getDisplayName = () => {
    return mapConfig.name || `Layout Mapping #${index + 1}`;
  };

  // Handle name save
  const handleNameSave = (newName: string) => {
    updateLayoutMapName({ mapId: mapConfig.id, name: newName });
  };

  return (
    <Paper key={index} p="md">
      <Group justify="space-between" mb={20}>
        <EditableTitle
          value={getDisplayName()}
          onSave={handleNameSave}
          order={3}
          placeholder={`Layout Mapping #${index + 1}`}
        />
        <Group onClick={() => setIsOpen(!isOpen)} style={{ cursor: "pointer" }}>
          <Group gap="xs">
            <ActionIcon
              size="lg"
              radius="xl"
              onClick={() => addLayoutMapFromCopy(mapConfig.id)}
            >
              <IconCopy />
            </ActionIcon>

            <ActionIcon
              size="lg"
              color="red"
              radius="xl"
              onClick={() => setDeleteModalOpen(true)}
            >
              <IconTrashFilled />
            </ActionIcon>
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
          </Group>
        </Group>
      </Group>
      <Title styles={{ root: { marginTop: "30px" } }} order={5} mb="md">
        Layout Dependencies
      </Title>
      <LayoutMultiSelect
        key={index}
        showButton={isOpen}
        layoutConfig={mapConfig}
      />
      {isOpen && (
        <>
          <Divider styles={{ root: { marginTop: "30px" } }} />
          <Title styles={{ root: { marginTop: "20px" } }} order={5} mb="md">
            Set Variables
          </Title>

          {/* Display all variables from layoutConfig in their own Paper */}
          {mapConfig.variables.map((variableConfig) => (
            <VariableCard
              key={variableConfig.id}
              variableConfig={variableConfig}
              layoutMap={mapConfig}
            />
          ))}

          {/* Add Variable button to open modal */}
          <Button
            onClick={() => {
              // Using appStore for handling events
              setIsImageVariableMappingModalOpen(true);
              setCurrentSelectedMapId(mapConfig.id);
              setCurrentAddImageMappingSelectedVariables([]);
            }}
          >
            <IconPlus />
            <span style={{ marginLeft: "10px" }}>Add Variables</span>
          </Button>
        </>
      )}

      {/* Delete Confirmation Modal */}
      <Modal
        opened={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        title="Confirm Deletion"
        centered
      >
        <Text size="sm" mb="lg">
          Are you sure you want to delete this mapping?
        </Text>
        <Group justify="flex-end" mt="md">
          <Button variant="outline" onClick={() => setDeleteModalOpen(false)}>
            Cancel
          </Button>
          <Button
            color="red"
            onClick={() => {
              deleteLayoutMap(mapConfig.id);
              setDeleteModalOpen(false);
            }}
          >
            Delete
          </Button>
        </Group>
      </Modal>
    </Paper>
  );
};

/**
 * onAddVariable={() => {
                    const configIndex =
                      state.studio.layoutImageMapping.findIndex(
                        (c) => c.id === config.id,
                      );
                    setCurrentConfigIndex(configIndex);
                    events.modal.setIsAddVariableModalOpen(true);
                  }}
 */
