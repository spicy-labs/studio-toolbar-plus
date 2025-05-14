import {
  Button,
  Group,
  Modal,
  Stack,
  Text,
  type TextFactory,
  type TextProps,
} from "@mantine/core";
import { IconCircleX, IconExternalLink } from "@tabler/icons-react";
import { createElement, useEffect, type ReactNode } from "react";
import { appStore } from "../../core/appStore/store";
import { type VersionCheckState } from "./updateStore";
import { type Config } from "../../core/configType";

export function UpdateNotice({}): ReactNode {
  const isUpdateModalOpen = appStore((store) => store.state.update.isModalOpen);
  const versionCheckState = appStore(
    (store) => store.state.update.versionCheckState
  );
  const config = appStore((store) => store.state.toolbar.config);

  if (!config) {
    return createElement("div");
  }

  const {
    setIsUpdateModalOpen,
    handleDismissUpdate,
    fetchChangelogContent: checkForChangelog,
    fetchUpdateStatus: checkForUpdate,
  } = appStore.getState().actions.update;

  useEffect(() => {
    switch (versionCheckState.state) {
      case "not_checked":
        checkForUpdate();
        break;
      case "available":
        checkForChangelog();
        break;
      case "available_with_changelog":
        setIsUpdateModalOpen(true);
        break;
      default:
        break;
    }
  }, [versionCheckState]);

  return createElement(
    Modal,
    {
      opened: isUpdateModalOpen,
      onClose: () => setIsUpdateModalOpen(false),
      title: "Update Available",
      centered: true,
      trapFocus: false,
    },
    createElement(
      Stack,
      {},
      // Text about new version
      createElement(Text<"p">, {
        children: "A new version of Studio Toolbar Plus is available!",
      }),
      // Version information
      createElement(
        Text<"p">,
        {
          size: "sm",
        },
        [
          `Current version: ${config.currentVersion}`,
          createElement("br"),
          `Latest version: ${
            versionCheckState.state === "available_with_changelog" ||
            versionCheckState.state === "available"
              ? versionCheckState.version
              : "ERROR"
          }`,
        ]
      ),
      ...createBodyChildrenNodes(versionCheckState, handleDismissUpdate, config)
    )
  );
}

function createBodyChildrenNodes(
  versionCheckState: VersionCheckState,
  handleDismissUpdate: () => void,
  config: Config
): ReactNode[] {
  const nodes = [];

  if (versionCheckState.state === "available_with_changelog") {
    nodes.push(
      createElement(Text<"div">, {
        style: {
          whiteSpace: "pre-wrap",
          maxHeight: "300px",
          overflowY: "auto",
        },
        children: versionCheckState.changelog,
      })
    );
  }

  nodes.push(
    createElement(
      Group,
      { justify: "space-between", mt: "md" },
      createElement(Button<"button">, {
        onClick: handleDismissUpdate,
        leftSection: createElement(IconCircleX, { size: 16 }),
        variant: "subtle",
        color: "gray",
        children: "Dismiss",
      }),
      createElement(Button<"a">, {
        component: "a",
        href: config.urls.updateDownloadUrl,
        target: "_blank",
        rightSection: createElement(IconExternalLink, { size: 16 }),
        color: "blue",
        children: "Download Update",
      })
    )
  );

  return nodes;
}

export default UpdateNotice;
