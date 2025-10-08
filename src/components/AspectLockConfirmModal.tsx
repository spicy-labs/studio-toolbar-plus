import { useState } from "react";
import {
  Modal,
  Text,
  Group,
  Button,
  Slider,
  Loader,
  Stack,
} from "@mantine/core";
import { getStudio, saveLayoutSizingToAction } from "../studio/studioAdapter";
import { appStore } from "../modalStore";
import { getAllLayouts, setLayoutResizable } from "../studio/layoutHandler";
import { ConstraintMode } from "@chili-publish/studio-sdk";
import { deleteAction } from "../studio/actionHandler";
import { deleteVariables } from "../studio/variableHandler";

interface AspectLockConfirmModalProps {
  opened: boolean;
  onClose: () => void;
}

export function AspectLockConfirmModal({
  opened,
  onClose,
}: AspectLockConfirmModalProps) {
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
  const [tolerancePercentage, setTolerancePercentage] = useState(10);
  const [isSecondConfirmModalOpen, setIsSecondConfirmModalOpen] =
    useState(false);
  const [isRemoveConfirmModalOpen, setIsRemoveConfirmModalOpen] =
    useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const raiseError = appStore((store) => store.raiseError);

  const handleUpdateLayouts = () => {
    // Show second confirmation modal
    setIsSecondConfirmModalOpen(true);
  };

  const handleLegacyAspectLock = async () => {
    // Close the first modal and show processing
    onClose();
    setIsProcessing(true);

    try {
      const result = await saveLayoutSizingToAction(true);

      if (result.isError()) {
        raiseError(
          result.error ?? new Error("Failed to apply legacy aspect lock"),
        );
        setIsProcessing(false);
        return;
      }

      // Processing complete - show success modal
      setIsProcessing(false);
      setIsSuccessModalOpen(true);
    } catch (error) {
      raiseError(
        error instanceof Error ? error : new Error("Unknown error occurred"),
      );
      setIsProcessing(false);
    }
  };

  const handleRemoveRestrictProportions = () => {
    // Show remove confirmation modal
    setIsRemoveConfirmModalOpen(true);
  };

  const handleRemoveConfirmCancel = () => {
    // Close remove confirmation modal and return to first modal
    setIsRemoveConfirmModalOpen(false);
  };

  const handleRemoveConfirm = async () => {
    // Close remove confirmation modal and show processing
    setIsRemoveConfirmModalOpen(false);
    setIsProcessing(true);

    try {
      const studioResult = await getStudio();
      if (studioResult.isError()) {
        raiseError(studioResult.error ?? new Error("Failed to get studio"));
        setIsProcessing(false);
        return;
      }

      await studioResult.onSuccess(async (studio) => {
        // Get all layouts
        const layoutsResult = await getAllLayouts(window.SDK);

        if (layoutsResult.isError()) {
          raiseError(
            layoutsResult.error ?? new Error("Failed to get all layouts"),
          );
          setIsProcessing(false);
          return;
        }

        const layouts = layoutsResult.value;

        if (!layouts) {
          raiseError(new Error("Layouts data is undefined"));
          setIsProcessing(false);
          return;
        }

        // Remove restrict proportions for all resizable layouts
        for (const layout of layouts) {
          // Skip layouts that are not resizable
          if (!layout.resizableByUser.enabled) {
            continue;
          }

          // Get existing constraints
          const { minWidth, maxWidth, minHeight, maxHeight } =
            layout.resizableByUser;

          // Remove restrict proportions - set vertical and horizontal to null
          const updateResult = await setLayoutResizable(studio, layout.id, {
            enabled: true,
            minWidth: minWidth ?? null,
            maxWidth: maxWidth ?? null,
            minHeight: minHeight ?? null,
            maxHeight: maxHeight ?? null,
            constrainMode: ConstraintMode.range,
            vertical: null,
            horizontal: null,
          });

          if (updateResult.isError()) {
            raiseError(
              updateResult.error ??
                new Error(
                  `Failed to remove restrict proportions for layout ${layout.name}`,
                ),
            );
            setIsProcessing(false);
            return;
          }
        }

        await deleteAction({
          name: "AUTO_GEN_TOOLBAR_LAYOUTS",
          studio: studio,
        });
      });

      // Processing complete - show success modal
      setIsProcessing(false);
      setIsSuccessModalOpen(true);
    } catch (error) {
      raiseError(
        error instanceof Error ? error : new Error("Unknown error occurred"),
      );
      setIsProcessing(false);
    }
  };

  const handleSecondConfirmCancel = () => {
    // Close second confirmation modal and return to first modal
    setIsSecondConfirmModalOpen(false);
  };

  const handleSecondConfirm = async () => {
    // Close second confirmation modal and show processing
    setIsSecondConfirmModalOpen(false);
    setIsProcessing(true);

    try {
      const studioResult = await getStudio();
      if (studioResult.isError()) {
        raiseError(studioResult.error ?? new Error("Failed to get studio"));
        setIsProcessing(false);
        return;
      }

      await studioResult.onSuccess(async (studio) => {
        // Get all layouts
        const layoutsResult = await getAllLayouts(window.SDK);

        if (layoutsResult.isError()) {
          raiseError(
            layoutsResult.error ?? new Error("Failed to get all layouts"),
          );
          setIsProcessing(false);
          return;
        }

        const layouts = layoutsResult.value;

        if (!layouts) {
          raiseError(new Error("Layouts data is undefined"));
          setIsProcessing(false);
          return;
        }

        // Get the ratio for each layout W:H and determine the ratio in W:H that would be different from the original ratio based on tolerance
        for (const layout of layouts) {
          // Skip layouts that are not resizable
          if (!layout.resizableByUser.enabled) {
            continue;
          }

          // Extract numeric values from PropertyState objects
          const widthValue =
            typeof layout.width === "object" && layout.width !== null
              ? (layout.width.value as number)
              : (layout.width as number);

          const heightValue =
            typeof layout.height === "object" && layout.height !== null
              ? (layout.height.value as number)
              : (layout.height as number);

          // Calculate aspect ratio with type safety
          const aspectRatio = heightValue > 0 ? widthValue / heightValue : 0;

          if (aspectRatio === 0) {
            continue; // Skip layouts with invalid aspect ratios
          }

          // Determine the ratio in W:H based on the tolerance percentage
          const minRatio =
            aspectRatio - aspectRatio * (tolerancePercentage / 100);
          const maxRatio =
            aspectRatio + aspectRatio * (tolerancePercentage / 100);

          console.log(minRatio, maxRatio);

          // Get existing constraints
          const { minWidth, maxWidth, minHeight, maxHeight } =
            layout.resizableByUser;

          // Turn aspect lock ON - set constraint mode to range
          const updateResult = await setLayoutResizable(studio, layout.id, {
            enabled: true,
            minWidth: minWidth ?? null,
            maxWidth: maxWidth ?? null,
            minHeight: minHeight ?? null,
            maxHeight: maxHeight ?? null,
            constrainMode: ConstraintMode.range,
            vertical: {
              min: 100,
              max: 100,
            },
            horizontal: {
              min: 100 * minRatio,
              max: 100 * maxRatio,
            },
          });

          if (updateResult.isError()) {
            raiseError(
              updateResult.error ??
                new Error(
                  `Failed to set aspect lock for layout ${layout.name}`,
                ),
            );
            setIsProcessing(false);
            return;
          }
        }

        await deleteAction({
          name: "AUTO_GEN_TOOLBAR_LAYOUTS",
          studio: studio,
        });
        await deleteVariables(studio, ["AUTO_GEN_TOOLBAR_LAYOUTS"]);
      });

      // Processing complete - show success modal
      setIsProcessing(false);
      setIsSuccessModalOpen(true);
    } catch (error) {
      raiseError(
        error instanceof Error ? error : new Error("Unknown error occurred"),
      );
      setIsProcessing(false);
    }
  };

  const handleSuccessClose = () => {
    setIsSuccessModalOpen(false);
    onClose();
  };

  return (
    <>
      {/* Aspect Lock Confirmation Modal */}
      <Modal
        opened={opened}
        onClose={onClose}
        title="Confirm Aspect Lock Change"
        centered
        size="lg"
      >
        <Text mb="md">
          Set the Aspect Lock Restrict Proportions range for all Layouts
        </Text>
        <Text size="sm" mb="xs">
          Tolerance: ±{tolerancePercentage}%
        </Text>
        <Slider
          value={tolerancePercentage}
          onChange={setTolerancePercentage}
          marks={[
            { value: 5, label: "5%" },
            { value: 10, label: "10%" },
            { value: 15, label: "15%" },
          ]}
          step={5}
          min={5}
          max={15}
          mb="xl"
        />
        <Group justify="space-between" mt="md">
          <Button
            variant="subtle"
            onClick={handleLegacyAspectLock}
            color="gray"
            size="lg"
          >
            Legacy Aspect Lock
          </Button>
          <Group>
            <Button
              variant="default"
              onClick={handleRemoveRestrictProportions}
              size="lg"
            >
              Remove Restrict Proportions
            </Button>
            <Button variant="default" onClick={onClose} size="lg">
              Cancel
            </Button>
            <Button color="blue" onClick={handleUpdateLayouts} size="lg">
              Update Layouts
            </Button>
          </Group>
        </Group>
      </Modal>

      {/* Second Confirmation Modal */}
      <Modal
        opened={isSecondConfirmModalOpen}
        onClose={handleSecondConfirmCancel}
        title="Confirm Changes"
        centered
        size="md"
      >
        <Text>
          This will overwrite all Layouts to ±{tolerancePercentage}% aspect
          ratio
        </Text>
        <Group justify="flex-end" mt="md">
          <Button
            variant="default"
            onClick={handleSecondConfirmCancel}
            size="lg"
          >
            Cancel
          </Button>
          <Button color="blue" onClick={handleSecondConfirm} size="lg">
            Confirm
          </Button>
        </Group>
      </Modal>

      {/* Remove Restrict Proportions Confirmation Modal */}
      <Modal
        opened={isRemoveConfirmModalOpen}
        onClose={handleRemoveConfirmCancel}
        title="Confirm Changes"
        centered
        size="md"
      >
        <Text>
          This will overwrite all Layouts to remove the restrict proportions
        </Text>
        <Group justify="flex-end" mt="md">
          <Button
            variant="default"
            onClick={handleRemoveConfirmCancel}
            size="lg"
          >
            Cancel
          </Button>
          <Button color="blue" onClick={handleRemoveConfirm} size="lg">
            Confirm
          </Button>
        </Group>
      </Modal>

      {/* Processing Modal */}
      <Modal
        opened={isProcessing}
        onClose={() => {}} // Cannot close during processing
        title="Processing"
        centered
        size="md"
        closeOnClickOutside={false}
        closeOnEscape={false}
        withCloseButton={false}
      >
        <Stack align="center" gap="md">
          <Loader size="lg" />
          <Text>Updating all layouts with aspect lock settings...</Text>
        </Stack>
      </Modal>

      {/* Success Modal */}
      <Modal
        opened={isSuccessModalOpen}
        onClose={handleSuccessClose}
        title="Complete"
        centered
        size="md"
      >
        <Text>
          All layouts have been successfully updated with aspect lock settings.
        </Text>
        <Group justify="flex-end" mt="md">
          <Button onClick={handleSuccessClose} size="lg">
            Close
          </Button>
        </Group>
      </Modal>
    </>
  );
}
