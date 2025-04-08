import type SDK from "@chili-publish/studio-sdk";
import { Result } from "typescript-result";
import { type LayoutSize } from "../types/toolbarEnvelope";
import { getAllLayouts } from "../studio/layoutHandler";

/**
 * Converts all layouts from the Studio SDK into a lookup Record
 * @param studio The Studio SDK instance
 * @returns A Result containing either a Record with layout names as keys and LayoutSize objects as values,
 * or an Error if the operation fails
 */
export async function layoutManagerToLookup(studio: SDK): Promise<Result<Record<string, LayoutSize>, Error>> {
  const layoutsResult = await getAllLayouts(studio);
  
  // Return the error result directly if getting layouts failed
  if (layoutsResult.isError()) {
    console.error("Failed to get layouts:", layoutsResult.error);
    return layoutsResult as Result<Record<string, LayoutSize>, Error>;
  }
  
  const layouts = layoutsResult.value;
  
  // Return an error if layouts is null or undefined
  if (!layouts) {
    return Result.error(new Error("Layouts are null or undefined"));
  }
  
  // Process the layouts
  return Result.try(() => {
    const layoutSizes: Record<string, LayoutSize> = {};
    
    for (const layout of layouts) {
      // Extract numeric values from PropertyState objects
      const widthValue = typeof layout.width === 'object' && layout.width !== null
        ? (layout.width.value as number)
        : (layout.width as number);
        
      const heightValue = typeof layout.height === 'object' && layout.height !== null
        ? (layout.height.value as number)
        : (layout.height as number);
      
      // Calculate aspect ratio with type safety
      const aspectRatioPercentage = heightValue > 0 ? (widthValue / heightValue) * 100 : 0;
      
      layoutSizes[layout.name] = {
        width: widthValue,
        height: heightValue,
        aspectRatioPercentage
      };
    }
    
    return layoutSizes;
  });
}
