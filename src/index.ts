import { createRoot, type Root } from "react-dom/client";
import { appStore } from "./core/appStore/store.ts";
import type { default as SDKType } from "@chili-publish/studio-sdk";
import "@mantine/core/styles.css";
import { MantineProvider, createTheme } from "@mantine/core";
import { parseConfig, type Config } from "./core/configType.ts";
import { Result } from "typescript-result";
import { createElement, Fragment } from "react";
import { enableMapSet } from "immer";
import { getStudio, type SDKExtended } from "./studio/studioAdapter.ts";
import { Toolbar } from "./core/toolbar/Toolbar.ts";
import { setEnableActions } from "./studio/actionHandler.ts";

// Allow immer to use Map and Set
enableMapSet();

// Create a theme for Mantine
const theme = createTheme({
  primaryColor: "blue",
  defaultRadius: "sm",
  colors: {
    // Add custom colors if needed
  },
});

declare global {
  interface Window {
    toolbarInstance?: Root;
    SDK: SDKType;
    studioToolbar: {
      getToolbarStore: () => void;
      raiseToolbarAlert: (message: string) => void;
    };
  }
}

window.studioToolbar = {
  getToolbarStore: () => console.log(appStore.getState()),
  raiseToolbarAlert: (message: string) => {
    appStore.getState().actions.alerts.raiseAlert(new Error(message));
  }
};

async function initToolbar(studio: SDKExtended, config: Config) {
  console.log("Rendering toolbar...");

  // Create toolbar container if it doesn't exist
  if (!window.toolbarInstance) {
    const toolbarContainer = document.createElement("div");
    toolbarContainer.id = "toolbar-container";
    document.body.appendChild(toolbarContainer);

    window.toolbarInstance = createRoot(toolbarContainer);

    // Render the toolbar
    window.toolbarInstance.render(
      createElement(
        MantineProvider,
        { theme },
        createElement(Fragment, {}, [
          createElement(Toolbar, { config }),
        ])
      )
    );
  }
}

async function waitForSDK(
  maxAttempts = 50,
  delay = 200
): Promise<Result<SDKExtended, Error>> {
  let attempts = 0;
  while (attempts < maxAttempts) {
    const studioResult = await getStudio();

    if (studioResult.isOk()) {
      return studioResult;
    }

    console.log(
      `Studio not found, retrying in ${delay}ms... (attempt ${
        attempts + 1
      }/${maxAttempts})`
    );

    await new Promise((resolve) => setTimeout(resolve, delay));

    // delay = Math.min(delay * backoffFactor, 2000);
    attempts++;
  }

  return Result.error(
    new Error(`Failed to get Studio after ${maxAttempts} attempts`)
  );
}

async function waitForStudioReady(
  studio: SDKExtended,
  timeout = 25000
): Promise<Result<SDKExtended, Error>> {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(
        Result.error(
          new Error(`Studio not ready after ${timeout / 1000} seconds`)
        )
      );
    }, timeout);
    studio.config.events.onParagraphStylesChanged.registerCallback(() => {
      resolve(Result.ok(studio));
    });
  });
}

// Send message to content.js so it can get the version and config
window.postMessage({ type: "TOOLBAR_READY_TO_LOAD" });

// Listen for message from content.js with the version and config
window.addEventListener("message", (event) => {
  if (event.data.type === "LOAD_TOOLBAR") {
    console.log("Received message to load toolbar");

    parseConfig(event.data.payload.config).fold(
      async (config) => {
        const sdkResult = await waitForSDK();
        const studioReadyResult = await sdkResult.map(async (studio) => {
          return await waitForStudioReady(studio);
        });
        studioReadyResult.fold(
          (studio) => {
            if (window.toolbarInstance) {
              return;
            }
            console.log("Studio found, initializing toolbar");
            initToolbar(studio, config);
            setEnableActions(studio, config.setEnableActions);
          },
          (error) => {
            console.error("Failed to get Studio:", error);
            throw error;
          }
        );
      },
      (error) => {
        console.error("Invalid config, not loading toolbar", error);
        throw error;
      }
    );
  }
});
