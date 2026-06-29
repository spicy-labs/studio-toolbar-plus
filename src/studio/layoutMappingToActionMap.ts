import type { Doc } from "../types/docStateTypes";
import type {
  LayoutMap,
  TargetVariable,
  VariableValue,
  TextareaValueType,
} from "../types/layoutConfigTypes";

/**
 * Extracts and concatenates variable values into a string with variable references
 * @param variableValue Array of string, VariableValue, or TextareaValueType
 * @param doc Document containing variables for ID lookup
 * @returns Concatenated string with variable references in ${variableName} format
 */
function getValueString(
  variableValue: (string | VariableValue | TextareaValueType)[],
  doc: Doc,
): string {
  return variableValue
    .map((varValue) => {
      if (typeof varValue === "string") {
        return varValue;
      }
      if (varValue.type === "TextareaValue") {
        return varValue.value;
      } else if (varValue.id) {
        // Find the variable in the document by ID
        const valueVar = doc.variables.find((v) => v.id === varValue.id);
        if (valueVar) {
          return `\${${valueVar.name}}`;
        }
      }
      return "";
    })
    .join("");
}

/**
 * Extracts transform commands from variable values
 * @param variableValue Array of string, VariableValue, or TextareaValueType
 * @param doc Document containing variables for ID lookup
 * @returns Object mapping variable names to their transform commands
 */
function getTransforms(
  variableValue: (string | VariableValue | TextareaValueType)[],
  doc: Doc,
): Record<string, any> {
  return variableValue
    .filter(
      (varValue) =>
        typeof varValue != "string" && varValue.type !== "TextareaValue",
    )
    .reduce((obj: Record<string, any>, varValue) => {
      if (varValue.id) {
        const valueVar = doc.variables.find((v) => v.id === varValue.id);
        if (valueVar && varValue.transform && varValue.transform.length > 0) {
          obj[valueVar.name] = varValue.transform;
        }
      }
      return obj;
    }, {});
}

function buildVariableMap(
  targetVars: TargetVariable[],
  doc: Doc,
): Record<string, any> {
  const variableMap: Record<string, any> = {};

  targetVars.forEach((targetVar: TargetVariable) => {
    const docVariable = doc.variables.find((v) => v.id === targetVar.id);
    if (!docVariable) return;

    variableMap[docVariable.name] = {};

    targetVar.dependentGroup.forEach((group) => {
      if (group.alwaysRun) {
        const transforms = getTransforms(group.variableValue, doc);
        variableMap[docVariable.name]["_always_run"] = {
          value: getValueString(group.variableValue, doc),
          ...(Object.keys(transforms).length > 0 && { transforms }),
        };
        return;
      }

      const dependentNames: string[] = [];
      group.dependents.forEach((dependent) => {
        const dependentVar = doc.variables.find(
          (v) => v.id === dependent.variableId,
        );
        if (dependentVar) {
          dependentNames.push(dependentVar.name);
        }
      });

      if (dependentNames.length === 0) return;

      const dependentKey = dependentNames.join("|");
      if (!variableMap[docVariable.name][dependentKey]) {
        variableMap[docVariable.name][dependentKey] = {};
      }

      const allPossibleValues = group.dependents.map((dependent) => {
        return dependent.values;
      });

      const generateCombinations = (
        arrays: string[][],
        current: string[] = [],
        index: number = 0,
      ): string[][] => {
        if (index === arrays.length) {
          return [current];
        }
        const result: string[][] = [];
        for (const value of arrays[index]) {
          result.push(
            ...generateCombinations(arrays, [...current, value], index + 1),
          );
        }
        return result;
      };

      const valueCombinations = generateCombinations(allPossibleValues);
      const valueString = getValueString(group.variableValue, doc);
      const transforms = getTransforms(group.variableValue, doc);
      const entry: Record<string, any> = { value: valueString };
      if (Object.keys(transforms).length > 0) {
        entry.transforms = transforms;
      }

      valueCombinations.forEach((combination) => {
        const valueKey = combination.join("|");
        variableMap[docVariable.name][dependentKey][valueKey] = entry;
      });
    });
  });

  return variableMap;
}

export function layoutMappingToActionMap(layoutMaps: LayoutMap[], doc: Doc) {
  const actionMap: Record<string, Record<string, any>> = {};

  layoutMaps.forEach((layoutMap) => {
    const variableMap = buildVariableMap(layoutMap.variables, doc);

    layoutMap.layoutIds.forEach((layoutId) => {
      const layout = doc.layouts.find((l) => l.id === layoutId);
      if (layout) {
        if (!actionMap[layout.name]) {
          actionMap[layout.name] = {};
        }
        Object.assign(actionMap[layout.name], variableMap);
      }
    });
  });

  return actionMap;
}
