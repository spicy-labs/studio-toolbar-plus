import { Result } from "typescript-result";
import type { LayoutMap } from "../types/layoutConfigTypes.ts";
import {
  getPrivateData,
  setPrivateData,
  getAllLayouts,
  getSelected,
} from "./layoutHandler.ts";
import {
  createVariable,
  getAllVariables,
  setOrCreateVariableValue,
  setVariableValue,
} from "./variableHandler.ts";
import {
  type PrivateData,
  type ActionTrigger,
  type default as SDKType,
  ActionEditorEvent,
  VariableType,
} from "@chili-publish/studio-sdk";
import {
  createEmptyEnvelope,
  type ToolbarEnvelope,
  type FrameLayoutMap,
  type LayoutSize,
} from "../types/toolbarEnvelope.ts";
import type {
  Doc,
  Layout,
  Variable,
  TextImageVariable,
  ListVariable,
  BooleanVariable,
} from "../types/docStateTypes.ts";
import { updateAction } from "./actionHandler.ts";
import { imageSelectionScript } from "./actions/imageSelection.js";
import { imageSizingScript } from "./actions/imageSizing.js";
import { layoutMappingToActionMap } from "./layoutMappingToActionMap.ts";
import { frameLayoutMappingToLookup } from "../studio-adapter/frameLayoutMappingToLookup.ts";
import { layoutManagerToLookup } from "../studio-adapter/layoutManagerToLookup.ts";

declare global {
  interface Window {
    SDK: SDKType;
  }
}

export async function getStudio() {
  if (window.SDK == null)
    return Result.error(new Error("Studio SDK does not exist on the window"));
  return Result.ok(window.SDK);
}

async function tryAddingToolbarToData(data: PrivateData) {
  const newData = {
    ...data,
    toolbar: JSON.stringify(createEmptyEnvelope(), null, 0),
  };
  return setPrivateData({
    studio: window.SDK,
    id: "0",
    privateData: newData,
  });
}

export async function loadLayoutImageMapFromDoc(): Promise<
Result<LayoutMap[], never> | Result<never, Error>
> {
  const result = await loadToolbarDataFromDoc();
  if (await result.isOk()){
    return Result.ok(result.value?.layoutMaps ?? []);
  }

  return result as Result<never, Error>;;
}

export async function loadFrameLayoutMapsFromDoc(): Promise<
Result<FrameLayoutMap[], never> | Result<never, Error>
> {
  const result = await loadToolbarDataFromDoc();
  if (await result.isOk()){
    return Result.ok(result.value?.frameMaps ?? []);
  }

  return result as Result<never, Error>;;
}

export async function loadLayoutSizesFromDoc(): Promise<
Result<Record<string, LayoutSize>, never> | Result<never, Error>
> {
  const result = await loadToolbarDataFromDoc();
  if (await result.isOk()){
    return Result.ok(result.value?.layoutSizes ?? {});
  }

  return result as Result<never, Error>;;
}

export async function loadToolbarDataFromDoc(): Promise<
  Result<ToolbarEnvelope, never> | Result<never, Error>
> {
  const dataResult = await getPrivateData({
    id: "0",
    studio: window.SDK,
  });

  if (dataResult.isOk()) {
    const data = dataResult.value;

    if (data.toolbar != null) {
      const toolbarResult = await Result.try(() => JSON.parse(data.toolbar));
      if (toolbarResult.isOk()) {
        return Result.ok((toolbarResult.value as ToolbarEnvelope));
      }

      return toolbarResult as Result<never, Error>;
    } else {
      const setDataResult = await tryAddingToolbarToData(data);
      if (setDataResult.isOk()) {
        return Result.ok(createEmptyEnvelope());
      }

      return setDataResult as Result<never, Error>;
    }
  }

  return dataResult as Result<never, Error>;
}

export function saveLayoutImageMapToDoc(layoutMaps: LayoutMap[]) {
  return saveToolbarDataToDoc("layoutMaps", layoutMaps)
}

export function saveFrameLayoutMapsToDoc(frameMaps: FrameLayoutMap[]) {
  return saveToolbarDataToDoc("frameMaps", frameMaps)
}

