import { createRoot, type Root } from "react-dom/client";
import { appStore } from "./core/appStore/store.ts";
import type { default as SDKType } from "@chili-publish/studio-sdk";
import "@mantine/core/styles.css";
import { MantineProvider, createTheme } from "@mantine/core";
import { Toolbar } from "./core/toolbar/Toolbar.ts";
import { AlertsContainer } from "./components/AlertsContainer.tsx";
import { setEnableActions } from "./studio/actionHandler.ts";
import { getStudio, type SDKExtended } from "./studio/studioAdapter.ts";
import { parseConfig, type Config } from "./core/configType.ts";
import { Result } from "typescript-result";
import { createElement } from "react";

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
  }
}

//@ts-ignore
window.getToolbarStore = () => console.log(appStore.getState());

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
      createElement(MantineProvider, 
        createElement(Toolbar, { config })
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
        Result.error(new Error(`Studio not ready after ${timeout/1000} seconds`))
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
