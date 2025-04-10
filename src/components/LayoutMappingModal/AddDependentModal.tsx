import { Modal, Stack, MultiSelect, Group, Button } from "@mantine/core";
import type React from "react";
import { appStore } from "../../modalStore";

export const AddDependentModal: React.FC = () => {
  const raiseError = appStore((state) => state.raiseError);
  const setIsOpen = appStore((state) => state.effects.modal.dependentModal.setIsOpen);
  const setCurrentGroupIndex = appStore((state) => state.effects.modal.dependentModal.setCurrentGroupIndex);
  const setCurrentSelectedVariables = appStore((state) => state.effects.modal.dependentModal.setCurrentSelectedVariables);
  const addDependentGroup = appStore((state) => state.effects.studio.layoutImageMapping.addDependentGroup);
  const updateDependent = appStore((state) => state.effects.studio.layoutImageMapping.updateDependent);
  const variables = appStore((state) => state.state.studio.document.variables);
  const currentSelectedVariables = appStore(
    (state) => state.state.modal.dependentModal.currentSelectedVariables
  );
  const currentImageVariableId = appStore(
    (state) => state.state.modal.dependentModal.currentImageVariableId
  );
  const currentSelectedMapId = appStore(
    (state) => state.state.modal.currentSelectedMapId
  );
  const currentGroupIndex = appStore(
    (state) => state.state.modal.dependentModal.currentGroupIndex
  );
  const isOpen = appStore((state) => state.state.modal.dependentModal.isOpen);

  const onClose = () => {
    setIsOpen(false);
    setCurrentGroupIndex(null);
    setCurrentSelectedVariables([]);
  };

  // Function to get variable details by ID
  const getVariableById = (id: string) => {
    return variables.find((v) => v.id === id);
  };

  const addDependents = () => {
    const selectedVariables = currentSelectedVariables;
    const imageVariableId = currentImageVariableId;
    const mapId = currentSelectedMapId;
    if (!mapId || !imageVariableId) {
      raiseError(
        new Error(
          `One of these are null mapId:${mapId} or imageVariableId:${imageVariableId}`,
        ),
      );
      return;
    }

    const groupIndex = currentGroupIndex;

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

    if (groupIndex === null) {
      addDependentGroup({
        mapId,
        imageVariableId,
        dependents,
      });
    } else {
      dependents.forEach((dependent) => {
        updateDependent({
          mapId: currentSelectedMapId || "",
          imageVariableId,
          dependentGroupIndex: groupIndex,
          dependent,
        });
      });
    }
    onClose();
  };

  return (
    <Modal
      opened={isOpen}
      onClose={onClose}
      title="Add Dependent Variable"
      centered
    >
      <Stack>
        <MultiSelect
          label="Select Variable"
          placeholder="Choose a variable"
          data={variables
            .filter(
              (variable) =>
                variable.type !== "image" && variable.type !== "shortText",
            )
            .map((variable) => ({
              value: variable.id,
              label: variable.name,
            }))}
          value={currentSelectedVariables}
          onChange={setCurrentSelectedVariables}
          searchable
        />

        <Group justify="flex-end" mt="md">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button
            onClick={addDependents}
            disabled={
              currentSelectedVariables.length === 0
            }
          >
            Add
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
};
