import React from "react";
import { createRoot, type Root } from "react-dom/client";
import { ConfigModal } from "./components/Old/ConfigModal.tsx";
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
    customToolbar: () => void;
  }
}

//@ts-ignore
window.test = () => console.log(appStore.getState());

// Initialize the customToolbar function
window.customToolbar = () => {
  renderToolbar();
};

// Define the exportCSV function z
const handleExportCSV = () => {
  console.log("Exporting CSV...");
  // Implementation will come later
};

async function renderToolbar() {
  const studioResult = await getStudio();
  studioResult.onSuccess((studio) => setEnableActions(studio, true));
  
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

// Also set a timeout as a fallback
setTimeout(() => {
  renderToolbar();
}, 5000);
