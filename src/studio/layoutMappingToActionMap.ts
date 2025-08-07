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
        // Find the variable in the document by ID
        const valueVar = doc.variables.find((v) => v.id === varValue.id);
        if (valueVar) {
          obj[valueVar.name] = varValue.transform;
        }
      }
      return obj;
    }, {});
}

export function layoutMappingToActionMap(layoutMaps: LayoutMap[], doc: Doc) {
  const actionMap: Record<string, Record<string, any>> = {};

  // Process each layout map
  layoutMaps.forEach((layoutMap) => {
    // For each layout ID in the layout map
    layoutMap.layoutIds.forEach((layoutId) => {
      // Find the layout in the document by ID
      const layout = doc.layouts.find((l) => l.id === layoutId);

      if (layout) {
        // Use the layout name as the key in the action map
        const layoutName = layout.name;

        // Initialize the layout entry if it doesn't exist
        if (!actionMap[layoutName]) {
          actionMap[layoutName] = {};
        }

        // Process each image variable in the layout map
        layoutMap.variables.forEach((targetVar: TargetVariable) => {
          // Find the corresponding variable in the document
          const docVariable = doc.variables.find((v) => v.id === targetVar.id);

          if (docVariable) {
            actionMap[layoutName][docVariable.name] = {};

            // Process each dependent group for this image variable
            targetVar.dependentGroup.forEach((group) => {
              if (group.alwaysRun) {
                const dependentKey = "_always_run";
                actionMap[layoutName][docVariable.name][dependentKey] = {};

                 // Set the value property
                actionMap[layoutName][docVariable.name][dependentKey].value = getValueString(
                  group.variableValue,
                  doc,
                );

                actionMap[layoutName][docVariable.name][dependentKey].transforms = getTransforms(
                  group.variableValue,
                  doc,
                );
                return;
              }

              // Get the names of all dependent variables
              const dependentNames: string[] = [];

              // Map to store variable names by their IDs for later use
              const variableNamesById: Record<string, string> = {};

              // Process each dependent in the group
              group.dependents.forEach((dependent) => {
                // Find the variable in the document by ID
                const dependentVar = doc.variables.find(
                  (v) => v.id === dependent.variableId,
                );

                if (dependentVar) {
                  // Add the variable name to our list
                  dependentNames.push(dependentVar.name);

                  // Store the variable name by ID for later reference
                  variableNamesById[dependent.variableId] = dependentVar.name;
                }
              });

              // Skip if no dependent names were found
              if (dependentNames.length === 0) return;

              // Create a key by joining dependent names with "|"
              const dependentKey = dependentNames.join("|");

              // Initialize the dependent key entry if it doesn't exist
              if (!actionMap[layoutName][docVariable.name][dependentKey]) {
                actionMap[layoutName][docVariable.name][dependentKey] = {};
              }

              // Generate all possible combinations of dependent values
              // First, create an array of arrays containing all possible values for each dependent
              const allPossibleValues = group.dependents.map((dependent) => {
                return dependent.values;
              });

              // Generate all combinations of these values
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
                    ...generateCombinations(
                      arrays,
                      [...current, value],
                      index + 1,
                    ),
                  );
                }
                return result;
              };

              const valueCombinations = generateCombinations(allPossibleValues);

              // For each combination of values
              valueCombinations.forEach((combination) => {
                // Create a key by joining the values with "|"
                const valueKey = combination.join("|");

                // Initialize the value key entry if it doesn't exist
                if (
                  !actionMap[layoutName][docVariable.name][dependentKey][
                    valueKey
                  ]
                ) {
                  actionMap[layoutName][docVariable.name][dependentKey][
                    valueKey
                  ] = { value: "" };
                }

                // Process the variable values to create the concatenated string
                const valueString = getValueString(group.variableValue, doc);

                const transforms = getTransforms(group.variableValue, doc);

                // Set the value property
                actionMap[layoutName][docVariable.name][dependentKey][
                  valueKey
                ].value = valueString;

                actionMap[layoutName][docVariable.name][dependentKey][
                  valueKey
                ].transforms = transforms;
              });
            });
          }
        });
      }
    });
  });

  return actionMap;
}
