// modalStore.ts
import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import {
  type LayoutMap,
  type DependentVar,
  type TargetVariable,
  type VariableValue,
  type StudioVariable,
} from "./types/layoutConfigTypes";
import { Result, type Result as ResultType } from "typescript-result";
import { type Doc } from "./types/docStateTypes";
import type { WritableDraft } from "immer";

type LayoutImageMappingModalState = {
  isModalVisible: boolean;
  dependentModal: {
    isOpen: boolean;
    currentGroupIndex: number | null;
    currentTargetVariableId: string | null;
    currentSelectedVariables: string[];
  };
  currentAddImageMappingSelectedVariables: string[];
  isAddTargetVariableMappingModalOpen: boolean;
  isSwapTargetVariableModalOpen: boolean;
  currentSwapTargetVariableSelected: string;
  currentSwapTargetVariableId: string | null;
  currentSelectedMapId: string | null;
};

type LayoutImageMappingModalEffects = {
  showModal: () => void;
  hideModal: () => void;
  dependentModal: {
    setIsOpen: (value: boolean, mapId?: string) => void;
    setCurrentGroupIndex: (value: number | null) => void;
    setCurrentTargetVariableId: (id: string) => void;
    setCurrentSelectedVariables: (value: string[]) => void;
  };
  setIsTargetVariableMappingModalOpen: (value: boolean) => void;
  setCurrentAddImageMappingSelectedVariables: (value: string[]) => void;
  setIsSwapTargetVariableModalOpen: (value: boolean) => void;
  setCurrentSwapTargetVariableSelected: (value: string) => void;
  setCurrentSwapTargetVariableId: (value: string | null) => void;
  setCurrentSelectedMapId: (value: string) => void;
};

type StudioState = {
  document: Doc;
  isDocumentLoaded: boolean;
  layoutImageMapping: LayoutMap[];
  isLayoutConfigLoaded: boolean;
};

class VariableTypesDoNotMatchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VariableTypesDoNotMatchError";
  }
}

type StudioEffects = {
  document: {
    load: (doc: Doc) => void;
    unload: () => void;
  };
  layoutImageMapping: {
    addLayoutMap: () => void;
    addLayoutMapFromCopy: (mapId: string) => void;
    deleteLayoutMap: (mapId: string) => void;
    setLayoutIds: (data: { mapId: string; layoutIds: string[] }) => void;
    addTargetVariable: (data: {
      mapId: string;
      targetVariable: TargetVariable;
    }) => void;
    removeTargetVariable: (data: {
      mapId: string;
      targetVariableId: string;
    }) => void;
    swapTargetVariable: (data: {
      mapId: string;
      oldTargetVariableId: string;
      newTargetVariableId: string;
    }) => Result<void, VariableTypesDoNotMatchError>;
    updateDependent: (data: {
      mapId: string;
      targetVariableId: string;
      dependentGroupIndex: number;
      dependent: DependentVar;
    }) => void;
    removeDependent: (data: {
      mapId: string;
      targetVariableId: string;
      dependentGroupIndex: number;
      dependent: DependentVar;
    }) => void;
    addDependentGroup: (data: {
      mapId: string;
      targetVariableId: string;
      dependents: DependentVar[];
    }) => void;
    copyDependentGroup: (data: {
      mapId: string;
      targetVariableId: string;
      groupIndex: number;
    }) => void;
    removeDependentGroup: (data: {
      mapId: string;
      targetVariableId: string;
      groupIndex: number;
    }) => void;
    addVarValueToDependentGroup: (data: {
      mapId: string;
      targetVariableId: string;
      groupIndex: number;
      variableValue: string | VariableValue;
    }) => void;
    removeVarValueFromDependentGroup: (data: {
      mapId: string;
      targetVariableId: string;
      groupIndex: number;
      variableValueIndex: number;
    }) => void;
    updateVarValueFromDependentGroup: (data: {
      mapId: string;
      targetVariableId: string;
      groupIndex: number;
      variableValueIndex: number;
      variableValue: string | VariableValue;
    }) => void;
    setIndexOfVarValueFromDependentGroup: (data: {
      mapId: string;
      targetVariableId: string;
      groupIndex: number;
      oldVariableValueIndex: number;
      newVariableValueIndex: number;
    }) => void;
    load: (configs: LayoutMap[]) => void;
    unload: () => void;
    save: () => void;
  };
};

