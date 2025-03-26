export type Layout = {
  name: string;
  id: string;
  parentId?: string;
};

/**
 * Base type with common properties for all variable types
 */
export type VariableBase = {
  id: string;
  name: string;
  isVisiblie: boolean;
};

export type TextImageVariable = VariableBase & {
  type: "image" | "shortText";
  value: string;
};

export type ListVariable = VariableBase & {
  type: "list";
  value: string;
  items: Item[];
};

export type BooleanVariable = VariableBase & {
  type: "boolean";
  value: boolean;
};

export type Variable = TextImageVariable | ListVariable | BooleanVariable;

export type Item = {
  value: string;
  displayValue?: string;
};

export type Doc = {
  layouts: Layout[];
  variables: Variable[];
};
