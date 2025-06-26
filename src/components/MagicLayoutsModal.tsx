import React, { useState, useEffect } from "react";
import { Modal, Text, Stack, Button, Loader } from "@mantine/core";
import {
  getAllLayouts,
  getLayoutById,
  setLayoutAvailable,
} from "../studio/layoutHandler";
import {
  getPropertiesOnLayout,
  getAll as getAllFrames,
} from "../studio/frameHandler";
import {
  VariableType,
  VariableVisibilityType,
  ActionEditorEvent,
  type Layout,
} from "@chili-publish/studio-sdk";
import {
  setOrCreateVariableValue,
  getAllVariables,
  getByName,
  moveVariable,
  setVariableVisblityWithName,
  groupVariables,
  deleteVariables,
} from "../studio/variableHandler";
import { updateAction } from "../studio/actionHandler";
import { magicLayoutScript } from "../studio/actions/magicLayout";
import { appStore } from "../modalStore";

interface MagicLayoutsModalProps {
  opened: boolean;
  onClose: () => void;
}

export function MagicLayoutsModal({ opened, onClose }: MagicLayoutsModalProps) {
  const [isProcessing, setIsProcessing] = useState(true);
  const [isComplete, setIsComplete] = useState(false);
  const raiseError = appStore((store) => store.raiseError);

  // Helper function to recursively gather leaf children (children with no children)
  const gatherAllChildren = async (
    childrenLayoutIds: string[],
    onlyLeafs: boolean,
    skipUnavailable: boolean = true,
    recur = 0,
  ) => {
    const leafNames: string[] = [];
    const leafIds: string[] = [];

    if (childrenLayoutIds.length === 0) {
      return { names: [], ids: [] };
    }

    const childLayouts = await Promise.all(
      childrenLayoutIds.map(async (id) => {
        const layoutResult = await getLayoutById(window.SDK, id);
        if (layoutResult.isError()) {
          raiseError(new Error(`Failed to get layout with id ${id}`));
          throw new Error(`Failed to get layout with id ${id}`);
        }
        return layoutResult.value as Layout;
      }),
    );

    console.log({
      recur: recur,
      childrenIds: childrenLayoutIds,
      children: childLayouts,
    });

    for (const child of childLayouts) {
      if (onlyLeafs) {
        const hasChildren = child.childLayouts.length > 0;

        if (!hasChildren) {
          // This child has no children, so it's a leaf - include it
          if (!skipUnavailable || child.availableForUser) {
            leafNames.push(child.name);
            leafIds.push(child.id);

            console.log({
              skipping: false,
              child: child.name,
              childLeaves: [],
            });
          }
        } else {
          // This child has children, so recursively get its leaf children
          const childLeaves = await gatherAllChildren(
            child.childLayouts,
            onlyLeafs,
            skipUnavailable,
            recur + 1,
          );

          console.log({
            skipping: true,
            child: child.name,
            childLeaves: childLeaves,
          });

          leafNames.push(...childLeaves.names);
          leafIds.push(...childLeaves.ids);
        }
        console.log("afterPush", leafNames, leafIds);
      } else {
        if (!skipUnavailable || child.availableForUser) {
          leafNames.push(child.name);
          leafIds.push(child.id);
        }

        const childLeaves = await gatherAllChildren(
          child.childLayouts,
          onlyLeafs,
          skipUnavailable,
          recur + 1,
        );
        leafNames.push(...childLeaves.names);
        leafIds.push(...childLeaves.ids);
      }
    }

    console.log("FINAL", { names: leafNames, ids: leafIds, recur });
    return { names: leafNames, ids: leafIds };
  };

  // Async function that runs when modal opens
  const runMagicProcess = async () => {
    // Get all layouts
    const layoutsResult = await getAllLayouts(window.SDK);

    if (layoutsResult.isError()) {
      raiseError(new Error("Failed to get layouts"));
      throw new Error("Failed to get layouts");
    }

    const layouts = layoutsResult.value;

    // Ensure layouts is defined
    if (!layouts) {
      raiseError(new Error("Layouts data is undefined"));
      throw new Error("Layouts data is undefined");
    }

    // Find all layouts that start with ✨
    const magicLayouts = layouts.filter((layout) =>
      layout.name.startsWith("✨"),
    );

    // Create a map of magic layouts to their corresponding normal layouts
    const muggleToMagicLayouts = magicLayouts.reduce(
      (acc, magicLayout) => {
        const normalLayoutName = magicLayout.name.replace("✨", "");
        const normalLayout = layouts.find(
          (layout) => layout.name === normalLayoutName,
        );
        if (normalLayout) {
          acc[normalLayout.name] = magicLayout.name;

          // if (!acc[magicLayout.id]) {
          //   acc[magicLayout.id] = [];
          // }

          // acc[magicLayout.id].push(normalLayout.name);
        }
        return acc;
      },
      {} as Record<string, string>,
    );

    // For each normal layout that has a magic counterpart, find all its children
    for (const [normalLayoutName, magicLayoutName] of Object.entries(
      muggleToMagicLayouts,
    )) {
      const normalLayout = layouts.find(
        (layout) => layout.name === normalLayoutName,
      );
      if (normalLayout) {
        const allChildren = await gatherAllChildren(
          normalLayout.childLayouts,
          false,
        );
        // Add all children to muggleToMagicLayouts with the same magic layout name
        allChildren.names.forEach((childName) => {
          muggleToMagicLayouts[childName] = magicLayoutName;
        });
      }
    }

    const childrenIds: string[] = [];

    const result = await getAllVariables(window.SDK);
    if (result.isOk()) {
      const variables = result.value;
      const idsToDelete = variables
        .filter((variable) => variable.name.startsWith("✨"))
        .map((variable) => variable.id);
      await deleteVariables(window.SDK, idsToDelete);
    }

    // For each magic layout, create a variable with its children layout names
    for (const magicLayout of magicLayouts) {
      // Get leaf children recursively
      const leafChildren = await gatherAllChildren(
        magicLayout.childLayouts,
        true,
        false,
      );
      console.log("LEAF CHILDREN", leafChildren);
      const childrenNames = leafChildren.names;
      childrenIds.push(...leafChildren.ids);

      (await gatherAllChildren(magicLayout.childLayouts, false)).ids.forEach(
        (id) => setLayoutAvailable(window.SDK, id, false),
      );

      // // If the layout has a childLayouts property, also include those names
      // if (magicLayout.childLayouts && Array.isArray(magicLayout.childLayouts)) {
      //   const additionalChildren = layouts.filter((layout) =>
      //     magicLayout.childLayouts!.includes(layout.id)
      //   );
      //   additionalChildren.forEach((child) => {
      //     if (!childrenNames.includes(child.name)) {
      //       setLayoutAvailable(window.SDK, child.id, true);
      //       // childrenNames.push(child.name);
      //       // childrenIds.push(child.id);
      //     }
      //   });
      // }

      setLayoutAvailable(window.SDK, magicLayout.id, false);

      // Create variable with the same name as the layout
      await setOrCreateVariableValue({
        studio: window.SDK,
        name: magicLayout.name,
        variableType: VariableType.list,
        value: childrenNames,
      });

      // Set the variable to invisible
      const visibilityResult = await setVariableVisblityWithName({
        studio: window.SDK,
        name: magicLayout.name,
        visible: { type: VariableVisibilityType.invisible },
      });

      if (visibilityResult.isError()) {
        raiseError(
          new Error(
            `Failed to set visibility for variable ${magicLayout.name}`,
          ),
        );
        // Continue with other variables even if one fails
      }
    }

    // After creating all magic variables, organize them under AUTO_GEN_MAGIC group
    const allVariablesResult = await getAllVariables(window.SDK);

    if (allVariablesResult.isError()) {
      raiseError(new Error("Failed to get all variables"));
      throw new Error("Failed to get all variables");
    }

    const allVariables = allVariablesResult.value;

    if (!allVariables) {
      raiseError(new Error("Variables data is undefined"));
      throw new Error("Variables data is undefined");
    }

    // Check if AUTO_GEN_MAGIC variable exists
    let autoGenMagicId: string;
    const existingAutoGenMagic = allVariables.find(
      (variable) => variable.name === "AUTO_GEN_MAGIC",
    );

    if (existingAutoGenMagic) {
      autoGenMagicId = existingAutoGenMagic.id;
    } else {
      const createGroupResult = await groupVariables({
        studio: window.SDK,
        name: "AUTO_GEN_MAGIC",
        variableIds: [],
      });

      if (createGroupResult.isError()) {
        raiseError(new Error("Failed to create AUTO_GEN_MAGIC group"));
        throw new Error("Failed to create AUTO_GEN_MAGIC group");
      }

      // Get the ID using getByName
      const getByNameResult = await getByName(window.SDK, "AUTO_GEN_MAGIC");

      if (getByNameResult.isError()) {
        raiseError(new Error("Failed to get AUTO_GEN_MAGIC by name"));
        throw new Error("Failed to get AUTO_GEN_MAGIC by name");
      }

      if (!getByNameResult.value) {
        raiseError(
          new Error("AUTO_GEN_MAGIC variable not found after creation"),
        );
        throw new Error("AUTO_GEN_MAGIC variable not found after creation");
      }

      autoGenMagicId = getByNameResult.value.id;
    }

    // Find all magic variables we created and move them under AUTO_GEN_MAGIC if needed
    const magicVariableNames = magicLayouts.map((layout) => layout.name);
    const magicVariables = allVariables.filter((variable) =>
      magicVariableNames.includes(variable.name),
    );

    // Move variables that don't have the correct parentId
    for (const magicVariable of magicVariables) {
      if (magicVariable.parentId !== autoGenMagicId) {
        const moveResult = await moveVariable({
          studio: window.SDK,
          id: magicVariable.id,
          newParentId: autoGenMagicId,
          order: 0,
        });

        if (moveResult.isError()) {
          raiseError(
            new Error(`Failed to move variable ${magicVariable.name}`),
          );
          throw new Error(`Failed to move variable ${magicVariable.name}`);
        }
      }
    }

    // Get all layouts again and filter to only child layouts
    const allLayoutsResult = await getAllLayouts(window.SDK);

    if (allLayoutsResult.isError()) {
      raiseError(new Error("Failed to get layouts for child filtering"));
      throw new Error("Failed to get layouts for child filtering");
    }

    const allLayouts = allLayoutsResult.value;

    if (!allLayouts) {
      raiseError(new Error("All layouts data is undefined"));
      throw new Error("All layouts data is undefined");
    }

    // Filter to only child layouts (layouts that have a parentId)
    const childLayouts = allLayouts.filter((layout) =>
      childrenIds.includes(layout.id),
    );

    // Create object with child layout names as keys and {w, h} as values
    const childLayoutSizes: Record<string, { w: number; h: number }> = {};

    for (const layout of childLayouts) {
      // Extract width and height values, handling both PropertyState objects and direct numbers

      childLayoutSizes[layout.name] = {
        w: layout.width.value,
        h: layout.height.value,
      };
    }

    // Get all frames to look up frame names
    const allFramesResult = await getAllFrames(window.SDK);

    if (allFramesResult.isError()) {
      raiseError(new Error("Failed to get all frames"));
      throw new Error("Failed to get all frames");
    }

    const allFrames = allFramesResult.value;

    if (!allFrames) {
      raiseError(new Error("All frames data is undefined"));
      throw new Error("All frames data is undefined");
    }

    // Create a map of frame IDs to frame names for lookup
    const frameIdToNameMap = new Map<string, string>();
    allFrames.forEach((frame) => {
      frameIdToNameMap.set(frame.id, frame.name);
    });

    // Process frame properties for each child layout
    const layoutFramesData: Record<string, any[]> = {};

    for (const layout of childLayouts) {
      const framePropertiesResult = await getPropertiesOnLayout(
        window.SDK,
        layout.id,
      );

      if (framePropertiesResult.isError()) {
        raiseError(
          new Error(`Failed to get frame properties for layout ${layout.name}`),
        );
        throw new Error(
          `Failed to get frame properties for layout ${layout.name}`,
        );
      }

      const frameProperties = framePropertiesResult.value;

      if (!frameProperties || !Array.isArray(frameProperties)) {
        raiseError(
          new Error(
            `Frame properties is not an array for layout ${layout.name}`,
          ),
        );
        throw new Error(
          `Frame properties is not an array for layout ${layout.name}`,
        );
      }

      const visibleFramesWithOverrides: any[] = [];

      // Check each frame's properties
      for (const frameProps of frameProperties) {
        // Skip if frameProps is null or undefined
        if (!frameProps) {
          raiseError(
            new Error(
              `Frame properties is null or undefined for layout ${layout.name}`,
            ),
          );
          throw new Error(
            `Frame properties is null or undefined for layout ${layout.name}`,
          );
        }

        // Check if isVisible.value is true and at least one property has isOverride true
        const isVisible = frameProps.isVisible?.value === true;
        // const hasOverride =
        //   frameProps.x?.isOverride === true ||
        //   frameProps.y?.isOverride === true ||
        //   frameProps.width?.isOverride === true ||
        //   frameProps.height?.isOverride === true ||
        //   frameProps.rotationDegrees?.isOverride === true;

        if (isVisible) {
          // Get frame name from our lookup map
          const frameName = frameIdToNameMap.get(frameProps.id) || null;

          if (!frameName) {
            raiseError(
              new Error(
                `Failed to get frame name for frame ID ${frameProps.id}`,
              ),
            );
            throw new Error(
              `Failed to get frame name for frame ID ${frameProps.id}`,
            );
          }

          visibleFramesWithOverrides.push({
            id: frameProps.id,
            x: frameProps.x.value,
            y: frameProps.y.value,
            width: frameProps.width.value,
            height: frameProps.height.value,
            isVisible: frameProps.isVisible,
            rotationDegrees: frameProps.rotationDegrees.value,
            name: frameName,
          });
        }
      }

      // Only add to layoutFramesData if there are visible frames with overrides
      if (visibleFramesWithOverrides.length > 0) {
        layoutFramesData[layout.name] = visibleFramesWithOverrides;
      }
    }

    // Create and update the magic layout action script
    const script =
      magicLayoutScript
        .toString()
        .replace('"%DATA1%"', JSON.stringify(childLayoutSizes))
        .replace('"%DATA2%"', JSON.stringify(layoutFramesData))
        .replace('"%DATA3%"', JSON.stringify(muggleToMagicLayouts)) +
      "\nmagicLayoutScript(false)";

    const updateResult = await updateAction(
      {
        name: "AUTO_GEN_MAGIC_LAYOUT",
        studio: window.SDK,
      },
      {
        name: "AUTO_GEN_MAGIC_LAYOUT",
        triggers: [
          ...magicVariables.map((variable) => ({
            event: ActionEditorEvent.variableValueChanged,
            triggers: [variable.id],
          })),
          { event: ActionEditorEvent.selectedLayoutChanged },
          { event: ActionEditorEvent.documentLoaded },
        ],
        script: script,
      },
    );

    return updateResult;
  };

  useEffect(() => {
    if (!opened) {
      // Reset state when modal is closed
      setIsProcessing(true);
      setIsComplete(false);
      return;
    }

    // Run the magic process when modal opens
    const executeMagic = async () => {
      try {
        await runMagicProcess();
        setIsProcessing(false);
        setIsComplete(true);
      } catch (error) {
        console.error("Magic process failed:", error);
        setIsProcessing(false);
        // Could add error handling here
      }
    };

    executeMagic();
  }, [opened]);

  const handleClose = () => {
    onClose();
  };

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      title="Magic Layouts"
      centered
      size="md"
      closeOnClickOutside={false}
      closeOnEscape={false}
    >
      <Stack align="center" gap="lg" p="lg">
        {isProcessing ? (
          <>
            <Loader size="lg" color="purple" />
            <Text size="lg" fw={500}>
              Creating Magic ✨
            </Text>
          </>
        ) : (
          <>
            <Text size="lg" fw={500} c="green">
              Magic Created ✨
            </Text>
            <Button
              onClick={handleClose}
              color="purple"
              size="md"
              disabled={!isComplete}
            >
              Close
            </Button>
          </>
        )}
      </Stack>
    </Modal>
  );
}
