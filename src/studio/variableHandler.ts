import type SDK from "@chili-publish/studio-sdk";
import { Result } from "typescript-result";
import { handleStudioFunc } from "./utils";
import type { PrivateData, VariableType } from "@chili-publish/studio-sdk";

export async function getAllVariables(studio: SDK) {
  return handleStudioFunc(studio.next.variable.getAll);
}

type SetVariableValueProps = {
  studio: SDK;
  id: string;
  value: string;
};

export async function setVariableValue({
  studio,
  id,
  value,
}: SetVariableValueProps) {
  return handleStudioFunc(studio.variable.setValue, id, value);
}

type CreateVariableValue = {
  studio: SDK;
  variableType: VariableType;
  name: string;
};

export async function createVariable({
  studio,
  variableType,
  name,
}: CreateVariableValue) {
  const createResult = await handleStudioFunc(
    studio.variable.create,
    "",
    variableType,
  );
  return createResult.map(async (id) => {
    const result = await handleStudioFunc(studio.variable.rename, id, name);
    if (result.isOk()) return id;
    return Result.error(result.value);
  });
}

type SetOrCreateVariableValueProps = {
  studio: SDK;
  name: string;
  value: string;
  variableType: VariableType;
};

export async function setOrCreateVariableValue({
  studio,
  name,
  value,
  variableType,
}: SetOrCreateVariableValueProps) {
  // Get all variables to check if one with the given name exists
  const allVariablesResult = await getAllVariables(studio);

  return allVariablesResult.map(async (variables) => {
    // Find variable with matching name
    const existingVariable = variables.find(
      (variable) => variable.name === name,
    );

    if (existingVariable) {
      // If variable exists, update its value
      return await setVariableValue({
        studio,
        id: existingVariable.id,
        value,
      });
    } else {
      // If variable doesn't exist, create it first
      const createResult = await createVariable({
        studio,
        variableType,
        name,
      });

      // Then set its value if creation was successful
      return createResult.map(async (id) => {
        return await setVariableValue({
          studio,
          id,
          value,
        });
      });
    }
  });
}