type StateStore = {
  modal: LayoutImageMappingModalState;
  studio: StudioState;
  isToolbarVisible: boolean;
  isToolbarEnabled: boolean;
};

type EffectStore = {
  modal: LayoutImageMappingModalEffects;
  studio: StudioEffects;
};

type Alert = {
  id: string;
  message: string;
};

type AppStore = {
  state: StateStore;
  effects: EffectStore;
  errors: { error: Error; state: AppStore }[];
  alerts: Alert[];
  raiseError: (error: Result<any, Error> | Error) => void;
  showToolbar: () => void;
  hideToolbar: () => void;
  enableToolbar: () => void;
  disableToolbar: () => void;
  dismissAlert: (id: string) => void;
};

// Placeholder for the external save function
const saveLayoutConfigToJSON = (config: LayoutMap[]) => {
  console.log("Saving config:", config);
  // To be implemented
};

export const useAppStore = (): AppStore => appStore();

const unloadedDoc = { layouts: [], variables: [] };

export const appStore = create<AppStore>()(
  immer((set, get) => ({
    state: {
      modal: {
        isAddTargetVariableMappingModalOpen: false,
        currentAddImageMappingSelectedVariables: [],
        isSwapTargetVariableModalOpen: false,
        currentSwapTargetVariableSelected: "",
        currentSwapTargetVariableId: null,
        isModalVisible: false,
        currentSelectedMapId: null,
        dependentModal: {
          isOpen: false,
          currentTargetVariableId: null,
          currentSelectedVariables: [],
          currentGroupIndex: null,
        },
      },
      studio: {
        isLayoutConfigLoaded: false,
        isDocumentLoaded: false,
        document: unloadedDoc,
        layoutImageMapping: [],
      },
      isToolbarVisible: false,
      isToolbarEnabled: true,
    },
    alerts: [],
    effects: {
      modal: {
        showModal: () =>
          set((store) => {
            store.state.modal.isModalVisible = true;
            store.state.isToolbarVisible = false;
          }),
        hideModal: () =>
          set((store) => {
            store.state.modal.isModalVisible = false;
          }),
        setIsTargetVariableMappingModalOpen: (value: boolean) =>
          set((store) => {
            store.state.modal.isAddTargetVariableMappingModalOpen = value;
          }),
        setCurrentAddImageMappingSelectedVariables: (value) =>
          set((store) => {
            store.state.modal.currentAddImageMappingSelectedVariables = value;
          }),
        setCurrentSelectedMapId: (value) => {
          set((store) => {
            store.state.modal.currentSelectedMapId = value;
          });
        },
        setIsSwapTargetVariableModalOpen: (value: boolean) => {
          set((store) => {
            store.state.modal.isSwapTargetVariableModalOpen = value;
          });
        },
        setCurrentSwapTargetVariableSelected: (value: string) => {
          set((store) => {
            store.state.modal.currentSwapTargetVariableSelected = value;
          });
        },
        setCurrentSwapTargetVariableId: (value: string | null) => {
          set((store) => {
            store.state.modal.currentSwapTargetVariableId = value;
          });
        },
        dependentModal: {
          setIsOpen: (value, mapId) => {
            set((store) => {
              store.state.modal.dependentModal.isOpen = value;
              if (value === true) {
                if (!mapId) {
                  raiseError(
                    store,
                    new Error("Cannot open dependent modal without mapId"),
                  );
                  store.state.modal.dependentModal.isOpen = false;
                  return;
                }
                store.state.modal.currentSelectedMapId = mapId;
              }
            });
          },
          setCurrentTargetVariableId: (id: string) => {
            set((store) => {
              store.state.modal.dependentModal.currentTargetVariableId = id;
            });
          },
          setCurrentSelectedVariables: (value) => {
            set((store) => {
              store.state.modal.dependentModal.currentSelectedVariables = value;
            });
          },
          setCurrentGroupIndex: (value) => {
            set((store) => {
              store.state.modal.dependentModal.currentGroupIndex = value;
            });
          },
        },
      },
      studio: {
        document: {
          load: (doc) =>
            set((store) => {
              store.state.studio.isDocumentLoaded = true;
              store.state.studio.document = doc;
              console.log(doc);
            }),
          unload: () =>
            set((store) => {
              store.state.studio.document = unloadedDoc;
              store.state.studio.isDocumentLoaded = false;
            }),
        },
        layoutImageMapping: {
          addLayoutMap: () =>
            set((store) => {
              if (store.state.studio.isLayoutConfigLoaded) {
                // Generate a random ID for the new layout map
                const randomId = Math.random().toString(36).substring(2, 10);

                // Create a new layout map with the random ID
                const newLayoutMap: LayoutMap = {
                  id: randomId,
                  layoutIds: [],
                  variables: [],
                };

                // Add the new layout map to the array
                store.state.studio.layoutImageMapping.push(newLayoutMap);
              } else {
                raiseError(
                  store,
                  new Error("For addLayoutMap layout config is not loaded"),
                );
              }
            }),
          addLayoutMapFromCopy: (mapId) =>
            set((store) => {
              if (store.state.studio.isLayoutConfigLoaded) {
                // Find the source layout map to copy
                const sourceLayoutMap =
                  store.state.studio.layoutImageMapping.find(
                    (map) => map.id === mapId,
                  );

                if (sourceLayoutMap) {
                  // Generate a random ID for the new layout map
                  const randomId = Math.random().toString(36).substring(2, 10);

                  // Create a deep copy of the source layout map
                  const newLayoutMap: LayoutMap = {
                    id: randomId,
                    layoutIds: [], // Empty layoutIds as required
                    variables: JSON.parse(
                      JSON.stringify(sourceLayoutMap.variables),
                    ), // Deep copy variables
                  };

                  // Add the new layout map to the array
                  store.state.studio.layoutImageMapping.push(newLayoutMap);
                } else {
                  raiseError(
                    store,
                    new Error(
                      "For addLayoutMapFromCopy source layout map not found",
                    ),
                  );
                }
              } else {
                raiseError(
                  store,
                  new Error(
                    "For addLayoutMapFromCopy layout config is not loaded",
                  ),
                );
              }
            }),
          deleteLayoutMap: (mapId) =>
            set((store) => {
              if (store.state.studio.isLayoutConfigLoaded) {
                const mapIndex =
                  store.state.studio.layoutImageMapping.findIndex(
                    (map) => map.id === mapId,
                  );

                if (mapIndex !== -1) {
                  // Remove the layout map at the found index
                  store.state.studio.layoutImageMapping.splice(mapIndex, 1);
                } else {
                  raiseError(
                    store,
                    new Error("For deleteLayoutMap layout map not found"),
                  );
                }
              } else {
                raiseError(
                  store,
                  new Error("For deleteLayoutMap layout config is not loaded"),
                );
              }
            }),
          setLayoutIds: ({ mapId: configId, layoutIds }) =>
            set((store) => {
              if (store.state.studio.isLayoutConfigLoaded) {
                const targetLayoutMap =
                  store.state.studio.layoutImageMapping.find(
                    (layout) => layout.id == configId,
                  );
                if (targetLayoutMap) {
                  targetLayoutMap.layoutIds = layoutIds;
                } else {
                  raiseError(
                    store,
                    new Error("For setLayoutIds targetLayoutMap not found"),
                  );
                }
              } else {
                raiseError(
                  store,
                  new Error("For setLayoutIds layout config is not loaded"),
                );
              }
            }),
          addTargetVariable: ({ mapId, targetVariable }) =>
            set((store) => {
              if (store.state.studio.isLayoutConfigLoaded) {
                const targetLayoutMapMap =
                  store.state.studio.layoutImageMapping.find(
                    (map) => map.id == mapId,
                  );
                if (targetLayoutMapMap) {
                  const targetVariableIndex =
                    targetLayoutMapMap.variables.findIndex(
                      (imgVar) => imgVar.id == targetVariable.id,
                    );

                  if (targetVariableIndex == -1) {
                    targetLayoutMapMap.variables.push(targetVariable);
                  } else {
                    targetLayoutMapMap.variables[targetVariableIndex] =
                      targetVariable;
                  }
                } else {
                  raiseError(
                    store,
                    new Error(
                      "For addTargetVariable targetLayoutMapMap not found",
                    ),
                  );
                }
              } else {
                raiseError(
                  store,
                  new Error(
                    "For addTargetVariable layout config is not loaded",
                  ),
                );
              }
            }),
          updateDependent: ({
            mapId,
            targetVariableId,
            dependentGroupIndex,
            dependent,
          }) =>
            set((store) => {
              if (store.state.studio.isLayoutConfigLoaded) {
                const targetLayoutMap =
                  store.state.studio.layoutImageMapping.find(
                    (layout) => layout.id == mapId,
                  );

                if (!targetLayoutMap) {
                  raiseError(
                    store,
                    new Error("For updateDependent targetLayoutMap not found"),
                  );
                  return;
                }

                const targetVariable = targetLayoutMap.variables.find(
                  (imgVar) => imgVar.id == targetVariableId,
                );

                if (!targetVariable) {
                  raiseError(
                    store,
                    new Error("For updateDependent targetVariable not found"),
                  );
                  return;
                }

                const dependentGroup =
                  targetVariable.dependentGroup[dependentGroupIndex];

                if (dependentGroup == undefined) {
                  raiseError(
                    store,
                    new Error("For updateDependent dependentGroup not found"),
                  );
                  return;
                }

                const dependentIndex = dependentGroup.dependents.findIndex(
                  (dep) => dep.variableId == dependent.variableId,
                );

                if (dependentIndex == -1) {
                  // Add new dependent if it doesn't exist
                  dependentGroup.dependents.push(dependent);
                } else {
                  // Update existing dependent
                  dependentGroup.dependents[dependentIndex] = dependent;
                }
              } else {
                raiseError(
                  store,
                  new Error("For updateDependent layout config is not loaded"),
                );
              }
            }),
          removeDependent: ({
            mapId,
            targetVariableId,
            dependentGroupIndex,
            dependent,
          }) =>
            set((store) => {
              if (store.state.studio.isLayoutConfigLoaded) {
                const targetLayoutMap =
                  store.state.studio.layoutImageMapping.find(
                    (layout) => layout.id == mapId,
                  );

                if (!targetLayoutMap) {
                  raiseError(
                    store,
                    new Error("For removeDependent targetLayoutMap not found"),
                  );
                  return;
                }

                const targetVariable = targetLayoutMap.variables.find(
                  (imgVar) => imgVar.id == targetVariableId,
                );

                if (!targetVariable) {
                  raiseError(
                    store,
                    new Error("For removeDependent targetVariable not found"),
                  );
                  return;
                }

                const dependentGroup =
                  targetVariable.dependentGroup[dependentGroupIndex];

                if (dependentGroup == undefined) {
                  raiseError(
                    store,
                    new Error("For removeDependent dependentGroup not found"),
                  );
                  return;
                }

                const dependentIndex = dependentGroup.dependents.findIndex(
                  (dep) => dep.variableId == dependent.variableId,
                );

                if (dependentIndex == -1) {
                  raiseError(
                    store,
                    new Error("For removeDependent dependent not found"),
                  );
                  return;
                }

                dependentGroup.dependents.splice(dependentIndex, 1);
              } else {
                raiseError(
                  store,
                  new Error("For removeDependent layout config is not loaded"),
                );
              }
            }),
          load: (configs: LayoutMap[]) =>
            set((store) => {
              if (!store.state.studio.isLayoutConfigLoaded) {
                store.state.studio.isLayoutConfigLoaded = true;
                store.state.studio.layoutImageMapping = configs;
              } else {
                raiseError(
                  store,
                  new Error("For load layout config is already loaded"),
                );
              }
            }),
          unload: () =>
            set((store) => {
              store.state.studio.layoutImageMapping = [];
              store.state.studio.isLayoutConfigLoaded = false;
            }),
          save: () => {
            const store = get();
            if (store.state.studio.isLayoutConfigLoaded) {
              saveLayoutConfigToJSON(store.state.studio.layoutImageMapping);
            } else {
              raiseError(
                store,
                new Error("For save layout config is not loaded"),
              );
            }
          },
          addDependentGroup: ({ mapId, targetVariableId, dependents }) =>
            set((store) => {
              if (store.state.studio.isLayoutConfigLoaded) {
                const targetLayoutMap =
                  store.state.studio.layoutImageMapping.find(
                    (map) => map.id == mapId,
                  );
                if (targetLayoutMap) {
                  const targetVariable = targetLayoutMap.variables.find(
                    (imgVar) => imgVar.id == targetVariableId,
                  );
                  if (targetVariable) {
                    targetVariable.dependentGroup.push({
                      dependents,
                      variableValue: [],
                    });
                  } else {
                    raiseError(
                      store,
                      new Error(
                        "For addDependentGroup targetVariable not found",
                      ),
                    );
                  }
                } else {
                  raiseError(
                    store,
                    new Error(
                      "For addDependentGroup targetLayoutMap not found",
                    ),
                  );
                }
              } else {
                raiseError(
                  store,
                  new Error(
                    "For addDependentGroup layout config is not loaded",
                  ),
                );
              }
            }),
          copyDependentGroup: ({ mapId, targetVariableId, groupIndex }) =>
            set((store) => {
              if (store.state.studio.isLayoutConfigLoaded) {
                const targetLayoutMap =
                  store.state.studio.layoutImageMapping.find(
                    (map) => map.id == mapId,
                  );
                if (targetLayoutMap) {
                  const targetVariable = targetLayoutMap.variables.find(
                    (imgVar) => imgVar.id == targetVariableId,
                  );
                  if (targetVariable) {
                    const dependentGroup =
                      targetVariable.dependentGroup[groupIndex];

                    if (dependentGroup == undefined) {
                      raiseError(
                        store,
                        new Error(
                          "For copyDependentGroup dependentGroup not found",
                        ),
                      );
                      return;
                    }

                    // Create a deep copy of the dependent group
                    const newDependentGroup = JSON.parse(
                      JSON.stringify(dependentGroup),
                    );

                    // Add the copied group to the target variable's dependentGroup array
                    targetVariable.dependentGroup.push(newDependentGroup);
                  } else {
                    raiseError(
                      store,
                      new Error(
                        "For copyDependentGroup targetVariable not found",
                      ),
                    );
                  }
                } else {
                  raiseError(
                    store,
                    new Error(
                      "For copyDependentGroup targetLayoutMap not found",
                    ),
                  );
                }
              } else {
                raiseError(
                  store,
                  new Error(
                    "For copyDependentGroup layout config is not loaded",
                  ),
                );
              }
            }),
          removeTargetVariable: ({ mapId, targetVariableId }) =>
            set((store) => {
              if (store.state.studio.isLayoutConfigLoaded) {
                const targetLayoutMap =
                  store.state.studio.layoutImageMapping.find(
                    (map) => map.id == mapId,
                  );
                if (targetLayoutMap) {
                  const targetVariableIndex =
                    targetLayoutMap.variables.findIndex(
                      (imgVar) => imgVar.id == targetVariableId,
                    );
                  if (targetVariableIndex !== -1) {
                    targetLayoutMap.variables.splice(targetVariableIndex, 1);
                  } else {
                    raiseError(
                      store,
                      new Error(
                        "For removeTargetVariable targetVariable not found",
                      ),
                    );
                  }
                } else {
                  raiseError(
                    store,
                    new Error(
                      "For removeTargetVariable targetLayoutMap not found",
                    ),
                  );
                }
              } else {
                raiseError(
                  store,
                  new Error(
                    "For removeTargetVariable layout config is not loaded",
                  ),
                );
              }
            }),
          swapTargetVariable: ({
            mapId,
            oldTargetVariableId,
            newTargetVariableId,
          }) => {
            const store = get();
            if (!store.state.studio.isLayoutConfigLoaded) {
              return Result.error(
                new VariableTypesDoNotMatchError(
                  "For swapTargetVariable layout config is not loaded",
                ),
              );
            }

            const targetLayoutMap = store.state.studio.layoutImageMapping.find(
              (map) => map.id == mapId,
            );

            if (!targetLayoutMap) {
              return Result.error(
                new VariableTypesDoNotMatchError(
                  "For swapTargetVariable targetLayoutMap not found",
                ),
              );
            }

            const oldTargetVariableIndex = targetLayoutMap.variables.findIndex(
              (imgVar) => imgVar.id == oldTargetVariableId,
            );

            if (oldTargetVariableIndex === -1) {
              return Result.error(
                new VariableTypesDoNotMatchError(
                  "For swapTargetVariable oldTargetVariable not found",
                ),
              );
            }

            set((store) => {
              const targetLayoutMap =
                store.state.studio.layoutImageMapping.find(
                  (map) => map.id == mapId,
                );

              if (targetLayoutMap) {
                const oldTargetVariableIndex =
                  targetLayoutMap.variables.findIndex(
                    (imgVar) => imgVar.id == oldTargetVariableId,
                  );

                if (oldTargetVariableIndex !== -1) {
                  // Get the old target variable with all its dependentGroups
                  const oldTargetVariable =
                    targetLayoutMap.variables[oldTargetVariableIndex];

                  // Create a new target variable with the new ID but keeping all dependentGroups
                  const newTargetVariable: TargetVariable = {
                    id: newTargetVariableId,
                    type: oldTargetVariable.type,
                    dependentGroup: [...oldTargetVariable.dependentGroup],
                  };

                  // Replace the old target variable with the new one
                  targetLayoutMap.variables[oldTargetVariableIndex] =
                    newTargetVariable;
                }
              }
            });

            return Result.ok(undefined);
          },
          removeDependentGroup: ({ mapId, targetVariableId, groupIndex }) =>
            set((store) => {
              if (store.state.studio.isLayoutConfigLoaded) {
                const targetLayoutMap =
                  store.state.studio.layoutImageMapping.find(
                    (map) => map.id == mapId,
                  );
                if (targetLayoutMap) {
                  const targetVariable = targetLayoutMap.variables.find(
                    (imgVar) => imgVar.id == targetVariableId,
                  );
                  if (targetVariable) {
                    targetVariable.dependentGroup.splice(groupIndex, 1);
                  } else {
                    raiseError(
                      store,
                      new Error(
                        "For removeDependentGroup targetVariable not found",
                      ),
                    );
                  }
                } else {
                  raiseError(
                    store,
                    new Error(
                      "For removeDependentGroup targetLayoutMap not found",
                    ),
                  );
                }
              } else {
                raiseError(
                  store,
                  new Error(
                    "For removeDependentGroup layout config is not loaded",
                  ),
                );
              }
            }),
          addVarValueToDependentGroup: ({
            mapId,
            targetVariableId,
            groupIndex,
            variableValue,
          }) =>
            set((store) => {
              if (store.state.studio.isLayoutConfigLoaded) {
                const targetLayoutMap =
                  store.state.studio.layoutImageMapping.find(
                    (map) => map.id == mapId,
                  );
                if (targetLayoutMap) {
                  const targetVariable = targetLayoutMap.variables.find(
                    (imgVar) => imgVar.id == targetVariableId,
                  );
                  if (targetVariable) {
                    const dependentGroup =
                      targetVariable.dependentGroup[groupIndex];

                    if (dependentGroup == undefined) {
                      raiseError(
                        store,
                        new Error(
                          "For addVarValueToDependentGroup dependentGroup not found",
                        ),
                      );
                      return;
                    }

                    // Add the variable value to the dependent group
                    dependentGroup.variableValue.push(variableValue);
                  } else {
                    raiseError(
                      store,
                      new Error(
                        "For addVarValueToDependentGroup targetVariable not found",
                      ),
                    );
                  }
                } else {
                  raiseError(
                    store,
                    new Error(
                      "For addVarValueToDependentGroup targetLayoutMap not found",
                    ),
                  );
                }
              } else {
                raiseError(
                  store,
                  new Error(
                    "For addVarValueToDependentGroup layout config is not loaded",
                  ),
                );
              }
            }),
          removeVarValueFromDependentGroup: ({
            mapId,
            targetVariableId,
            groupIndex,
            variableValueIndex,
          }) =>
            set((store) => {
              if (store.state.studio.isLayoutConfigLoaded) {
                const targetLayoutMap =
                  store.state.studio.layoutImageMapping.find(
                    (map) => map.id == mapId,
                  );
                if (targetLayoutMap) {
                  const targetVariable = targetLayoutMap.variables.find(
                    (imgVar) => imgVar.id == targetVariableId,
                  );
                  if (targetVariable) {
                    const dependentGroup =
                      targetVariable.dependentGroup[groupIndex];

                    if (dependentGroup == undefined) {
                      raiseError(
                        store,
                        new Error(
                          "For removeVarValueFromDependentGroup dependentGroup not found",
                        ),
                      );
                      return;
                    }

                    if (
                      variableValueIndex < 0 ||
                      variableValueIndex >= dependentGroup.variableValue.length
                    ) {
                      raiseError(
                        store,
                        new Error(
                          "For removeVarValueFromDependentGroup invalid variableValueIndex",
                        ),
                      );
                      return;
                    }

                    // Remove the variable value at the specified index
                    dependentGroup.variableValue.splice(variableValueIndex, 1);
                  } else {
                    raiseError(
                      store,
                      new Error(
                        "For removeVarValueFromDependentGroup targetVariable not found",
                      ),
                    );
                  }
                } else {
                  raiseError(
                    store,
                    new Error(
                      "For removeVarValueFromDependentGroup targetLayoutMap not found",
                    ),
                  );
                }
              } else {
                raiseError(
                  store,
                  new Error(
                    "For removeVarValueFromDependentGroup layout config is not loaded",
                  ),
                );
              }
            }),
          updateVarValueFromDependentGroup: ({
            mapId,
            targetVariableId,
            groupIndex,
            variableValueIndex,
            variableValue,
          }) =>
            set((store) => {
              if (store.state.studio.isLayoutConfigLoaded) {
                const targetLayoutMap =
                  store.state.studio.layoutImageMapping.find(
                    (map) => map.id == mapId,
                  );
                if (targetLayoutMap) {
                  const targetVariable = targetLayoutMap.variables.find(
                    (imgVar) => imgVar.id == targetVariableId,
                  );
                  if (targetVariable) {
                    const dependentGroup =
                      targetVariable.dependentGroup[groupIndex];

                    if (dependentGroup == undefined) {
                      raiseError(
                        store,
                        new Error(
                          "For updateVarValueFromDependentGroup dependentGroup not found",
                        ),
                      );
                      return;
                    }

                    if (
                      variableValueIndex < 0 ||
                      variableValueIndex >= dependentGroup.variableValue.length
                    ) {
                      raiseError(
                        store,
                        new Error(
                          "For updateVarValueFromDependentGroup invalid variableValueIndex",
                        ),
                      );
                      return;
                    }

                    // Update the variable value at the specified index
                    dependentGroup.variableValue[variableValueIndex] =
                      variableValue;
                  } else {
                    raiseError(
                      store,
                      new Error(
                        "For updateVarValueFromDependentGroup targetVariable not found",
                      ),
                    );
                  }
                } else {
                  raiseError(
                    store,
                    new Error(
                      "For updateVarValueFromDependentGroup targetLayoutMap not found",
                    ),
                  );
                }
              } else {
                raiseError(
                  store,
                  new Error(
                    "For updateVarValueFromDependentGroup layout config is not loaded",
                  ),
                );
              }
            }),
          setIndexOfVarValueFromDependentGroup: ({
            mapId,
            targetVariableId,
            groupIndex,
            oldVariableValueIndex,
            newVariableValueIndex,
          }) =>
            set((store) => {
              if (store.state.studio.isLayoutConfigLoaded) {
                const targetLayoutMap =
                  store.state.studio.layoutImageMapping.find(
                    (map) => map.id == mapId,
                  );
                if (targetLayoutMap) {
                  const targetVariable = targetLayoutMap.variables.find(
                    (imgVar) => imgVar.id == targetVariableId,
                  );
                  if (targetVariable) {
                    const dependentGroup =
                      targetVariable.dependentGroup[groupIndex];

                    if (dependentGroup == undefined) {
                      raiseError(
                        store,
                        new Error(
                          "For setIndexOfVarValueFromDependentGroup dependentGroup not found",
                        ),
                      );
                      return;
                    }

                    if (
                      oldVariableValueIndex < 0 ||
                      oldVariableValueIndex >=
                        dependentGroup.variableValue.length
                    ) {
                      raiseError(
                        store,
                        new Error(
                          "For setIndexOfVarValueFromDependentGroup invalid oldVariableValueIndex",
                        ),
                      );
                      return;
                    }

                    // Handle boundary conditions for newVariableValueIndex
                    let adjustedNewIndex = newVariableValueIndex;

                    // If newVariableValueIndex is less than 0, set it to 0
                    if (adjustedNewIndex < 0) {
                      adjustedNewIndex = 0;
                    }

                    // If newVariableValueIndex is greater than the length, set it to the last element
                    if (
                      adjustedNewIndex >= dependentGroup.variableValue.length
                    ) {
                      adjustedNewIndex =
                        dependentGroup.variableValue.length - 1;
                    }

                    // Move the variable value from the old index to the new index
                    const [movedItem] = dependentGroup.variableValue.splice(
                      oldVariableValueIndex,
                      1,
                    );
                    dependentGroup.variableValue.splice(
                      adjustedNewIndex,
                      0,
                      movedItem,
                    );
                  } else {
                    raiseError(
                      store,
                      new Error(
                        "For setIndexOfVarValueFromDependentGroup targetVariable not found",
                      ),
                    );
                  }
                } else {
                  raiseError(
                    store,
                    new Error(
                      "For setIndexOfVarValueFromDependentGroup targetLayoutMap not found",
                    ),
                  );
                }
              } else {
                raiseError(
                  store,
                  new Error(
                    "For setIndexOfVarValueFromDependentGroup layout config is not loaded",
                  ),
                );
              }
            }),
        },
      },
    },
    errors: [],
    showToolbar: () =>
      set((state) => {
        state.state.isToolbarVisible = true;
      }),
    hideToolbar: () =>
      set((state) => {
        state.state.isToolbarVisible = false;
      }),
    enableToolbar: () =>
      set((state) => {
        console.log("ENABLE TOOLBAR");
        state.state.isToolbarEnabled = true;
      }),
    disableToolbar: () =>
      set((state) => {
        console.log("DISABLE TOOLBAR");
        state.state.isToolbarEnabled = false;
      }),
    raiseError: (error) => {
      if ((error as ResultType<any, Error>).isResult != null) {
        (error as ResultType<any, Error>).onFailure((error) =>
          set((state) => raiseError(state, error)),
        );
      } else {
        set((state) => raiseError(state, error as Error));
      }
    },
    dismissAlert: (id) =>
      set((state) => {
        state.alerts = state.alerts.filter((alert) => alert.id !== id);
      }),
  })),
);

