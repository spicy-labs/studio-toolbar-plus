import React, { useState, useEffect } from "react";
import { Modal, Text, Loader, Alert, Stack } from "@mantine/core";
import { IconAlertCircle } from "@tabler/icons-react";
import { getStudio, updateFrameLayoutMaps } from "../studio/studioAdapter";
import {
  getSelected,
  getPropertiesOnSelectedLayout,
  getById,
} from "../studio/frameHandler";
import {
  getById as getVariableById
} from "../studio/variableHandler";
import type SDK from "@chili-publish/studio-sdk";
import { Result } from "typescript-result";

type AddFrameSnapshotModalProps = {
  opened: boolean;
  onClose: () => void;
  raiseError: (error: Error) => void;
};

type FramePosition = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export function AddFrameSnapshotModal({
  opened,
  onClose,
  raiseError,
}: AddFrameSnapshotModalProps) {
  const [status, setStatus] = useState<
    "idle" | "loading" | "error" | "success"
  >("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [positionData, setPositionData] = useState<FramePosition | null>(null);

  useEffect(() => {
    if (!opened) {
      // Reset state when modal is closed
      setStatus("idle");
      setMessage(null);
      setPositionData(null);
      return;
    }

    const fetchAndValidateFrame = async () => {
      setStatus("loading");
      setMessage(null);

      try {
        // 1. Get Studio
        const studioResult = await getStudio();
        if (!studioResult.isOk()) {
          throw studioResult.error; // Let catch block handle raiseError
        }
        const studio = studioResult.value;

        // 2. Get Selected Frames
        const selectedResult = await getSelected(studio);
        if (!selectedResult.isOk()) {
          throw selectedResult.error;
        }
        const selectedFrames = selectedResult.value;

        // 3. Validate Selection Count
        if (selectedFrames.length === 0) {
          setStatus("error");
          setMessage("Please select an image frame.");
          return;
        }
        if (selectedFrames.length > 1) {
          setStatus("error");
          setMessage(
            `Please select only one frame - ${selectedFrames.length} were selected.`,
          );
          return;
        }
        const selectedFrameType = selectedFrames[0];

        // 5. Validate Frame Type
        // Attempting to access type directly, casting to 'any' to bypass TS error for now
        if (selectedFrameType.type !== "image") {
          setStatus("error");
          setMessage(
            `Please select an image frame, you selected a ${selectedFrameType.type || 'non-image'} frame.`,
          );
          return;
        }

        const frameResult = await getById(studio, selectedFrameType.id);
        if (!frameResult.isOk()) {
          throw frameResult.error;
        }

        const frame = frameResult.value;

        // Check if the frame is connected to a variable via its src property
        if (!frame.src?.variableId) {
            throw new Error("Image frame is not tied to image variable");
        }

        // Fetch the variable linked to the frame to ensure it exists
        const variableResult = await getVariableById(studio, frame.src.variableId);
        if (!variableResult.isOk()) {
            // If the variable fetch fails, throw the specific error from getVariableById
            throw variableResult.error;
        }
        // We don't strictly need the variable value here, just confirming it's linked and exists.
        // const linkedVariable = variableResult.value;


        // 4. Get Frame Properties
        const propertiesResult = await getPropertiesOnSelectedLayout(studio);
        if (!propertiesResult.isOk()) {
          throw propertiesResult.error;
        }
        const allProperties = propertiesResult.value;

        // Find the selected frame's properties
        // Ensure propertiesResult.value is an array before finding
        const frameProperties = Array.isArray(allProperties)
          ? allProperties.find((prop: any) => prop.id === selectedFrameType.id)
          : null;

        if (!frameProperties) {
           // This case might happen if getPropertiesOnSelectedLayout returns unexpected data
           throw new Error(`Could not find properties for selected frame ${selectedFrameType.name} with ID: ${selectedFrameType.id}`);
        }


        // 6. Extract Position Data (Accessing .value from PropertyState)
        const { x, y, width, height } = frameProperties;
        if (x?.value === undefined || y?.value === undefined || width?.value === undefined || height?.value === undefined) {
            throw new Error("Selected image frame is missing position properties (x, y, width, or height values).");
        }

        const extractedPosition: FramePosition = { x: x.value, y: y.value, width: width.value, height: height.value };
        setPositionData(extractedPosition);

        // Call updateFrameLayoutMaps with the extracted position and frame ID
        const updateResult = await updateFrameLayoutMaps({
          frameId: selectedFrameType.id,
          x: extractedPosition.x,
          y: extractedPosition.y,
          width: extractedPosition.width,
          height: extractedPosition.height
        });

        if (!updateResult.isOk()) {
          throw updateResult.error;
        }

        // 7. Success
        setStatus("success");
        setMessage("Image position successfully saved to layout mapping");

      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        setStatus("error");
        setMessage(err.message);
        raiseError(err); // Raise error globally
      }
    };

    fetchAndValidateFrame();

  }, [opened, raiseError]); // Dependency array includes opened and raiseError

  return (
    <Modal
      opened={opened}
      onClose={status === "loading" ? () => {} : onClose}
      title="Snapshot Image Position"
      centered
      closeOnClickOutside={status !== "loading"}
      closeOnEscape={status !== "loading"}
    >
      <Stack>
        {status === "loading" && (
          <Stack align="center">
            <Loader />
            <Text>Processing frame snapshot...</Text>
          </Stack>
        )}
        {status === "error" && message && (
          <Alert icon={<IconAlertCircle size="1rem" />} title="Error" color="red">
            {message}
          </Alert>
        )}
        {status === "success" && message && (
          <Alert color="green" title="Success">
            {message}
            {/* Optionally display positionData here for debugging */}
            {/* <pre>{JSON.stringify(positionData, null, 2)}</pre> */}
          </Alert>
        )}
         {status === "idle" && (
            <Text size="sm" c="dimmed">Initializing...</Text>
         )}
      </Stack>
    </Modal>
  );
}
