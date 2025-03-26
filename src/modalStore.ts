// modalStore.ts
import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import {
  type LayoutMap,
  type ImageVariable,
  type DependentVar,
  type Variable,
} from "./types/layoutConfigTypes";
import { Result, type Result as ResultType } from "typescript-result";
import { type Doc } from "./types/docStateTypes";
import type { WritableDraft } from "immer";

type LayoutImageMappingModalState = {
  isModalVisible: boolean;
  dependentModal: {
    isOpen: boolean;
    currentGroupIndex: number | null;
    currentImageVariableId: string | null;
    currentSelectedVariables: string[];
  };
  currentAddImageMappingSelectedVariables: string[];
  isAddImageVariableMappingModalOpen: boolean;
  currentSelectedMapId: string | null;
};

type LayoutImageMappingModalEffects = {
  showModal: () => void;
  hideModal: () => void;
  dependentModal: {
    setIsOpen: (value: boolean) => void;
    setCurrentGroupIndex: (value: number | null) => void;
    setCurrentImageVariableId: (id: string) => void;
    setCurrentSelectedVariables: (value: string[]) => void;
  };
  setIsImageVariableMappingModalOpen: (value: boolean) => void;
  setCurrentAddImageMappingSelectedVariables: (value: string[]) => void;
  setCurrentSelectedMapId: (value: string) => void;
};

