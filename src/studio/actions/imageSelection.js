export function imageSelectionScript(debug) {
  const imageSelectionData = "%DATA%";

  const errorCollection = [];
  const debugData = {};

  try {
    const vars = studio.variables.all();
    const imageVars = vars.filter((f) => f.type == "image");

    const layoutImageMapping = imageSelectionData[getSelectedLayoutName()];

    if (debug) {
      debugData.imageVars = imageVars;
      debugData.layoutImageMapping = layoutImageMapping;
    }

    if (!layoutImageMapping) {
      errorCollection.push(
        Error(`No image mapping found for layout ${getSelectedLayoutName()}`),
      );
      return { debugData, errorCollection };
    }

    for (const imageVar of imageVars) {
      const imageVariableDependentGroups = layoutImageMapping[imageVar.name];

      if (debug) {
        debugData[imageVar.name] = {
          imageVariableDependentGroups: layoutImageMapping[imageVar.name],
        };
      }

      if (!imageVariableDependentGroups) {
        errorCollection.push(
          Error(
            `No  dependent groups found for image variable: ${imageVar.name}`,
          ),
        );
        continue;
      }

      const dependancies = Object.keys(imageVariableDependentGroups);

      if (debug) {
        debugData[imageVar.name].dependancies = dependancies;
      }

      if (dependancies.length == 0) {
        errorCollection.push(
          Error(`Something went wrong no dependancies for: ${imageVar.name}`),
        );
        continue;
      }

      const variableMatch = dependancies.reduce((variableMatch, d) => {
        if (variableMatch != null) {
          return variableMatch;
        }
        const compositeKey = getCompositeKeyFromVariables(d.split("|"));
        variableMatch = imageVariableDependentGroups[d][compositeKey];

        if (debug) {
          debugData[imageVar.name].compositeKeys = !debugData[imageVar.name]
            .compositeKeys
            ? [compositeKey]
            : [...debugData[imageVar.name].compositeKeys, compositeKey];
          debugData[imageVar.name].variableMatches = !debugData[imageVar.name]
            .variableMatches
            ? [variableMatch]
            : [...debugData[imageVar.name].variableMatches, variableMatch];
        }

        return variableMatch;
      }, null);

      if (debug) {
        debugData[imageVar.name].variableMatch = variableMatch;
      }

      if (!variableMatch) {
        errorCollection.push(
          Error(`Something went wrong no match found for: ${imageVar.name}`),
        );
        continue;
      }

      const variableValue = replaceVariables(
        variableMatch.value,
        variableMatch.transforms,
      );

      setVariableValue(imageVar.name, variableValue);

      if (debug) {
        debugData[imageVar.name].variableValue = variableValue;
      }
    }

    function replaceVariables(input, allTransforms) {
      // Use a regular expression to match ${NAME}
      return input.replace(/\${(.*?)}/g, (_, name) => {
        const variableValue = getVariableValue(name);
        const currentTransforms = allTransforms[name];
        return currentTransforms.reduce((previousValue, transform) => {
          if (transform.replaceAll) {
            return previousValue.replaceAll(transform.find, transform.replace);
          }
          return previousValue.replace(transform.find, transform.replace);
        }, variableValue);
      });
    }

    function getCompositeKeyFromVariables(dependencies) {
      return dependencies
        .map((dep) => {
          const variableRawValue = getVariableValue(dep);
          const variableValue =
            typeof variableRawValue == "boolean"
              ? variableRawValue
                ? "TRUE"
                : "FALSE"
              : variableRawValue;
          return `${variableValue}`;
        })
        .join("|");
    }
  } catch (e) {
    errorCollection.push(e);
  }

  return { debugData, errorCollection };
}
