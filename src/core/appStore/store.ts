import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import {
  initUpdateStore,
  type UpdateStore,
} from "../../apps/update/updateStore";
import { initToolbarStore, type ToolbarStore } from "../toolbar/toolbarStore";
import { initAlertsStore, type AlertsStore } from "../alerts/alertsStore";
import type { Store } from "./storeTypes";

export type AppStore = Store & UpdateStore & ToolbarStore & AlertsStore;

export const appStore = create<AppStore>()(
  immer((set, get) =>
    initAlertsStore(
      set,
      get,
      initUpdateStore(
        set,
        get,
        initToolbarStore(set, get, { state: {}, actions: {} })
      )
    )
  )
);