export function saveLayoutSizesToDoc(layoutSizes: Record<string, LayoutSize>) {
  return saveToolbarDataToDoc("layoutSizes", layoutSizes)
}


export async function saveToolbarDataToDoc<K extends keyof ToolbarEnvelope>(key:K, value:ToolbarEnvelope[K]) {
  const dataResult = await getPrivateData({
    id: "0",
    studio: window.SDK,
  });

  if (dataResult.isOk()) {
    let data = dataResult.value as PrivateData;

    if (data.toolbar == null) {
      const setDataResult = await tryAddingToolbarToData(data);
      if (setDataResult.isOk()) {
        const dataResult = await getPrivateData({
          id: "0",
          studio: window.SDK,
        });

        if (dataResult.isOk()) {
          data = dataResult.value as PrivateData;
        }
        return dataResult;
      } else {
        return setDataResult;
      }
    }

    if (data.toolbar != null) {
      const toolbarResult = await Result.try(() => JSON.parse(data.toolbar));
      if (toolbarResult.isOk()) {
        const toolbar = toolbarResult.value as ToolbarEnvelope;
        toolbar[key] = value;
        const stringifyResult = Result.try(() =>
          JSON.stringify(toolbar, null, 0),
        );
        if (stringifyResult.isOk()) {
          data.toolbar = stringifyResult.value as string;
          const setDataResult = await setPrivateData({
            studio: window.SDK,
            id: "0",
            privateData: data,
          });
          if (setDataResult.isOk()) {
            return Result.ok();
          }

          return setDataResult;
        }
        return stringifyResult;
      }
      return toolbarResult;
    }

    return Result.error(
      new Error("data.toolbar is null even after we tried to fix it"),
    );
  }

  return dataResult;
}

export async function loadDocFromDoc(): Promise<
  Result<Doc, never> | Result<never, Error>
> {
  // Get all layouts from the SDK
  const layoutsResult = await getAllLayouts(window.SDK);
  if (!layoutsResult.isOk()) {
    return layoutsResult as Result<never, Error>;
  }

  // Get all variables from the SDK
  const variablesResult = await getAllVariables(window.SDK);
  if (!variablesResult.isOk()) {
    return variablesResult as Result<never, Error>;
  }

  // Transform layouts to match the Layout type
  const layouts: Layout[] = layoutsResult.value.map((layout: any) => ({
    name: layout.name || "",
    id: layout.id || "",
    parentId: layout.parentId,
  }));

  // Transform variables to match the Variable type
  const variables: Variable[] = variablesResult.value.map((variable: any) => {
    const baseVariable = {
      id: variable.id || "",
      name: variable.name || "",
      isVisiblie: variable.isVisible ?? false,
    };

    switch (variable.type) {
      case "image":
      case "shortText":
        return {
          ...baseVariable,
          type: variable.type as "image" | "shortText",
          value: String(variable.value || ""),
        } as TextImageVariable;
      case "list":
        return {
          ...baseVariable,
          type: "list",
          value: String(variable.value || ""),
          items: Array.isArray(variable.items)
            ? variable.items.map((item: any) => ({
                value: String(item.value || ""),
                displayValue: item.displayValue,
              }))
            : [],
        } as ListVariable;
      case "boolean":
        return {
          ...baseVariable,
          type: "boolean",
          value: Boolean(variable.value),
        } as BooleanVariable;
      default:
        // Default to text variable for unknown types
        return {
          ...baseVariable,
          type: "shortText",
          value: String(variable.value || ""),
        } as TextImageVariable;
    }
  });

  // Return the Doc object
  return Result.ok({
    layouts,
    variables,
  });
}

