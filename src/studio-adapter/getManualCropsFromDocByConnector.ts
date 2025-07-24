import type SDK from "@chili-publish/studio-sdk";
import { Result } from "typescript-result";
import { getCurrentDocumentState } from "../studio/documentHandler";
import type { ManualCrop, FrameProperty } from "./manualCropTypes";
import type { DocumentConnectorWithUsage } from "../types/connectorTypes";

type Layouts = {
  id: string;
  name: string;
  parentId: string;
};

type ManualCrops = {
  layouts: (Layouts & { manualCrops: ManualCrop[] })[];
  connectorId: string;
};

type Frame = {
  id: string;
  name: string;
};

type Page = {
  frames: Frame[];
};

type DocumentLayout = {
  id: string;
  name: string;
  parentId?: string;
  frameProperties: FrameProperty[];
};

type DocumentState = {
  layouts: DocumentLayout[];
  pages: Page[];
};

/**
 * Gets manual crops from the document for a specific connector ID
 * @param studio The Studio SDK instance
 * @param connectorId The connector ID to filter manual crops by
 * @returns A Result containing either ManualCrops data or an Error
 */
export async function getManualCropsFromDocByConnector(
  studio: SDK,
  connectorId: string,
): Promise<Result<ManualCrops, Error>> {
  try {
    // Get the current document state
    const documentStateResult = await getCurrentDocumentState(studio);
    if (!documentStateResult.isOk()) {
      return Result.error(
        new Error(
          "Failed to get document state: " + documentStateResult.error?.message,
        ),
      );
    }

    const documentState = documentStateResult.value as DocumentState;

    // Create a map of frame IDs to frame names from pages
    const frameIdToNameMap = new Map<string, string>();
    if (documentState.pages && Array.isArray(documentState.pages)) {
      for (const page of documentState.pages) {
        if (page.frames && Array.isArray(page.frames)) {
          for (const frame of page.frames) {
            frameIdToNameMap.set(frame.id, frame.name);
          }
        }
      }
    }

    const result: ManualCrops = {
      layouts: [],
      connectorId: connectorId,
    };

    // Process each layout
    if (documentState.layouts && Array.isArray(documentState.layouts)) {
      for (const layout of documentState.layouts) {
        const manualCrops: ManualCrop[] = [];

        // Process frame properties for this layout
        if (layout.frameProperties && Array.isArray(layout.frameProperties)) {
          for (const frameProperty of layout.frameProperties) {
            // Check if this frame property has perAssetCrop for our connector
            if (
              frameProperty.perAssetCrop &&
              frameProperty.perAssetCrop[connectorId]
            ) {
              const connectorCrops = frameProperty.perAssetCrop[connectorId];

              // Process each asset path for this connector
              for (const [assetPath, cropData] of Object.entries(
                connectorCrops,
              )) {
                const frameName =
                  frameIdToNameMap.get(frameProperty.id) || frameProperty.id;

                const manualCrop: ManualCrop = {
                  frameId: frameProperty.id,
                  frameName: frameName,
                  name: assetPath,
                  top: cropData.top,
                  left: cropData.left,
                  width: cropData.width,
                  height: cropData.height,
                  rotationDegrees: cropData.rotationDegrees ?? 0,
                  originalParentWidth: cropData.originalParentWidth ?? 283464,
                  originalParentHeight: cropData.originalParentHeight ?? 283464,
                };

                manualCrops.push(manualCrop);
              }
            }
          }
        }

        // Only include layouts that have manual crops for this connector
        if (manualCrops.length > 0) {
          const layoutWithCrops: Layouts & { manualCrops: ManualCrop[] } = {
            id: layout.id,
            name: layout.name,
            parentId: layout.parentId || "",
            manualCrops: manualCrops,
          };

          result.layouts.push(layoutWithCrops);
        }
      }
    }

    return Result.ok(result);
  } catch (error) {
    return Result.error(
      error instanceof Error ? error : new Error(String(error)),
    );
  }
}
