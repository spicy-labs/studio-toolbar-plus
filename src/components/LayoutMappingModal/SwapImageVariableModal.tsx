import { Modal, Stack, Select, Group, Button } from "@mantine/core";
import type React from "react";
import { appStore } from "../../modalStore";
import { useMemo } from "react";
import type { LayoutMap, ImageVariable } from "../../types/layoutConfigTypes";

interface SwapImageVariableModalProps {
  currentMapConfig: LayoutMap | null;
  currentImageVariable: ImageVariable | null;
}

export const SwapImageVariableModal: React.FC<SwapImageVariableModalProps> = ({
  currentMapConfig,
  currentImageVariable,
}) => {
  // Modal effects
  const setIsSwapImageVariableModalOpen = appStore(
    (state) => state.effects.modal.setIsSwapImageVariableModalOpen,
  );
  const setCurrentSwapImageVariableSelected = appStore(
    (state) => state.effects.modal.setCurrentSwapImageVariableSelected,
  );
  const swapImageVariable = appStore(
    (state) => state.effects.studio.layoutImageMapping.swapImageVariable,
  );
  const variables = appStore((state) => state.state.studio.document.variables);
  const currentSelectedMapId = appStore(
    (state) => state.state.modal.currentSelectedMapId,
  );
  const currentSwapImageVariableSelected = appStore(
    (state) => state.state.modal.currentSwapImageVariableSelected,
  );
  const isSwapImageVariableModalOpen = appStore(
    (state) => state.state.modal.isSwapImageVariableModalOpen,
  );

  const possibleVariableValues = useMemo(() => {
    // Get all image variables
    const allImageVariables = variables
      .filter((variable) => variable.type === "image")
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
    setIsSwapImageVariableModalOpen(false);
    setCurrentSwapImageVariableSelected("");
  };

  const handleSwapImageVariable = () => {
    const mapId = currentSelectedMapId;
    const newImageVariableId = currentSwapImageVariableSelected;

    if (mapId == null || !currentImageVariable || !newImageVariableId) return;

    swapImageVariable({
      mapId: mapId,
      oldImageVariableId: currentImageVariable.id,
      newImageVariableId: newImageVariableId,
    });

    onClose();
  };

  return (
    <Modal
      opened={isSwapImageVariableModalOpen}
      onClose={onClose}
      title="Swap Image Variable"
      centered
    >
      <Stack>
        <Select
          label="Select Image Variable"
          placeholder="Choose an image variable to swap with"
          data={possibleVariableValues}
          value={currentSwapImageVariableSelected}
          onChange={(value) =>
            value && setCurrentSwapImageVariableSelected(value)
          }
          searchable
        />

        <Group justify="flex-end" mt="md">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSwapImageVariable}
            disabled={!currentSwapImageVariableSelected}
          >
            Swap
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
};
