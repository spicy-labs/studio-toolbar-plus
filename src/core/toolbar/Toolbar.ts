import { useEffect, createElement, type ReactNode } from "react";
import type { Config } from "../configType";
import { Result } from "typescript-result";
import UpdateNotice from "../../apps/update/UpdateNotice";
import { appStore } from "../appStore/store";

type ToolarProps = {
  config: Config;
};

export function Toolbar({ config }: ToolarProps): ReactNode {

  const configState = appStore((store) => store.state.toolbar.config);

  useEffect(() => {
    appStore.getState().actions.toolbar.setConfig(config);
  }, []);

  if (!configState) {
    return createElement("div", {}, "Loading...");
  }
  else {
    return createElement(UpdateNotice);
  }
}



async function getChangelog() {
  return Result.try(async () => {
    const changelogResp = await fetch(
    "https://raw.githubusercontent.com/spicy-labs/studio-toolbar-plus/refs/heads/main/CHANGELOG.md"
  );

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

function parseChangelogToReactNode(changelogText: string, targetVersion: string): ReactNode {
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
