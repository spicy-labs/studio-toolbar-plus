import {
  Modal,
  Stack,
  MultiSelect,
  Group,
  Button,
  Checkbox,
} from "@mantine/core";
import type React from "react";
import { useState } from "react";
import { appStore } from "../../modalStore";

export const AddDependentModal: React.FC = () => {
  const raiseError = appStore((state) => state.raiseError);
  const setIsOpen = appStore(
    (state) => state.effects.modal.dependentModal.setIsOpen
  );
  const setCurrentGroupIndex = appStore(
    (state) => state.effects.modal.dependentModal.setCurrentGroupIndex
  );
  const setCurrentSelectedVariables = appStore(
    (state) => state.effects.modal.dependentModal.setCurrentSelectedVariables
  );
  const addDependentGroup = appStore(
    (state) => state.effects.studio.layoutImageMapping.addDependentGroup
  );
  const updateDependent = appStore(
    (state) => state.effects.studio.layoutImageMapping.updateDependent
  );
  const variables = appStore((state) => state.state.studio.document.variables);
  const currentSelectedVariables = appStore(
    (state) => state.state.modal.dependentModal.currentSelectedVariables
  );
  const currentTargetVariableId = appStore(
    (state) => state.state.modal.dependentModal.currentTargetVariableId
  );
  const currentSelectedMapId = appStore(
    (state) => state.state.modal.currentSelectedMapId
  );
  const currentGroupIndex = appStore(
    (state) => state.state.modal.dependentModal.currentGroupIndex
  );
  const isOpen = appStore((state) => state.state.modal.dependentModal.isOpen);
  const allowAlways = appStore(
    (state) => state.state.modal.dependentModal.allowAlways
  );

  const [runAlways, setRunAlways] = useState(false);

  const onClose = () => {
    setIsOpen(false);
    setCurrentGroupIndex(null);
    setCurrentSelectedVariables([]);
    setRunAlways(false);
  };

  const handleRunAlwaysChange = (checked: boolean) => {
    setRunAlways(checked);
    if (checked) {
      setCurrentSelectedVariables([]);
    }
  };

  // Function to get variable details by ID
  const getVariableById = (id: string) => {
    return variables.find((v) => v.id === id);
  };

  const addDependents = () => {
    const selectedVariables = currentSelectedVariables;
    const targetVariableId = currentTargetVariableId;
    const mapId = currentSelectedMapId;
    if (!mapId || !targetVariableId) {
      raiseError(
        new Error(
          `One of these are null mapId:${mapId} or imageVariableId:${targetVariableId}`
        )
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
        targetVariableId,
        dependents,
        alwaysRun: runAlways,
      });
    } else {
      dependents.forEach((dependent) => {
        updateDependent({
          mapId: currentSelectedMapId || "",
          targetVariableId,
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
            .filter((variable) => variable.type === "list")
            .map((variable) => ({
              value: variable.id,
              label: variable.name,
            }))}
          value={currentSelectedVariables}
          onChange={setCurrentSelectedVariables}
          searchable
          disabled={runAlways}
        />

        <Group justify="space-between" mt="md">
          {allowAlways && (
            <Checkbox
              label="Run Always"
              checked={runAlways}
              onChange={(event) =>
                handleRunAlwaysChange(event.currentTarget.checked)
              }
            />
          )}
          <Group justify="flex-end">
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
            <Button
              onClick={addDependents}
              disabled={!runAlways && currentSelectedVariables.length === 0}
            >
              Add
            </Button>
          </Group>
        </Group>
      </Stack>
    </Modal>
  );
};
