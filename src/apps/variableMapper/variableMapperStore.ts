import type { Set, Get, Store } from "../../core/appStore/storeTypes";

type VariableMapperState = {
  isModalOpen: boolean;
};

type VariableMapperActions = {
  setIsVariableMapperModalOpen: (isOpen: boolean) => void;
};

export type VariableMapperStore = {
  state: {
    variableMapper: VariableMapperState;
  };
  actions: {
    variableMapper: VariableMapperActions;
  };
};

export function initVariableMapperStore<T extends Store>(
  set: Set,
  get: Get,
  store: T
): T & VariableMapperStore {
  if ("variableMapper" in store.state && "variableMapper" in store.actions) {
    return store as T & VariableMapperStore;
  }

  const updatedStore = {
    state: {
      ...store.state,
      variableMapper: initVariableMapperState(),
    },
    actions: {
      ...store.actions,
      variableMapper: initVariableMapperActions(set, get),
    },
  };

  return updatedStore as T & VariableMapperStore;
}

function initVariableMapperState(): VariableMapperState {
  return {
    isModalOpen: false,
  };
}

function initVariableMapperActions(set: Set, get: Get): VariableMapperActions {
  return {
    setIsVariableMapperModalOpen: (isOpen) =>
      set((store) => {
        store.state.variableMapper.isModalOpen = isOpen;
      }),
  };
}
