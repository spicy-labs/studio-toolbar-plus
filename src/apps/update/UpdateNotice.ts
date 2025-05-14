import { createElement, useEffect, type ReactNode } from "react";
import {
  Modal,
  Text,
  Stack,
  Group,
  Button,
  type TextProps,
  type TextFactory,
} from "@mantine/core";
import { IconCircleX, IconExternalLink } from "@tabler/icons-react";
import { appStore } from "../../core/appStore/store";

export function UpdateNotice({}): ReactNode {
  const isUpdateModalOpen = appStore((store) => store.state.update.isModalOpen);
  const versionCheckState = appStore(
    (store) => store.state.update.versionCheckState
  );
  const config = appStore((store) => store.state.toolbar.config);

  if (!config) {
    return createElement("div");
  }

  const { setIsUpdateModalOpen, handleDismissUpdate, checkForUpdate } =
    appStore.getState().actions.update;

  useEffect(() => {
    switch (versionCheckState.state) {
      case "not_checked":
        checkForUpdate();
        break;
      case "available":
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
            versionCheckState.state === "available"
              ? versionCheckState.version
              : config.currentVersion
          }`,
        ]
      ),
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
          href: "https://github.com/spicy-labs/studio-toolbar-plus/",
          target: "_blank",
          rightSection: createElement(IconExternalLink, { size: 16 }),
          color: "blue",
          children: "Download Update",
        })
      )
    )
  );
}

export default UpdateNotice;