type StudioState = {
  document: Doc;
  isDocumentLoaded: boolean;
  layoutImageMapping: LayoutMap[];
  isLayoutConfigLoaded: boolean;
};

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
    addImageVariable: (data: {
      mapId: string;
      imageVariable: ImageVariable;
    }) => void;
    removeImageVariable: (data: {
      mapId: string;
      imageVariableId: string;
    }) => void;
    updateDependent: (data: {
      mapId: string;
      imageVariableId: string;
      dependentGroupIndex: number;
      dependent: DependentVar;
    }) => void;
    removeDependent: (data: {
      mapId: string;
      imageVariableId: string;
      dependentGroupIndex: number;
      dependent: DependentVar;
    }) => void;
    addDependentGroup: (data: {
      mapId: string;
      imageVariableId: string;
      dependents: DependentVar[];
    }) => void;
    copyDependentGroup: (data: {
      mapId: string;
      imageVariableId: string;
      groupIndex: number;
    }) => void;
    removeDependentGroup: (data: {
      mapId: string;
      imageVariableId: string;
      groupIndex: number;
    }) => void;
    addVarValueToDependentGroup: (data: {
      mapId: string;
      imageVariableId: string;
      groupIndex: number;
      variableValue: string | Variable;
    }) => void;
    removeVarValueFromDependentGroup: (data: {
      mapId: string;
      imageVariableId: string;
      groupIndex: number;
      variableValueIndex: number;
    }) => void;
    updateVarValueFromDependentGroup: (data: {
      mapId: string;
      imageVariableId: string;
      groupIndex: number;
      variableValueIndex: number;
      variableValue: string | Variable;
    }) => void;
    setIndexOfVarValueFromDependentGroup: (data: {
      mapId: string;
      imageVariableId: string;
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
        isAddImageVariableMappingModalOpen: false,
        currentAddImageMappingSelectedVariables: [],
        isModalVisible: false,
        currentSelectedMapId: null,
        dependentModal: {
          isOpen: false,
          currentImageVariableId: null,
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
        setIsImageVariableMappingModalOpen: (value) =>
          set((store) => {
            store.state.modal.isAddImageVariableMappingModalOpen = value;
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
        dependentModal: {
          setIsOpen: (value) => {
            set((store) => {
              store.state.modal.dependentModal.isOpen = value;
            });
          },
          setCurrentImageVariableId: (id) => {
            set((store) => {
              store.state.modal.dependentModal.currentImageVariableId = id;
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
          addImageVariable: ({ mapId, imageVariable }) =>
            set((store) => {
              if (store.state.studio.isLayoutConfigLoaded) {
                const targetLayoutMapMap =
                  store.state.studio.layoutImageMapping.find(
                    (map) => map.id == mapId,
                  );
                if (targetLayoutMapMap) {
                  const imageVariableIndex =
                    targetLayoutMapMap.variables.findIndex(
                      (imgVar) => imgVar.id == imageVariable.id,
                    );

                  if (imageVariableIndex == -1) {
                    targetLayoutMapMap.variables.push(imageVariable);
                  } else {
                    targetLayoutMapMap.variables[imageVariableIndex] =
                      imageVariable;
                  }
                } else {
                  raiseError(
                    store,
                    new Error(
                      "For addImageVariable targetLayoutMapMap not found",
                    ),
                  );
                }
              } else {
                raiseError(
                  store,
                  new Error("For addImageVariable layout config is not loaded"),
                );
              }
            }),
          updateDependent: ({
            mapId,
            imageVariableId,
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

                const imageVariable = targetLayoutMap.variables.find(
                  (imgVar) => imgVar.id == imageVariableId,
                );

                if (!imageVariable) {
                  raiseError(
                    store,
                    new Error("For updateDependent imageVariable not found"),
                  );
                  return;
                }

                const dependentGroup =
                  imageVariable.dependentGroup[dependentGroupIndex];

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
            imageVariableId,
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

                const imageVariable = targetLayoutMap.variables.find(
                  (imgVar) => imgVar.id == imageVariableId,
                );

                if (!imageVariable) {
                  raiseError(
                    store,
                    new Error("For removeDependent imageVariable not found"),
                  );
                  return;
                }

                const dependentGroup =
                  imageVariable.dependentGroup[dependentGroupIndex];

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
          addDependentGroup: ({ mapId, imageVariableId, dependents }) =>
            set((store) => {
              if (store.state.studio.isLayoutConfigLoaded) {
                const targetLayoutMap =
                  store.state.studio.layoutImageMapping.find(
                    (map) => map.id == mapId,
                  );
                if (targetLayoutMap) {
                  const imageVariable = targetLayoutMap.variables.find(
                    (imgVar) => imgVar.id == imageVariableId,
                  );
                  if (imageVariable) {
                    imageVariable.dependentGroup.push({
                      dependents,
                      variableValue: [],
                    });
                  } else {
                    raiseError(
                      store,
                      new Error(
                        "For addDependentGroup imageVariable not found",
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
          copyDependentGroup: ({ mapId, imageVariableId, groupIndex }) =>
            set((store) => {
              if (store.state.studio.isLayoutConfigLoaded) {
                const targetLayoutMap =
                  store.state.studio.layoutImageMapping.find(
                    (map) => map.id == mapId,
                  );
                if (targetLayoutMap) {
                  const imageVariable = targetLayoutMap.variables.find(
                    (imgVar) => imgVar.id == imageVariableId,
                  );
                  if (imageVariable) {
                    const dependentGroup =
                      imageVariable.dependentGroup[groupIndex];

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
                      JSON.stringify(dependentGroup)
                    );

                    // Add the copied group to the image variable's dependentGroup array
                    imageVariable.dependentGroup.push(newDependentGroup);
                  } else {
                    raiseError(
                      store,
                      new Error(
                        "For copyDependentGroup imageVariable not found",
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
          removeImageVariable: ({ mapId, imageVariableId }) =>
            set((store) => {
              if (store.state.studio.isLayoutConfigLoaded) {
                const targetLayoutMap =
                  store.state.studio.layoutImageMapping.find(
                    (map) => map.id == mapId,
                  );
                if (targetLayoutMap) {
                  const imageVariableIndex =
                    targetLayoutMap.variables.findIndex(
                      (imgVar) => imgVar.id == imageVariableId,
                    );
                  if (imageVariableIndex !== -1) {
                    targetLayoutMap.variables.splice(imageVariableIndex, 1);
                  } else {
                    raiseError(
                      store,
                      new Error(
                        "For removeImageVariable imageVariable not found",
                      ),
                    );
                  }
                } else {
                  raiseError(
                    store,
                    new Error(
                      "For removeImageVariable targetLayoutMap not found",
                    ),
                  );
                }
              } else {
                raiseError(
                  store,
                  new Error(
                    "For removeImageVariable layout config is not loaded",
                  ),
                );
              }
            }),
          removeDependentGroup: ({ mapId, imageVariableId, groupIndex }) =>
            set((store) => {
              if (store.state.studio.isLayoutConfigLoaded) {
                const targetLayoutMap =
                  store.state.studio.layoutImageMapping.find(
                    (map) => map.id == mapId,
                  );
                if (targetLayoutMap) {
                  const imageVariable = targetLayoutMap.variables.find(
                    (imgVar) => imgVar.id == imageVariableId,
                  );
                  if (imageVariable) {
                    imageVariable.dependentGroup.splice(groupIndex, 1);
                  } else {
                    raiseError(
                      store,
                      new Error(
                        "For removeDependentGroup imageVariable not found",
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
            imageVariableId,
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
                  const imageVariable = targetLayoutMap.variables.find(
                    (imgVar) => imgVar.id == imageVariableId,
                  );
                  if (imageVariable) {
                    const dependentGroup =
                      imageVariable.dependentGroup[groupIndex];

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
                        "For addVarValueToDependentGroup imageVariable not found",
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
            imageVariableId,
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
                  const imageVariable = targetLayoutMap.variables.find(
                    (imgVar) => imgVar.id == imageVariableId,
                  );
                  if (imageVariable) {
                    const dependentGroup =
                      imageVariable.dependentGroup[groupIndex];

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
                        "For removeVarValueFromDependentGroup imageVariable not found",
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
            imageVariableId,
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
                  const imageVariable = targetLayoutMap.variables.find(
                    (imgVar) => imgVar.id == imageVariableId,
                  );
                  if (imageVariable) {
                    const dependentGroup =
                      imageVariable.dependentGroup[groupIndex];

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
                        "For updateVarValueFromDependentGroup imageVariable not found",
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
            imageVariableId,
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
                  const imageVariable = targetLayoutMap.variables.find(
                    (imgVar) => imgVar.id == imageVariableId,
                  );
                  if (imageVariable) {
                    const dependentGroup =
                      imageVariable.dependentGroup[groupIndex];

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
                        "For setIndexOfVarValueFromDependentGroup imageVariable not found",
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
        state.state.isToolbarEnabled = true;
      }),
    disableToolbar: () =>
      set((state) => {
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
