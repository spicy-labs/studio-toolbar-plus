import type { WritableDraft } from "immer";
import type { AppStore } from "./store";

export type Store = {
  state: {
    [appName: string]: Record<string, any>;
  };
  actions: {
    [appName: string]: Record<string, (...args: any[]) => void>;
  };
};

export type Set = (
  nextStateOrUpdater:
    | AppStore
    | Partial<AppStore>
    | ((state: WritableDraft<AppStore>) => void),
  shouldReplace?: false,
) => void;

export type Get = () => AppStore;
