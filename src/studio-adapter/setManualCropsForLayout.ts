import { Result } from "typescript-result";
import type { ManualCrop } from "./manualCropTypes";

/**
 * Sets manual crops for a specific layout and connector
 * @param documentState The document state JSON to update
 * @param layoutId The layout ID to set crops for
 * @param connectorId The connector ID to associate crops with
 * @param manualCrops Array of manual crop data
 * @returns A Result containing the updated document state JSON or an error
 */
export function setManualCropsForLayout(
  documentState: any,
  layoutId: string,
  connectorId: string,
  manualCrops: ManualCrop[]
): Result<any, Error> {
  try {
    // Create a deep copy of the document state to avoid mutating the original
    const updatedDocumentState = JSON.parse(JSON.stringify(documentState));

    console.log("Updated document state:", updatedDocumentState);

    // Find the layout by ID
    const layout = updatedDocumentState.layouts?.find(
      (l: any) => l.id === layoutId
    );
    if (!layout) {
      return Result.error(new Error(`Layout with ID ${layoutId} not found`));
    }

    // Ensure frameProperties array exists
    if (!layout.frameProperties) {
      layout.frameProperties = [];
    }

    // Update the frameProperties with perAssetCrop data
    for (const manualCrop of manualCrops) {
      let frameProperty = layout.frameProperties.find(
        (fp: any) => fp.id === manualCrop.frameId
      );

      // If frame property doesn't exist, create it
      if (!frameProperty) {
        frameProperty = {
          id: manualCrop.frameId,
          type: "child",
          perAssetCrop: {},
        };
        layout.frameProperties.push(frameProperty);
      }

      // Initialize perAssetCrop if it doesn't exist
      if (!frameProperty.perAssetCrop) {
        frameProperty.perAssetCrop = {};
      }

      // Initialize connector entry if it doesn't exist
      if (!frameProperty.perAssetCrop[connectorId]) {
        frameProperty.perAssetCrop[connectorId] = {};
      }

      // Set the manual crop data for this asset
      frameProperty.perAssetCrop[connectorId][manualCrop.name] = {
        left: manualCrop.left,
        top: manualCrop.top,
        width: manualCrop.width,
        height: manualCrop.height,
        rotationDegrees: manualCrop.rotationDegrees,
        originalParentWidth: manualCrop.originalParentWidth,
        originalParentHeight: manualCrop.originalParentHeight,
      };
    }

    // Return the updated document state
    return Result.ok(updatedDocumentState);
  } catch (error) {
    return Result.error(
      error instanceof Error
        ? error
        : new Error("Failed to set manual crops for layout")
    );
  }
}
