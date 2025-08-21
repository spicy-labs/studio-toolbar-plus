import React, { useRef, useState, useEffect } from "react";
import { Modal } from "@mantine/core";
import { appStore } from "../modalStore";
import { getStudio } from "../studio/studioAdapter";
import { getCurrentDocumentState } from "../studio/documentHandler";
import { getFontFamilies } from "../studio/fontHandler";
import { queryMediaConnectorSimple } from "../studio/mediaConnectorHandler";
import {
  registerConnector,
  unregisterConnector,
} from "../studio/connectorAdapter";
import { getVision } from "../utils/smartCrop/getVision";
import { setVision, uploadImage } from "../utils/smartCrop/setVision";
import { getMediaConnectorsAPI } from "../utils/getMediaConnectorsAPI";
import { loadDocumentFromJsonStr } from "../studio/documentHandler";
import { loadToolbarDataFromDoc } from "../studio/studioAdapter";
import { ImageBrowser, ImageBrowserMode } from "./ImageBrowser";
import { ConnectorSelectionModal } from "./ConnectorSelectionModal";
import { ReplaceConnectorsModal } from "./DownloadModal/ReplaceConnectorsModal";
import { DefaultSettingsModal } from "./DownloadModal/DefaultSettingsModal";
import type { ImageBrowserFolderSelection } from "./ImageBrowser";
import type { QueryPage, Media } from "./ImageBrowser";
import type {
  Connector,
  DocumentConnector,
  DocumentConnectorGraFx,
} from "../types/connectorTypes";
import type {
  FontData,
  FontFamily,
  FontFamiliesResponse,
  FontStylesResponse,
  FontUploadResponse,
} from "../types/fontTypes";
import { InitialScreen } from "./DownloadModal/InitialScreen";
import { DownloadSettingsScreen } from "./DownloadModal/DownloadSettingsScreen";
import { DownloadTasksScreen } from "./DownloadModal/DownloadTasksScreen";
import { UploadTasksScreen } from "./DownloadModal/UploadTasksScreen";
import {
  type ModalState,
  type DownloadSettings,
  type DownloadFile,
  type TaskItem,
  type SmartCropsData,
  type StudioPackage,
  FontAlreadyExistsError,
  NoChiliPackageError,
  MissingFontFileError,
  MissingSmartCropsFileError,
  InvalidSmartCropsJsonError,
  FailedToFetchConnectorsError,
  MissingDocumentFileError,
  InvalidDocumentJsonError,
} from "./DownloadModal/types";
import {
  loadFilesFromDirectory,
  verifyStudioPackage,
  sanitizeFolderName,
  generateTimestamp,
  validateFolderName,
  getDocumentId,
} from "./DownloadModal/utils";
import { cornersOfRectangle } from "@dnd-kit/core/dist/utilities/algorithms/helpers";
import { clampSubjectAreaToBounds } from "../utils/smartCrop/clampSubjectAreaToBounds";

interface DownloadModalNewProps {
  opened: boolean;
  onClose: () => void;
}

