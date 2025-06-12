import type SDK from "@chili-publish/studio-sdk";
import { Result } from "typescript-result";
import { handleStudioFunc } from "./utils";
import type {
  PrivateData,
  VariableVisibility,
} from "@chili-publish/studio-sdk";
import { VariableType } from "@chili-publish/studio-sdk";
import type { Variable } from "../types/layoutConfigTypes";

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

type SetVariableVisibilityProps = {
  studio: SDK;
  id: string;
  visible: VariableVisibility;
};

export async function setVariableVisblity({
  studio,
  id,
  visible,
}: SetVariableVisibilityProps) {
  return handleStudioFunc(studio.variable.setVariableVisibility, id, visible);
}

type SetVariableNameVisibilityProps = {
  studio: SDK;
  name: string;
  visible: VariableVisibility;
};

export async function setVariableVisblityWithName({
  studio,
  name,
  visible,
}: SetVariableNameVisibilityProps) {
  const allVariablesResult = await getAllVariables(studio);

  return allVariablesResult.map(async (variables) => {
    // Find variable with matching name
    const existingVariable = variables.find(
      (variable) => variable.name === name
    );

    if (existingVariable) {
      // If variable exists, update its value
      return await setVariableVisblity({
        studio,
        id: existingVariable.id,
        visible,
      });
    } else {
      return Result.error(new Error(`Variable with name ${name} not found`));
    }
  });
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
    variableType
  );
  return createResult.map(async (id) => {
    const result = await handleStudioFunc(studio.variable.rename, id, name);
    if (result.isOk()) return id;
    return Result.error(result.value);
  });
}

type GroupVariablesProps = {
  studio: SDK;
  name: string;
  variableIds: string[];
};

export async function groupVariables({
  studio,
  name,
  variableIds,
}: GroupVariablesProps) {
  return handleStudioFunc(studio.variable.groupVariables, name, variableIds);
}

type MoveVariableProps = {
  studio: SDK;
  id: string;
  newParentId: string;
  order?: number;
};

export async function moveVariable({
  studio,
  id,
  order = 0,
  newParentId,
}: MoveVariableProps) {
  return handleStudioFunc(studio.variable.move, order, id, newParentId);
}

type SetVariableTypeProps = {
  studio: SDK;
  id: string;
  variableType: VariableType;
};

export async function setVariableType({
  studio,
  id,
  variableType,
}: SetVariableTypeProps) {
  return handleStudioFunc(studio.variable.setType, id, variableType);
}

export async function setListVariableItems({
  studio,
  id,
  items,
}: {
  studio: SDK;
  id: string;
  items: string[];
}) {
  return handleStudioFunc(studio.variable.setListVariable, id, items);
}

export async function deleteVariables(studio: SDK, ids: string[]) {
  return handleStudioFunc(studio.variable.remove, ids);
}

type SetOrCreateVariableValuePropsBase = {
  studio: SDK;
  name: string;
};

type SetOrCreateVariableValueProps = SetOrCreateVariableValuePropsBase &
  (
    | {
        value: string;
        variableType: VariableType.shortText | VariableType.longText;
      }
    | {
        value: string[];
        variableType: VariableType.list;
      }
  );

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
      (variable) => variable.name === name
    );

    if (existingVariable) {
      if (existingVariable.type !== variableType) {
        await setVariableType({
          studio,
          id: existingVariable.id,
          variableType,
        });
      }

      if (variableType === VariableType.list) {
        return await setListVariableItems({
          studio,
          id: existingVariable.id,
          items: value,
        });
      }

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
        if (variableType === VariableType.list) {
          return await setListVariableItems({ studio, id, items: value });
        }

        return await setVariableValue({
          studio,
          id,
          value,
        });
      });
    }
  });
}

export async function getById(studio: SDK, id: string) {
  return handleStudioFunc(studio.next.variable.getById, id);
}

export function getByName(studio: SDK, name: string) {
  return handleStudioFunc(studio.next.variable.getByName, name);
}
