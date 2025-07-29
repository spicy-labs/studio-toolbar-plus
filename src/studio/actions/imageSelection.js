export function imageSelectionScript(debug) {
  const version = "1";
  const imageSelectionData = "%DATA%";

  const errorCollection = [];
  const debugData = {};

  try {
    const variables = studio.variables.all();

    const layoutName = getSelectedLayoutName();

    const layoutImageMapping = imageSelectionData[layoutName];

    if (debug) {
      debugData.variables = variables;
      debugData.layoutImageMapping = layoutImageMapping;
    }

    if (!layoutImageMapping) {
      errorCollection.push(
        Error(`No image mapping found for layout ${layoutName}`),
      );
      return { debugData, errorCollection };
    }

    for (const variable of variables) {
      const imageVariableDependentGroups = layoutImageMapping[variable.name];

      if (debug) {
        debugData[variable.name] = {
          imageVariableDependentGroups: layoutImageMapping[variable.name],
        };
      }

      if (!imageVariableDependentGroups) {
        errorCollection.push(
          Error(
            `No  dependent groups found for image variable: ${variable.name}`,
          ),
        );
        continue;
      }


      if (imageVariableDependentGroups["_always_run"]) {
        const variableValue = replaceVariables(
          imageVariableDependentGroups["_always_run"].value,
          imageVariableDependentGroups["_always_run"].transforms,
        );

        setVariableValue(variable.name, variableValue);

        if (debug) {
          debugData[variable.name].variableValue = variableValue;
        }
        continue;
      }

      const dependancies = Object.keys(imageVariableDependentGroups).filter(d => d !== "_always_run");

      if (debug) {
        debugData[variable.name].dependancies = dependancies;
      }

      if (dependancies.length == 0) {
        errorCollection.push(
          Error(`Something went wrong no dependancies for: ${variable.name}`),
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
          debugData[variable.name].compositeKeys = !debugData[variable.name]
            .compositeKeys
            ? [compositeKey]
            : [...debugData[variable.name].compositeKeys, compositeKey];
          debugData[variable.name].variableMatches = !debugData[variable.name]
            .variableMatches
            ? [variableMatch]
            : [...debugData[variable.name].variableMatches, variableMatch];
        }

        return variableMatch;
      }, null);

      if (debug) {
        debugData[variable.name].variableMatch = variableMatch;
      }

      if (!variableMatch) {
        errorCollection.push(
          Error(`Something went wrong no match found for: ${variable.name}`),
        );
        continue;
      }

      const variableValue = replaceVariables(
        variableMatch.value,
        variableMatch.transforms,
      );

      setVariableValue(variable.name, variableValue);

      if (debug) {
        debugData[variable.name].variableValue = variableValue;
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
          // const variableValue =
          //   typeof variableRawValue == "boolean"
          //     ? variableRawValue
          //       ? "TRUE"
          //       : "FALSE"
          //     : variableRawValue;
          return `${variableRawValue}`;
        })
        .join("|");
    }
  } catch (e) {
    errorCollection.push(e);
  }

  return { debugData, errorCollection };
}

