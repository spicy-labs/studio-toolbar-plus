import type SDK from "@chili-publish/studio-sdk";
import { Result } from "typescript-result";
import { getCurrentDocumentState } from "../studio/documentHandler";
import type {
  ManualCrop,
  FrameProperty,
  PerAssetCrop,
} from "./manualCropTypes";
import type { DocumentConnectorWithUsage } from "../types/connectorTypes";
import { getPerAssetCrop } from "../studio/editorAPIHandler";

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

    // Prepare promises for fetching crop data
    const cropPromises: Promise<{
      layoutId: string;
      frameId: string;
      result: Result<{ perAssetCrop: PerAssetCrop }, Error>;
    }>[] = [];

    // Collect all frames that need checking
    if (documentState.layouts && Array.isArray(documentState.layouts)) {
      for (const layout of documentState.layouts) {
        if (layout.frameProperties && Array.isArray(layout.frameProperties)) {
          for (const frameProperty of layout.frameProperties) {
            if (
              !frameProperty.perAssetCrop ||
              !frameProperty.perAssetCrop[connectorId]
            ) {
              continue;
            }

            cropPromises.push(
              getPerAssetCrop({
                studio,
                layoutId: layout.id,
                frameId: frameProperty.id,
              }).then((res) => ({
                layoutId: layout.id,
                frameId: frameProperty.id,
                result: res,
              })),
            );
          }
        }
      }
    }

    // Wait for all crop data fetches
    console.log("Waiting for crop data fetches");
    const cropResults = await Promise.all(cropPromises);
    console.log("Crop data fetches complete", cropResults);

    // Process results
    const layoutCropsMap = new Map<string, ManualCrop[]>();

    for (const { layoutId, frameId, result: cropResult } of cropResults) {
      if (cropResult.isOk()) {
        const perAssetCrop = cropResult.value?.perAssetCrop;
        console.log(perAssetCrop);
        console.log("connectorId", connectorId);
        if (perAssetCrop && perAssetCrop[connectorId]) {
          console.log("Found crops for connector");
          const connectorCrops = perAssetCrop[connectorId];
          const frameName = frameIdToNameMap.get(frameId) || frameId;

          for (const [assetPath, cropData] of Object.entries(connectorCrops)) {
            const manualCrop: ManualCrop = {
              frameId: frameId,
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

            console.log("manualCrop", manualCrop);

            if (!layoutCropsMap.has(layoutId)) {
              layoutCropsMap.set(layoutId, []);
            }
            layoutCropsMap.get(layoutId)?.push(manualCrop);
          }
        }
      }
    }

    console.log("Layout crops map", layoutCropsMap);

    // Construct the final result
    if (documentState.layouts && Array.isArray(documentState.layouts)) {
      for (const layout of documentState.layouts) {
        const manualCrops = layoutCropsMap.get(layout.id);
        if (manualCrops && manualCrops.length > 0) {
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
