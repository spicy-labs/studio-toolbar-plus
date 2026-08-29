import React from "react";
import { createRoot, type Root } from "react-dom/client";
import { appStore } from "./modalStore";
import type { default as SDKType } from "@chili-publish/studio-sdk";
import { LayoutImageMappingModal } from "./components/LayoutMappingModal/LayoutModal.tsx";
import "@mantine/core/styles.css";
import { MantineProvider, createTheme } from "@mantine/core";
import { LayoutMultiSelect } from "./components/LayoutMappingModal/LayoutMultiSelect.tsx";
import { Toolbar } from "./components/Toolbar.tsx";
import { AlertsContainer } from "./components/AlertsContainer.tsx";
import { setEnableActions } from "./studio/actionHandler.ts";
import { getStudio } from "./studio/studioAdapter.ts";
import { Result } from "typescript-result";
import { removeIntercom } from "./studio/utils.js";

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
    rootInstance?: Root;
    toolbarInstance?: Root;
    SDK: SDKType;
    customToolbarLoaded: boolean;
  }
}

//@ts-ignore
window.test = () => console.log(appStore.getState());

// Define the exportCSV function z
const handleExportCSV = () => {
  console.log("Exporting CSV...");
  // Implementation will come later
};

// Load toolbar settings from localStorage with defaults
function loadToolbarSettings() {
  const localConfig = localStorage.getItem("tempUserConfig");

  return Result.try(() => {
    if (localConfig) {
      return JSON.parse(localConfig);
    }
    return {};
  }).fold(
    (parsedConfig: any) => {
      return {
        enableActionsInDesignMode: parsedConfig.enableActionsInDesignMode
          ? true
          : false,
        removeIntercom: parsedConfig.removeIntercom ? true : false,
      };
    },
    () => {
      // If parsing failed, create new config with defaults
      const defaultConfig = {
        enableActionsInDesignMode: false,
        removeIntercom: false,
      };

      return defaultConfig;
    },
  );
}

async function renderToolbar(studio: SDKType) {
  // Load toolbar settings on startup
  const toolbarSettings = await loadToolbarSettings();

  if (toolbarSettings.enableActionsInDesignMode) {
    setEnableActions(studio, true);
  }

  if (toolbarSettings.removeIntercom) {
    removeIntercom();
  }

  console.log("Rendering toolbar...");
  // Create our modal root if it doesn't exist
  if (!window.rootInstance) {
    // Create div on body and use in it in the createRoot
    const modalContainer = document.createElement("div");
    modalContainer.id = "config-modal-root";
    document.body.appendChild(modalContainer);

    window.rootInstance = createRoot(modalContainer);
  }

  // Create toolbar container if it doesn't exist
  if (!window.toolbarInstance) {
    const toolbarContainer = document.createElement("div");
    toolbarContainer.id = "toolbar-container";
    document.body.appendChild(toolbarContainer);

    window.toolbarInstance = createRoot(toolbarContainer);
  }

  // Render the modal
  window.rootInstance.render(
    <React.StrictMode>
      <LayoutImageMappingModal onExportCSV={() => console.log("Look")} />
    </React.StrictMode>,
  );

  // Render the toolbar
  window.toolbarInstance.render(
    <React.StrictMode>
      <MantineProvider>
        <Toolbar />
        <AlertsContainer />
      </MantineProvider>
    </React.StrictMode>,
  );
}

async function checkStudioExist() {
  const studioResult = await getStudio();
  studioResult.fold(
    (studio) => {
      studio.config.events.onParagraphStylesChanged.registerCallback(() => {
        if (window.customToolbarLoaded == null) {
          console.log("Studio found, rendering toolbar...");
          window.customToolbarLoaded = true;
          renderToolbar(studio);
        }
      });
    },
    () => {
      console.log("Studio not found, retrying in 200ms...");
      setTimeout(() => {
        checkStudioExist();
      }, 200);
    },
  );
}

checkStudioExist();
