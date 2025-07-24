import { useState, useEffect, useCallback } from "react";
import {
  Box,
  Group,
  Text,
  Button,
  ScrollArea,
  Table,
  TextInput,
  Stack,
  Paper,
  Title,
  Loader,
  Center,
  Checkbox,
  ActionIcon,
  Tooltip,
} from "@mantine/core";
import {
  IconTrash,
  IconCopy,
  IconCopyPlus,
  IconReplace,
  IconDeselect,
  IconArrowAutofitDown,
} from "@tabler/icons-react";
import { appStore } from "../../modalStore";
import { getStudio } from "../../studio/studioAdapter";
import {
  getCurrentDocumentState,
  loadDocumentFromJsonStr,
} from "../../studio/documentHandler";
import { getAllLayouts } from "../../studio/layoutHandler";
import { getManualCropsFromDocByConnector } from "../../studio-adapter/getManualCropsFromDocByConnector";
import { setManualCropsForLayout } from "../../studio-adapter/setManualCropsForLayout";
import { deleteSingleManualCropForLayout } from "../../studio-adapter/deleteManualCropsForLayout";
import { CopyCropToLayerModal } from "./CopyCropToLayerModal";
import { CopyAndAddRowModal } from "./CopyAndAddRowModal";
import { CopyAndReplaceModal } from "./CopyAndReplaceModal";
import type { ManualCrop } from "../../studio-adapter/manualCropTypes";
import type { Layout } from "@chili-publish/studio-sdk";
import { Result } from "typescript-result";

interface ManualCropToDelete {
  layoutId: string;
  cropIndex: number;
}

interface LayoutCrops {
  layoutId: string;
  layoutName: string;
  crops: ManualCrop[];
}

interface CropRowProps {
  crop: ManualCrop;
  layoutId: string;
  cropIndex: number;
  onCropChange: (
    layoutId: string,
    cropIndex: number,
    updatedCrop: ManualCrop
  ) => void;
  isChecked: boolean;
  onCheckChange: (
    layoutId: string,
    cropIndex: number,
    checked: boolean
  ) => void;
  isDeleted: boolean;
}

function CropRow({
  crop,
  layoutId,
  cropIndex,
  onCropChange,
  isChecked,
  onCheckChange,
  isDeleted,
}: CropRowProps) {
  const [localCrop, setLocalCrop] = useState<ManualCrop>(crop);

  // Update local state when prop changes (e.g., when data is reloaded)
  useEffect(() => {
    setLocalCrop(crop);
  }, [crop]);

  const handleFieldChange = (field: keyof ManualCrop, value: string) => {
    let processedValue: string | number = value;

    // For numeric fields, keep as string if it's a valid partial number (e.g., "2.", "2.89")
    // Only convert to number when it's a complete valid number
    if (field !== "frameName" && field !== "name" && field !== "frameId") {
      // Allow empty string, partial decimals, and valid numbers
      if (value === "" || value === "." || value === "-" || value === "-.") {
        processedValue = 0; // Default to 0 for empty/invalid states
      } else if (/^-?\d*\.?\d*$/.test(value)) {
        // Valid number format (including partial decimals)
        const numValue = parseFloat(value);
        processedValue = isNaN(numValue) ? 0 : numValue;
      } else {
        processedValue = localCrop[field]; // Keep previous value if invalid input
        return; // Don't update if invalid
      }
    }

    const updatedCrop = {
      ...localCrop,
      [field]: processedValue,
    };
    setLocalCrop(updatedCrop);
    onCropChange(layoutId, cropIndex, updatedCrop);
  };

  // If the row is marked for deletion, return null to hide it
  if (isDeleted) {
    return null;
  }

  return (
    <Table.Tr>
      <Table.Td>
        <Checkbox
          checked={isChecked}
          onChange={(event) =>
            onCheckChange(layoutId, cropIndex, event.currentTarget.checked)
          }
        />
      </Table.Td>
      <Table.Td>
        <Text size="sm">{localCrop.frameName}</Text>
      </Table.Td>
      <Table.Td>
        <TextInput
          value={localCrop.name}
          onChange={(e) => handleFieldChange("name", e.target.value)}
          size="xs"
          style={{ width: "100%" }}
        />
      </Table.Td>
      <Table.Td>
        <TextInput
          value={localCrop.left.toString()}
          onChange={(e) => handleFieldChange("left", e.target.value)}
          size="xs"
          style={{ width: 80 }}
          type="text"
          inputMode="decimal"
        />
      </Table.Td>
      <Table.Td>
        <TextInput
          value={localCrop.top.toString()}
          onChange={(e) => handleFieldChange("top", e.target.value)}
          size="xs"
          style={{ width: 80 }}
          type="text"
          inputMode="decimal"
        />
      </Table.Td>
      <Table.Td>
        <TextInput
          value={localCrop.width.toString()}
          onChange={(e) => handleFieldChange("width", e.target.value)}
          size="xs"
          style={{ width: 80 }}
          type="text"
          inputMode="decimal"
        />
      </Table.Td>
      <Table.Td>
        <TextInput
          value={localCrop.height.toString()}
          onChange={(e) => handleFieldChange("height", e.target.value)}
          size="xs"
          style={{ width: 80 }}
          type="text"
          inputMode="decimal"
        />
      </Table.Td>
    </Table.Tr>
  );
}

