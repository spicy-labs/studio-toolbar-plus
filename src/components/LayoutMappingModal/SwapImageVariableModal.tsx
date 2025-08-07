import { Modal, Stack, Select, Group, Button } from "@mantine/core";
import type React from "react";
import { appStore } from "../../modalStore";
import { useMemo } from "react";
import {
  convertDocVariableToLayoutVariable,
  type LayoutMap,
  type TargetVariable,
} from "../../types/layoutConfigTypes";

interface SwapTargetVariableModalProps {
  currentMapConfig: LayoutMap | null;
  currentImageVariable: TargetVariable | null;
}

export const SwapTargetVariableModal: React.FC<
  SwapTargetVariableModalProps
> = ({ currentMapConfig, currentImageVariable }) => {
  // Modal effects
  const setIsSwapTargetVariableModalOpen = appStore(
    (state) => state.effects.modal.setIsSwapTargetVariableModalOpen,
  );
  const setCurrentSwapTargetVariableSelected = appStore(
    (state) => state.effects.modal.setCurrentSwapTargetVariableSelected,
  );
  const swapTargetVariable = appStore(
    (state) => state.effects.studio.layoutImageMapping.swapTargetVariable,
  );
  const variables = appStore((state) => state.state.studio.document.variables);
  const currentSelectedMapId = appStore(
    (state) => state.state.modal.currentSelectedMapId,
  );
  const currentSwapTargetVariableSelected = appStore(
    (state) => state.state.modal.currentSwapTargetVariableSelected,
  );
  const isSwapTargetVariableModalOpen = appStore(
    (state) => state.state.modal.isSwapTargetVariableModalOpen,
  );
  const raiseError = appStore((state) => state.raiseError);

  const possibleVariableValues = useMemo(() => {
    if (currentImageVariable == null) return [];

    // Get all image variables
    const allImageVariables = variables
      .filter(
        (variable) =>
          convertDocVariableToLayoutVariable(variable).isOk() &&
          convertDocVariableToLayoutVariable(variable).value ===
            currentImageVariable.type,
      )
      .map((variable) => ({
        value: variable.id,
        label: variable.name,
        // Disable if the variable is the current one or already in the current map config
        disabled:
          (currentImageVariable && variable.id === currentImageVariable.id) ||
          currentMapConfig?.variables.some(
            (v) =>
              v.id === variable.id &&
              (currentImageVariable ? v.id !== currentImageVariable.id : true),
          ) ||
          false,
      }));

    return allImageVariables;
  }, [variables, currentMapConfig, currentImageVariable]);

  const onClose = () => {
    setIsSwapTargetVariableModalOpen(false);
    setCurrentSwapTargetVariableSelected("");
  };

  const handleSwapTargetVariable = async () => {
    const mapId = currentSelectedMapId;
    const newImageVariableId = currentSwapTargetVariableSelected;

    if (mapId == null || !currentImageVariable || !newImageVariableId) return;

    const swapResult = await swapTargetVariable({
      mapId: mapId,
      oldTargetVariableId: currentImageVariable.id,
      newTargetVariableId: newImageVariableId,
    });

    if (swapResult.isError()) {
      raiseError(swapResult.error);
      return;
    }

    onClose();
  };

  return (
    <Modal
      opened={isSwapTargetVariableModalOpen}
      onClose={onClose}
      title="Swap Image Variable"
      centered
    >
      <Stack>
        <Select
          label={`Select ${currentImageVariable?.type} Variable`}
          placeholder={`Choose an ${currentImageVariable?.type} variable to swap with`}
          data={possibleVariableValues}
          value={currentSwapTargetVariableSelected}
          onChange={(value) =>
            value && setCurrentSwapTargetVariableSelected(value)
          }
          searchable
        />

        <Group justify="flex-end" mt="md">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSwapTargetVariable}
            disabled={!currentSwapTargetVariableSelected}
          >
            Swap
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
};
