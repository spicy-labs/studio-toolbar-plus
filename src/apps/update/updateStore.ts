import { Result } from "typescript-result";
import type { Set, Get, Store } from "../../core/appStore/storeTypes";
import type { Config } from "../../core/configType";

      const DISMISSED_LAST_NOTIFIED_VERSION_KEY = "toolbarplus_dismissed_last_notified_version";

type UpdateState = {
  isModalOpen: boolean;
  versionCheckState: VersionCheckState;
};

type UpdateActions = {
  setIsUpdateModalOpen: (isOpen: boolean) => void;
  handleDismissUpdate: () => void;
  checkForUpdate: () => void;
};

export type UpdateStore = {
  state: {
    update: UpdateState;
  };
  actions: {
    update: UpdateActions;
  };
};

type VersionCheckState =
  | NotChecked
  | CheckingForUpdate
  | UpdateNotAvailable
  | UpdateAvailable
  | ErrorState;

type NotChecked = {
  state: "not_checked";
};

type CheckingForUpdate = {
  state: "checking";
};

type UpdateNotAvailable = {
  state: "not_available";
};

type UpdateAvailable = {
  state: "available";
  version: string;
};

type ErrorState = {
  state: "error";
  error: Error | Result<never, Error>;
};

export function initUpdateStore<T extends Store>(
  set: Set,
  get: Get,
  store: T
): T & UpdateStore {
  if ("update" in store.state && "update" in store.actions) {
    return store as T & UpdateStore;
  }

  const updatedStore = {
    state: {
      ...store.state,
      update: initUpdateState(),
    },
    actions: {
      ...store.actions,
      update: initUpdateActions(set, get),
    },
  };

  return updatedStore as T & UpdateStore;
}

function initUpdateState(): UpdateState {
  return {
    isModalOpen: false,
    versionCheckState: { state: "not_checked" },
  };
}

function initUpdateActions(set: Set, get: Get): UpdateActions {
  return {
    setIsUpdateModalOpen: (isOpen) =>
      set((store) => {
        store.state.update.isModalOpen = isOpen;
      }),
    handleDismissUpdate: () => {
      const versionCheckState = get().state.update.versionCheckState;
      if (versionCheckState.state === "available") {
        // Add alert error as this could fail if environment doesn't support localStorage
        localStorage.setItem(
          DISMISSED_LAST_NOTIFIED_VERSION_KEY,
          versionCheckState.version
        );
      }
      set((store) => {
        store.state.update.isModalOpen = false;
      });
    },
    checkForUpdate: async () => {
      const config = get().state.toolbar.config;
      if (config) {
        set((store) => {
          store.state.update.versionCheckState = { state: "checking" };
        });
        const result = await checkAndGetUpdate(config);
        result.fold(
          ([updateAvailable, version]) => {
            if (updateAvailable) {
              set((store) => {
                store.state.update.versionCheckState = {
                  state: "available",
                  version,
                };
              });
            } else {
              set((store) => {
                store.state.update.versionCheckState = {
                  state: "not_available",
                };
              });
            }
          },
          (error) => {
            set((store) => {
              store.state.update.versionCheckState = {
                state: "error",
                error,
              };
            });
          }
        );
      } else {
        set((store) => {
          store.state.update.versionCheckState = {
            state: "error",
            error: new Error("Config not found"),
          };
        });
      }
    },
  };
}

async function checkAndGetUpdate(
  config: Config
): Promise<Result<[boolean, string], Error>> {
  return Result.try(async () => {
    const manifestResp = await fetch(config.updateCheckUrl);

    if (!manifestResp.ok) {
      return Result.error(
        new Error(
          `Failed to fetch manifest - status ${manifestResp.status}:${manifestResp.statusText}`
        )
      );
    }

    const dismissedLastNotifiedVersion = localStorage.getItem(
      DISMISSED_LAST_NOTIFIED_VERSION_KEY
    );

    // Maybe add a type for manifest.json
    const packageJson = await manifestResp.json();

    console.log("Package JSON:", packageJson);

    const githubVersion = packageJson.version;

    const [githubMajor, githubMinor, githubPatch] = githubVersion
      .split(".")
      .map((versionComponent: string) => Number.parseInt(versionComponent, 10));
    const [currentMajor, currentMinor, currentPatch] = config.currentVersion
      .split(".")
      .map((versionComponent: string) => Number.parseInt(versionComponent, 10));

    if (
      isNaN(githubMajor) ||
      isNaN(githubMinor) ||
      isNaN(githubPatch) ||
      isNaN(currentMajor) ||
      isNaN(currentMinor) ||
      isNaN(currentPatch)
    ) {
      return Result.error(new Error("Failed to parse version numbers"));
    }

    if (
      githubMajor > currentMajor ||
      (githubMajor === currentMajor && githubMinor > currentMinor) ||
      (githubMajor === currentMajor &&
        githubMinor === currentMinor &&
        githubPatch > currentPatch &&
        githubVersion !== dismissedLastNotifiedVersion)
    ) {
      return Result.ok([true, githubVersion]);
    }

    return Result.ok([false, githubVersion]);
  });
}
