import { Result } from "typescript-result";
import type { Set, Get, Store } from "../../core/appStore/storeTypes";
import type { Config } from "../../core/configType";
import { createElement, type ReactNode } from "react";

const DISMISSED_LAST_NOTIFIED_VERSION_KEY =
  "toolbarplus_dismissed_last_notified_version";

type UpdateState = {
  isModalOpen: boolean;
  versionCheckState: VersionCheckState;
};

type UpdateActions = {
  setIsUpdateModalOpen: (isOpen: boolean) => void;
  handleDismissUpdate: () => void;
  fetchChangelogContent: () => void;
  fetchUpdateStatus: () => void;
};

export type UpdateStore = {
  state: {
    update: UpdateState;
  };
  actions: {
    update: UpdateActions;
  };
};

export type VersionCheckState =
  | NotChecked
  | CheckingForUpdate
  | UpdateNotAvailable
  | UpdateAvailable
  | UpdateAvailableWithChangelog
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

type UpdateAvailableWithChangelog = {
  state: "available_with_changelog";
  version: string;
  changelog: ReactNode;
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
    fetchChangelogContent: async () => {
      const config = get().state.toolbar.config;
      const versionCheckState = get().state.update.versionCheckState;
      if (config && versionCheckState.state === "available") {
        const changelogResult = await getChangelog(config);
        changelogResult.fold(
          (changelog) => {
            const parsedChangelog = parseChangelogToReactNode(
              changelog,
              versionCheckState.version
            );
            set((store) => {
              store.state.update.versionCheckState = {
                state: "available_with_changelog",
                version: versionCheckState.version,
                changelog: parsedChangelog,
              };
            });
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
      }
    },
    fetchUpdateStatus: async () => {
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
    const manifestResp = await fetch(config.urls.updateCheckUrl);

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

async function getChangelog(config: Config) {
  return Result.try(async () => {
    const changelogResp = await fetch(config.urls.changelogUrl);

    if (!changelogResp.ok) {
      return Result.error(
        new Error(
          `Failed to fetch changelog - status ${changelogResp.status}:${changelogResp.statusText}`
        )
      );
    }

    const changelog = await changelogResp.text();

    return Result.ok(changelog);
  });
}

function parseChangelogToReactNode(
  changelogText: string,
  targetVersion: string
): ReactNode {
  // Split the changelog into lines
  const lines = changelogText.split("\n");

  let currentVersion = null;
  let inTargetVersion = false;
  let elements: ReactNode[] = [];
  let listItems: ReactNode[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Check for version line (## X.X.X)
    if (line.startsWith("## ")) {
      // If we were in a list, close it
      if (listItems.length > 0) {
        elements.push(createElement("ul", {}, ...listItems));
        listItems = [];
      }

      // Get the version from the line
      currentVersion = line.substring(3).trim();

      // Check if this is the target version
      if (currentVersion === targetVersion) {
        inTargetVersion = true;
        elements.push(createElement("h2", {}, currentVersion));
      } else if (inTargetVersion) {
        // We've moved past our target version, stop processing
        break;
      }
    }
    // Only process lines if we're in the target version section
    else if (inTargetVersion) {
      if (line.startsWith("### ")) {
        // If we were in a list, close it
        if (listItems.length > 0) {
          elements.push(createElement("ul", {}, ...listItems));
          listItems = [];
        }

        // Convert subheadings (### Fixed)
        const heading = line.substring(4).trim();
        elements.push(createElement("h3", {}, heading));
      } else if (line.startsWith("- ")) {
        // Convert list items
        const listItem = line.substring(2).trim();
        listItems.push(createElement("li", {}, listItem));
      }
      // Handle empty lines between sections
      else if (listItems.length > 0 && line === "" && i < lines.length - 1) {
        const nextLine = lines[i + 1].trim();
        if (!nextLine.startsWith("- ")) {
          elements.push(createElement("ul", {}, ...listItems));
          listItems = [];
        }
      }
    }
  }

  // Close any open list
  if (listItems.length > 0) {
    elements.push(createElement("ul", {}, ...listItems));
  }

  return createElement("div", { className: "changelog" }, ...elements);
}
