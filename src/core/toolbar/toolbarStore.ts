import type { Config } from "../configType";
import type { Set, Get, Store } from "../appStore/storeTypes";

type ToolbarState = {
  isToolbarVisible: boolean;
  isToolbarDisabled: boolean;
  config: Config | null;
};

type ToolbarActions = {
  setConfig: (config: Config) => void;
  setToolbarVisible: (isVisible: boolean) => void;
  setToolbarDisabled: (isDisabled: boolean) => void;
};

export type ToolbarStore = {
  state: {
    toolbar: ToolbarState;
  };
  actions: {
    toolbar: ToolbarActions;
  };
};

export function initToolbarStore<T extends Store>(
  set: Set,
  get: Get,
  store: T,
): T & ToolbarStore {
  if ("toolbar" in store.state && "toolbar" in store.actions) {
    return store as T & ToolbarStore;
  }

  const updatedStore = {
    state: {
      ...store.state,
      toolbar: initToolbarState(),
    },
    actions: {
      ...store.actions,
      toolbar: initToolbarActions(set, get),
    },
  };

  return updatedStore as T & ToolbarStore;
}

function initToolbarState(): ToolbarState {
  return {
    isToolbarVisible: false,
    isToolbarDisabled: false,
    config: null,
  };
}

function initToolbarActions(set: Set, get: Get): ToolbarActions {
  return {
    setConfig: (config) =>
      set((store) => {
        store.state.toolbar.config = config;
      }),
    setToolbarVisible: (isVisible) =>
      set((store) => {
        store.state.toolbar.isToolbarVisible = isVisible;
      }),
    setToolbarDisabled: (isDisabled) =>
      set((store) => {
        store.state.toolbar.isToolbarDisabled = isDisabled;
      }),
  };
}
