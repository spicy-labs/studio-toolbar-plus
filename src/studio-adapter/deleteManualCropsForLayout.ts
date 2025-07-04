import { Result } from "typescript-result";
type FrameProperty = {
  id: string;
  type?: string;
  perAssetCrop?: {
    [connectorId: string]: {
      [assetName: string]: {
        left: number;
        top: number;
        width: number;
        height: number;
        rotationDegrees: number;
        originalParentWidth: number;
        originalParentHeight: number;
      };
    };
  };
  [key: string]: any;
};

type DocumentLayout = {
  id: string;
  name: string;
  parentId?: string;
  frameProperties: FrameProperty[];
  [key: string]: any;
};

/**
 * Deletes a single manual crop for a specific frame and asset
 * @param documentState The document state JSON to update
 * @param layoutId The layout ID containing the crop to delete
 * @param connectorId The connector ID associated with the crop
 * @param frameId The specific frame ID containing the crop
 * @param assetName The specific asset name (crop name) to delete
 * @returns A Result containing the updated document state JSON or an error
 */
export function deleteSingleManualCropForLayout(
  documentState: any,
  layoutId: string,
  connectorId: string,
  frameId: string,
  assetName: string,
): Result<any, Error> {
  try {
    // Create a deep copy of the document state to avoid mutating the original
    const updatedDocumentState = JSON.parse(JSON.stringify(documentState));

    // Find the layout by ID
    const layout = updatedDocumentState.layouts?.find(
      (l: any) => l.id === layoutId,
    );
    if (!layout) {
      return Result.error(new Error(`Layout with ID ${layoutId} not found`));
    }

    // Find the frame property by frameId
    const frameProperty = layout.frameProperties?.find(
      (fp: any) => fp.id === frameId,
    );
    if (!frameProperty) {
      return Result.error(
        new Error(`Frame with ID ${frameId} not found in layout ${layoutId}`),
      );
    }

    // Check if perAssetCrop exists for this frame
    if (
      !frameProperty.perAssetCrop ||
      !frameProperty.perAssetCrop[connectorId]
    ) {
      return Result.error(
        new Error(
          `No crops found for connector ${connectorId} in frame ${frameId}`,
        ),
      );
    }

    // Check if the specific asset exists
    if (!frameProperty.perAssetCrop[connectorId][assetName]) {
      return Result.error(
        new Error(
          `Asset ${assetName} not found for connector ${connectorId} in frame ${frameId}`,
        ),
      );
    }

    // Delete the specific asset crop
    delete frameProperty.perAssetCrop[connectorId][assetName];

    // If no assets remain for this connector, remove the connector entry
    if (Object.keys(frameProperty.perAssetCrop[connectorId]).length === 0) {
      delete frameProperty.perAssetCrop[connectorId];
    }

    // If no connectors remain, remove the perAssetCrop property entirely
    if (Object.keys(frameProperty.perAssetCrop).length === 0) {
      delete frameProperty.perAssetCrop;
    }

    // Return the updated document state
    return Result.ok(updatedDocumentState);
  } catch (error) {
    return Result.error(
      error instanceof Error
        ? error
        : new Error("Failed to delete single manual crop for layout"),
    );
  }
}

/**
 * Deletes manual crops for a specific layout and connector
 * @param documentState The document state JSON to update
 * @param layoutId The layout ID to delete crops for
 * @param connectorId The connector ID to remove crops from
 * @returns A Result containing the updated document state JSON or an error
 */
export function deleteManualCropsForLayout(
  documentState: any,
  layoutId: string,
  connectorId: string,
): Result<any, Error> {
  try {
    // Create a deep copy of the document state to avoid mutating the original
    const updatedDocumentState = JSON.parse(JSON.stringify(documentState));

    // Find the layout by ID
    const layout = updatedDocumentState.layouts?.find(
      (l: any) => l.id === layoutId,
    );
    if (!layout) {
      return Result.error(new Error(`Layout with ID ${layoutId} not found`));
    }

    // Remove manual crops for the specified connector from all frame properties
    for (const frameProperty of layout.frameProperties) {
      if (
        frameProperty.perAssetCrop &&
        frameProperty.perAssetCrop[connectorId]
      ) {
        // Delete the connector's crops for this frame
        delete frameProperty.perAssetCrop[connectorId];

        // If no connectors remain, remove the perAssetCrop property entirely
        if (Object.keys(frameProperty.perAssetCrop).length === 0) {
          delete frameProperty.perAssetCrop;
        }
      }
    }

    // Return the updated document state
    return Result.ok(updatedDocumentState);
  } catch (error) {
    return Result.error(
      error instanceof Error
        ? error
        : new Error("Failed to delete manual crops for layout"),
    );
  }
}
