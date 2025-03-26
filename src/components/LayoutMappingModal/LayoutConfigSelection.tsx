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
import {
  IconSettings,
  IconCaretDownFilled,
  IconPlus,
  IconCopy,
  IconTrashFilled,
} from "@tabler/icons-react";
import { useAppStore } from "../../modalStore";

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
  const [menuOpened, setMenuOpened] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const { effects: events } = useAppStore();

  return (
    <Paper key={index} p="md">
      <Group justify="space-between" mb={20} onClick={() => setIsOpen(!isOpen)}>
        <Title order={3}>Layout Mapping #{index + 1}</Title>
        <Group>
          <Group gap="xs">
            <ActionIcon
              size="lg"
              radius="xl"
              onClick={() =>
                events.studio.layoutImageMapping.addLayoutMapFromCopy(
                  mapConfig.id,
                )
              }
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
              events.modal.setIsImageVariableMappingModalOpen(true);
              events.modal.setCurrentSelectedMapId(mapConfig.id);
              events.modal.setCurrentAddImageMappingSelectedVariables([]);
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
              events.studio.layoutImageMapping.deleteLayoutMap(mapConfig.id);
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