export async function saveLayoutMappingToAction(
  layoutMaps: LayoutMap[],
  doc: Doc,
) {
  const actionMap = layoutMappingToActionMap(layoutMaps, doc);

  const script =
    imageSelectionScript
      .toString()
      .replace('"%DATA%"', JSON.stringify(actionMap)) +
    "\nconsole.log(imageSelectionScript(false))";

  const updateResult = await updateAction(
    {
      name: "AUTO_GEN_TOOLBAR",
      studio: window.SDK,
    },
    {
      name: "AUTO_GEN_TOOLBAR",
      triggers: [
        { event: ActionEditorEvent.selectedLayoutChanged },
        { event: ActionEditorEvent.variableValueChanged },
      ],
      script: script,
    },
  );

  return updateResult;

  // return updateResult.map(async (_) => {
  //   return await setOrCreateVariableValue({
  //     studio: window.SDK,
  //     name: "AUTO_GEN_JSON",
  //     value: JSON.stringify(actionMap),
  //     variableType: VariableType.shortText,
  //   });
  // });
}

export async function saveImageSizingMappingToAction(
  frameMaps: FrameLayoutMap[],
) {

  const imageResizingMapResult = await frameLayoutMappingToLookup(frameMaps, window.SDK);
  const layoutSizingMapResult = await layoutManagerToLookup(window.SDK);

  const results = Result.all(imageResizingMapResult, layoutSizingMapResult)
  
  if (results.isError() || results.value == null) {
    return results;
  }
  
  const [imageResizingData, layoutSizingData] = results.value;

  const script =
    imageSizingScript
      .toString()
      .replace('"%DATA1%"', JSON.stringify(imageResizingData))
      .replace('"%DATA2%"', JSON.stringify(layoutSizingData)) +
    "\nconsole.log(imageSizingScript(false))";

  const updateResult = await updateAction(
    {
      name: "AUTO_GEN_TOOLBAR_IR",
      studio: window.SDK,
    },
    {
      name: "AUTO_GEN_TOOLBAR_IR",
      triggers: [
        { event: ActionEditorEvent.selectedLayoutChanged },
        { event: ActionEditorEvent.variableValueChanged },
      ],
      script: script,
    },
  );

  return updateResult;

}


// export async function convertOldMap(variableId: string) {
//   const studioResult = await getStudio();
//   if (!studioResult.isOk()) {
//     return studioResult;
//   }
//
//   const studio = studioResult.value;
//
//   try {
//     // Get the variable by ID
//     const variableResponse = await studio.variable.getById(variableId);
//     if (!variableResponse || !variableResponse.data) {
//       return Result.error(
//         new Error(`Variable with ID ${variableId} not found`),
//       );
//     }
//
//     // The variable value is directly in the data property
//     const variableValue = variableResponse.data;
//
//     // Parse the JSON value
//     const jsonResult = await Result.try(() => JSON.parse(variableValue));
//     if (!jsonResult.isOk()) {
//       return Result.error(
//         new Error(`Failed to parse JSON: ${jsonResult.error?.message}`),
//       );
//     }
//
//     // Convert the old map to the new layout config format
//     const layoutMaps = convertOldMapToLayoutConfig(
//       jsonResult.value as Record<string, any>,
//     );
//
//     // Save the layout maps to the document
//     //return await saveLayoutImageMapToDoc(layoutMaps);
//     const idResult = await createVariable({
//       studio,
//       variableType: VariableType.shortText,
//       name: "JSON_COVERTED",
//     });
//     idResult.onSuccess((id) =>
//       setVariableValue({ studio, id, value: JSON.stringify(layoutMaps) }),
//     );
//   } catch (error) {
//     return Result.error(
//       error instanceof Error ? error : new Error(String(error)),
//     );
//   }
// }

