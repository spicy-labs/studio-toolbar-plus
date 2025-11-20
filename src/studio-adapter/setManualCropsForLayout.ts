import type SDK from "@chili-publish/studio-sdk";
import { Result } from "typescript-result";
import type { AssetCrop, ManualCrop } from "./manualCropTypes";
import { setPerAssetCrop } from "../studio/editorAPIHandler";

/**
 * Sets manual crops for a specific layout and connector using the Studio editor API.
 *
 * Instead of mutating the document JSON and reloading it, this helper
 * calls `setPerAssetCrop` for each asset crop belonging to the given layout
 * and connector.
 */
export async function setManualCropsForLayout(
  studio: SDK,
  layoutId: string,
  connectorId: string,
  manualCrops: ManualCrop[],
): Promise<Result<void, Error>> {
  try {
    for (const manualCrop of manualCrops) {
      const perAssetCrop: AssetCrop = {
        left: manualCrop.left,
        top: manualCrop.top,
        width: manualCrop.width,
        height: manualCrop.height,
        rotationDegrees: manualCrop.rotationDegrees,
        originalParentWidth: manualCrop.originalParentWidth,
        originalParentHeight: manualCrop.originalParentHeight,
      };

      const result = await setPerAssetCrop({
        studio,
        perAssetCrop,
        layoutId,
        frameId: manualCrop.frameId,
        remoteConnectorId: connectorId,
        assetId: manualCrop.name,
      });

      // `setPerAssetCrop` currently uses the generic `handleApiCall` helper
      // which returns a nested Result. We only care whether the outer call
      // succeeded (i.e. Studio accepted the request), so treat any outer
      // error as a failure and ignore inner parsing errors.
      if (result.isError()) {
        return Result.error(
          result.error ??
            new Error(
              `Failed to set per-asset crop for frame ${manualCrop.frameId} and asset ${manualCrop.name}`,
            ),
        );
      }
    }

    return Result.ok(undefined);
  } catch (error) {
    return Result.error(
      error instanceof Error
        ? error
        : new Error("Failed to set manual crops for layout"),
    );
  }
}
