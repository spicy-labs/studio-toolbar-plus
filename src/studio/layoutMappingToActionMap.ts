import type { Doc } from "../types/docStateTypes";
import type { LayoutMap, ImageVariable } from "../types/layoutConfigTypes";

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
        layoutMap.variables.forEach((imageVar: ImageVariable) => {
          // Find the corresponding variable in the document
          const docVariable = doc.variables.find((v) => v.id === imageVar.id);

          if (docVariable) {
            actionMap[layoutName][docVariable.name] = {};

            // Process each dependent group for this image variable
            imageVar.dependentGroup.forEach((group) => {
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
                const valueString = group.variableValue
                  .map((varValue) => {
                    if (typeof varValue === "string") {
                      return varValue;
                    } else if (varValue.id) {
                      // Find the variable in the document by ID
                      const valueVar = doc.variables.find(
                        (v) => v.id === varValue.id,
                      );
                      if (valueVar) {
                        return `\${${valueVar.name}}`;
                      }
                    }
                    return "";
                  })
                  .join("");

                console.log("VALUES", group.variableValue);

                const transforms = group.variableValue
                  .filter((varValue) => typeof varValue != "string")
                  .reduce((obj: Record<string, any>, varValue) => {
                    if (varValue.id) {
                      // Find the variable in the document by ID
                      const valueVar = doc.variables.find(
                        (v) => v.id === varValue.id,
                      );
                      if (valueVar) {
                        obj[valueVar.name] = varValue.transform;
                      }
                    }
                    return obj;
                  }, {});

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
