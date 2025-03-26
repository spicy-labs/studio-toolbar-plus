import { Result } from "typescript-result";
import type { LayoutMap } from "../types/layoutConfigTypes.ts";
import {
  getPrivateData,
  setPrivateData,
  getAllLayouts,
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
import { layoutMappingToActionMap } from "./layoutMappingToActionMap.ts";

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
  const dataResult = await getPrivateData({
    id: "0",
    studio: window.SDK,
  });

  if (dataResult.isOk()) {
    const data = dataResult.value;

    if (data.toolbar != null) {
      const toolbarResult = await Result.try(() => JSON.parse(data.toolbar));
      if (toolbarResult.isOk()) {
        return Result.ok((toolbarResult.value as ToolbarEnvelope).layoutMaps);
      }

      return toolbarResult as Result<never, Error>;
    } else {
      const setDataResult = await tryAddingToolbarToData(data);
      if (setDataResult.isOk()) {
        return Result.ok([]);
      }

      return setDataResult as Result<never, Error>;
    }
  }

  return dataResult as Result<never, Error>;
}

export async function saveLayoutImageMapToDoc(layoutMaps: LayoutMap[]) {
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
        toolbar.layoutMaps = layoutMaps;
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
    "\nconsole.log(imageSelectionScript(true))";

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
