export type TransformCommands = {
  find: string;
  replace: string;
  replaceAll: boolean;
  regex: boolean;
};

export type StudioText = "StudioText";
export type StudioList = "StudioList";
export type ConfigString = "ConfigString";

export type Text = {
  type: ConfigString;
};

export type Variable = {
  id: string | null;
  type: StudioText | StudioList;
  transform: TransformCommands[];
};

export type DependentVar = {
  variableId: string;
  values: string[];
};

export type DependentGroup = {
  dependents: DependentVar[];
  variableValue: (string | Variable)[];
};

export type ImageVariable = {
  id: string;
  dependentGroup: DependentGroup[];
};

export type LayoutMap = {
  id: string;
  layoutIds: string[];
  variables: ImageVariable[];
};
