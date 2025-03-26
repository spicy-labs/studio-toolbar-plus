import { Modal, Stack, MultiSelect, Group, Button } from "@mantine/core";
import type React from "react";
import { useAppStore } from "../../modalStore";

export const AddDependentModal: React.FC = () => {
  const { state, effects, raiseError } = useAppStore();

  const onClose = () => {
    effects.modal.dependentModal.setIsOpen(false);
    effects.modal.dependentModal.setCurrentGroupIndex(null);
    effects.modal.dependentModal.setCurrentSelectedVariables([]);
  };

  // Function to get variable details by ID
  const getVariableById = (id: string) => {
    return state.studio.document.variables.find((v) => v.id === id);
  };

  const addDependents = () => {
    const selectedVariables =
      state.modal.dependentModal.currentSelectedVariables;
    const imageVariableId = state.modal.dependentModal.currentImageVariableId;
    const mapId = state.modal.currentSelectedMapId;
    if (!mapId ||!imageVariableId) {
      raiseError(new Error(`One of these are null mapId:${mapId} or imageVariableId:${imageVariableId}`))
      return
    }

    const currentGroupIndex = state.modal.dependentModal.currentGroupIndex;

    const dependents = selectedVariables.map((variableId) => {
      const variable = getVariableById(variableId);

      if (!variable) {
        const e = new Error(`Variable with id ${variableId} is not found`);
        raiseError(e);
        throw e;
      }

      switch (variable.type) {
        case "list":
          return {
            variableId,
            values: variable.items.map((i) => i.value),
          };

        default:
          return {
            variableId,
            values: [],
          };
      }
    });

    if (currentGroupIndex === null) {
      effects.studio.layoutImageMapping.addDependentGroup({
        mapId,
        imageVariableId,
        dependents,
      });
    } else {
      dependents.forEach((dependent) => {
        effects.studio.layoutImageMapping.updateDependent({
          mapId: state.modal.currentSelectedMapId || "",
          imageVariableId,
          dependentGroupIndex: currentGroupIndex,
          dependent,
        });
      });
    }
    onClose();
  };

  return (
    <Modal
      opened={state.modal.dependentModal.isOpen}
      onClose={onClose}
      title="Add Dependent Variable"
      centered
    >
      <Stack>
        <MultiSelect
          label="Select Variable"
          placeholder="Choose a variable"
          data={state.studio.document.variables
            .filter(
              (variable) =>
                variable.type !== "image" && variable.type !== "shortText",
            )
            .map((variable) => ({
              value: variable.id,
              label: variable.name,
            }))}
          value={state.modal.dependentModal.currentSelectedVariables}
          onChange={effects.modal.dependentModal.setCurrentSelectedVariables}
          searchable
        />

        <Group justify="flex-end" mt="md">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button
            onClick={addDependents}
            disabled={
              effects.modal.dependentModal.setCurrentSelectedVariables.length ==
              0
            }
          >
            Add
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
};
