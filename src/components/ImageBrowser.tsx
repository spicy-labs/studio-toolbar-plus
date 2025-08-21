import { useState, useEffect, useMemo } from "react";
import { FixedSizeList as List } from "react-window";
import {
  Modal,
  Text,
  Stack,
  Group,
  Button,
  Loader,
  Alert,
  Select,
  SimpleGrid,
  Card,
  Checkbox,
  ScrollArea,
  Breadcrumbs,
  Anchor,
  ActionIcon,
  Center,
  Tooltip,
  Drawer,
  Slider,
} from "@mantine/core";
import {
  IconAlertCircle,
  IconFolder,
  IconFile,
  IconArrowBigLeftFilled,
  IconExclamationCircle,
  IconEyeCheck,
  IconSettings,
} from "@tabler/icons-react";
import { appStore } from "../modalStore";
import { getStudio } from "../studio/studioAdapter";
import {
  queryMediaConnectorSimple,
  downloadMediaConnector,
} from "../studio/mediaConnectorHandler";
import {
  registerConnector,
  unregisterConnector,
} from "../studio/connectorAdapter";
import type { Connector } from "../types/connectorTypes";
import { MediaDownloadType } from "@chili-publish/studio-sdk";
import { getMediaConnectorsAPI } from "../utils/getMediaConnectorsAPI";
import { getVision } from "../utils/smartCrop/getVision";
import { setVision } from "../utils/smartCrop/setVision";
import type { CropMetadata } from "../utils/smartCrop/smartCrop.types";
import type { TaskItem } from "./DownloadModal/types";
import { DownloadTasksScreen } from "./DownloadModal/DownloadTasksScreen";
import { clampSubjectAreaToBounds } from "../utils/smartCrop/clampSubjectAreaToBounds";

// Define types for the component
export type QueryPage<T> = {
  pageSize: number;
  nextPageToken?: string;
  data: T[];
};

export type Media = {
  id: string;
  name: string;
  type: "folder" | "file";
  [key: string]: any;
};

export interface ImageBrowserFolderSelection {
  selectedFolders: string[];
  connectorId: string;
  connectorName: string;
}

export interface ImageBrowserFileSelection {
  selectedFile: string;
  folderPath: string;
  connectorId: string;
  connectorName: string;
}

export enum ImageBrowserMode {
  FolderSelection,
  FileSelection,
  SmartCropSelection,
}

interface ImageBrowserProps<
  T extends ImageBrowserMode = ImageBrowserMode.FolderSelection,
> {
  opened: boolean;
  mode: T;
  onClose: T extends ImageBrowserMode.FileSelection
    ? (selection: ImageBrowserFileSelection | null) => void
    : (selection: ImageBrowserFolderSelection | null) => void;
  initialSelection?: T extends ImageBrowserMode.FileSelection
    ? ImageBrowserFileSelection | null
    : ImageBrowserFolderSelection | null;
}

type BrowserState = "loading" | "connectorSelection" | "folderBrowsing";
type DisplayMode = "grid" | "list";

// Settings interface for ImageBrowser
interface ImageBrowserSettings {
  iconSize: number;
}