interface ManualCropEditorProps {
  selectedLayoutIds: string[];
  selectedConnectorId: string;
  onModalClose?: () => void;
  onCropsSaved?: () => void;
}

type SaveState = "idle" | "saving" | "error" | "success";

export function ManualCropEditor({
  selectedLayoutIds,
  selectedConnectorId,
  onModalClose,
  onCropsSaved,
}: ManualCropEditorProps) {
  const raiseError = appStore((store) => store.raiseError);
  const [layoutCrops, setLayoutCrops] = useState<Map<string, LayoutCrops>>(
    new Map()
  );
  const [isLoading, setIsLoading] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [saveMessage, setSaveMessage] = useState<string>("");
  const [originalDocumentState, setOriginalDocumentState] = useState<any>(null);
  const [changedRows, setChangedRows] = useState<
    Map<string, ManualCrop | ManualCropToDelete>
  >(new Map());
  const [checkedRows, setCheckedRows] = useState<Set<string>>(new Set());
  const [copyCropToLayerModalOpened, setCopyCropToLayerModalOpened] =
    useState(false);
  const [currentCopySourceLayoutId, setCurrentCopySourceLayoutId] =
    useState<string>("");
  const [copyAndAddRowModalOpened, setCopyAndAddRowModalOpenedState] =
    useState(false);
  const [currentCropForCopy, setCurrentCropForCopy] =
    useState<ManualCrop | null>(null);
  const [currentLayoutIdForCopy, setCurrentLayoutIdForCopy] =
    useState<string>("");
  const [copyAndReplaceModalOpened, setCopyAndReplaceModalOpenedState] =
    useState(false);
  const [currentCropsForReplace, setCurrentCropsForReplace] = useState<
    ManualCrop[]
  >([]);
  const [currentLayoutIdForReplace, setCurrentLayoutIdForReplace] =
    useState<string>("");

  const loadCropsForSelectedLayouts = useCallback(async () => {
    if (!selectedConnectorId) return;

    try {
      setIsLoading(true);
      const studioResult = await getStudio();
      if (!studioResult.isOk()) {
        raiseError(
          new Error(studioResult.error?.message || "Failed to get studio")
        );
        return;
      }
      const studio = studioResult.value;

      // Get all layouts to have access to layout names
      const allLayoutsResult = await getAllLayouts(studio);
      if (!allLayoutsResult.isOk()) {
        raiseError(
          new Error(
            "Failed to load layouts: " + allLayoutsResult.error?.message
          )
        );
        return;
      }
      const allLayouts = allLayoutsResult.value as Layout[];

      const cropsResult = await getManualCropsFromDocByConnector(
        studio,
        selectedConnectorId
      );

      if (!cropsResult.isOk()) {
        raiseError(
          new Error(
            "Failed to load manual crops: " + cropsResult.error?.message
          )
        );
        return;
      }

      const cropsData = cropsResult.value;

      // Filter crops to only include selected layouts and convert to Map
      const layoutCropsMap = new Map<string, LayoutCrops>();
      selectedLayoutIds.forEach((layoutId) => {
        // Find layout in all layouts to get the name
        const layout = allLayouts.find((l) => l.id === layoutId);
        if (layout) {
          // Check if this layout has crops
          const layoutData = cropsData.layouts.find((l) => l.id === layoutId);
          layoutCropsMap.set(layoutId, {
            layoutId: layout.id,
            layoutName: layout.name,
            crops: layoutData ? layoutData.manualCrops : [], // Empty array if no crops
          });
        }
      });

      setLayoutCrops(layoutCropsMap);
    } catch (error) {
      raiseError(
        error instanceof Error
          ? error
          : new Error("Failed to load manual crops")
      );
    } finally {
      setIsLoading(false);
    }
  }, [selectedConnectorId, selectedLayoutIds, raiseError]);

  // Load crops when connector or selected layouts change
  useEffect(() => {
    if (selectedConnectorId && selectedLayoutIds.length > 0) {
      loadCropsForSelectedLayouts();
    } else {
      setLayoutCrops(new Map());
    }
    // Clear changed rows and checked rows when layouts change
    setChangedRows(new Map());
    setCheckedRows(new Set());
  }, [selectedConnectorId, selectedLayoutIds, loadCropsForSelectedLayouts]);

  // Handle crop changes from individual row components
  const handleCropChange = useCallback(
    (layoutId: string, cropIndex: number, updatedCrop: ManualCrop) => {
      const rowKey = `${layoutId}-${cropIndex}`;
      setChangedRows((prev) => {
        const newMap = new Map(prev);
        newMap.set(rowKey, updatedCrop);
        return newMap;
      });
    },
    []
  );

  // Handle checkbox changes from individual row components
  const handleCheckChange = useCallback(
    (layoutId: string, cropIndex: number, checked: boolean) => {
      const rowKey = `${layoutId}-${cropIndex}`;
      setCheckedRows((prev) => {
        const newSet = new Set(prev);
        if (checked) {
          newSet.add(rowKey);
        } else {
          newSet.delete(rowKey);
        }
        return newSet;
      });
    },
    []
  );

  // Get checked snapshots count for a specific layout
  const getCheckedSnapshotsCountForLayout = useCallback(
    (layoutId: string) => {
      return Array.from(checkedRows).filter((rowKey) =>
        rowKey.startsWith(`${layoutId}-`)
      ).length;
    },
    [checkedRows]
  );

  // Get checked crops for a specific layout
  const getCheckedCropsForLayout = useCallback(
    (layoutId: string): ManualCrop[] => {
      const layoutCrop = layoutCrops.get(layoutId);
      if (!layoutCrop) return [];

      const checkedCrops: ManualCrop[] = [];
      Array.from(checkedRows).forEach((rowKey) => {
        if (rowKey.startsWith(`${layoutId}-`)) {
          const [, cropIndexStr] = rowKey.split("-");
          const cropIndex = parseInt(cropIndexStr, 10);

          // First try to get crop from changedRows, then fallback to layoutCrops
          const changedCrop = changedRows.get(rowKey);
          let crop: ManualCrop | undefined;

          if (changedCrop && "frameId" in changedCrop) {
            // Use the changed crop data
            crop = changedCrop;
          } else {
            // Fallback to original crop from layoutCrops
            crop = layoutCrop.crops[cropIndex];
          }

          if (crop) {
            checkedCrops.push(crop);
          }
        }
      });
      return checkedCrops;
    },
    [checkedRows, layoutCrops, changedRows]
  );

  // Action button handlers
  const deleteCheckedSnapshots = useCallback(
    (layoutId: string) => {
      // Find all checked rows for this layout
      const checkedRowsForLayout = Array.from(checkedRows).filter((rowKey) =>
        rowKey.startsWith(`${layoutId}-`)
      );

      // Add ManualCropToDelete entries to changedRows for each checked row
      setChangedRows((prev) => {
        const newMap = new Map(prev);
        checkedRowsForLayout.forEach((rowKey) => {
          const [, cropIndexStr] = rowKey.split("-");
          const cropIndex = parseInt(cropIndexStr, 10);
          const deleteEntry: ManualCropToDelete = {
            layoutId,
            cropIndex,
          };
          newMap.set(rowKey, deleteEntry);
        });
        return newMap;
      });

      // Clear the checked rows for this layout
      setCheckedRows((prev) => {
        const newSet = new Set(prev);
        checkedRowsForLayout.forEach((rowKey) => {
          newSet.delete(rowKey);
        });
        return newSet;
      });
    },
    [checkedRows]
  );

  const setCopyModalOpened = useCallback(
    (opened: boolean, layoutId?: string) => {
      if (opened && layoutId) {
        setCurrentCopySourceLayoutId(layoutId);
      }
      setCopyCropToLayerModalOpened(opened);
    },
    []
  );

  const setCopyAndAddRowModalOpened = useCallback(
    (opened: boolean, layoutId?: string) => {
      if (opened && layoutId) {
        // Find the first checked crop for this layout
        const checkedCrops = getCheckedCropsForLayout(layoutId);
        if (checkedCrops.length === 1) {
          setCurrentCropForCopy(checkedCrops[0]);
          setCurrentLayoutIdForCopy(layoutId);
          setCopyAndAddRowModalOpenedState(true);
        }
      } else {
        setCopyAndAddRowModalOpenedState(false);
        setCurrentCropForCopy(null);
        setCurrentLayoutIdForCopy("");
      }
    },
    [getCheckedCropsForLayout]
  );

  const setCopyAndReplaceModalOpened = useCallback(
    (opened: boolean, layoutId?: string) => {
      if (opened && layoutId) {
        // Get all checked crops for this layout
        const checkedCrops = getCheckedCropsForLayout(layoutId);
        if (checkedCrops.length > 0) {
          setCurrentCropsForReplace(checkedCrops);
          setCurrentLayoutIdForReplace(layoutId);
          setCopyAndReplaceModalOpenedState(true);
        }
      } else {
        setCopyAndReplaceModalOpenedState(false);
        setCurrentCropsForReplace([]);
        setCurrentLayoutIdForReplace("");
      }
    },
    [getCheckedCropsForLayout]
  );

  const deselectAllRows = useCallback((layoutId: string) => {
    setCheckedRows((prev) => {
      const newSet = new Set(prev);
      // Remove all checked rows for this layout
      Array.from(prev).forEach((rowKey) => {
        if (rowKey.startsWith(`${layoutId}-`)) {
          newSet.delete(rowKey);
        }
      });
      return newSet;
    });
  }, []);

  // Select all crops for a specific layout
  const selectAllRowsForLayout = useCallback(
    (layoutId: string) => {
      const layoutCrop = layoutCrops.get(layoutId);
      if (!layoutCrop) return;

      setCheckedRows((prev) => {
        const newSet = new Set(prev);
        layoutCrop.crops.forEach((_, index) => {
          const rowKey = `${layoutId}-${index}`;
          // Only add if not marked for deletion
          const changedRow = changedRows.get(rowKey);
          const isDeleted =
            changedRow &&
            "cropIndex" in changedRow &&
            !("frameId" in changedRow);
          if (!isDeleted) {
            newSet.add(rowKey);
          }
        });
        return newSet;
      });
    },
    [layoutCrops, changedRows]
  );

  // Get checkbox state for layout header (checked/unchecked/indeterminate)
  const getLayoutCheckboxState = useCallback(
    (layoutId: string): "checked" | "unchecked" | "indeterminate" => {
      const layoutCrop = layoutCrops.get(layoutId);
      if (!layoutCrop || layoutCrop.crops.length === 0) return "unchecked";

      // Count non-deleted crops
      const nonDeletedCrops = layoutCrop.crops.filter((_, index) => {
        const rowKey = `${layoutId}-${index}`;
        const changedRow = changedRows.get(rowKey);
        const isDeleted =
          changedRow && "cropIndex" in changedRow && !("frameId" in changedRow);
        return !isDeleted;
      });

      if (nonDeletedCrops.length === 0) return "unchecked";

      // Count checked crops
      const checkedCount = nonDeletedCrops.filter((_, originalIndex) => {
        // Find the original index in the crops array
        const cropIndex = layoutCrop.crops.findIndex((crop, idx) => {
          const rowKey = `${layoutId}-${idx}`;
          const changedRow = changedRows.get(rowKey);
          const isDeleted =
            changedRow &&
            "cropIndex" in changedRow &&
            !("frameId" in changedRow);
          return !isDeleted && crop === nonDeletedCrops[originalIndex];
        });
        const rowKey = `${layoutId}-${cropIndex}`;
        return checkedRows.has(rowKey);
      }).length;

      if (checkedCount === 0) return "unchecked";
      if (checkedCount === nonDeletedCrops.length) return "checked";
      return "indeterminate";
    },
    [layoutCrops, checkedRows, changedRows]
  );

  // Handle layout checkbox change
  const handleLayoutCheckboxChange = useCallback(
    (layoutId: string, checked: boolean) => {
      if (checked) {
        selectAllRowsForLayout(layoutId);
      } else {
        deselectAllRows(layoutId);
      }
    },
    [selectAllRowsForLayout, deselectAllRows]
  );

  // Get all child and descendant layout IDs for a given layout
  const getAllChildLayoutIds = useCallback(
    (parentLayoutId: string, allLayouts: Layout[]): string[] => {
      const childIds: string[] = [];

      const collectChildren = (layoutId: string) => {
        allLayouts.forEach((layout) => {
          if (layout.parentId === layoutId) {
            childIds.push(layout.id);
            collectChildren(layout.id); // Recursively collect children of children
          }
        });
      };

      collectChildren(parentLayoutId);
      return childIds;
    },
    []
  );

  const copyCropsToLayers = useCallback(
    async (targetLayoutIds: string[], checkedCrops: ManualCrop[]) => {
      // Get layout names for target layouts that aren't already loaded
      const missingLayoutIds = targetLayoutIds.filter(
        (id) => !layoutCrops.has(id)
      );

      let layoutNamesMap = new Map<string, string>();

      if (missingLayoutIds.length > 0) {
        try {
          const studioResult = await getStudio();
          if (studioResult.isOk()) {
            const allLayoutsResult = await getAllLayouts(studioResult.value);
            if (allLayoutsResult.isOk()) {
              const allLayouts = allLayoutsResult.value as Layout[];
              missingLayoutIds.forEach((layoutId) => {
                const layout = allLayouts.find((l) => l.id === layoutId);
                if (layout) {
                  layoutNamesMap.set(layoutId, layout.name);
                }
              });
            }
          }
        } catch (error) {
          // If we can't get layout names, we'll use fallback names
          raiseError(
            error instanceof Error
              ? error
              : new Error("Failed to load layout names")
          );
        }
      }

      // For each target layout, replace existing crops or add new ones
      setLayoutCrops((prevLayoutCrops) => {
        const newLayoutCrops = new Map(prevLayoutCrops);

        targetLayoutIds.forEach((targetLayoutId) => {
          const existingLayoutCrop = newLayoutCrops.get(targetLayoutId);
          if (existingLayoutCrop) {
            // Create a new array with existing crops, replacing or adding as needed
            const updatedCrops = [...existingLayoutCrop.crops];

            checkedCrops.forEach((newCrop) => {
              // Find existing crop with same frameId and name
              const existingIndex = updatedCrops.findIndex(
                (crop) =>
                  crop.frameId === newCrop.frameId && crop.name === newCrop.name
              );

              if (existingIndex !== -1) {
                // Replace existing crop
                updatedCrops[existingIndex] = newCrop;
              } else {
                // Add new crop
                updatedCrops.push(newCrop);
              }
            });

            newLayoutCrops.set(targetLayoutId, {
              ...existingLayoutCrop,
              crops: updatedCrops,
            });
          } else {
            // Create a new layout crop entry if it doesn't exist
            // Use the actual layout name if available, otherwise fallback to ID
            const layoutName =
              layoutNamesMap.get(targetLayoutId) || `Layout ${targetLayoutId}`;
            newLayoutCrops.set(targetLayoutId, {
              layoutId: targetLayoutId,
              layoutName: layoutName,
              crops: [...checkedCrops],
            });
          }
        });

        return newLayoutCrops;
      });

      // Add the crops to changedRows so they get saved
      setChangedRows((prev) => {
        const newMap = new Map(prev);

        targetLayoutIds.forEach((targetLayoutId) => {
          const existingLayoutCrop = layoutCrops.get(targetLayoutId);

          checkedCrops.forEach((crop) => {
            if (existingLayoutCrop) {
              // Find existing crop with same frameId and name
              const existingIndex = existingLayoutCrop.crops.findIndex(
                (c) => c.frameId === crop.frameId && c.name === crop.name
              );

              if (existingIndex !== -1) {
                // Replace existing crop
                const rowKey = `${targetLayoutId}-${existingIndex}`;
                newMap.set(rowKey, crop);
              } else {
                // Add new crop at the end
                const newIndex = existingLayoutCrop.crops.length;
                const rowKey = `${targetLayoutId}-${newIndex}`;
                newMap.set(rowKey, crop);
              }
            } else {
              // New layout, add all crops starting from index 0
              const newIndex = checkedCrops.indexOf(crop);
              const rowKey = `${targetLayoutId}-${newIndex}`;
              newMap.set(rowKey, crop);
            }
          });
        });

        return newMap;
      });
    },
    [layoutCrops, raiseError]
  );

  // Copy selected crops to all child layouts
  const copySelectedCropsToChildren = useCallback(
    async (sourceLayoutId: string) => {
      try {
        (await getStudio())
          .map((studio) => getAllLayouts(studio))
          .fold(
            (layouts) => {
              const childLayoutIds = getAllChildLayoutIds(
                sourceLayoutId,
                layouts
              );
              if (childLayoutIds.length === 0) {
                return Result.error(
                  new Error("No child layouts found for this layout")
                );
              }

              // Get selected crops for the source layout
              const selectedCrops = getCheckedCropsForLayout(sourceLayoutId);
              if (selectedCrops.length == 0) {
                return Result.error(new Error("No crops selected to copy"));
              }

              // Copy crops to all child layouts
              copyCropsToLayers(childLayoutIds, selectedCrops);
            },
            (error) => raiseError(error)
          );
      } catch (error) {
        raiseError(
          error instanceof Error
            ? error
            : new Error("Failed to copy crops to child layouts")
        );
      }
    },
    [getAllChildLayoutIds, getCheckedCropsForLayout, copyCropsToLayers]
  );

  const addCopyOfCrop = useCallback(
    (originalCrop: ManualCrop, newName: string) => {
      const layoutId = currentLayoutIdForCopy;
      if (!layoutId) return;

      // Create a copy of the crop with the new name
      const newCrop: ManualCrop = {
        ...originalCrop,
        name: newName,
      };

      // Replace existing crop or add new crop to the layout
      setLayoutCrops((prevLayoutCrops) => {
        const newLayoutCrops = new Map(prevLayoutCrops);
        const existingLayoutCrop = newLayoutCrops.get(layoutId);

        if (existingLayoutCrop) {
          const updatedCrops = [...existingLayoutCrop.crops];

          // Find existing crop with same frameId and name
          const existingIndex = updatedCrops.findIndex(
            (crop) =>
              crop.frameId === newCrop.frameId && crop.name === newCrop.name
          );

          if (existingIndex !== -1) {
            // Replace existing crop
            updatedCrops[existingIndex] = newCrop;
          } else {
            // Add new crop
            updatedCrops.push(newCrop);
          }

          newLayoutCrops.set(layoutId, {
            ...existingLayoutCrop,
            crops: updatedCrops,
          });
        }

        return newLayoutCrops;
      });

      // Add the crop to changedRows so it gets saved
      setChangedRows((prev) => {
        const newMap = new Map(prev);
        const existingLayoutCrop = layoutCrops.get(layoutId);

        if (existingLayoutCrop) {
          // Find existing crop with same frameId and name
          const existingIndex = existingLayoutCrop.crops.findIndex(
            (crop) =>
              crop.frameId === newCrop.frameId && crop.name === newCrop.name
          );

          if (existingIndex !== -1) {
            // Replace existing crop
            const rowKey = `${layoutId}-${existingIndex}`;
            newMap.set(rowKey, newCrop);
          } else {
            // Add new crop at the end
            const newIndex = existingLayoutCrop.crops.length;
            const rowKey = `${layoutId}-${newIndex}`;
            newMap.set(rowKey, newCrop);
          }
        }

        return newMap;
      });
    },
    [currentLayoutIdForCopy, layoutCrops]
  );

  const addCopyOfCropForReplace = useCallback(
    (originalCrop: ManualCrop, newName: string) => {
      const layoutId = currentLayoutIdForReplace;
      if (!layoutId) return;

      // Create a copy of the crop with the new name
      const newCrop: ManualCrop = {
        ...originalCrop,
        name: newName,
      };

      // Replace existing crop or add new crop to the layout
      setLayoutCrops((prevLayoutCrops) => {
        const newLayoutCrops = new Map(prevLayoutCrops);
        const existingLayoutCrop = newLayoutCrops.get(layoutId);

        if (existingLayoutCrop) {
          const updatedCrops = [...existingLayoutCrop.crops];

          // Find existing crop with same frameId and name
          const existingIndex = updatedCrops.findIndex(
            (crop) =>
              crop.frameId === newCrop.frameId && crop.name === newCrop.name
          );

          if (existingIndex !== -1) {
            // Replace existing crop
            updatedCrops[existingIndex] = newCrop;
          } else {
            // Add new crop
            updatedCrops.push(newCrop);
          }

          newLayoutCrops.set(layoutId, {
            ...existingLayoutCrop,
            crops: updatedCrops,
          });
        }

        return newLayoutCrops;
      });

      // Add the crop to changedRows so it gets saved
      setChangedRows((prev) => {
        const newMap = new Map(prev);
        const existingLayoutCrop = layoutCrops.get(layoutId);

        if (existingLayoutCrop) {
          // Find existing crop with same frameId and name
          const existingIndex = existingLayoutCrop.crops.findIndex(
            (crop) =>
              crop.frameId === newCrop.frameId && crop.name === newCrop.name
          );

          if (existingIndex !== -1) {
            // Replace existing crop
            const rowKey = `${layoutId}-${existingIndex}`;
            newMap.set(rowKey, newCrop);
          } else {
            // Add new crop at the end
            const newIndex = existingLayoutCrop.crops.length;
            const rowKey = `${layoutId}-${newIndex}`;
            newMap.set(rowKey, newCrop);
          }
        }

        return newMap;
      });
    },
    [currentLayoutIdForReplace, layoutCrops]
  );

  const saveCropChanges = async () => {
    if (changedRows.size === 0) return;

    try {
      // Set saving state and show spinner
      setSaveState("saving");
      setSaveMessage("Saving Crop Changes...");

      // Get studio instance
      const studioResult = await getStudio();
      if (!studioResult.isOk()) {
        raiseError(
          new Error(studioResult.error?.message || "Failed to get studio")
        );
        setSaveState("error");
        setSaveMessage("Error saving changes...");
        return;
      }
      const studio = studioResult.value;

      // Get and store original document state for potential revert
      const originalDocStateResult = await getCurrentDocumentState(studio);
      if (!originalDocStateResult.isOk()) {
        raiseError(
          new Error(
            "Failed to get original document state: " +
              originalDocStateResult.error?.message
          )
        );
        setSaveState("error");
        setSaveMessage("Error saving changes...");
        return;
      }

      const originalDocumentState = originalDocStateResult.value;
      setOriginalDocumentState(originalDocumentState);

      // Separate changed rows into updates and deletes
      const layoutChanges = new Map<string, Map<number, ManualCrop>>();
      const layoutDeletes = new Map<string, Set<number>>();

      changedRows.forEach((entry, rowKey) => {
        const [layoutId, cropIndexStr] = rowKey.split("-");
        const cropIndex = parseInt(cropIndexStr, 10);

        if ("frameId" in entry) {
          // This is a ManualCrop update
          if (!layoutChanges.has(layoutId)) {
            layoutChanges.set(layoutId, new Map());
          }
          layoutChanges.get(layoutId)!.set(cropIndex, entry);
        } else {
          // This is a ManualCropToDelete
          if (!layoutDeletes.has(layoutId)) {
            layoutDeletes.set(layoutId, new Set());
          }
          layoutDeletes.get(layoutId)!.add(cropIndex);
        }
      });

      // Start with the original document state and apply changes sequentially
      let currentDocumentState = originalDocumentState;

      // First, handle deletions for each affected layout
      for (const [layoutId, deleteIndices] of layoutDeletes) {
        if (deleteIndices.size > 0) {
          const layoutCrop = layoutCrops.get(layoutId);
          if (!layoutCrop) {
            raiseError(
              new Error(`Layout crops not found for layout ${layoutId}`)
            );
            return;
          }

          // Delete each individual crop using the granular function
          for (const cropIndex of deleteIndices) {
            const crop = layoutCrop.crops[cropIndex];
            if (!crop) {
              raiseError(
                new Error(
                  `Crop at index ${cropIndex} not found in layout ${layoutId}`
                )
              );
              return;
            }

            const result = deleteSingleManualCropForLayout(
              currentDocumentState,
              layoutId,
              selectedConnectorId,
              crop.frameId,
              crop.name
            );

            if (result.isError()) {
              raiseError(
                new Error(
                  `Failed to delete manual crop ${crop.name} in frame ${crop.frameId}: ${result.error?.message}`
                )
              );
              // Error occurred, revert changes
              setSaveState("error");
              setSaveMessage("Error reverting changes...");

              if (originalDocumentState) {
                const revertResult = await loadDocumentFromJsonStr(
                  studio,
                  JSON.stringify(originalDocumentState)
                );
                if (revertResult.isError()) {
                  raiseError(new Error("Failed to revert changes after error"));
                }
              }
              return;
            }

            // Update the current document state for the next iteration
            currentDocumentState = result.value;
          }
        }
      }

      // Then, handle updates for each affected layout
      for (const [layoutId, cropChanges] of layoutChanges) {
        const layoutCrop = layoutCrops.get(layoutId);
        if (!layoutCrop) continue;

        // Create updated crops array with changes applied
        const updatedCrops = layoutCrop.crops.map((crop, index) => {
          const changedCrop = cropChanges.get(index);
          return changedCrop || crop;
        });

        const manualCrops = updatedCrops.map((crop) => ({
          frameId: crop.frameId,
          frameName: crop.frameName,
          name: crop.name,
          left: crop.left,
          top: crop.top,
          width: crop.width,
          height: crop.height,
          rotationDegrees: crop.rotationDegrees,
          originalParentWidth: crop.originalParentWidth,
          originalParentHeight: crop.originalParentHeight,
        }));

        console.log("Current document state:", currentDocumentState);

        const result = setManualCropsForLayout(
          currentDocumentState,
          layoutId,
          selectedConnectorId,
          manualCrops
        );

        if (result.isError()) {
          raiseError(
            new Error("Failed to set manual crops: " + result.error?.message)
          );
          // Error occurred, revert changes
          setSaveState("error");
          setSaveMessage("Error reverting changes...");

          if (originalDocumentState) {
            const revertResult = await loadDocumentFromJsonStr(
              studio,
              JSON.stringify(originalDocumentState)
            );
            if (revertResult.isError()) {
              raiseError(new Error("Failed to revert changes after error"));
            }
          }
          return;
        }

        // Update the current document state for the next iteration
        currentDocumentState = result.value;
      }

      // Apply the final document state to the studio
      const finalResult = await loadDocumentFromJsonStr(
        studio,
        JSON.stringify(currentDocumentState)
      );
      if (finalResult.isError()) {
        raiseError(
          new Error(
            "Failed to load final document state: " + finalResult.error?.message
          )
        );
        // Error occurred, revert changes
        setSaveState("error");
        setSaveMessage("Error reverting changes...");

        if (originalDocumentState) {
          const revertResult = await loadDocumentFromJsonStr(
            studio,
            JSON.stringify(originalDocumentState)
          );
          if (revertResult.isError()) {
            raiseError(new Error("Failed to revert changes after error"));
          }
        }
        return;
      }

      // Success - show success message
      setSaveState("success");
      setSaveMessage("Changes Saved!");
      setChangedRows(new Map());

      // Notify parent that crops were saved
      if (onCropsSaved) {
        onCropsSaved();
      }
    } catch (error) {
      raiseError(
        error instanceof Error
          ? error
          : new Error("Failed to save crop changes")
      );
      // Error occurred, try to revert changes
      setSaveState("error");
      setSaveMessage("Error reverting changes...");

      if (originalDocumentState) {
        try {
          const studioResult = await getStudio();
          if (studioResult.isOk()) {
            await loadDocumentFromJsonStr(
              studioResult.value,
              JSON.stringify(originalDocumentState)
            );
          }
        } catch (revertError) {
          raiseError(new Error("Failed to revert changes after error"));
        }
      }
    }
  };

  const handleOkayClick = async () => {
    // Reset save state and reload crops
    setSaveState("idle");
    setSaveMessage("");
    await loadCropsForSelectedLayouts();
  };

  const handleCloseClick = () => {
    // Close the modal if callback is provided
    if (onModalClose) {
      onModalClose();
    } else {
      // Fallback: just reset the state
      setSaveState("idle");
      setSaveMessage("");
    }
  };

  // Show spinner during saving, error, or success states
  if (saveState !== "idle") {
    return (
      <Center style={{ height: "100%" }}>
        <Stack align="center" gap="md">
          {saveState === "saving" && <Loader size="lg" />}
          <Text size="lg" fw={500}>
            {saveMessage}
          </Text>
          {saveState === "success" && (
            <Group gap="md">
              <Button onClick={handleOkayClick} color="blue">
                Okay
              </Button>
              <Button onClick={handleCloseClick} variant="outline">
                Close
              </Button>
            </Group>
          )}
        </Stack>
      </Center>
    );
  }

  if (selectedLayoutIds.length === 0) {
    return (
      <Center style={{ height: "100%" }}>
        <Text c="dimmed">
          Select layouts from the Layout Viewer to view their manual crops
        </Text>
      </Center>
    );
  }

  return (
    <Box style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <Box
        p="md"
        style={{ borderBottom: "1px solid var(--mantine-color-gray-3)" }}
      >
        <Group justify="flex-end" align="center">
          <Button
            onClick={saveCropChanges}
            disabled={changedRows.size === 0}
            color="blue"
            size="sm"
          >
            Save Crop Changes
          </Button>
        </Group>
      </Box>

      {/* Content */}
      <ScrollArea style={{ flex: 1 }}>
        <Box p="md">
          {isLoading ? (
            <Center style={{ height: 200 }}>
              <Loader size="sm" />
            </Center>
          ) : layoutCrops.size === 0 ? (
            <Center style={{ height: 200 }}>
              <Text c="dimmed">
                {selectedConnectorId
                  ? "No manual crops found for the selected layouts and connector"
                  : "Select a connector to view manual crops"}
              </Text>
            </Center>
          ) : (
            <Stack gap="lg">
              {Array.from(layoutCrops.values()).map((layoutCrop) => {
                const checkedSnapshotsCount = getCheckedSnapshotsCountForLayout(
                  layoutCrop.layoutId
                );
                return (
                  <Paper key={layoutCrop.layoutId} p="md" withBorder>
                    <Group justify="space-between" align="center" mb="md">
                      <Title order={4}>{layoutCrop.layoutName}</Title>
                      <Group gap="xs">
                        {checkedSnapshotsCount > 0 && (
                          <>
                            <Tooltip
                              label="Delete selected crops"
                              position="top"
                              withArrow
                            >
                              <ActionIcon
                                color="red"
                                variant="filled"
                                onClick={() =>
                                  deleteCheckedSnapshots(layoutCrop.layoutId)
                                }
                                disabled={!selectedConnectorId}
                              >
                                <IconTrash size={16} />
                              </ActionIcon>
                            </Tooltip>
                            <Tooltip
                              label="Copy selected crops to other layouts"
                              position="top"
                              withArrow
                            >
                              <ActionIcon
                                color="blue"
                                variant="filled"
                                onClick={() =>
                                  setCopyModalOpened(true, layoutCrop.layoutId)
                                }
                                disabled={!selectedConnectorId}
                              >
                                <IconCopy size={16} />
                              </ActionIcon>
                            </Tooltip>
                            {checkedSnapshotsCount === 1 && (
                              <Tooltip
                                label="Copy selected crop and add as new row"
                                position="top"
                                withArrow
                              >
                                <ActionIcon
                                  color="blue"
                                  variant="filled"
                                  onClick={() =>
                                    setCopyAndAddRowModalOpened(
                                      true,
                                      layoutCrop.layoutId
                                    )
                                  }
                                  disabled={!selectedConnectorId}
                                >
                                  <IconCopyPlus size={16} />
                                </ActionIcon>
                              </Tooltip>
                            )}
                            <Tooltip
                              label="Copy and replace existing crops"
                              position="top"
                              withArrow
                            >
                              <ActionIcon
                                color="blue"
                                variant="filled"
                                onClick={() =>
                                  setCopyAndReplaceModalOpened(
                                    true,
                                    layoutCrop.layoutId
                                  )
                                }
                                disabled={!selectedConnectorId}
                              >
                                <IconReplace size={16} />
                              </ActionIcon>
                            </Tooltip>
                            <Tooltip
                              label="Deselect all crops in this layout"
                              position="top"
                              withArrow
                            >
                              <ActionIcon
                                color="blue"
                                variant="filled"
                                onClick={() =>
                                  deselectAllRows(layoutCrop.layoutId)
                                }
                                disabled={!selectedConnectorId}
                              >
                                <IconDeselect size={16} />
                              </ActionIcon>
                            </Tooltip>
                            <Tooltip
                              label="Copy selected crops to all child layouts"
                              position="top"
                              withArrow
                            >
                              <ActionIcon
                                color="blue"
                                variant="filled"
                                onClick={() =>
                                  copySelectedCropsToChildren(
                                    layoutCrop.layoutId
                                  )
                                }
                                disabled={!selectedConnectorId}
                              >
                                <IconArrowAutofitDown size={16} />
                              </ActionIcon>
                            </Tooltip>
                          </>
                        )}
                      </Group>
                    </Group>

                    {layoutCrop.crops.length === 0 ? (
                      <Text c="dimmed" size="sm">
                        No manual crops for this layout
                      </Text>
                    ) : (
                      <Table striped highlightOnHover>
                        <Table.Thead>
                          <Table.Tr>
                            <Table.Th style={{ width: 40 }}></Table.Th>
                            <Table.Th>
                              <Group gap="xs" align="center">
                                <Tooltip
                                  label="Select/deselect all crops in this layout"
                                  position="top"
                                  withArrow
                                >
                                  <Checkbox
                                    checked={
                                      getLayoutCheckboxState(
                                        layoutCrop.layoutId
                                      ) === "checked"
                                    }
                                    indeterminate={
                                      getLayoutCheckboxState(
                                        layoutCrop.layoutId
                                      ) === "indeterminate"
                                    }
                                    onChange={(event) =>
                                      handleLayoutCheckboxChange(
                                        layoutCrop.layoutId,
                                        event.currentTarget.checked
                                      )
                                    }
                                    disabled={!selectedConnectorId}
                                  />
                                </Tooltip>
                                <Text>Frame Name</Text>
                              </Group>
                            </Table.Th>
                            <Table.Th>Asset Name</Table.Th>
                            <Table.Th>Left</Table.Th>
                            <Table.Th>Top</Table.Th>
                            <Table.Th>Width</Table.Th>
                            <Table.Th>Height</Table.Th>
                          </Table.Tr>
                        </Table.Thead>
                        <Table.Tbody>
                          {layoutCrop.crops.map((crop, index) => {
                            const rowKey = `${layoutCrop.layoutId}-${index}`;
                            const changedRow = changedRows.get(rowKey);
                            const isDeleted =
                              changedRow &&
                              "cropIndex" in changedRow &&
                              !("frameId" in changedRow);
                            return (
                              <CropRow
                                key={`${crop.frameId}-${crop.name}`}
                                crop={crop}
                                layoutId={layoutCrop.layoutId}
                                cropIndex={index}
                                onCropChange={handleCropChange}
                                isChecked={checkedRows.has(rowKey)}
                                onCheckChange={handleCheckChange}
                                isDeleted={!!isDeleted}
                              />
                            );
                          })}
                        </Table.Tbody>
                      </Table>
                    )}
                  </Paper>
                );
              })}
            </Stack>
          )}
        </Box>
      </ScrollArea>

      {/* Copy Crop to Layer Modal */}
      <CopyCropToLayerModal
        opened={copyCropToLayerModalOpened}
        onClose={() => setCopyCropToLayerModalOpened(false)}
        sourceLayoutId={currentCopySourceLayoutId}
        checkedCrops={getCheckedCropsForLayout(currentCopySourceLayoutId)}
        selectedConnectorId={selectedConnectorId}
        onCopy={copyCropsToLayers}
      />

      {/* Copy and Add Row Modal */}
      {currentCropForCopy && (
        <CopyAndAddRowModal
          opened={copyAndAddRowModalOpened}
          onClose={() => setCopyAndAddRowModalOpened(false)}
          crop={currentCropForCopy}
          layoutId={currentLayoutIdForCopy}
          existingCrops={layoutCrops.get(currentLayoutIdForCopy)?.crops || []}
          onAddCopy={addCopyOfCrop}
        />
      )}

      {/* Copy and Replace Modal */}
      {currentCropsForReplace.length > 0 && (
        <CopyAndReplaceModal
          opened={copyAndReplaceModalOpened}
          onClose={() => setCopyAndReplaceModalOpened(false)}
          crops={currentCropsForReplace}
          layoutId={currentLayoutIdForReplace}
          existingCrops={
            layoutCrops.get(currentLayoutIdForReplace)?.crops || []
          }
          onAddCopy={addCopyOfCropForReplace}
        />
      )}
    </Box>
  );
}