appStore.subscribe((state, oldState) =>
  console.log("state", state, "oldState", oldState),
);

function raiseError(store: WritableDraft<AppStore>, error: Error) {
  // Generate a random ID for the alert
  const alertId = Math.random().toString(36).substring(2, 15);

  // Create an Alert object with the ID and error message
  const alert: Alert = {
    id: alertId,
    message: error.message,
  };

  // Push the alert into the alerts array
  store.alerts.push(alert);

  // Keep the existing functionality
  store.errors.push({ error, state: store });
  console.error(error);
}

function mockDocData() {
  return {
    layouts: [
      {
        name: "Parent",
        id: "0",
      },

      {
        name: "Push",
        id: "1",
        parentId: "0",
      },
      {
        name: "Pull",
        id: "6",
        parentId: "0",
      },
    ],
    variables: [
      // 3 image variables
      {
        id: "img1",
        type: "image",
        isVisiblie: true,
        name: "Header Logo",
        value: "https://example.com/images/logo.png",
      },
      {
        id: "img2",
        type: "image",
        isVisiblie: true,
        name: "Profile Picture",
        value: "https://example.com/images/profile.jpg",
      },
      {
        id: "img3",
        type: "image",
        isVisiblie: true,
        name: "Background Image",
        value: "https://example.com/images/background.jpg",
      },

      // 2 list variables
      {
        id: "list1",
        type: "list",
        isVisiblie: true,
        name: "Country Selection",
        value: "United States",
        items: [
          { value: "us", displayValue: "United States" },
          { value: "ca", displayValue: "Canada" },
          { value: "uk", displayValue: "United Kingdom" },
          { value: "au", displayValue: "Australia" },
          { value: "de", displayValue: "Germany" },
        ],
      },
      {
        id: "list2",
        type: "list",
        isVisiblie: true,
        name: "Document Categories",
        value: "financial",
        items: [
          { value: "financial", displayValue: "Financial Documents" },
          { value: "legal", displayValue: "Legal Documents" },
          { value: "medical", displayValue: "Medical Records" },
          { value: "educational", displayValue: "Educational Documents" },
        ],
      },

      // 3 shortText variables (1 requested + 2 additional to reach 8 total)
      {
        id: "text1",
        type: "shortText",
        isVisiblie: true,
        name: "Document Title",
        value: "Quarterly Financial Report",
      },
      {
        id: "text2",
        type: "shortText",
        isVisiblie: true,
        name: "Author Name",
        value: "Jane Doe",
      },
      {
        id: "text3",
        type: "shortText",
        isVisiblie: true,
        name: "Department",
        value: "Finance",
      },

      // 1 boolean
      {
        id: "bool1",
        type: "boolean",
        isVisiblie: true,
        name: "For Sale",
        value: true,
      },
    ],
  } as Doc;
}