export async function removeFrameLayouyMap(frameId:string, imageName:String, layoutId:string): Promise<Result<void, Error>> {
  try {
    // 1. Load frame layout maps from doc
    const frameLayoutMapsResult = await loadFrameLayoutMapsFromDoc();
    if (!frameLayoutMapsResult.isOk()) {
      return Result.error(new Error("Failed to load frame layout maps: " + frameLayoutMapsResult.error?.message));
    }
    
    const frameLayoutMaps = frameLayoutMapsResult.value;

    // 2. Find the frame layout map for the specified layout
    const frameLayoutMapIndex = frameLayoutMaps.findIndex(map => map.layoutId === layoutId);
    
    if (frameLayoutMapIndex === -1) {
      return Result.error(new Error(`No frame layout map found for layout ID: ${layoutId}`));
    }

    // 3. Find the frame snapshot with the specified frame ID
    const frameLayoutMap = frameLayoutMaps[frameLayoutMapIndex];
    const frameSnapshotIndex = frameLayoutMap.frameSnapshots.findIndex(
      snapshot => snapshot.frameId === frameId && snapshot.imageName == imageName
    );
    
    if (frameSnapshotIndex === -1) {
      return Result.error(new Error(`No frame snapshot found with ID: ${frameId}`));
    }

    // 4. Remove the frame snapshot
    frameLayoutMap.frameSnapshots.splice(frameSnapshotIndex, 1);

    // 5. If there are no more frame snapshots, remove the entire frame layout map
    if (frameLayoutMap.frameSnapshots.length === 0) {
      frameLayoutMaps.splice(frameLayoutMapIndex, 1);
    }

    // 6. Save the updated frame layout maps
    const saveResult = await saveFrameLayoutMapsToDoc(frameLayoutMaps);
    if (!saveResult.isOk()) {
      return Result.error(new Error("Failed to save frame layout maps: " + saveResult.error?.message));
    }

    return Result.ok(undefined);
  } catch (error) {
    return Result.error(error instanceof Error ? error : new Error(String(error)));
  }
}

export async function updateFrameLayoutMaps(frameSnapshot: {
  frameId: string;
  assetId:string;
  x: number;
  y: number;
  width: number;
  height: number;
}): Promise<Result<void, Error>> {
  try {
    // 1. Get Studio
    const studioResult = await getStudio();
    if (!studioResult.isOk()) {
      return Result.error(studioResult.error);
    }
    const studio = studioResult.value;

    // 2. Get selected layout ID
    const selectedLayoutResult = await getSelected(studio);
    if (!selectedLayoutResult.isOk()) {
      return Result.error(new Error("Failed to get selected layout: " + selectedLayoutResult.error?.message));
    }
    
    const selectedLayout = selectedLayoutResult.value;
    if (!selectedLayout || !selectedLayout.id) {
      return Result.error(new Error("No layout is currently selected"));
    }
    
    const layoutId = selectedLayout.id;

    // 3. Load frame layout maps from doc
    const frameLayoutMapsResult = await loadFrameLayoutMapsFromDoc();
    if (!frameLayoutMapsResult.isOk()) {
      return Result.error(new Error("Failed to load frame layout maps: " + frameLayoutMapsResult.error?.message));
    }
    
    const frameLayoutMaps = frameLayoutMapsResult.value;

    // 4. Find or create a FrameLayoutMap for the selected layout
    let frameLayoutMap = frameLayoutMaps.find(map => map.layoutId === layoutId);
    
    if (!frameLayoutMap) {
      // Create a new FrameLayoutMap if one doesn't exist for this layout
      frameLayoutMap = {
        layoutId,
        frameSnapshots: []
      };
      frameLayoutMaps.push(frameLayoutMap);
    }

    // 5. Find or add a FrameSnapshot for the selected frame
    const frameSnapshotIndex = frameLayoutMap.frameSnapshots.findIndex(
      snapshot => snapshot.frameId === frameSnapshot.frameId && snapshot.imageName == frameSnapshot.assetId
    );

    const newFrameSnapshot = {
      imageName: frameSnapshot.assetId,
      frameId: frameSnapshot.frameId,
      x: frameSnapshot.x,
      y: frameSnapshot.y,
      width: frameSnapshot.width,
      height: frameSnapshot.height
    };

    if (frameSnapshotIndex >= 0) {
      // Update existing snapshot
      frameLayoutMap.frameSnapshots[frameSnapshotIndex] = newFrameSnapshot;
    } else {
      // Add new snapshot
      frameLayoutMap.frameSnapshots.push(newFrameSnapshot);
    }

    // 6. Save updated frame layout maps to doc
    const saveResult = await saveFrameLayoutMapsToDoc(frameLayoutMaps);
    if (!saveResult.isOk()) {
      return Result.error(new Error("Failed to save frame layout maps: " + saveResult.error?.message));
    }

    return Result.ok(undefined);
  } catch (error) {
    return Result.error(error instanceof Error ? error : new Error(String(error)));
  }
}