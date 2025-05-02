import { createRoot, type Root } from "react-dom/client";
import { appStore } from "./modalStore";
import type { default as SDKType } from "@chili-publish/studio-sdk";
import "@mantine/core/styles.css";
import { MantineProvider, createTheme } from "@mantine/core";
import { Toolbar } from "./components/Toolbar.tsx";
import { AlertsContainer } from "./components/AlertsContainer.tsx";
import { setEnableActions } from "./studio/actionHandler.ts";
import { getStudio, type SDKExtended } from "./studio/studioAdapter.ts";
import { parseConfig, type Config } from "./types/configType.ts";

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
window.test = () => console.log(appStore.getState());

// Define the exportCSV function z
const handleExportCSV = () => {
  console.log("Exporting CSV...");
  // Implementation will come later
};

async function initToolbar(studio: SDKExtended, config: Config) {
  console.log("Rendering toolbar...");

  // Create toolbar container if it doesn't exist
  if (!window.toolbarInstance) {
    const toolbarContainer = document.createElement("div");
    toolbarContainer.id = "toolbar-container";
    document.body.appendChild(toolbarContainer);

    window.toolbarInstance = createRoot(toolbarContainer);
  }

  // Render the toolbar
  window.toolbarInstance.render(
      <MantineProvider>
        <Toolbar />
        <AlertsContainer />
      </MantineProvider>
  );
}

async function checkStudioExist(callback: (studio: SDKExtended) => void) {
  const studioResult = await getStudio();
  studioResult.fold(
    (studio) => {
      studio.config.events.onParagraphStylesChanged.registerCallback(() =>
        callback(studio)
      );
    },
    () => {
      console.log("Studio not found, retrying in 200ms...");
      setTimeout(() => {
        checkStudioExist(callback);
      }, 200);
    }
  );
}

window.postMessage({ type: "TOOLBAR_READY_TO_LOAD" });

window.addEventListener("message", (event) => {
  if (event.data.type === "LOAD_TOOLBAR") {
    console.log("Received message to load toolbar");

    parseConfig(event.data.payload).fold(
      (config) =>
        checkStudioExist((studio) => {
          if (!studio.customToolbarLoaded) {
            studio.customToolbarLoaded = true;
            initToolbar(studio,config);
            setEnableActions(studio, config.setEnableActions);
          }
        }),
      (error) => {
        console.log("Invalid config, not loading toolbar");
        throw error;
      }
    );
  }
});
