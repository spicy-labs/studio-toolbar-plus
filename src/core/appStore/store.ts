import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import {
  initUpdateStore,
  type UpdateStore,
} from "../../apps/update/updateStore";
import { initToolbarStore, type ToolbarStore } from "../toolbar/toolbarStore";
import type { Store } from "./storeTypes";

export type AppStore = Store & UpdateStore & ToolbarStore;

export const appStore = create<AppStore>()(
  immer((set, get) =>
    initUpdateStore(set, get, initToolbarStore(set, get, {state:{}, actions:{}}))
  )
);
