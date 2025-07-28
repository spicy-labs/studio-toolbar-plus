import { Result } from "typescript-result";
import type { Variable } from "./docStateTypes";

export type TransformCommands = {
  find: string;
  replace: string;
  replaceAll: boolean;
  regex: boolean;
};

export type StudioText = "StudioText";
export type StudioList = "StudioList";
export type StudioImage = "StudioImage";
export type StudioVariable = StudioText | StudioList | StudioImage;
export type ConfigString = "ConfigString";

export type Text = {
  type: ConfigString;
};

export function convertDocVariableToLayoutVariable(
  variable: Variable,
): Result<StudioVariable, string> {
  switch (variable.type) {
    case "image":
      return Result.ok("StudioImage");
    case "list":
      return Result.ok("StudioList");
    case "shortText":
    case "longText":
      return Result.ok("StudioText");
    default:
      return Result.error(`Unsupported variable type: ${variable.type}`);
  }
}

export type VariableValue = {
  id: string | null;
  type: StudioVariable;
  transform: TransformCommands[];
};

export type DependentVar = {
  variableId: string;
  values: string[];
};

export type DependentGroup = {
  dependents: DependentVar[];
  variableValue: (string | VariableValue)[];
};

export type TargetVariable = {
  id: string;
  type: StudioVariable;
  dependentGroup: DependentGroup[];
};

export type LayoutMap = {
  id: string;
  layoutIds: string[];
  variables: TargetVariable[];
};