export function DownloadModalNew({ opened, onClose }: DownloadModalNewProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const raiseError = appStore((store) => store.raiseError);
  const [modalState, setModalState] = useState<ModalState>("initial");
  const [error, setError] = useState<string | null>(null);
  const [downloadSettings, setDownloadSettings] = useState<DownloadSettings>({
    includeFonts: false,
    includeGrafxMedia: false,
    includeSmartCrops: false,
    removeToolbarData: false,
    removeUnusedConnectors: false,
    useOriginalFontFileNames: false,
    addTimestamp: false,
  });
  const [folderName, setFolderName] = useState<string>("");
  const [folderNameError, setFolderNameError] = useState<string>("");
  const [downloadFiles, setDownloadFiles] = useState<DownloadFile[]>([]);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [fontFamilies, setFontFamilies] = useState<FontFamily[] | null>(null);
  const [fontStylesCount, setFontStylesCount] = useState<number>(0);
  const [folderBrowserOpened, setFolderBrowserOpened] = useState(false);
  const [connectorSelection, setConnectorSelection] =
    useState<ImageBrowserFolderSelection | null>(null);
  const [uploadTasks, setUploadTasks] = useState<TaskItem[]>([]);

  // New state for upload workflow
  const [connectorSelectionModalOpened, setConnectorSelectionModalOpened] =
    useState(false);
  const [replaceConnectorsModalOpened, setReplaceConnectorsModalOpened] =
    useState(false);
  const [availableConnectors, setAvailableConnectors] = useState<Connector[]>(
    [],
  );
  const [connectorsToReplace, setConnectorsToReplace] = useState<
    DocumentConnectorGraFx[]
  >([]);
  const [selectedVisionConnector, setSelectedVisionConnector] =
    useState<string>("");
  const [smartCropsData, setSmartCropsData] = useState<any>(null);
  const [documentData, setDocumentData] = useState<any>(null);
  const [packageJsonTaskId, setPackageJsonTaskId] = useState<string>("");
  const [currentFiles, setCurrentFiles] = useState<File[]>([]);
  const [currentStudioPackage, setCurrentStudioPackage] =
    useState<StudioPackage | null>(null);
  const [currentStudio, setCurrentStudio] = useState<any>(null);
  const [currentToken, setCurrentToken] = useState<string>("");
  const [currentBaseUrl, setCurrentBaseUrl] = useState<string>("");
  const [isDefaultSettingsModalOpen, setIsDefaultSettingsModalOpen] =
    useState(false);

  // Listen for download completion messages
  useEffect(() => {
    const messageListener = (event: MessageEvent) => {
      if (event.source !== window) return;

      if (event.data.type === "DOWNLOAD_COMPLETE") {
        const { downloadId, success, error } = event.data.data;

        setDownloadFiles((prev) =>
          prev.map((f) =>
            f.id === downloadId
              ? {
                  ...f,
                  status: success ? "complete" : "error",
                  error: error || undefined,
                }
              : f,
          ),
        );
      }
    };

    window.addEventListener("message", messageListener);

    return () => {
      window.removeEventListener("message", messageListener);
    };
  }, []);

  // Fetch font families when Include fonts is checked
  useEffect(() => {
    const fetchFontFamilies = async () => {
      if (!downloadSettings.includeFonts) {
        setFontFamilies(null);
        setFontStylesCount(0);
        return;
      }

      try {
        const studioResult = await getStudio();
        if (!studioResult.isOk()) {
          raiseError(
            new Error(studioResult.error?.message || "Failed to get studio"),
          );
          return;
        }

        const fontFamiliesResult = await getFontFamilies(studioResult.value);
        if (!fontFamiliesResult.isOk()) {
          raiseError(
            new Error(
              fontFamiliesResult.error?.message ||
                "Failed to get font families",
            ),
          );
          return;
        }

        const families = fontFamiliesResult.value;
        setFontFamilies(families);

        // Count total font styles
        const totalStyles = families.reduce(
          (total, family) => total + family.fontStyles.length,
          0,
        );
        setFontStylesCount(totalStyles);
      } catch (error) {
        raiseError(error instanceof Error ? error : new Error(String(error)));
      }
    };

    fetchFontFamilies();
  }, [downloadSettings.includeFonts, raiseError]);

  // Document processing functions
  const processDocumentForDownload = (
    documentData: any,
    settings: DownloadSettings,
  ): any => {
    // Create a deep copy of the document data
    let processedDocument = JSON.parse(JSON.stringify(documentData));

    // Remove toolbar data if requested
    if (settings.removeToolbarData) {
      processedDocument = removeToolbarData(processedDocument);
    }

    // Remove unused connectors if requested
    if (settings.removeUnusedConnectors) {
      processedDocument = removeUnusedConnectors(processedDocument);
    }

    return processedDocument;
  };

  const removeToolbarData = (documentData: any): any => {
    if (
      documentData.layouts &&
      documentData.layouts.length > 0 &&
      documentData.layouts[0].privateData &&
      documentData.layouts[0].privateData.toolbar
    ) {
      const processedDocument = { ...documentData };
      processedDocument.layouts = [...documentData.layouts];
      processedDocument.layouts[0] = {
        ...documentData.layouts[0],
        privateData: { ...documentData.layouts[0].privateData },
      };
      delete processedDocument.layouts[0].privateData.toolbar;
      return processedDocument;
    }
    return documentData;
  };

  const removeUnusedConnectors = (documentData: any): any => {
    if (!documentData.connectors || !Array.isArray(documentData.connectors)) {
      return documentData;
    }

    // Filter connectors where source.source === "grafx" and source.id is not null
    const grafxConnectors = documentData.connectors.filter(
      (connector: any) =>
        connector.source &&
        connector.source.source === "grafx" &&
        connector.source.id != null,
    );

    if (grafxConnectors.length === 0) {
      return documentData;
    }

    // Create a copy of the document without the connectors key for searching
    const documentWithoutConnectors = { ...documentData };
    delete documentWithoutConnectors.connectors;
    const searchableJsonString = JSON.stringify(documentWithoutConnectors);

    // Find unused connectors
    const usedConnectorIds = new Set<string>();
    for (const connector of grafxConnectors) {
      if (searchableJsonString.includes(connector.id)) {
        usedConnectorIds.add(connector.id);
      }
    }

    // Remove unused connectors from the original document
    const processedDocument = { ...documentData };
    processedDocument.connectors = documentData.connectors.filter(
      (connector: any) => {
        // Keep non-grafx connectors
        if (
          !connector.source ||
          connector.source.source !== "grafx" ||
          connector.source.id == null
        ) {
          return true;
        }
        // Keep used grafx connectors
        return usedConnectorIds.has(connector.id);
      },
    );

    return processedDocument;
  };

  // Helper function to get template name and document ID
  const getDocumentName = async (): Promise<string> => {
    try {
      const studioResult = await getStudio();
      if (!studioResult.isOk()) {
        return "document";
      }

      // Get token and baseUrl from configuration
      const token = (
        await studioResult.value.configuration.getValue("GRAFX_AUTH_TOKEN")
      ).parsedData;
      const baseUrl = (
        await studioResult.value.configuration.getValue("ENVIRONMENT_API")
      ).parsedData;

      // Get template ID from URL
      const urlPath = window.location.href;
      const templateIdMatch = urlPath.match(/templates\/([\w-]+)/);

      if (templateIdMatch && templateIdMatch[1]) {
        const templateId = templateIdMatch[1];

        try {
          // Fetch template details to get the name
          const templateResponse = await fetch(
            `${baseUrl}templates/${templateId}`,
            {
              headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
              },
            },
          );

          if (templateResponse.ok) {
            const templateData = await templateResponse.json();
            if (templateData && templateData.data && templateData.data.name) {
              return templateData.data.name;
            }
          }
        } catch (error) {
          // Fall back to document ID if template fetch fails
        }

        // Return template ID if name fetch failed
        return templateId;
      }

      return "document";
    } catch (error) {
      return "document";
    }
  };

  // Reset modal state when closed
  const handleClose = () => {
    // Cleanup blob URLs
    createdBlobUrls.forEach((url) => {
      URL.revokeObjectURL(url);
    });
    setCreatedBlobUrls([]);
    setTasks([]);
    setUploadTasks([]);
    setModalState("initial");
    setError(null);
    setFolderName("");
    setFolderNameError("");
    setDownloadFiles([]);
    setConnectorSelection(null);
    onClose();
  };

  // Handle Download button click
  const handleDownload = async () => {
    setError(null);

    // Load default settings and apply them
    try {
      const { settings, connectorSelection } = await loadDefaultSettings();
      setDownloadSettings(settings);
      setConnectorSelection(connectorSelection);
    } catch (error) {
      console.warn("Failed to load default settings:", error);
      // Keep current settings if loading fails
    }

    // Get document name and sanitize it for folder name
    try {
      const documentName = await getDocumentName();
      const sanitizedName = sanitizeFolderName(documentName);
      setFolderName(sanitizedName);
      setFolderNameError("");
    } catch (error) {
      setFolderName("document");
      setFolderNameError("");
    }

    // Go straight to download settings view
    setModalState("downloadSettings");
  };

  // Handle Upload button click
  const handleUpload = () => {
    // Check if we should show upload instructions
    const skipInstructions = localStorage.getItem("tempSlowUploadInstructions");

    if (skipInstructions === "true") {
      // Skip instructions and go straight to directory picker
      handleDirectoryPicker();
    } else {
      // Show instructions modal
      setModalState("uploadInstructions");
    }
  };

  // Handle Default Settings button click
  const handleDefaultSettings = () => {
    setIsDefaultSettingsModalOpen(true);
  };

  // Load default settings from toolbar data
  const loadDefaultSettings = async (): Promise<{
    settings: DownloadSettings;
    connectorSelection: ImageBrowserFolderSelection | null;
  }> => {
    const defaultFallback: DownloadSettings = {
      includeFonts: true,
      includeGrafxMedia: false,
      includeSmartCrops: false,
      removeToolbarData: false,
      removeUnusedConnectors: false,
      useOriginalFontFileNames: false,
      addTimestamp: true,
    };

    try {
      const toolbarDataResult = await loadToolbarDataFromDoc();
      if (toolbarDataResult.isOk()) {
        const toolbarData = toolbarDataResult.value;
        if (toolbarData.defaultDownloadSettings) {
          const { smartCropsConnectorSelection, ...settings } =
            toolbarData.defaultDownloadSettings;
          return {
            settings,
            connectorSelection: smartCropsConnectorSelection || null,
          };
        }
      }
    } catch (error) {
      console.warn("Failed to load default settings, using fallback:", error);
    }

    return {
      settings: defaultFallback,
      connectorSelection: null,
    };
  };

  // Handle directory picker
  const handleDirectoryPicker = async () => {
    try {
      if (!window.showDirectoryPicker) {
        raiseError(
          new Error("File System Access API is not supported in this browser"),
        );
        return;
      }

      const directoryHandle = await window.showDirectoryPicker();
      setModalState("uploading");

      // Load files from directory
      const filesResult = await loadFilesFromDirectory(directoryHandle);
      if (!filesResult.isOk()) {
        setError(
          filesResult.error?.message || "Failed to load files from directory",
        );
        setModalState("uploadInstructions");
        return;
      }

      // Start processing upload files
      await processUploadFiles(filesResult.value);
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        // User cancelled the picker
        setModalState("initial");
        return;
      }
      raiseError(error instanceof Error ? error : new Error(String(error)));
      setModalState("initial");
    }
  };

  // Process upload files with new task-based workflow
  const processUploadFiles = async (files: File[]) => {
    try {
      // Find and parse chili-package.json
      const packageJsonFile = files.find(
        (file) => file.name === "chili-package.json",
      );
      if (!packageJsonFile) {
        raiseError(new NoChiliPackageError("chili-package.json not found"));
        return;
      }

      const packageJsonText = await packageJsonFile.text();
      const packageJsonData = JSON.parse(packageJsonText);

      const validationResult = verifyStudioPackage(packageJsonData);
      if (!validationResult.isOk()) {
        raiseError(
          validationResult.error || new Error("Package validation failed"),
        );
        return;
      }

      const studioPackage = validationResult.value;
      setUploadTasks([]);

      // Get studio instance and configuration
      const studioResult = await getStudio();
      if (!studioResult.isOk()) {
        raiseError(
          new Error(studioResult.error?.message || "Failed to get studio"),
        );
        return;
      }

      const studio = studioResult.value;
      const token = (await studio.configuration.getValue("GRAFX_AUTH_TOKEN"))
        .parsedData as string;
      const baseUrl = (await studio.configuration.getValue("ENVIRONMENT_API"))
        .parsedData as string;

      if (!token || !baseUrl) {
        raiseError(new Error("Failed to get authentication token or base URL"));
        return;
      }

      // Create chili-package.json processing task
      const packageTaskId = "package-processing";
      setPackageJsonTaskId(packageTaskId);
      setUploadTasks([
        {
          id: packageTaskId,
          name: "Processing chili-package.json",
          type: "package_processing",
          status: "processing",
        },
      ]);

      // Store current state for modal continuations
      setCurrentFiles(files);
      setCurrentStudioPackage(studioPackage);
      setCurrentStudio(studio);
      setCurrentToken(token);
      setCurrentBaseUrl(baseUrl);

      // Process chili-package.json workflow
      await processPackageJsonWorkflow(
        files,
        studioPackage,
        studio,
        token,
        baseUrl,
        packageTaskId,
      );
    } catch (error) {
      raiseError(error instanceof Error ? error : new Error(String(error)));
    }
  };

  // Process chili-package.json workflow
  const processPackageJsonWorkflow = async (
    files: File[],
    studioPackage: StudioPackage,
    studio: any,
    token: string,
    baseUrl: string,
    packageTaskId: string,
  ) => {
    try {
      // Helper function to update package task status
      const updatePackageTaskStatus = (
        status: TaskItem["status"],
        error?: string,
      ) => {
        setUploadTasks((prev) =>
          prev.map((task) =>
            task.id === packageTaskId ? { ...task, status, error } : task,
          ),
        );
      };

      // Step 1: Verify smart crops file exists if needed
      let smartCropsFileData: any = null;
      for (const document of studioPackage.documents) {
        if (document.smartCrops) {
          const smartCropsFile = files.find(
            (file) => file.name === document.smartCrops!.filePath,
          );
          if (!smartCropsFile) {
            const error = new MissingSmartCropsFileError(
              `Smart crops file not found: ${document.smartCrops.filePath}`,
            );
            raiseError(error);
            updatePackageTaskStatus("error", error.message);
            return;
          }

          // Parse smart crops file
          try {
            const smartCropsText = await smartCropsFile.text();
            smartCropsFileData = JSON.parse(smartCropsText);
            setSmartCropsData(smartCropsFileData);
          } catch (parseError) {
            const error = new InvalidSmartCropsJsonError(
              `Invalid smart crops JSON: ${parseError instanceof Error ? parseError.message : String(parseError)}`,
            );
            raiseError(error);
            updatePackageTaskStatus("error", error.message);
            return;
          }
        }
      }

      // Step 2: If smart crops exist and have crops, show connector selection modal
      if (
        smartCropsFileData &&
        smartCropsFileData.crops &&
        smartCropsFileData.crops.length > 0
      ) {
        // Get media connectors
        const connectorsResult = await getMediaConnectorsAPI(baseUrl, token);
        if (!connectorsResult.isOk()) {
          const error = new FailedToFetchConnectorsError(
            `Failed to fetch connectors: ${connectorsResult.error?.message}`,
          );
          raiseError(error);
          updatePackageTaskStatus("error", error.message);
          return;
        }

        const mediaConnectors = connectorsResult.value.data.filter(
          (connector) => connector.enabled && connector.type === "media",
        );

        // Show connector selection modal and wait for selection
        setAvailableConnectors(mediaConnectors);
        setConnectorSelectionModalOpened(true);

        // The workflow will continue in handleConnectorSelection
        return;
      }

      // Step 3: Continue with document processing if no smart crops
      await continuePackageProcessing(
        files,
        studioPackage,
        studio,
        token,
        baseUrl,
        packageTaskId,
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      raiseError(error instanceof Error ? error : new Error(errorMessage));
      setUploadTasks((prev) =>
        prev.map((task) =>
          task.id === packageTaskId
            ? { ...task, status: "error", error: errorMessage }
            : task,
        ),
      );
    }
  };

  // Continue package processing after smart crops connector selection
  const continuePackageProcessing = async (
    files: File[],
    studioPackage: StudioPackage,
    studio: any,
    token: string,
    baseUrl: string,
    packageTaskId: string,
  ) => {
    try {
      // Helper function to update package task status
      const updatePackageTaskStatus = (
        status: TaskItem["status"],
        error?: string,
      ) => {
        setUploadTasks((prev) =>
          prev.map((task) =>
            task.id === packageTaskId ? { ...task, status, error } : task,
          ),
        );
      };

      // Step 1: Verify document file exists and parse it
      let parsedDocumentData: any = null;
      for (const document of studioPackage.documents) {
        const documentFile = files.find(
          (file) => file.name === document.filePath,
        );
        if (!documentFile) {
          const error = new MissingDocumentFileError(
            `Document file not found: ${document.filePath}`,
          );
          raiseError(error);
          updatePackageTaskStatus("error", error.message);
          return;
        }

        // Parse document file
        try {
          const documentText = await documentFile.text();
          parsedDocumentData = JSON.parse(documentText);
          setDocumentData(parsedDocumentData);
        } catch (parseError) {
          const error = new InvalidDocumentJsonError(
            `Invalid document JSON: ${parseError instanceof Error ? parseError.message : String(parseError)}`,
          );
          raiseError(error);
          updatePackageTaskStatus("error", error.message);
          return;
        }
      }

      // Step 2: Get available connectors for document connector replacement
      const connectorsResult = await getMediaConnectorsAPI(baseUrl, token);
      if (!connectorsResult.isOk()) {
        const error = new FailedToFetchConnectorsError(
          `Failed to fetch connectors: ${connectorsResult.error?.message}`,
        );
        raiseError(error);
        updatePackageTaskStatus("error", error.message);
        return;
      }

      const mediaConnectors = connectorsResult.value.data.filter(
        (connector) => connector.enabled && connector.type === "media",
      );
      setAvailableConnectors(mediaConnectors);

      // Step 3: Check for document connectors that need replacement
      // Use the locally parsed data instead of state since state might not be updated yet
      const currentDocumentData = documentData || parsedDocumentData;
      if (currentDocumentData && currentDocumentData.connectors) {
        const documentConnectors =
          currentDocumentData.connectors as DocumentConnector[];
        const connectorsNeedingReplacement = documentConnectors.filter(
          (connector) =>
            connector.source.source === "grafx" && connector.source.id,
        ) as DocumentConnectorGraFx[];

        if (connectorsNeedingReplacement.length > 0) {
          setConnectorsToReplace(connectorsNeedingReplacement);
          setReplaceConnectorsModalOpened(true);
          return;
        }
      }

      // Step 4: Complete package processing and start task processing
      updatePackageTaskStatus("complete");
      await startTaskProcessing(files, studioPackage, studio, token, baseUrl);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      raiseError(error instanceof Error ? error : new Error(errorMessage));
      setUploadTasks((prev) =>
        prev.map((task) =>
          task.id === packageTaskId
            ? { ...task, status: "error", error: errorMessage }
            : task,
        ),
      );
    }
  };

  // Handle connector selection for smart crops
  const handleConnectorSelection = async (connectorId: string) => {
    setSelectedVisionConnector(connectorId);
    setConnectorSelectionModalOpened(false);

    // Continue with package processing using stored state
    if (
      currentFiles.length > 0 &&
      currentStudioPackage &&
      currentStudio &&
      currentToken &&
      currentBaseUrl
    ) {
      await continuePackageProcessing(
        currentFiles,
        currentStudioPackage,
        currentStudio,
        currentToken,
        currentBaseUrl,
        packageJsonTaskId,
      );
    }
  };

  // Handle connector replacement
  const handleConnectorReplacement = async (
    replacementMap: Map<string, string>,
  ) => {
    setReplaceConnectorsModalOpened(false);

    if (documentData) {
      // Perform string replacement in document JSON
      console.log("HELLO");
      console.log(documentData);

      const newDocumentData = JSON.parse(JSON.stringify(documentData));

      for (const connector of newDocumentData.connectors) {
        if (connector.source.source === "grafx" && connector.source.id) {
          const sourceId = connector.source.id;
          const replacementId = replacementMap.get(sourceId);
          if (replacementId) {
            connector.source.id = replacementId;
            newDocumentData.layouts.forEach((layout) => {
              layout.frameProperties.forEach((props) => {
                if (props.perAssetCrop) {
                  const { [sourceId]: idValue, ...rest } = props.perAssetCrop;
                  if (idValue) {
                    console.log({
                      ac: props.perAssetCrop,
                      sourceId,
                      replacementId,
                    });
                    props.perAssetCrop = { [replacementId]: idValue, ...rest };
                  }
                }
              });
            });
          }
        }
      }

      const remainingOldConnectors: string[] = [];
      const newDocumentStr = JSON.stringify(newDocumentData);

      for (let [sourceId, replacementId] of replacementMap) {
        if (newDocumentStr.includes(sourceId)) {
          remainingOldConnectors.push(sourceId);
        }
      }

      if (remainingOldConnectors.length > 0) {
        const errorMessage = `Connector replacement failed. Old connector IDs still found: ${remainingOldConnectors.join(", ")}`;

        setUploadTasks((prev) =>
          prev.map((task) =>
            task.id === packageJsonTaskId
              ? { ...task, status: "error", error: errorMessage }
              : task,
          ),
        );

        raiseError(new Error(errorMessage));
        return;
      }

      setDocumentData(newDocumentData);
      console.log(newDocumentData);

      // Mark package task as complete and continue with task processing
      setUploadTasks((prev) =>
        prev.map((task) =>
          task.id === packageJsonTaskId
            ? { ...task, status: "complete" }
            : task,
        ),
      );

      // Add document load task
      setUploadTasks((prev) => [
        ...prev,
        {
          id: "document-load",
          name: "Loading document",
          type: "document_load",
          status: "pending",
        },
      ]);

      // Start task processing using stored state
      if (
        currentFiles.length > 0 &&
        currentStudioPackage &&
        currentStudio &&
        currentToken &&
        currentBaseUrl
      ) {
        await startTaskProcessing(
          currentFiles,
          currentStudioPackage,
          currentStudio,
          currentToken,
          currentBaseUrl,
          newDocumentData,
        );
      }
    }
  };

  // Start task processing (fonts, smart crops, document)
  const startTaskProcessing = async (
    files: File[],
    studioPackage: StudioPackage,
    studio: any,
    token: string,
    baseUrl: string,
    currentDocumentData?: any,
  ) => {
    try {
      // Process fonts first
      for (const document of studioPackage.documents) {
        for (const fontInfo of document.fonts) {
          const fontFile = files.find(
            (file) => file.name === fontInfo.filePath,
          );
          if (!fontFile) {
            const taskId = `font-upload-${fontInfo.details.id}`;
            setUploadTasks((prev) => [
              ...prev,
              {
                id: taskId,
                name: `Font missing: ${fontInfo.details.familyName} ${fontInfo.details.name}`,
                type: "font_upload",
                status: "error",
                error: `Font file not found: ${fontInfo.filePath}`,
              },
            ]);
            continue;
          }

          const taskId = `font-upload-${fontInfo.details.id}`;
          setUploadTasks((prev) => [
            ...prev,
            {
              id: taskId,
              name: `Uploading font: ${fontInfo.details.familyName} ${fontInfo.details.name}`,
              type: "font_upload",
              status: "processing",
            },
          ]);

          try {
            await uploadFont(
              fontFile,
              fontInfo.details,
              token,
              baseUrl,
              taskId,
            );
          } catch (error) {
            // Error handling is done within uploadFont function
          }
        }
      }

      // Process smart crops if available
      if (smartCropsData && smartCropsData.crops && selectedVisionConnector) {
        const totalCrops = smartCropsData.crops.length;
        const summaryTaskId = `smart-crop-upload-summary-${selectedVisionConnector}`;

        // Create summary task
        setUploadTasks((prev) => [
          ...prev,
          {
            id: summaryTaskId,
            name: `Smart Crop Upload: ${totalCrops} crops to process`,
            type: "smart_crop_upload",
            status: "processing",
          },
        ]);

        // Helper function to update summary task
        const updateSummaryTask = () => {
          setUploadTasks((prev) => {
            const individualTasks = prev.filter(
              (task) =>
                task.type === "smart_crop_upload" &&
                task.id.startsWith("smart-crop-") &&
                task.id !== summaryTaskId,
            );

            const totalTasks = individualTasks.length;
            const completedTasks = individualTasks.filter(
              (task) => task.status === "complete",
            ).length;
            const errorTasks = individualTasks.filter(
              (task) => task.status === "error",
            ).length;
            const processingTasks = individualTasks.filter(
              (task) => task.status === "processing",
            ).length;

            return prev.map((task) => {
              if (task.id === summaryTaskId) {
                if (processingTasks > 0) {
                  return {
                    ...task,
                    name: `Smart Crop Upload: ${completedTasks + errorTasks}/${totalTasks} processed`,
                  };
                } else if (errorTasks > 0) {
                  // Get error details for tooltip
                  const errorDetails = individualTasks
                    .filter((task) => task.status === "error")
                    .map((task) => task.error || "Unknown error")
                    .slice(0, 3);

                  const tooltipMessage =
                    errorTasks > 3
                      ? `${errorTasks} failed: ${errorDetails.join(", ")}... and ${errorTasks - 3} more`
                      : `${errorTasks} failed: ${errorDetails.join(", ")}`;

                  return {
                    ...task,
                    status: "error" as const,
                    name: `Smart Crop Upload: ${completedTasks} completed, ${errorTasks} failed`,
                    tooltip: tooltipMessage,
                    error: `${errorTasks} uploads failed`,
                  };
                } else {
                  return {
                    ...task,
                    status: "complete" as const,
                    name: `Smart Crop Upload: ${totalTasks} crops completed`,
                  };
                }
              }
              return task;
            });
          });
        };

        for (const crop of smartCropsData.crops) {
          const taskId = `smart-crop-${crop.assetId}`;
          setUploadTasks((prev) => [
            ...prev,
            {
              id: taskId,
              name: `Uploading smart crop: ${crop.assetId}`,
              type: "smart_crop_upload",
              status: "processing",
            },
          ]);

          try {
            // Check if vision data exists before setting it
            // const visionCheckResult = await getVision({
            //   baseUrl,
            //   connectorId: selectedVisionConnector,
            //   asset: crop.assetId,
            //   authorization: token,
            // });

            // if (
            //   !visionCheckResult.isOk() &&
            //   (visionCheckResult.error as any)?.type === "VisionNotFoundError"
            // ) {
            //   await uploadImage({
            //     baseUrl,
            //     connectorId: selectedVisionConnector,
            //     asset: crop.assetId,
            //     authorization: token,
            //   });
            // }

            const visionResult = await setVision({
              baseUrl,
              connectorId: selectedVisionConnector,
              asset: crop.assetId,
              authorization: token,
              metadata: clampSubjectAreaToBounds(crop.metadata),
            });

            if (visionResult.isOk()) {
              setUploadTasks((prev) =>
                prev.map((task) =>
                  task.id === taskId ? { ...task, status: "complete" } : task,
                ),
              );
              updateSummaryTask();
            } else {
              setUploadTasks((prev) =>
                prev.map((task) =>
                  task.id === taskId
                    ? {
                        ...task,
                        status: "error",
                        error:
                          visionResult.error?.message ||
                          "Failed to set vision data",
                      }
                    : task,
                ),
              );
              updateSummaryTask();
            }
          } catch (error) {
            setUploadTasks((prev) =>
              prev.map((task) =>
                task.id === taskId
                  ? {
                      ...task,
                      status: "error",
                      error:
                        error instanceof Error ? error.message : String(error),
                    }
                  : task,
              ),
            );
            updateSummaryTask();
          }
        }
      }

      // Finally, load the document
      if (currentDocumentData) {
        setUploadTasks((prev) =>
          prev.map((task) =>
            task.id === "document-load"
              ? { ...task, status: "processing" }
              : task,
          ),
        );

        console.log(currentDocumentData);
        try {
          const loadResult = await loadDocumentFromJsonStr(
            studio,
            JSON.stringify(currentDocumentData),
          );
          if (loadResult.isOk()) {
            setUploadTasks((prev) =>
              prev.map((task) =>
                task.id === "document-load"
                  ? { ...task, status: "complete" }
                  : task,
              ),
            );
          } else {
            setUploadTasks((prev) =>
              prev.map((task) =>
                task.id === "document-load"
                  ? {
                      ...task,
                      status: "error",
                      error:
                        loadResult.error?.message || "Failed to load document",
                    }
                  : task,
              ),
            );
          }
        } catch (error) {
          setUploadTasks((prev) =>
            prev.map((task) =>
              task.id === "document-load"
                ? {
                    ...task,
                    status: "error",
                    error:
                      error instanceof Error ? error.message : String(error),
                  }
                : task,
            ),
          );
        }
      }
    } catch (error) {
      raiseError(error instanceof Error ? error : new Error(String(error)));
    }
  };

  // Helper function to fetch all pages from a paginated font-families endpoint
  const fetchAllFontFamilies = async (
    baseUrl: string,
    token: string,
    initialUrl?: string,
  ): Promise<any[]> => {
    const allData: any[] = [];
    let nextPageUrl: string | null =
      initialUrl || `${baseUrl}font-families?sortBy=Name&sortOrder=asc`;

    while (nextPageUrl) {
      const response = await fetch(nextPageUrl, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(
          `Failed to fetch font families: ${response.statusText}`,
        );
      }

      const data: FontFamiliesResponse = await response.json();
      allData.push(...data.data);

      // Check for next page
      nextPageUrl = data.links?.nextPage || null;
      if (nextPageUrl === "") {
        nextPageUrl = null;
      }
    }

    return allData;
  };

  // Helper function to fetch all pages from a paginated font-styles endpoint
  const fetchAllFontStyles = async (
    baseUrl: string,
    token: string,
    fontFamilyId: string,
  ): Promise<any[]> => {
    const allData: any[] = [];
    let nextPageUrl: string | null =
      `${baseUrl}font-families/${fontFamilyId}/styles`;

    while (nextPageUrl) {
      const response = await fetch(nextPageUrl, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch font styles: ${response.statusText}`);
      }

      const data: FontStylesResponse = await response.json();
      allData.push(...data.data);

      // Check for next page
      nextPageUrl = data.links?.nextPage || null;
      if (nextPageUrl === "") {
        nextPageUrl = null;
      }
    }

    return allData;
  };

  // Upload font function
  const uploadFont = async (
    fontFile: File,
    fontDetails: FontData,
    token: string,
    baseUrl: string,
    taskId: string,
  ) => {
    try {
      // First, check if font already exists - fetch all pages
      const allFontFamilies = await fetchAllFontFamilies(baseUrl, token);

      // Check if family exists
      const targetFamily = allFontFamilies.find(
        (tf: any) => tf.name === fontDetails.familyName,
      );

      if (targetFamily) {
        // Family exists, check styles - fetch all pages
        try {
          const allFontStyles = await fetchAllFontStyles(
            baseUrl,
            token,
            targetFamily.id,
          );
          const targetStyle = allFontStyles.find(
            (ts: any) => ts.name === fontDetails.name,
          );
          if (targetStyle) {
            // Font already exists, mark as info
            setUploadTasks((prev) =>
              prev.map((task) =>
                task.id === taskId
                  ? {
                      ...task,
                      status: "info",
                      tooltip: "Font already exists, skipping",
                    }
                  : task,
              ),
            );
            return;
          }
        } catch (error) {
          // If fetching styles fails, continue with upload
          console.warn(
            "Failed to fetch font styles, continuing with upload:",
            error,
          );
        }
      }

      // Font doesn't exist, proceed with upload
      const formData = new FormData();

      // Create a new File with the correct name from FontData
      const renamedFile = new File([fontFile], fontDetails.fileName, {
        type: fontFile.type,
        lastModified: fontFile.lastModified,
      });

      formData.append("file", renamedFile);

      // Step 1: Upload
      const uploadResponse = await fetch(`${baseUrl}font-styles/temp`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (!uploadResponse.ok) {
        throw new Error(`Failed to upload font: ${uploadResponse.statusText}`);
      }

      const uploadData: FontUploadResponse = await uploadResponse.json();

      if (!uploadData.data.preloadedData.length) {
        throw new Error("No preloaded font data received");
      }

      const preloadedFont = uploadData.data.preloadedData[0];

      // Step 2: Patch
      const patchResponse = await fetch(
        `${baseUrl}font-styles/temp/${uploadData.batchId}`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify([
            {
              fontStyleId: preloadedFont.id,
              familyName: fontDetails.familyName,
              styleName: fontDetails.name,
            },
          ]),
        },
      );

      if (!patchResponse.ok) {
        throw new Error(`Failed to patch font: ${patchResponse.statusText}`);
      }

      // Step 3: Confirm
      const confirmResponse = await fetch(
        `${baseUrl}font-styles/temp/${uploadData.batchId}/confirm`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (!confirmResponse.ok) {
        throw new Error(
          `Failed to confirm font upload: ${confirmResponse.statusText}`,
        );
      }

      // Mark task as complete
      setUploadTasks((prev) =>
        prev.map((task) =>
          task.id === taskId ? { ...task, status: "complete" } : task,
        ),
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      // Check if it's a FontAlreadyExistsError
      if (error instanceof FontAlreadyExistsError) {
        setUploadTasks((prev) =>
          prev.map((task) =>
            task.id === taskId
              ? {
                  ...task,
                  status: "info",
                  tooltip: "Font already exists, skipping",
                }
              : task,
          ),
        );
      } else {
        setUploadTasks((prev) =>
          prev.map((task) =>
            task.id === taskId
              ? {
                  ...task,
                  status: "error",
                  error: errorMessage,
                }
              : task,
          ),
        );
      }
    }
  };

  // Handle JSON download button click
  const handleJsonDownload = async () => {
    try {
      // Get studio and document state
      const studioResult = await getStudio();
      if (!studioResult.isOk()) {
        raiseError(
          new Error(studioResult.error?.message || "Failed to get studio"),
        );
        return;
      }

      const documentResult = await getCurrentDocumentState(studioResult.value);
      if (!documentResult.isOk()) {
        raiseError(
          new Error(
            documentResult.error?.message || "Failed to get document state",
          ),
        );
        return;
      }

      const documentData = documentResult.value as any;
      const documentName = await getDocumentName();

      // Create JSON blob and download
      const jsonStr = JSON.stringify(documentData, null, 2);
      const blob = new Blob([jsonStr], { type: "application/json" });
      const url = URL.createObjectURL(blob);

      // Create temporary download link
      const link = document.createElement("a");
      link.href = url;
      link.download = `${documentName}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Clean up the blob URL
      URL.revokeObjectURL(url);
    } catch (error) {
      raiseError(error instanceof Error ? error : new Error(String(error)));
    }
  };

  // Collect smart crops data with enhanced task tracking and proper connector management
  const collectSmartCropsDataWithTasks = async (
    studio: any,
    connectorSelection: ImageBrowserFolderSelection,
  ): Promise<SmartCropsData> => {
    const smartCropsData: SmartCropsData = {
      connectorId: connectorSelection.connectorId,
      connectorName: connectorSelection.connectorName,
      crops: [],
    };

    // Get environment details for getVision calls
    const token = (await studio.configuration.getValue("GRAFX_AUTH_TOKEN"))
      .parsedData as string;
    const baseUrl = (await studio.configuration.getValue("ENVIRONMENT_API"))
      .parsedData as string;

    if (!token || !baseUrl) {
      throw new Error("Failed to get authentication token or base URL");
    }

    // Register the connector first
    const registerResult = await registerConnector(
      studio,
      connectorSelection.connectorId,
    );
    if (!registerResult.isOk()) {
      throw new Error(
        `Failed to register connector: ${registerResult.error?.message}`,
      );
    }

    const localConnectorId = registerResult.value as string;
    let hasErrors = false;

    try {
      for (const folderPath of connectorSelection.selectedFolders) {
        // Add folder query task
        const folderTaskId = `query-folder-${folderPath.replace(/[^a-zA-Z0-9]/g, "-")}`;
        setTasks((prev) => [
          ...prev,
          {
            id: folderTaskId,
            name: `Getting files: ${folderPath}`,
            type: "query_folder",
            status: "processing",
          },
        ]);

        try {
          // Collect all files from all pages in this folder
          const allFiles: Media[] = [];
          let pageToken = "";
          let hasMorePages = true;
          let pageCount = 0;

          // Pagination loop to get all files from the folder
          while (hasMorePages) {
            pageCount++;

            // Update task name to show pagination progress
            setTasks((prev) =>
              prev.map((task) =>
                task.id === folderTaskId
                  ? {
                      ...task,
                      name: `Getting files: ${folderPath} (page ${pageCount})`,
                    }
                  : task,
              ),
            );

            // Query files in the folder using the local connector ID
            const queryResult = await queryMediaConnectorSimple(
              studio,
              localConnectorId,
              folderPath,
              pageToken,
            );

            if (!queryResult.isOk()) {
              hasErrors = true;
              // Update task to error
              setTasks((prev) =>
                prev.map((task) =>
                  task.id === folderTaskId
                    ? {
                        ...task,
                        status: "error",
                        error: `Failed to query folder: ${queryResult.error?.message}`,
                      }
                    : task,
                ),
              );
              break; // Exit pagination loop on error
            }

            const queryPage = queryResult.value as QueryPage<Media>;

            // Filter for files only (type === "file" or type === 0) and add to collection
            const pageFiles = queryPage.data.filter(
              (item) => item.type === "file" || (item.type as unknown) === 0,
            );
            allFiles.push(...pageFiles);

            // Check if there are more pages
            if (queryPage.nextPageToken) {
              pageToken = queryPage.nextPageToken;
              hasMorePages = true;
            } else {
              hasMorePages = false;
            }
          }

          // Update task to complete with total file count
          if (!hasErrors) {
            setTasks((prev) =>
              prev.map((task) =>
                task.id === folderTaskId
                  ? {
                      ...task,
                      status: "complete",
                      name: `Getting files: ${folderPath} (${allFiles.length} files found)`,
                    }
                  : task,
              ),
            );
          }

          // Process vision data for all collected files
          const files = allFiles;

          // Get vision data for each file
          for (const file of files) {
            const visionTaskId = `vision-${file.id}`;
            setTasks((prev) => [
              ...prev,
              {
                id: visionTaskId,
                name: `Getting Vision Data: ${file.name || file.id}`,
                type: "get_vision",
                status: "processing",
              },
            ]);

            try {
              const visionResult = await getVision({
                baseUrl,
                connectorId: connectorSelection.connectorId,
                asset: file.id,
                authorization: token,
              });

              if (visionResult.isOk()) {
                smartCropsData.crops.push({
                  assetId: file.id,
                  metadata: visionResult.value,
                });

                // Update task to complete
                setTasks((prev) =>
                  prev.map((task) =>
                    task.id === visionTaskId
                      ? { ...task, status: "complete" }
                      : task,
                  ),
                );
              } else {
                // Handle vision errors
                const error = visionResult.error;
                if (error && (error as any).type === "VisionNotFoundError") {
                  // Update task to info status for VisionNotFoundError
                  setTasks((prev) =>
                    prev.map((task) =>
                      task.id === visionTaskId
                        ? {
                            ...task,
                            status: "info",
                            tooltip: "Skipped no vision data",
                          }
                        : task,
                    ),
                  );
                } else {
                  // Update task to error for other errors and mark as having errors
                  hasErrors = true;
                  setTasks((prev) =>
                    prev.map((task) =>
                      task.id === visionTaskId
                        ? {
                            ...task,
                            status: "error",
                            error:
                              error?.message || "Failed to get vision data",
                          }
                        : task,
                    ),
                  );
                }
              }
            } catch (error) {
              // Handle unexpected errors and mark as having errors
              hasErrors = true;
              setTasks((prev) =>
                prev.map((task) =>
                  task.id === visionTaskId
                    ? {
                        ...task,
                        status: "error",
                        error:
                          error instanceof Error
                            ? error.message
                            : String(error),
                      }
                    : task,
                ),
              );
            }
          }
        } catch (error) {
          // Update folder task to error and mark as having errors
          hasErrors = true;
          setTasks((prev) =>
            prev.map((task) =>
              task.id === folderTaskId
                ? {
                    ...task,
                    status: "error",
                    error:
                      error instanceof Error ? error.message : String(error),
                  }
                : task,
            ),
          );
        }
      }
    } finally {
      // Always unregister the connector
      try {
        await unregisterConnector(studio, localConnectorId);
      } catch (error) {
        console.warn("Failed to unregister connector:", error);
      }
    }

    // If there were errors during processing, throw an error to fail the smart crops download
    if (hasErrors) {
      throw new Error(
        "Smart crops data collection failed due to errors in folder querying or vision data retrieval",
      );
    }

    return smartCropsData;
  };

  // Handle JSON file upload
  const onJsonUpload = async () => {
    try {
      // Trigger file input click
      if (fileInputRef.current) {
        fileInputRef.current.click();
      }
    } catch (error) {
      raiseError(error instanceof Error ? error : new Error(String(error)));
    }
  };

  // Handle file selection for upload
  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      // Check if the file is a JSON file
      if (!file.name.toLowerCase().endsWith(".json")) {
        raiseError(new Error("Please select a valid JSON file"));
        return;
      }

      // Get studio instance
      const studioResult = await getStudio();
      if (!studioResult.isOk()) {
        raiseError(
          new Error(studioResult.error?.message || "Failed to get studio"),
        );
        return;
      }

      // Read the file content
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const content = e.target?.result as string;
          if (!content) {
            raiseError(new Error("Failed to read file content"));
            return;
          }

          // Parse JSON to validate it's valid JSON
          try {
            JSON.parse(content);
          } catch (parseError) {
            raiseError(
              new Error(
                `Invalid JSON format: ${
                  parseError instanceof Error
                    ? parseError.message
                    : String(parseError)
                }`,
              ),
            );
            return;
          }

          // Load the document using the parsed JSON string
          const loadResult = await loadDocumentFromJsonStr(
            studioResult.value,
            content,
          );

          if (!loadResult.isOk()) {
            raiseError(
              new Error(
                loadResult.error?.message ||
                  "Failed to load document from JSON",
              ),
            );
            return;
          }

          // Close the modal on successful load
          onClose();
        } catch (error) {
          raiseError(error instanceof Error ? error : new Error(String(error)));
        }
      };

      reader.onerror = () => {
        raiseError(new Error("Failed to read the selected file"));
      };

      reader.readAsText(file);
    } catch (error) {
      raiseError(error instanceof Error ? error : new Error(String(error)));
    }

    // Reset the file input
    if (event.target) {
      event.target.value = "";
    }
  };

  // Handle folder name change
  const handleFolderNameChange = (value: string) => {
    setFolderName(value);
    const error = validateFolderName(value);
    setFolderNameError(error);
  };

  // Track created blob URLs for cleanup
  const [createdBlobUrls, setCreatedBlobUrls] = useState<string[]>([]);

  // Cleanup blob URLs when component unmounts or modal closes
  useEffect(() => {
    return () => {
      // Cleanup all created blob URLs
      createdBlobUrls.forEach((url) => {
        URL.revokeObjectURL(url);
      });
    };
  }, [createdBlobUrls]);

  // Download font file function
  const downloadFontFile = async (
    fontStyleId: string,
    file: DownloadFile,
    folder: string,
    fontDataForPackage: { filePath: string; details: FontData }[],
    useOriginalFontFileNames: boolean,
  ) => {
    try {
      const studioResult = await getStudio();
      if (!studioResult.isOk()) {
        throw new Error(studioResult.error?.message || "Failed to get studio");
      }

      // Get token and baseUrl from configuration
      const token = (
        await studioResult.value.configuration.getValue("GRAFX_AUTH_TOKEN")
      ).parsedData as string;
      const baseUrl = (
        await studioResult.value.configuration.getValue("ENVIRONMENT_API")
      ).parsedData as string;

      // Find the font family and style from our stored fontFamilies
      let fontFamily: FontFamily | undefined;
      let fontStyle: any;

      if (fontFamilies) {
        for (const family of fontFamilies) {
          const style = family.fontStyles.find(
            (s) => s.fontStyleId === fontStyleId,
          );
          if (style) {
            fontFamily = family;
            fontStyle = style;
            break;
          }
        }
      }

      if (!fontFamily || !fontStyle) {
        throw new Error(`Font style ${fontStyleId} not found`);
      }

      // Get font style details to get the actual fileName
      let allFontStyles: any[] = [];
      try {
        // Try to fetch font styles using the fontFamilyId
        allFontStyles = await fetchAllFontStyles(
          baseUrl,
          token,
          fontFamily.fontFamilyId,
        );
      } catch (error) {
        // If that fails (404), implement backup search
        console.warn(
          "Failed to fetch font styles directly, trying search fallback:",
          error,
        );

        // URL encode the font family name for the search query
        const encodedFontName = encodeURIComponent(fontFamily.name);

        // Search for font family by name with pagination
        const searchUrl = `${baseUrl}font-families?search=${encodedFontName}&limit=1&sortBy=&sortOrder=`;
        const allSearchResults = await fetchAllFontFamilies(
          baseUrl,
          token,
          searchUrl,
        );

        // Check if we found any results
        if (!allSearchResults || allSearchResults.length === 0) {
          throw new Error(`No family found ${fontFamily.name}`);
        }

        // Get the fontFamilyId from the search response
        const foundFontFamily = allSearchResults[0];

        // Make a new call to get font styles using the found fontFamilyId
        allFontStyles = await fetchAllFontStyles(
          baseUrl,
          token,
          foundFontFamily.id,
        );
      }

      const fontStyleDetails = allFontStyles.find(
        (fs) => fs.name === fontStyle.name,
      );

      if (!fontStyleDetails) {
        throw new Error(`Font style details not found for ${fontStyle.name}`);
      }

      // Download the font file
      const fontDownloadResponse = await fetch(
        `${baseUrl}font-styles/${fontStyleDetails.id}/download`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (!fontDownloadResponse.ok) {
        throw new Error(
          `Failed to download font: ${fontDownloadResponse.statusText}`,
        );
      }

      // Get the font blob and create download URL
      const fontBlob = await fontDownloadResponse.blob();
      const blobUrl = URL.createObjectURL(fontBlob);

      // Track the blob URL for cleanup
      setCreatedBlobUrls((prev) => [...prev, blobUrl]);

      // Update file name based on user preference
      const actualFileName = useOriginalFontFileNames
        ? `fonts/${fontStyleDetails.fileName}`
        : `fonts/${fontStyleDetails.id}`;
      setDownloadFiles((prev) =>
        prev.map((f) =>
          f.id === file.id ? { ...f, name: actualFileName } : f,
        ),
      );

      // Add font data to package manifest
      fontDataForPackage.push({
        filePath: actualFileName,
        details: fontStyleDetails,
      });

      // Send download request to background script
      await sendDownloadRequest(
        blobUrl,
        `Bearer ${token}`,
        folder,
        actualFileName,
        file.id,
      );
    } catch (error) {
      throw error;
    }
  };

  // Download files function
  const startDownloadProcess = async (
    files: DownloadFile[],
    documentData: any,
    documentId: string,
    documentName: string,
    folder: string,
    connectorSelection: ImageBrowserFolderSelection | null,
  ) => {
    // Collect font data for the package manifest
    const fontDataForPackage: { filePath: string; details: FontData }[] = [];
    let smartCropsFilePath: string | undefined;

    // Separate files by type for proper ordering
    const documentJsonFile = files.find((f) => f.id === "document-json");
    const fontFiles = files.filter((f) => f.id.startsWith("font-"));
    const smartCropsFile = files.find((f) => f.id === "smart-crops");
    const packageFile = files.find((f) => f.id === "studio-package");

    // Download document JSON first
    if (documentJsonFile) {
      try {
        // Update file status to downloading
        setDownloadFiles((prev) =>
          prev.map((f) =>
            f.id === documentJsonFile.id ? { ...f, status: "downloading" } : f,
          ),
        );

        // Process document data based on settings before download
        const processedDocumentData = processDocumentForDownload(
          documentData,
          downloadSettings,
        );

        // Create document JSON data and blob URL
        const jsonStr = JSON.stringify(processedDocumentData, null, 2);
        const blob = new Blob([jsonStr], { type: "application/json" });
        const blobUrl = URL.createObjectURL(blob);

        // Track the blob URL for cleanup
        setCreatedBlobUrls((prev) => [...prev, blobUrl]);

        // Send download request to background script with URL
        await sendDownloadRequest(
          blobUrl,
          "",
          folder,
          documentJsonFile.name,
          documentJsonFile.id,
        );
      } catch (error) {
        // Update file status to error
        setDownloadFiles((prev) =>
          prev.map((f) =>
            f.id === documentJsonFile.id
              ? {
                  ...f,
                  status: "error",
                  error: error instanceof Error ? error.message : String(error),
                }
              : f,
          ),
        );
      }
    }

    // Download all fonts
    for (const file of fontFiles) {
      try {
        // Update file status to downloading
        setDownloadFiles((prev) =>
          prev.map((f) =>
            f.id === file.id ? { ...f, status: "downloading" } : f,
          ),
        );

        // Handle font download
        const fontStyleId = file.id.replace("font-", "");
        await downloadFontFile(
          fontStyleId,
          file,
          folder,
          fontDataForPackage,
          downloadSettings.useOriginalFontFileNames,
        );
      } catch (error) {
        // Update file status to error
        setDownloadFiles((prev) =>
          prev.map((f) =>
            f.id === file.id
              ? {
                  ...f,
                  status: "error",
                  error: error instanceof Error ? error.message : String(error),
                }
              : f,
          ),
        );
      }
    }

    // Process smart crops if included
    if (smartCropsFile && connectorSelection) {
      try {
        // Update file status to downloading
        setDownloadFiles((prev) =>
          prev.map((f) =>
            f.id === smartCropsFile.id ? { ...f, status: "downloading" } : f,
          ),
        );

        // Get studio instance
        const studioResult = await getStudio();
        if (!studioResult.isOk()) {
          throw new Error("Failed to get studio for smart crops collection");
        }

        // Collect smart crops data with task tracking
        const smartCropsData = await collectSmartCropsDataWithTasks(
          studioResult.value,
          connectorSelection,
        );

        // Create smart crops JSON blob and download
        const smartCropsStr = JSON.stringify(smartCropsData, null, 2);
        const blob = new Blob([smartCropsStr], { type: "application/json" });
        const blobUrl = URL.createObjectURL(blob);

        // Track the blob URL for cleanup
        setCreatedBlobUrls((prev) => [...prev, blobUrl]);

        // Set the file path for package manifest
        smartCropsFilePath = smartCropsFile.name;

        // Send download request to background script
        await sendDownloadRequest(
          blobUrl,
          "",
          folder,
          smartCropsFile.name,
          smartCropsFile.id,
        );
      } catch (error) {
        // Update file status to error
        setDownloadFiles((prev) =>
          prev.map((f) =>
            f.id === smartCropsFile.id
              ? {
                  ...f,
                  status: "error",
                  error: error instanceof Error ? error.message : String(error),
                }
              : f,
          ),
        );
      }
    }

    // Download package manifest last (after all fonts and smart crops are processed)
    if (packageFile) {
      try {
        // Update file status to downloading
        setDownloadFiles((prev) =>
          prev.map((f) =>
            f.id === packageFile.id ? { ...f, status: "downloading" } : f,
          ),
        );

        // Create package manifest and blob URL
        const documentEntry: any = {
          id: documentId,
          name: documentName,
          filePath: `${documentId}.json`,
          fonts: fontDataForPackage,
        };

        // Add smart crops file path if it exists
        if (smartCropsFilePath) {
          documentEntry.smartCrops = {
            filePath: smartCropsFilePath,
          };
        }

        const manifest: StudioPackage = {
          engineVersion: documentData.engineVersion || "unknown",
          source: window.location.href,
          documents: [documentEntry],
        };

        const manifestStr = JSON.stringify(manifest, null, 2);
        const blob = new Blob([manifestStr], { type: "application/json" });
        const blobUrl = URL.createObjectURL(blob);

        // Track the blob URL for cleanup
        setCreatedBlobUrls((prev) => [...prev, blobUrl]);

        // Send download request to background script with URL
        await sendDownloadRequest(
          blobUrl,
          "",
          folder,
          packageFile.name,
          packageFile.id,
        );
      } catch (error) {
        // Update file status to error
        setDownloadFiles((prev) =>
          prev.map((f) =>
            f.id === packageFile.id
              ? {
                  ...f,
                  status: "error",
                  error: error instanceof Error ? error.message : String(error),
                }
              : f,
          ),
        );
      }
    }
  };

  // Send download request to background script via content script
  const sendDownloadRequest = async (
    url: string,
    authorization: string,
    folder: string,
    filename: string,
    downloadId: string,
  ): Promise<void> => {
    return new Promise((resolve, reject) => {
      const requestId = `download_${Date.now()}_${Math.random()}`;

      // Listen for response
      const responseListener = (event: MessageEvent) => {
        if (event.source !== window) return;

        if (
          event.data.type === "DOWNLOAD_RESPONSE" &&
          event.data.requestId === requestId
        ) {
          window.removeEventListener("message", responseListener);

          if (event.data.response.success) {
            resolve();
          } else {
            reject(new Error(event.data.response.error));
          }
        }
      };

      window.addEventListener("message", responseListener);

      // Send request to content script
      window.postMessage(
        {
          type: "START_DOWNLOAD",
          requestId: requestId,
          data: {
            url,
            authorization,
            folder,
            filename,
            downloadId,
          },
        },
        "*",
      );

      // Timeout after 30 seconds
      setTimeout(() => {
        window.removeEventListener("message", responseListener);
        reject(new Error("Download request timeout"));
      }, 30000);
    });
  };

  // Handle download settings change
  const handleSettingChange = (
    setting: keyof DownloadSettings,
    value: boolean,
  ) => {
    setDownloadSettings((prev: DownloadSettings) => ({
      ...prev,
      [setting]: value,
    }));

    // Clear selected folder paths when smart crops is unchecked
    if (setting === "includeSmartCrops" && !value) {
      setConnectorSelection(null);
    }
  };

  // Handle download execution with settings
  const handleDownloadWithSettings = async () => {
    // Check for validation errors
    if (folderNameError) {
      setError("Please fix folder name errors before downloading");
      return;
    }

    if (!folderName.trim()) {
      setError("Folder name is required");
      return;
    }

    try {
      // Get studio and document state
      const studioResult = await getStudio();
      if (!studioResult.isOk()) {
        raiseError(
          new Error(studioResult.error?.message || "Failed to get studio"),
        );
        return;
      }

      const documentResult = await getCurrentDocumentState(studioResult.value);
      if (!documentResult.isOk()) {
        raiseError(
          new Error(
            documentResult.error?.message || "Failed to get document state",
          ),
        );
        return;
      }

      const documentData = documentResult.value as any;
      const documentId = getDocumentId();
      const documentName = await getDocumentName();

      // Generate final folder name with timestamp if enabled
      const finalFolderName = downloadSettings.addTimestamp
        ? `${folderName}_${generateTimestamp()}`
        : folderName;

      // Prepare files to download
      const filesToDownload: DownloadFile[] = [
        {
          id: "document-json",
          name: `${documentId}.json`,
          status: "pending",
        },
        {
          id: "studio-package",
          name: "chili-package.json",
          status: "pending",
        },
      ];

      // Add font files if fonts are included and available
      if (
        downloadSettings.includeFonts &&
        fontFamilies &&
        fontFamilies.length > 0
      ) {
        for (const family of fontFamilies) {
          for (const style of family.fontStyles) {
            filesToDownload.push({
              id: `font-${style.fontStyleId}`,
              name: `fonts/${style.name}.ttf`, // Will be updated with actual filename
              status: "pending",
            });
          }
        }
      }

      // Add smart crops file if smart crops are included and folders are selected
      if (
        downloadSettings.includeSmartCrops &&
        connectorSelection &&
        connectorSelection.selectedFolders.length > 0
      ) {
        filesToDownload.push({
          id: "smart-crops",
          name: "smart-crops.json",
          status: "pending",
        });
      }

      setDownloadFiles(filesToDownload);
      setTasks([]); // Reset tasks
      setModalState("tasks");

      // Start downloading files
      await startDownloadProcess(
        filesToDownload,
        documentData,
        documentId,
        documentName,
        finalFolderName,
        connectorSelection,
      );
    } catch (error) {
      raiseError(error instanceof Error ? error : new Error(String(error)));
    }
  };

  const handleFolderSelection = (
    selection: ImageBrowserFolderSelection | null,
  ) => {
    setConnectorSelection(selection);
    setFolderBrowserOpened(false);
  };

  // Handle removing a specific folder path
  const handleRemoveFolderPath = (pathToRemove: string) => {
    setConnectorSelection((prev) => {
      if (!prev) return null;
      const updatedFolders = prev.selectedFolders.filter(
        (path) => path !== pathToRemove,
      );
      if (updatedFolders.length === 0) return null;
      return {
        ...prev,
        selectedFolders: updatedFolders,
      };
    });
  };

  return (
    <>
      <Modal
        opened={opened}
        onClose={modalState === "uploading" ? () => {} : handleClose}
        closeOnClickOutside={modalState !== "uploading"}
        closeOnEscape={modalState !== "uploading"}
        withCloseButton={modalState !== "uploading"}
        title={
          modalState === "initial"
            ? "Document Upload/Download"
            : modalState === "downloadSettings"
              ? "Download Settings"
              : modalState === "tasks"
                ? "Tasks Processing"
                : modalState === "uploadInstructions"
                  ? "Upload Instructions"
                  : modalState === "uploading"
                    ? "Uploading Files"
                    : "Downloading Files"
        }
        centered
        size="50%"
        styles={{
          content: {
            minHeight: "400px",
          },
          body: {
            padding: "2rem",
          },
          header: {
            padding: "1.5rem 2rem 1rem 2rem",
          },
          title: {
            fontSize: "1.5rem",
            fontWeight: 600,
          },
        }}
      >
        {modalState === "initial" ? (
          <InitialScreen
            error={error}
            onDownload={handleDownload}
            onUpload={handleUpload}
            onJsonDownload={handleJsonDownload}
            onJsonUpload={onJsonUpload}
            onDefaultSettings={handleDefaultSettings}
          />
        ) : modalState === "downloadSettings" ? (
          <DownloadSettingsScreen
            error={error}
            folderName={folderName}
            folderNameError={folderNameError}
            downloadSettings={downloadSettings}
            fontStylesCount={fontStylesCount}
            connectorSelection={connectorSelection}
            onFolderNameChange={handleFolderNameChange}
            onSettingChange={handleSettingChange}
            onAddFolder={() => setFolderBrowserOpened(true)}
            onRemoveFolderPath={handleRemoveFolderPath}
            onBack={() => setModalState("initial")}
            onDownload={handleDownloadWithSettings}
          />
        ) : modalState === "tasks" || modalState === "uploading" ? (
          <DownloadTasksScreen
            downloadFiles={downloadFiles}
            tasks={tasks}
            uploadTasks={uploadTasks}
            onClose={handleClose}
          />
        ) : modalState === "uploadInstructions" ? (
          <UploadTasksScreen
            error={error}
            onBack={() => setModalState("initial")}
            onContinue={handleDirectoryPicker}
          />
        ) : null}
      </Modal>

      {/* Hidden file input for upload */}
      <input
        type="file"
        ref={fileInputRef}
        style={{ display: "none" }}
        accept=".json"
        onChange={handleFileChange}
      />

      {/* Image Browser Modal */}
      <ImageBrowser
        opened={folderBrowserOpened}
        mode={ImageBrowserMode.FolderSelection}
        initialSelection={connectorSelection}
        onClose={(selection) => {
          handleFolderSelection(selection);
          setFolderBrowserOpened(false);
        }}
      />

      {/* Connector Selection Modal for Smart Crops */}
      <ConnectorSelectionModal
        opened={connectorSelectionModalOpened}
        onClose={() => setConnectorSelectionModalOpened(false)}
        connectors={availableConnectors}
        smartCropsConnectorName={smartCropsData?.connectorName}
        onSelect={handleConnectorSelection}
      />

      {/* Replace Connectors Modal */}
      <ReplaceConnectorsModal
        opened={replaceConnectorsModalOpened}
        onClose={() => setReplaceConnectorsModalOpened(false)}
        connectorsToReplace={connectorsToReplace}
        availableConnectors={availableConnectors}
        onReplace={(replacementMap) => {
          handleConnectorReplacement(replacementMap);
        }}
      />

      {/* Default Settings Modal */}
      <DefaultSettingsModal
        opened={isDefaultSettingsModalOpen}
        onClose={() => setIsDefaultSettingsModalOpen(false)}
      />
    </>
  );
}