export function ImageBrowser<T extends ImageBrowserMode>({
  opened,
  mode,
  onClose,
  initialSelection = null,
}: ImageBrowserProps<T>) {
  const raiseError = appStore((store) => store.raiseError);

  // State management
  const [browserState, setBrowserState] = useState<BrowserState>("loading");
  const [connectors, setConnectors] = useState<Connector[]>([]);
  const [selectedConnectorId, setSelectedConnectorId] = useState<string | null>(
    null,
  );
  const [displayMode, setDisplayMode] = useState<DisplayMode>("list");
  const [localConnectorId, setLocalConnectorId] = useState<string | null>(null);
  const [currentPath, setCurrentPath] = useState<string>("/");
  const [folders, setFolders] = useState<Media[]>([]);
  const [files, setFiles] = useState<Media[]>([]);
  const [selectedFolders, setSelectedFolders] = useState<Set<string>>(
    new Set(),
  );
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  // Persistent selection storage across navigation
  const [persistentSelections, setPersistentSelections] = useState<Set<string>>(
    new Set(),
  );
  // Smart crop selection mode state
  const [smartCropMode, setSmartCropMode] = useState<boolean>(false);
  const [sourceFile, setSourceFile] = useState<string | null>(null);
  const [targetSelectedFiles, setTargetSelectedFiles] = useState<Set<string>>(
    new Set(),
  );
  const [isLoadingFolders, setIsLoadingFolders] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Thumbnail state
  const [thumbnailUrls, setThumbnailUrls] = useState<Map<string, string>>(
    new Map(),
  );
  const [thumbnailErrors, setThumbnailErrors] = useState<Map<string, string>>(
    new Map(),
  );
  const [loadingThumbnails, setLoadingThumbnails] = useState<Set<string>>(
    new Set(),
  );
  // Vision data caching state
  const [visionDataCache, setVisionDataCache] = useState<Map<string, boolean>>(
    new Map(),
  );
  const [loadingVisionData, setLoadingVisionData] = useState<Set<string>>(
    new Set(),
  );
  // Task processing state
  const [copyTasks, setCopyTasks] = useState<TaskItem[]>([]);
  const [showTaskModal, setShowTaskModal] = useState<boolean>(false);
  // Pagination state for lazy loading
  const [hasMorePages, setHasMorePages] = useState(false);
  const [nextPageToken, setNextPageToken] = useState<string>("");
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  // Blob URL cleanup timeout
  const [cleanupTimeoutId, setCleanupTimeoutId] =
    useState<NodeJS.Timeout | null>(null);
  // Settings state
  const [settings, setSettings] = useState<ImageBrowserSettings>({
    iconSize: 24,
  });
  const [tempSettings, setTempSettings] = useState<ImageBrowserSettings>({
    iconSize: 24,
  });
  const [isSettingsDrawerOpen, setIsSettingsDrawerOpen] = useState(false);

  // react-window configuration - calculate based on icon size with padding
  const itemSize = useMemo(
    () => Math.max(60, settings.iconSize + 32),
    [settings.iconSize],
  );

  // Session storage key for connector selection
  const CONNECTOR_SESSION_KEY = "tempDownloadModal_connectorId";
  // LocalStorage key for settings
  const SETTINGS_STORAGE_KEY = "tempImageBrowserSettings";

  // Load settings from localStorage on component mount
  useEffect(() => {
    const savedSettings = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (savedSettings) {
      try {
        const parsedSettings = JSON.parse(
          savedSettings,
        ) as ImageBrowserSettings;
        setSettings(parsedSettings);
        setTempSettings(parsedSettings);
      } catch (error) {
        // If parsing fails, use default settings
        console.warn("Failed to parse ImageBrowser settings:", error);
      }
    }
  }, []);

  // Cleanup blob URLs when component unmounts (fallback)
  useEffect(() => {
    return () => {
      // Cancel any pending cleanup timeout
      if (cleanupTimeoutId) {
        clearTimeout(cleanupTimeoutId);
      }
      // Cleanup all thumbnail URLs on unmount
      // Note: We can't log here reliably due to stale closures
      thumbnailUrls.forEach((url) => {
        URL.revokeObjectURL(url);
      });
    };
  }, []);

  // Load connectors when modal opens and initialize pre-selected paths
  useEffect(() => {
    if (opened) {
      // Cancel any pending cleanup timeout when reopening
      // if (cleanupTimeoutId) {
      //   clearTimeout(cleanupTimeoutId);
      //   setCleanupTimeoutId(null);
      // }

      if (mode === ImageBrowserMode.FolderSelection) {
        // Initialize persistent selections with pre-selected paths for folder mode
        const folderSelection =
          initialSelection as ImageBrowserFolderSelection | null;
        const selectedPaths = folderSelection?.selectedFolders || [];
        setPersistentSelections(new Set(selectedPaths));
      } else {
        // Initialize selected file for file mode
        const fileSelection =
          initialSelection as ImageBrowserFileSelection | null;
        if (fileSelection?.selectedFile) {
          setSelectedFile(fileSelection.selectedFile);
          setCurrentPath(fileSelection.folderPath);
        }
      }

      // Set the connector ID if provided
      if (initialSelection?.connectorId) {
        setSelectedConnectorId(initialSelection.connectorId);
      }

      loadConnectors();
    } else {
      // // Set cleanup timeout when modal closes (3 minutes)
      // // Capture current thumbnailUrls to avoid stale closure
      // const currentThumbnailUrls = thumbnailUrls;
      // const timeoutId = setTimeout(
      //   () => {
      //     console.log(
      //       `[Cleanup] Timeout expired, revoking ${currentThumbnailUrls.size} blob URLs`,
      //     );
      //     currentThumbnailUrls.forEach((url, key) => {
      //       console.log(`[Cleanup] Timeout revoking URL for ${key}: ${url}`);
      //       URL.revokeObjectURL(url);
      //     });
      //     setThumbnailUrls(new Map());
      //     setThumbnailErrors(new Map());
      //     setCleanupTimeoutId(null);
      //   },
      //   3 * 60 * 1000,
      // ); // 3 minutes

      // setCleanupTimeoutId(timeoutId);

      // Reset state when modal closes (but keep thumbnails)
      cleanupAndResetState();
    }
  }, [opened]);

  // Load preselected connector from session storage
  useEffect(() => {
    if (browserState === "connectorSelection") {
      const savedConnectorId = sessionStorage.getItem(CONNECTOR_SESSION_KEY);
      if (
        savedConnectorId &&
        connectors.some((c) => c.id === savedConnectorId)
      ) {
        setSelectedConnectorId(savedConnectorId);
      }
    }
  }, [browserState, connectors]);

  const resetState = () => {
    setBrowserState("loading");
    setConnectors([]);
    // setSelectedConnectorId(null);
    setLocalConnectorId(null);
    // setCurrentPath("/");
    setFolders([]);
    setSelectedFolders(new Set());
    setPersistentSelections(new Set());
    setIsLoadingFolders(false);
    setError(null);
    // Reset smart crop mode state
    setSmartCropMode(false);
    setSourceFile(null);
    setTargetSelectedFiles(new Set());
    // Reset pagination state
    setHasMorePages(false);
    setNextPageToken("");
    setIsLoadingMore(false);
    // Reset thumbnail loading state but keep URLs for caching
    setThumbnailErrors(new Map());
    setLoadingThumbnails(new Set());
    // Reset vision data cache
    setVisionDataCache(new Map());
    setLoadingVisionData(new Set());
  };

  const cleanupAndResetState = async () => {
    // Unregister the connector if we have a local connector ID
    if (localConnectorId) {
      try {
        const studioResult = await getStudio();
        if (studioResult.isOk()) {
          const unregisterResult = await unregisterConnector(
            studioResult.value,
            localConnectorId,
          );
          if (!unregisterResult.isOk()) {
            // Log error but don't throw - we still want to reset state
            raiseError(
              new Error(
                unregisterResult.error?.message ||
                  "Failed to unregister connector",
              ),
            );
          }
        }
      } catch (error) {
        // Log error but don't throw - we still want to reset state
        raiseError(error instanceof Error ? error : new Error(String(error)));
      }
    }

    thumbnailUrls.forEach((url, key) => {
      console.log(`[Cleanup] Timeout revoking URL for ${key}: ${url}`);
      URL.revokeObjectURL(url);
    });
    setThumbnailUrls(new Map());

    resetState();
  };

  const loadConnectors = async () => {
    try {
      setError(null);
      setBrowserState("loading");

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

      // Fetch connectors from API using the utility function
      const connectorsResult = await getMediaConnectorsAPI(baseUrl, token);
      if (!connectorsResult.isOk()) {
        throw new Error(
          connectorsResult.error?.message || "Failed to fetch connectors",
        );
      }

      const connectorResponse = connectorsResult.value;

      // Filter for media connectors that are enabled
      const mediaConnectors = connectorResponse.data.filter(
        (connector) => connector.type === "media" && connector.enabled,
      );

      setConnectors(mediaConnectors);

      // Check if we have a pre-selected connector and it exists in the loaded connectors
      if (
        selectedConnectorId &&
        mediaConnectors.some((c) => c.id === selectedConnectorId)
      ) {
        // Automatically proceed to folder browsing with the pre-selected connector
        await proceedWithConnector(selectedConnectorId, studioResult.value);
      } else {
        setBrowserState("connectorSelection");
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      setError(errorMessage);
      raiseError(new Error(errorMessage));
    }
  };

  // Helper function to proceed with a connector (used by both auto-selection and manual selection)
  const proceedWithConnector = async (connectorId: string, studio: any) => {
    try {
      setError(null);
      setIsLoadingFolders(true);

      // Save selection to session storage
      sessionStorage.setItem(CONNECTOR_SESSION_KEY, connectorId);

      // Register the selected connector and get the local connector ID
      const registerResult = await registerConnector(studio, connectorId);
      if (!registerResult.isOk()) {
        throw new Error(
          registerResult.error?.message || "Failed to register connector",
        );
      }

      const localId = registerResult.value as string;
      setLocalConnectorId(localId);
      setBrowserState("folderBrowsing");

      // Load initial folders
      await loadFolders(localId, selectedConnectorId, "/", "");
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      setError(errorMessage);
      raiseError(new Error(errorMessage));
      setIsLoadingFolders(false);
    }
  };

  // Wrapper function for setSelectedConnectorId that resets related state
  const setSelectedConnectorIdWithReset = (connectorId: string | null) => {
    setSelectedConnectorId(connectorId);
    setCurrentPath("/");
    setSelectedFolders(new Set());
    setSelectedFile(null);
    setPersistentSelections(new Set());
    // Reset pagination state when switching connectors
    setHasMorePages(false);
    setNextPageToken("");
    setIsLoadingMore(false);
    // Reset thumbnail state when switching connectors but keep URLs for caching
    setThumbnailErrors(new Map());
    setLoadingThumbnails(new Set());
    // Reset vision data cache when switching connectors
    setVisionDataCache(new Map());
    setLoadingVisionData(new Set());
  };

  // Function to load vision data for a file
  const loadVisionData = async (
    file: Media,
    localConnectorId: string,
    connectorId: string,
  ) => {
    if (!(file.type === "file" || (file.type as unknown) == 0)) {
      return;
    }

    const fileKey = `${localConnectorId}-${file.id}`;

    // Skip if already loading, loaded, or errored
    if (loadingVisionData.has(fileKey) || visionDataCache.has(fileKey)) {
      return;
    }

    // Mark as loading
    setLoadingVisionData((prev) => new Set(prev).add(fileKey));

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

      const visionResult = await getVision({
        baseUrl,
        connectorId,
        asset: file.id,
        authorization: token,
      });

      if (visionResult.isOk()) {
        // Vision data exists
        setVisionDataCache((prev) => {
          const newMap = new Map(prev);
          newMap.set(fileKey, true);
          return newMap;
        });
      } else {
        // Check if it's a VisionNotFoundError
        if ((visionResult.error as any)?.type === "VisionNotFoundError") {
          // Don't cache anything for VisionNotFoundError - just don't show icon
          setVisionDataCache((prev) => {
            const newMap = new Map(prev);
            newMap.set(fileKey, false);
            return newMap;
          });
        } else {
          // Other errors - don't cache
          console.warn(
            `Failed to load vision data for ${file.name}:`,
            visionResult.error?.message,
          );
        }
      }
    } catch (error) {
      console.warn(`Failed to load vision data for ${file.name}:`, error);
    } finally {
      // Remove from loading set
      setLoadingVisionData((prev) => {
        const newSet = new Set(prev);
        newSet.delete(fileKey);
        return newSet;
      });
    }
  };

  // Function to load thumbnail for a file
  const loadThumbnail = async (file: Media, connectorId: string) => {
    const fileKey = `${connectorId}-${file.id}`;

    // Skip if already loading, loaded, or errored
    if (
      loadingThumbnails.has(fileKey) ||
      thumbnailUrls.has(fileKey) ||
      thumbnailErrors.has(fileKey)
    ) {
      return;
    }

    // Mark as loading
    setLoadingThumbnails((prev) => new Set(prev).add(fileKey));

    try {
      const studioResult = await getStudio();
      if (!studioResult.isOk()) {
        throw new Error(studioResult.error?.message || "Failed to get studio");
      }

      const downloadResult = await downloadMediaConnector({
        studio: studioResult.value,
        connectorId: connectorId,
        assetId: file.id,
        downloadType: "thumbnail" as MediaDownloadType,
        metadata: {},
      });

      if (!downloadResult.isOk()) {
        throw new Error(
          downloadResult.error?.message || "Failed to download thumbnail",
        );
      }

      // Convert the Uint8Array to a blob and create object URL
      const uint8Array = downloadResult.value as Uint8Array;
      console.log(
        `[Thumbnail] Downloaded ${file.name}: ${uint8Array.length} bytes`,
      );

      // Try to detect content type from the first few bytes
      let contentType = "image/jpeg"; // default
      if (uint8Array.length > 4) {
        const header = Array.from(uint8Array.slice(0, 4))
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("");
        if (header.startsWith("ffd8")) contentType = "image/jpeg";
        else if (header.startsWith("8950")) contentType = "image/png";
        else if (header.startsWith("4749")) contentType = "image/gif";
        else if (header.startsWith("5249")) contentType = "image/webp";
        console.log(
          `[Thumbnail] Detected content type for ${file.name}: ${contentType} (header: ${header})`,
        );
      }

      const blob = new Blob([uint8Array], { type: contentType });
      const thumbnailUrl = URL.createObjectURL(blob);

      console.log(
        `[Thumbnail] Created blob URL for ${file.name}: ${thumbnailUrl}`,
      );

      // Update thumbnail URLs
      setThumbnailUrls((prev) => {
        const newMap = new Map(prev);
        newMap.set(fileKey, thumbnailUrl);
        console.log(`[Thumbnail] Stored URL for ${fileKey}: ${thumbnailUrl}`);
        return newMap;
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      setThumbnailErrors((prev) => new Map(prev).set(fileKey, errorMessage));
    } finally {
      // Remove from loading set
      setLoadingThumbnails((prev) => {
        const newSet = new Set(prev);
        newSet.delete(fileKey);
        return newSet;
      });
    }
  };

  const handleConnectorSelect = async () => {
    if (!selectedConnectorId) return;

    const studioResult = await getStudio();
    if (!studioResult.isOk()) {
      setError(studioResult.error?.message || "Failed to get studio");
      raiseError(
        new Error(studioResult.error?.message || "Failed to get studio"),
      );
      return;
    }

    await proceedWithConnector(selectedConnectorId, studioResult.value);
  };

  // Helper function to update selectedFolders based on persistent selections
  const updateSelectedFoldersForCurrentPath = (
    folderData: Media[],
    path: string,
  ) => {
    const currentPathSelections = new Set<string>();

    folderData.forEach((folder) => {
      const folderPath =
        path === "/" ? `/${folder.name}` : `${path}/${folder.name}`;
      if (persistentSelections.has(folderPath)) {
        currentPathSelections.add(folderPath);
      }
    });

    setSelectedFolders(currentPathSelections);
  };

  const loadFolders = async (
    connectorId: string,
    selectedConnectorId: string | null,
    path: string,
    pageToken: string = "",
    append: boolean = false,
  ) => {
    try {
      if (selectedConnectorId == null) {
        setError("Connector not selected.");
        raiseError(new Error("Connector not selected."));
        return;
      }

      // Set appropriate loading state
      if (append) {
        setIsLoadingMore(true);
      } else {
        setIsLoadingFolders(true);
      }
      setError(null);

      const studioResult = await getStudio();
      if (!studioResult.isOk()) {
        throw new Error(studioResult.error?.message || "Failed to get studio");
      }

      const queryResult = await queryMediaConnectorSimple(
        studioResult.value,
        connectorId,
        path,
        pageToken,
      );

      if (!queryResult.isOk()) {
        throw new Error(
          queryResult.error?.message || "Failed to query media connector",
        );
      }

      const queryPage = queryResult.value as QueryPage<Media>;

      // Filter for folders and files separately
      const folderData = queryPage.data.filter(
        (item) => item.type === "folder" || (item.type as unknown) == 1,
      );
      const fileData = queryPage.data.filter(
        (item) => item.type === "file" || (item.type as unknown) == 0,
      );

      if (append) {
        // Additional pages - append folders and files
        setFolders((prev) => {
          const newFolders = [...prev, ...folderData];
          if (mode === ImageBrowserMode.FolderSelection) {
            updateSelectedFoldersForCurrentPath(newFolders, path);
          }
          return newFolders;
        });
        setFiles((prev) => [...prev, ...fileData]);
        // Load thumbnails for files in both modes, but vision data only in file selection mode
        fileData.forEach((file) => {
          loadThumbnail(file, connectorId);
          if (mode === ImageBrowserMode.FileSelection) {
            loadVisionData(file, connectorId, selectedConnectorId);
          }
        });
      } else {
        // First page - replace folders and files
        setFolders(folderData);
        setFiles(fileData);
        // Update selectedFolders based on persistent selections for current path
        if (mode === ImageBrowserMode.FolderSelection) {
          updateSelectedFoldersForCurrentPath(folderData, path);
        }
        // Load thumbnails for files in both modes, but vision data only in file selection mode
        fileData.forEach((file) => {
          loadThumbnail(file, connectorId);
          if (mode === ImageBrowserMode.FileSelection) {
            loadVisionData(file, connectorId, selectedConnectorId);
          }
        });
      }

      // Update pagination state
      if (queryPage.nextPageToken) {
        setHasMorePages(true);
        setNextPageToken(queryPage.nextPageToken);
      } else {
        setHasMorePages(false);
        setNextPageToken("");
      }

      // Clear loading states
      setIsLoadingFolders(false);
      setIsLoadingMore(false);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      setError(errorMessage);
      raiseError(new Error(errorMessage));
      setIsLoadingFolders(false);
      setIsLoadingMore(false);
    }
  };

  // Function to load more items when scrolling
  const loadMoreItems = async () => {
    if (
      !localConnectorId ||
      !hasMorePages ||
      isLoadingMore ||
      nextPageToken === ""
    ) {
      return;
    }

    await loadFolders(
      localConnectorId,
      selectedConnectorId,
      currentPath,
      nextPageToken,
      true,
    );
  };

  // react-window item renderer for list view
  const ListItem = ({
    index,
    style,
  }: {
    index: number;
    style: React.CSSProperties;
  }) => {
    const allItems = [
      ...folders,
      // Show files in both FileSelection mode and FolderSelection mode
      ...files,
    ];
    const item = allItems[index];
    console.log(item);

    if (!item) return null;

    const isFolder = item.type === "folder" || (item.type as unknown) == 1;
    const isFile = item.type === "file" || (item.type as unknown) == 0;

    if (isFolder) {
      const folderPath =
        currentPath === "/" ? `/${item.name}` : `${currentPath}/${item.name}`;
      const isSelected = selectedFolders.has(folderPath);

      return (
        <div style={style}>
          <Card
            shadow="sm"
            padding="sm"
            radius="sm"
            style={{
              cursor: "pointer",
              border: isSelected ? "2px solid #228be6" : undefined,
              margin: "2px",
              height: itemSize - 4, // Account for margin
            }}
            onClick={() => navigateToFolder(item.name)}
          >
            <Group gap="md" align="center">
              {mode === ImageBrowserMode.FolderSelection && (
                <Checkbox
                  checked={isSelected}
                  onChange={() => toggleFolderSelection(item.name)}
                  onClick={(e) => e.stopPropagation()}
                />
              )}
              <IconFolder size={settings.iconSize} />
              <Text size="sm" style={{ flex: 1 }}>
                {item.name}
              </Text>
            </Group>
          </Card>
        </div>
      );
    }

    if (isFile) {
      const isSelected = selectedFile === item.id;
      const isSourceFile = smartCropMode && sourceFile === item.id;
      const isTargetSelected =
        smartCropMode && targetSelectedFiles.has(item.id);

      // In folder mode, files are not selectable
      const isFileSelectable = mode === ImageBrowserMode.FileSelection;

      return (
        <div style={style}>
          <Card
            shadow="sm"
            padding="sm"
            radius="sm"
            style={{
              cursor: !isFileSelectable
                ? "default"
                : smartCropMode && isSourceFile
                  ? "default"
                  : "pointer",
              border:
                isFileSelectable && isSelected
                  ? "2px solid #228be6"
                  : isFileSelectable && isTargetSelected
                    ? "2px solid #40c057"
                    : undefined,
              margin: "2px",
              height: itemSize - 4, // Account for margin
              opacity: !isFileSelectable ? 0.6 : isSourceFile ? 0.5 : 1,
              backgroundColor: !isFileSelectable
                ? "#f8f9fa"
                : isSourceFile
                  ? "#f8f9fa"
                  : undefined,
            }}
            onClick={() => {
              if (!isFileSelectable) {
                // Files are not selectable in folder mode
                return;
              }
              if (smartCropMode) {
                if (!isSourceFile) {
                  handleTargetFileToggle(item.id);
                }
              } else {
                handleFileSelection(item.id);
              }
            }}
          >
            <Group gap="md" align="center">
              {isFileSelectable && smartCropMode && !isSourceFile && (
                <Checkbox
                  checked={isTargetSelected}
                  onChange={() => handleTargetFileToggle(item.name)}
                  onClick={(e) => e.stopPropagation()}
                />
              )}
              {renderFileIcon(item)}
              <Group gap="md" justify="flex-start">
                <Text size="sm" style={{ flex: 1, userSelect: "text" }}>
                  {item.name}
                </Text>
                {isFileSelectable && renderVisionIcon(item)}
              </Group>
            </Group>
          </Card>
        </div>
      );
    }

    return null;
  };

  // react-window scroll handler for infinite loading
  const handleItemsRendered = ({
    visibleStopIndex,
  }: {
    visibleStopIndex: number;
  }) => {
    const allItems = [
      ...folders,
      // Show files in both FileSelection mode and FolderSelection mode
      ...files,
    ];
    const totalItems = allItems.length;

    // Load more when we're near the end (within 5 items)
    if (visibleStopIndex >= totalItems - 5 && hasMorePages && !isLoadingMore) {
      loadMoreItems();
    }
  };

  const navigateToFolder = async (folderName: string) => {
    if (!localConnectorId) return;

    const newPath =
      currentPath === "/" ? `/${folderName}` : `${currentPath}/${folderName}`;
    setCurrentPath(newPath);
    setFolders([]);
    // Clear selected file when navigating in file mode (but not in smart crop mode)
    if (mode === ImageBrowserMode.FileSelection && !smartCropMode) {
      setSelectedFile(null);
    }
    // Don't reset selectedFolders here - let updateSelectedFoldersForCurrentPath handle it
    await loadFolders(localConnectorId, selectedConnectorId, newPath, "");
  };

  const navigateBack = async () => {
    if (!localConnectorId || currentPath === "/") return;

    const pathParts = currentPath.split("/").filter(Boolean);
    pathParts.pop(); // Remove last part
    const newPath = pathParts.length === 0 ? "/" : `/${pathParts.join("/")}`;

    setCurrentPath(newPath);
    setFolders([]);
    // Clear selected file when navigating in file mode (but not in smart crop mode)
    if (mode === ImageBrowserMode.FileSelection && !smartCropMode) {
      setSelectedFile(null);
    }
    // Don't reset selectedFolders here - let updateSelectedFoldersForCurrentPath handle it
    await loadFolders(localConnectorId, selectedConnectorId, newPath, "");
  };

  const toggleFolderSelection = (folderName: string) => {
    const folderPath =
      currentPath === "/" ? `/${folderName}` : `${currentPath}/${folderName}`;
    const newSelected = new Set(selectedFolders);
    const newPersistent = new Set(persistentSelections);

    if (newSelected.has(folderPath)) {
      newSelected.delete(folderPath);
      newPersistent.delete(folderPath);
    } else {
      newSelected.add(folderPath);
      newPersistent.add(folderPath);
    }

    setSelectedFolders(newSelected);
    setPersistentSelections(newPersistent);
  };

  const toggleCurrentFolderSelection = () => {
    const newPersistent = new Set(persistentSelections);

    if (newPersistent.has(currentPath)) {
      newPersistent.delete(currentPath);
    } else {
      newPersistent.add(currentPath);
    }

    setPersistentSelections(newPersistent);
  };

  const clearAllFolderSelections = () => {
    setPersistentSelections(new Set());
    setSelectedFolders(new Set());
  };

  const handleFileSelection = (fileId: string) => {
    setSelectedFile(fileId);
  };

  const handleEnterSmartCropMode = () => {
    if (selectedFile) {
      setSmartCropMode(true);
      setSourceFile(selectedFile);
      setTargetSelectedFiles(new Set());
    }
  };

  const handleExitSmartCropMode = () => {
    setSmartCropMode(false);
    setSourceFile(null);
    setTargetSelectedFiles(new Set());
  };

  const handleTargetFileToggle = (fileName: string) => {
    const newTargetFiles = new Set(targetSelectedFiles);
    if (newTargetFiles.has(fileName)) {
      newTargetFiles.delete(fileName);
    } else {
      newTargetFiles.add(fileName);
    }
    setTargetSelectedFiles(newTargetFiles);
  };

  const handleDownloadFile = async () => {
    if (!selectedFile || !localConnectorId) {
      raiseError(new Error("No file or connector selected"));
      return;
    }

    try {
      const studioResult = await getStudio();
      if (!studioResult.isOk()) {
        throw new Error(studioResult.error?.message || "Failed to get studio");
      }

      // Find the selected file in the current files list to get its id
      const fileToDownload = files.find((file) => file.id === selectedFile);
      if (!fileToDownload) {
        throw new Error("Selected file not found");
      }

      const downloadResult = await downloadMediaConnector({
        studio: studioResult.value,
        connectorId: localConnectorId,
        assetId: fileToDownload.id,
        downloadType: MediaDownloadType.original,
        metadata: {},
      });

      if (!downloadResult.isOk()) {
        throw new Error(
          downloadResult.error?.message || "Failed to download file",
        );
      }

      // Convert the Uint8Array to a blob and create download URL
      const uint8Array = downloadResult.value as Uint8Array;
      const blob = new Blob([uint8Array]);
      const url = URL.createObjectURL(blob);

      // Create a temporary download link and trigger download
      const link = document.createElement("a");
      link.href = url;
      link.download = fileToDownload.name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Clean up the object URL
      URL.revokeObjectURL(url);

      console.log(
        `Downloaded ${fileToDownload.name}: ${uint8Array.length} bytes`,
      );
    } catch (error) {
      console.error("Download failed:", error);
      raiseError(error instanceof Error ? error : new Error("Download failed"));
    }
  };

  // Settings handlers
  const handleOpenSettings = () => {
    setTempSettings({ ...settings });
    setIsSettingsDrawerOpen(true);
  };

  const handleSaveSettings = () => {
    setSettings(tempSettings);
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(tempSettings));
    setIsSettingsDrawerOpen(false);
  };

  const handleCancelSettings = () => {
    setTempSettings({ ...settings });
    setIsSettingsDrawerOpen(false);
  };

  const handleCopyVisionData = async () => {
    if (!sourceFile || !localConnectorId || targetSelectedFiles.size === 0) {
      return;
    }

    try {
      // Reset tasks and show modal
      setCopyTasks([]);
      setShowTaskModal(true);

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

      // Step 1: Get vision data from source file
      const sourceFileObj = files.find((f) => f.id === sourceFile);
      if (!sourceFileObj) {
        throw new Error(`Source file ${sourceFile} not found`);
      }

      const getVisionTaskId = `get-vision-${sourceFileObj.id}`;
      setCopyTasks([
        {
          id: getVisionTaskId,
          name: `Getting vision data from: ${sourceFile}`,
          type: "get_vision",
          status: "processing",
        },
      ]);

      const visionResult = await getVision({
        baseUrl,
        connectorId: selectedConnectorId!,
        asset: sourceFileObj.id,
        authorization: token,
      });

      if (!visionResult.isOk()) {
        setCopyTasks((prev) =>
          prev.map((task) =>
            task.id === getVisionTaskId
              ? {
                  ...task,
                  status: "error",
                  error:
                    visionResult.error?.message || "Failed to get vision data",
                }
              : task,
          ),
        );
        return;
      }

      // Mark get vision task as complete
      setCopyTasks((prev) =>
        prev.map((task) =>
          task.id === getVisionTaskId ? { ...task, status: "complete" } : task,
        ),
      );

      const sourceVisionData = visionResult.value;

      // Step 2: Set vision data for each target file
      for (const targetFileName of targetSelectedFiles) {
        const targetFileObj = files.find((f) => f.id === targetFileName);
        if (!targetFileObj) {
          continue;
        }

        const setVisionTaskId = `set-vision-${targetFileObj.id}`;
        setCopyTasks((prev) => [
          ...prev,
          {
            id: setVisionTaskId,
            name: `Copying vision data to: ${targetFileName}`,
            type: "smart_crop_upload",
            status: "processing",
          },
        ]);

        try {
          const setResult = await setVision({
            baseUrl,
            connectorId: selectedConnectorId!,
            asset: targetFileObj.id,
            authorization: token,
            metadata: clampSubjectAreaToBounds(sourceVisionData),
          });

          if (setResult.isOk()) {
            setCopyTasks((prev) =>
              prev.map((task) =>
                task.id === setVisionTaskId
                  ? { ...task, status: "complete" }
                  : task,
              ),
            );

            // Update vision cache for target file
            const fileKey = `${localConnectorId}-${targetFileObj.id}`;
            setVisionDataCache((prev) => {
              const newMap = new Map(prev);
              newMap.set(fileKey, true);
              return newMap;
            });
          } else {
            setCopyTasks((prev) =>
              prev.map((task) =>
                task.id === setVisionTaskId
                  ? {
                      ...task,
                      status: "error",
                      error:
                        setResult.error?.message || "Failed to set vision data",
                    }
                  : task,
              ),
            );
          }
        } catch (error) {
          setCopyTasks((prev) =>
            prev.map((task) =>
              task.id === setVisionTaskId
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

  const handleSelection = async () => {
    // Cleanup connector before closing
    if (localConnectorId) {
      try {
        const studioResult = await getStudio();
        if (studioResult.isOk()) {
          const unregisterResult = await unregisterConnector(
            studioResult.value,
            localConnectorId,
          );
          if (!unregisterResult.isOk()) {
            raiseError(
              new Error(
                unregisterResult.error?.message ||
                  "Failed to unregister connector",
              ),
            );
          }
        }
      } catch (error) {
        raiseError(error instanceof Error ? error : new Error(String(error)));
      }
    }

    // Find the connector name from the connectors list
    const selectedConnector = connectors.find(
      (c) => c.id === selectedConnectorId,
    );
    const connectorName = selectedConnector?.name || "";

    if (mode === ImageBrowserMode.FolderSelection) {
      const selectedPaths = Array.from(persistentSelections);
      const selection: ImageBrowserFolderSelection = {
        selectedFolders: selectedPaths,
        connectorId: selectedConnectorId || "",
        connectorName: connectorName,
      };
      resetState();
      (onClose as (selection: ImageBrowserFolderSelection | null) => void)(
        selection,
      );
    } else {
      // File selection mode
      if (selectedFile) {
        const selection: ImageBrowserFileSelection = {
          selectedFile: selectedFile,
          folderPath: currentPath,
          connectorId: selectedConnectorId || "",
          connectorName: connectorName,
        };
        resetState();
        (onClose as (selection: ImageBrowserFileSelection | null) => void)(
          selection,
        );
      } else {
        resetState();
        (onClose as (selection: ImageBrowserFileSelection | null) => void)(
          null,
        );
      }
    }
  };

  const renderBreadcrumbs = () => {
    const pathParts = currentPath.split("/").filter(Boolean);
    const breadcrumbItems = [
      <Anchor
        key="root"
        onClick={() => {
          if (localConnectorId) {
            setCurrentPath("/");
            setFolders([]);
            // Clear selected file when navigating in file mode (but not in smart crop mode)
            if (mode === ImageBrowserMode.FileSelection && !smartCropMode) {
              setSelectedFile(null);
            }
            // Don't reset selectedFolders here - let updateSelectedFoldersForCurrentPath handle it
            loadFolders(localConnectorId, selectedConnectorId, "/", "");
          }
        }}
      >
        Root
      </Anchor>,
    ];

    pathParts.forEach((part, index) => {
      const partPath = `/${pathParts.slice(0, index + 1).join("/")}`;
      breadcrumbItems.push(
        <Anchor
          key={partPath}
          onClick={() => {
            if (localConnectorId) {
              setCurrentPath(partPath);
              setFolders([]);
              // Clear selected file when navigating in file mode (but not in smart crop mode)
              if (mode === ImageBrowserMode.FileSelection && !smartCropMode) {
                setSelectedFile(null);
              }
              // Don't reset selectedFolders here - let updateSelectedFoldersForCurrentPath handle it
              loadFolders(localConnectorId, selectedConnectorId, partPath, "");
            }
          }}
        >
          {part}
        </Anchor>,
      );
    });

    return <Breadcrumbs>{breadcrumbItems}</Breadcrumbs>;
  };

  // Helper function to render vision icon
  const renderVisionIcon = (file: Media) => {
    if (!localConnectorId) return null;

    const fileKey = `${localConnectorId}-${file.id}`;
    const hasVisionData = visionDataCache.get(fileKey);
    const isLoadingVision = loadingVisionData.has(fileKey);

    if (isLoadingVision) {
      return <Loader size={16} />;
    }

    if (hasVisionData) {
      return (
        <Tooltip label="Smart Crop (vision data) exist">
          <IconEyeCheck size={16} color="green" />
        </Tooltip>
      );
    }

    return null;
  };

  // Helper function to render file icon/thumbnail
  const renderFileIcon = (file: Media, size: number = settings.iconSize) => {
    if (!localConnectorId) return <IconFile size={size} />;

    const fileKey = `${localConnectorId}-${file.id}`;
    const thumbnailUrl = thumbnailUrls.get(fileKey);
    const thumbnailError = thumbnailErrors.get(fileKey);
    const isLoading = loadingThumbnails.has(fileKey);

    if (isLoading) {
      return <Loader size={size} />;
    }

    if (thumbnailError) {
      return (
        <Tooltip label={thumbnailError}>
          <IconExclamationCircle size={size} color="red" />
        </Tooltip>
      );
    }

    if (thumbnailUrl) {
      console.log(
        `[Render] Using thumbnail URL for ${file.name}: ${thumbnailUrl}`,
      );
      return (
        <img
          src={thumbnailUrl}
          alt={file.name}
          style={{
            width: size,
            height: size,
            objectFit: "cover",
            borderRadius: "4px",
          }}
          onLoad={() =>
            console.log(`[Image] Successfully loaded: ${thumbnailUrl}`)
          }
          onError={(e) => {
            console.error(`[Image] Failed to load: ${thumbnailUrl}`, e);
            console.log(`[Image] Current thumbnailUrls map:`, thumbnailUrls);
          }}
        />
      );
    }

    return <IconFile size={size} />;
  };

  // Helper function to render folders and files in grid mode
  const renderGridView = () => {
    return (
      <SimpleGrid cols={4} spacing="md">
        {folders.map((folder) => {
          const folderPath =
            currentPath === "/"
              ? `/${folder.name}`
              : `${currentPath}/${folder.name}`;
          const isSelected = selectedFolders.has(folderPath);

          return (
            <Card
              key={folder.id}
              shadow="sm"
              padding="md"
              radius="md"
              style={{
                cursor: "pointer",
                position: "relative",
                border: isSelected ? "2px solid #228be6" : undefined,
                minHeight: Math.max(120, settings.iconSize + 80), // Minimum 120px, or icon size + text space
              }}
              onClick={() => navigateToFolder(folder.name)}
            >
              {mode === ImageBrowserMode.FolderSelection && (
                <Checkbox
                  checked={isSelected}
                  onChange={() => toggleFolderSelection(folder.name)}
                  style={{
                    position: "absolute",
                    top: "8px",
                    right: "8px",
                  }}
                  onClick={(e) => e.stopPropagation()}
                />
              )}

              <Stack align="center" gap="xs">
                <IconFolder size={settings.iconSize} />
                <Text size="sm" ta="center" lineClamp={2}>
                  {folder.name}
                </Text>
              </Stack>
            </Card>
          );
        })}

        {files.map((file) => {
          const isSelected = selectedFile === file.name;
          const isSourceFile = smartCropMode && sourceFile === file.name;
          const isTargetSelected =
            smartCropMode && targetSelectedFiles.has(file.name);

          // In folder mode, files are not selectable
          const isFileSelectable = mode === ImageBrowserMode.FileSelection;

          return (
            <Card
              key={file.id}
              shadow="sm"
              padding="md"
              radius="md"
              style={{
                cursor: !isFileSelectable
                  ? "default"
                  : smartCropMode && isSourceFile
                    ? "default"
                    : "pointer",
                position: "relative",
                border:
                  isFileSelectable && isSelected
                    ? "2px solid #228be6"
                    : isFileSelectable && isTargetSelected
                      ? "2px solid #40c057"
                      : undefined,
                opacity: !isFileSelectable ? 0.6 : isSourceFile ? 0.5 : 1,
                backgroundColor: !isFileSelectable
                  ? "#f8f9fa"
                  : isSourceFile
                    ? "#f8f9fa"
                    : undefined,
                minHeight: Math.max(120, settings.iconSize + 80), // Minimum 120px, or icon size + text space
              }}
              onClick={() => {
                if (!isFileSelectable) {
                  // Files are not selectable in folder mode
                  return;
                }
                if (smartCropMode) {
                  if (!isSourceFile) {
                    handleTargetFileToggle(file.name);
                  }
                } else {
                  handleFileSelection(file.name);
                }
              }}
            >
              {isFileSelectable && smartCropMode && !isSourceFile && (
                <Checkbox
                  checked={isTargetSelected}
                  onChange={() => handleTargetFileToggle(file.name)}
                  style={{
                    position: "absolute",
                    top: "8px",
                    right: "8px",
                  }}
                  onClick={(e) => e.stopPropagation()}
                />
              )}

              <Stack align="center" gap="xs">
                {renderFileIcon(file)}
                <Group gap="xs" justify="flex-end">
                  <Text size="sm" ta="center" lineClamp={2}>
                    {file.name}
                  </Text>
                  {isFileSelectable && renderVisionIcon(file)}
                </Group>
              </Stack>
            </Card>
          );
        })}

        {isLoadingMore && (
          <Card shadow="sm" padding="md" radius="md" style={{ opacity: 0.7 }}>
            <Center h="100%">
              <Stack align="center" gap="xs">
                <Loader size="sm" />
                <Text size="xs" c="dimmed">
                  Loading more...
                </Text>
              </Stack>
            </Center>
          </Card>
        )}
      </SimpleGrid>
    );
  };

  return (
    <>
      <Modal
        opened={opened}
        onClose={async () => {
          await cleanupAndResetState();
          onClose(null);
        }}
        title={
          mode === ImageBrowserMode.FolderSelection
            ? "Select Folders for Smart Crops"
            : "Select File"
        }
        fullScreen
        styles={{
          content: {
            height: "100vh",
          },
          body: {
            padding: "1rem",
            height: "calc(100vh - 80px)",
            display: "flex",
            flexDirection: "column",
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
        <Stack gap="sm">
          {error && (
            <Alert
              icon={<IconAlertCircle size="1rem" />}
              title="Error"
              color="red"
            >
              {error}
            </Alert>
          )}

          {browserState === "loading" && (
            <Center>
              <Stack align="center" gap="md">
                <Loader size="lg" />
                <Text>Loading connectors...</Text>
              </Stack>
            </Center>
          )}

          {browserState === "connectorSelection" && (
            <Stack gap="md" align="center">
              <Text size="md" ta="center">
                {mode === ImageBrowserMode.FolderSelection
                  ? "Choose a connector to browse folders"
                  : "Choose a connector to browse files"}
              </Text>

              <Select
                label="Choose Connector"
                placeholder="Select a connector"
                data={connectors.map((c) => ({ value: c.id, label: c.name }))}
                value={selectedConnectorId}
                onChange={setSelectedConnectorId}
                style={{ width: "300px" }}
              />

              <Button
                onClick={handleConnectorSelect}
                disabled={!selectedConnectorId}
                loading={isLoadingFolders}
                style={{ marginLeft: "-50px" }}
              >
                Select
              </Button>
            </Stack>
          )}

          {browserState === "folderBrowsing" && (
            <>
              {/* Combined navigation and connector selection */}
              <Group justify="space-between" align="center">
                <Group gap="md">
                  <ActionIcon
                    variant="subtle"
                    onClick={navigateBack}
                    disabled={currentPath === "/"}
                  >
                    <IconArrowBigLeftFilled size={20} />
                  </ActionIcon>
                  {renderBreadcrumbs()}
                </Group>

                <Group gap="md" align="flex-end">
                  <ActionIcon
                    variant="subtle"
                    onClick={handleOpenSettings}
                    aria-label="Image Browser Settings"
                  >
                    <IconSettings size={20} />
                  </ActionIcon>
                  <Select
                    label="Change Connector"
                    placeholder="Select a connector"
                    data={connectors.map((c) => ({
                      value: c.id,
                      label: c.name,
                    }))}
                    value={selectedConnectorId}
                    onChange={async (value) => {
                      if (value && value !== selectedConnectorId) {
                        // Reset state and switch to new connector
                        setSelectedConnectorIdWithReset(value);

                        // Cleanup current connector if exists
                        if (localConnectorId) {
                          try {
                            const studioResult = await getStudio();
                            if (studioResult.isOk()) {
                              await unregisterConnector(
                                studioResult.value,
                                localConnectorId,
                              );
                            }
                          } catch (error) {
                            raiseError(
                              error instanceof Error
                                ? error
                                : new Error(String(error)),
                            );
                          }
                        }

                        // Proceed with new connector
                        const studioResult = await getStudio();
                        if (studioResult.isOk()) {
                          await proceedWithConnector(value, studioResult.value);
                        }
                      }
                    }}
                    style={{ width: "250px" }}
                  />
                </Group>
              </Group>

              {/* Toolbar for file selection mode when a file is selected */}
              {mode === ImageBrowserMode.FileSelection &&
                selectedFile &&
                !smartCropMode && (
                  <Group gap="md">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleEnterSmartCropMode}
                    >
                      Copy Smart Crop
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleDownloadFile}
                    >
                      Download
                    </Button>
                  </Group>
                )}

              {/* Toolbar for smart crop mode */}
              {smartCropMode && (
                <Group gap="md">
                  <Button
                    variant="filled"
                    size="sm"
                    disabled={targetSelectedFiles.size === 0}
                    onClick={handleCopyVisionData}
                  >
                    Paste
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleExitSmartCropMode}
                  >
                    Cancel
                  </Button>
                </Group>
              )}

              {/* Toolbar for folder selection mode when folders are selected */}
              {mode === ImageBrowserMode.FolderSelection &&
                persistentSelections.size > 0 && (
                  <Group justify="space-between">
                    <Button
                      variant="default"
                      size="sm"
                      onClick={clearAllFolderSelections}
                    >
                      Cancel
                    </Button>
                    <Group gap="md">
                      {currentPath !== "/" && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={toggleCurrentFolderSelection}
                        >
                          {persistentSelections.has(currentPath)
                            ? "Remove Current Folder"
                            : "Add Current Folder"}
                        </Button>
                      )}
                      <Button
                        size="sm"
                        onClick={handleSelection}
                        disabled={persistentSelections.size === 0}
                      >
                        Select ({persistentSelections.size})
                      </Button>
                    </Group>
                  </Group>
                )}

              <div style={{ flex: 1, minHeight: "500px" }}>
                {folders.length === 0 && isLoadingFolders ? (
                  <Center h={200}>
                    <Stack align="center" gap="md">
                      <Loader size="lg" />
                      <Text c="dimmed">Loading folders...</Text>
                    </Stack>
                  </Center>
                ) : folders.length === 0 &&
                  files.length === 0 &&
                  !isLoadingFolders ? (
                  <Center h={200}>
                    <Text c="dimmed">
                      {mode === ImageBrowserMode.FolderSelection
                        ? "No folders found"
                        : "No folders or files found"}
                    </Text>
                  </Center>
                ) : displayMode === "list" ? (
                  <div style={{ height: "800px", minHeight: "500px" }}>
                    <List
                      height={800}
                      width="100%"
                      itemCount={folders.length + files.length}
                      itemSize={itemSize}
                      onItemsRendered={handleItemsRendered}
                    >
                      {ListItem}
                    </List>
                    {isLoadingMore && (
                      <Card
                        shadow="sm"
                        padding="md"
                        radius="md"
                        style={{ opacity: 0.7, margin: "2px" }}
                      >
                        <Group gap="md" align="center">
                          <Loader size="sm" />
                          <Text size="sm" c="dimmed">
                            Loading more...
                          </Text>
                        </Group>
                      </Card>
                    )}
                  </div>
                ) : (
                  renderGridView()
                )}
              </div>

              {mode === ImageBrowserMode.FolderSelection &&
                persistentSelections.size > 0 && (
                  <Stack gap="xs">
                    <Text size="sm" fw={500}>
                      Selected folders:
                    </Text>
                    <ScrollArea h={80}>
                      <Stack gap="xs">
                        {Array.from(persistentSelections).map((path) => (
                          <Text key={path} size="xs" c="dimmed">
                            {path}
                          </Text>
                        ))}
                      </Stack>
                    </ScrollArea>
                  </Stack>
                )}

              {mode === ImageBrowserMode.FileSelection && selectedFile && (
                <Stack gap="xs">
                  <Text size="sm" fw={500}>
                    Selected file:
                  </Text>
                  <Text size="xs" c="dimmed">
                    {selectedFile}
                  </Text>
                </Stack>
              )}
            </>
          )}
        </Stack>
      </Modal>

      {/* Task Progress Modal */}
      <Modal
        opened={showTaskModal}
        onClose={() => {
          const allComplete = copyTasks.every(
            (task) =>
              task.status === "complete" ||
              task.status === "error" ||
              task.status === "info",
          );
          if (allComplete) {
            setShowTaskModal(false);
            setCopyTasks([]);
            // Exit smart crop mode after successful copy
            handleExitSmartCropMode();
          }
        }}
        title="Copying Vision Data"
        size="lg"
        closeOnClickOutside={false}
        closeOnEscape={false}
      >
        <DownloadTasksScreen
          downloadFiles={[]}
          tasks={copyTasks}
          uploadTasks={[]}
          onClose={() => {
            setShowTaskModal(false);
            setCopyTasks([]);
            handleExitSmartCropMode();
          }}
        />
      </Modal>

      {/* Settings Drawer */}
      <Drawer
        opened={isSettingsDrawerOpen}
        onClose={handleCancelSettings}
        title="Image Browser Settings"
        position="right"
        size="md"
        padding="md"
      >
        <Stack gap="lg">
          <Stack gap="md">
            <Text size="sm" fw={500}>
              File and Folder Icon Size
            </Text>
            <Slider
              value={tempSettings.iconSize}
              onChange={(value) =>
                setTempSettings({ ...tempSettings, iconSize: value })
              }
              min={24}
              max={192}
              step={24}
              marks={[
                { value: 24, label: "sm" },
                { value: 48, label: "md" },
                { value: 96, label: "lg" },
                { value: 192, label: "xl" },
              ]}
              style={{ marginTop: "1rem", marginBottom: "1rem" }}
            />
          </Stack>

          <Group justify="flex-end" gap="md">
            <Button variant="outline" onClick={handleCancelSettings}>
              Cancel
            </Button>
            <Button onClick={handleSaveSettings}>Save</Button>
          </Group>
        </Stack>
      </Drawer>
    </>
  );
}
