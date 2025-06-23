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
 * Deletes manual crops for a specific layout and connector
 * @param documentState The document state JSON to update
 * @param layoutId The layout ID to delete crops for
 * @param connectorId The connector ID to remove crops from
 * @returns A Result containing the updated document state JSON or an error
 */
export function deleteManualCropsForLayout(
  documentState: any,
  layoutId: string,
  connectorId: string
): Result<any, Error> {
  try {
    // Create a deep copy of the document state to avoid mutating the original
    const updatedDocumentState = JSON.parse(JSON.stringify(documentState));

    // Find the layout by ID
    const layout = updatedDocumentState.layouts?.find(
      (l: any) => l.id === layoutId
    );
    if (!layout) {
      return Result.error(new Error(`Layout with ID ${layoutId} not found`));
    }

    // Remove manual crops for the specified connector from all frame properties
    for (const frameProperty of layout.frameProperties) {
      if (frameProperty.perAssetCrop && frameProperty.perAssetCrop[connectorId]) {
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
        : new Error("Failed to delete manual crops for layout")
    );
  }
}
