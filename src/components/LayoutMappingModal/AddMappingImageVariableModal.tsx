import { Modal, Stack, MultiSelect, Group, Button } from "@mantine/core";
import type React from "react";
import { appStore } from "../../modalStore";
import { useMemo } from "react";
import {
  convertDocVariableToLayoutVariable,
  type LayoutMap,
} from "../../types/layoutConfigTypes";

interface AddMappingImageVariableModalProps {
  currentMapConfig: LayoutMap | null;
}

export const AddMappingImageVariableModal: React.FC<
  AddMappingImageVariableModalProps
> = ({ currentMapConfig }) => {
  // Modal effects
  const setIsImageVariableMappingModalOpen = appStore(
    (state) => state.effects.modal.setIsTargetVariableMappingModalOpen,
  );
  const setCurrentAddImageMappingSelectedVariables = appStore(
    (state) => state.effects.modal.setCurrentAddImageMappingSelectedVariables,
  );
  const addVariable = appStore(
    (state) => state.effects.studio.layoutImageMapping.addTargetVariable,
  );
  const raiseError = appStore((state) => state.raiseError);
  const variables = appStore((state) => state.state.studio.document.variables);
  const currentSelectedMapId = appStore(
    (state) => state.state.modal.currentSelectedMapId,
  );
  const currentAddImageMappingSelectedVariables = appStore(
    (state) => state.state.modal.currentAddImageMappingSelectedVariables,
  );
  const isAddImageVariableMappingModalOpen = appStore(
    (state) => state.state.modal.isAddTargetVariableMappingModalOpen,
  );

  const possibleVariableValues = useMemo(() => {
    // Get all image variables
    const allImageVariables = variables
      .filter(
        (variable) =>
          variable.type === "image" ||
          variable.type === "shortText" ||
          variable.type === "longText",
      )
      .map((variable) => ({
        value: variable.id,
        label: variable.name + " (" + variable.type + ")",
        // Disable if the variable is already in the current map config
        disabled:
          currentMapConfig?.variables.some((v) => v.id === variable.id) ||
          false,
      }));

    return allImageVariables;
  }, [variables, currentMapConfig]);

  const onClose = () => {
    setIsImageVariableMappingModalOpen(false);
    setCurrentAddImageMappingSelectedVariables([]);
  };

  const addImageVariables = () => {
    const mapId = currentSelectedMapId;

    if (mapId == null) return;

    currentAddImageMappingSelectedVariables.forEach((variableId) => {
      const variable = variables.find((v) => v.id === variableId);
      if (!variable) {
        raiseError(new Error(`Variable with id ${variableId} is not found`));
        return;
      }
      const variableTypeResult = convertDocVariableToLayoutVariable(variable);

      if (!variableTypeResult.isOk()) {
        raiseError(new Error(variableTypeResult.error));
        return;
      }

      addVariable({
        mapId: mapId,
        targetVariable: {
          id: variableId,
          type: variableTypeResult.value,
          dependentGroup: [],
        },
      });
    });
    onClose();
  };

  return (
    <Modal
      opened={isAddImageVariableMappingModalOpen}
      onClose={onClose}
      title="Add Image Variables"
      centered
    >
      <Stack>
        <MultiSelect
          label="Select Image Variable"
          placeholder="Choose an image variable"
          data={possibleVariableValues}
          value={currentAddImageMappingSelectedVariables}
          onChange={setCurrentAddImageMappingSelectedVariables}
          searchable
        />

        <Group justify="flex-end" mt="md">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button
            onClick={addImageVariables}
            disabled={currentAddImageMappingSelectedVariables.length == 0}
          >
            Add
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
};
