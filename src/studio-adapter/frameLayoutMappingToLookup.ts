import { Result } from "typescript-result";
import { type FrameLayoutMap, type FrameSnapshot } from "../types/toolbarEnvelope";
import type SDK from "@chili-publish/studio-sdk";
import { getAllLayouts } from "../studio/layoutHandler";
import { getAll as getAllFrames } from "../studio/frameHandler";

/**
 * Type for the frame snapshot with frameName and without the imageName property
 */
type FrameSnapshotWithNameWithoutImageName = Omit<FrameSnapshot, 'imageName'> & {
  frameName?: string;
};

/**
 * Type for the lookup object where each key is an imageName and the value is the rest of the FrameSnapshot with frameName
 */
type ImageNameToFrameSnapshotMap = Record<string, FrameSnapshotWithNameWithoutImageName>;

/**
 * Type for the result object where each key is a layout name and the value is an ImageNameToFrameSnapshotMap
 */
type LayoutNameToImageNameMap = Record<string, ImageNameToFrameSnapshotMap>;

/**
 * Converts an array of FrameLayoutMap objects into a lookup object using layout and frame names
 * @param frameMaps Array of FrameLayoutMap objects
 * @param studio Optional SDK instance to use for layout and frame name lookups
 * @returns A Promise of a Result containing either a lookup object or an Error
 */
export async function frameLayoutMappingToLookup(
  frameMaps: FrameLayoutMap[],
  studio: SDK
): Promise<Result<LayoutNameToImageNameMap, Error>> {
  try {

    const result: LayoutNameToImageNameMap = {};
    

      // Get all layouts to map IDs to names
      const layoutsResult = await getAllLayouts(studio);
      if (layoutsResult.isError()) {
        throw layoutsResult.error;
      }
      
      const layouts = layoutsResult.value;
      if (!layouts) {
        throw new Error("Failed to get layouts");
      }
      
      // Get all frames to map IDs to names
      const framesResult = await getAllFrames(studio);
      if (framesResult.isError()) {
        throw framesResult.error;
      }
      
      const frames = framesResult.value;
      if (!frames) {
        throw new Error("Failed to get frames");
      }
      
      const layoutIdToNameMap = new Map<string, string>();
      const frameIdToNameMap = new Map<string, string>();
      
      // Create a map of layout IDs to names
      for (const layout of layouts) {
        layoutIdToNameMap.set(layout.id, layout.name);
      }
      
      // Create a map of frame IDs to names
      for (const frame of frames) {
        frameIdToNameMap.set(frame.id, frame.name);
      }
      
      // Process each frame map using layout names
      for (const frameMap of frameMaps) {
        const { layoutId, frameSnapshots } = frameMap;
        const layoutName = layoutIdToNameMap.get(layoutId) || layoutId;
        
        // Initialize the inner object for this layout name if it doesn't exist
        if (!result[layoutName]) {
          result[layoutName] = {};
        }
        
        // Process each frame snapshot
        for (const snapshot of frameSnapshots) {
          const { imageName, ...rest } = snapshot;
          
          // Use frame name if available, otherwise use frameId
          const frameName = frameIdToNameMap.get(snapshot.frameId);

          if (!frameName) {
            throw new Error(`No frame name for frame with ID: ${snapshot.frameId}`)
          }
          
          // Create a new rest object with frameName added to the existing properties
          const newRest = { ...rest, frameName };
          
          // Add the snapshot to the lookup, using imageName as the key
          result[layoutName][imageName] = newRest;
        }
      }

    return Result.ok(result);
  } catch (error) {
    return Result.error(error instanceof Error ? error : new Error(String(error)));
  }
}
