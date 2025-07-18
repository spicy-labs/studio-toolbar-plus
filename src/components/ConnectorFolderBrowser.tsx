import { useState, useEffect } from "react";
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
} from "@mantine/core";
import {
  IconAlertCircle,
  IconFolder,
  IconArrowBigLeftFilled,
} from "@tabler/icons-react";
import { appStore } from "../modalStore";
import { getStudio } from "../studio/studioAdapter";
import { queryMediaConnectorSimple } from "../studio/mediaConnectorHandler";
import {
  registerConnector,
  unregisterConnector,
} from "../studio/connectorAdapter";
import type { Connector } from "../types/connectorTypes";
import { getMediaConnectorsAPI } from "../utils/getMediaConnectorsAPI";

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

export interface ConnectorFolderSelection {
  selectedFolders: string[];
  connectorId: string;
  connectorName: string;
}

interface ConnectorFolderBrowserProps {
  opened: boolean;
  onClose: (selection: ConnectorFolderSelection | null) => void;
  initialSelection?: ConnectorFolderSelection | null;
}

type BrowserState = "loading" | "connectorSelection" | "folderBrowsing";

export function ConnectorFolderBrowser({
  opened,
  onClose,
  initialSelection = null,
}: ConnectorFolderBrowserProps) {
  const raiseError = appStore((store) => store.raiseError);

  // State management
  const [browserState, setBrowserState] = useState<BrowserState>("loading");
  const [connectors, setConnectors] = useState<Connector[]>([]);
  const [selectedConnectorId, setSelectedConnectorId] = useState<string | null>(
    null,
  );
  const [localConnectorId, setLocalConnectorId] = useState<string | null>(null);
  const [currentPath, setCurrentPath] = useState<string>("/");
  const [folders, setFolders] = useState<Media[]>([]);
  const [selectedFolders, setSelectedFolders] = useState<Set<string>>(
    new Set(),
  );
  // Persistent selection storage across navigation
  const [persistentSelections, setPersistentSelections] = useState<Set<string>>(
    new Set(),
  );
  const [isLoadingFolders, setIsLoadingFolders] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileCount, setFileCount] = useState<number>(0);

  // Session storage key for connector selection
  const CONNECTOR_SESSION_KEY = "tempDownloadModal_connectorId";

  // Load connectors when modal opens and initialize pre-selected paths
  useEffect(() => {
    if (opened) {
      // Initialize persistent selections with pre-selected paths
      const selectedPaths = initialSelection?.selectedFolders || [];
      setPersistentSelections(new Set(selectedPaths));

      // Set the connector ID if provided
      if (initialSelection?.connectorId) {
        setSelectedConnectorId(initialSelection.connectorId);
      }

      loadConnectors();
    } else {
      // Reset state when modal closes
      cleanupAndResetState();
    }
  }, [opened, initialSelection]);

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
    setSelectedConnectorId(null);
    setLocalConnectorId(null);
    setCurrentPath("/");
    setFolders([]);
    setSelectedFolders(new Set());
    setPersistentSelections(new Set());
    setIsLoadingFolders(false);
    setError(null);
    setFileCount(0);
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
      await loadFolders(localId, "/", "");
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      setError(errorMessage);
      raiseError(new Error(errorMessage));
      setIsLoadingFolders(false);
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
    path: string,
    pageToken: string = "",
  ) => {
    try {
      setIsLoadingFolders(true);
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

      if (pageToken === "") {
        // First page - replace folders and reset file count
        setFolders(folderData);
        setFileCount(fileData.length);
        // Update selectedFolders based on persistent selections for current path
        updateSelectedFoldersForCurrentPath(folderData, path);
      } else {
        // Additional pages - append folders and add to file count
        setFolders((prev) => {
          const newFolders = [...prev, ...folderData];
          updateSelectedFoldersForCurrentPath(newFolders, path);
          return newFolders;
        });
        setFileCount((prev) => prev + fileData.length);
      }

      // If there are more pages, automatically load them
      if (queryPage.nextPageToken) {
        // Continue loading in the background
        setTimeout(() => {
          loadFolders(connectorId, path, queryPage.nextPageToken);
        }, 100); // Small delay to prevent overwhelming the API
      } else {
        setIsLoadingFolders(false);
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      setError(errorMessage);
      raiseError(new Error(errorMessage));
      setIsLoadingFolders(false);
    }
  };

  const navigateToFolder = async (folderName: string) => {
    if (!localConnectorId) return;

    const newPath =
      currentPath === "/" ? `/${folderName}` : `${currentPath}/${folderName}`;
    setCurrentPath(newPath);
    setFolders([]);
    // Don't reset selectedFolders here - let updateSelectedFoldersForCurrentPath handle it
    await loadFolders(localConnectorId, newPath, "");
  };

  const navigateBack = async () => {
    if (!localConnectorId || currentPath === "/") return;

    const pathParts = currentPath.split("/").filter(Boolean);
    pathParts.pop(); // Remove last part
    const newPath = pathParts.length === 0 ? "/" : `/${pathParts.join("/")}`;

    setCurrentPath(newPath);
    setFolders([]);
    // Don't reset selectedFolders here - let updateSelectedFoldersForCurrentPath handle it
    await loadFolders(localConnectorId, newPath, "");
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

  const handleSelectFolders = async () => {
    const selectedPaths = Array.from(persistentSelections);

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

    const selection: ConnectorFolderSelection = {
      selectedFolders: selectedPaths,
      connectorId: selectedConnectorId || "",
      connectorName: connectorName,
    };

    resetState();
    onClose(selection);
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
            // Don't reset selectedFolders here - let updateSelectedFoldersForCurrentPath handle it
            loadFolders(localConnectorId, "/", "");
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
              // Don't reset selectedFolders here - let updateSelectedFoldersForCurrentPath handle it
              loadFolders(localConnectorId, partPath, "");
            }
          }}
        >
          {part}
        </Anchor>,
      );
    });

    return <Breadcrumbs>{breadcrumbItems}</Breadcrumbs>;
  };

  return (
    <Modal
      opened={opened}
      onClose={async () => {
        await cleanupAndResetState();
        onClose(null);
      }}
      title="Select Folders for Smart Crops"
      fullScreen
      styles={{
        content: {
          height: "100vh",
        },
        body: {
          padding: "2rem",
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
      <Stack gap="lg">
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
              Choose a connector to browse folders
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
            <Text size="sm" c="dimmed" ta="center">
              Select folders to copy smart crops. All files directly under the
              selected folders will be included. Subfolders will not be
              automatically included.
            </Text>

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

            {/* File count display */}
            <Group justify="space-between" align="center">
              <Text size="sm" c="dimmed">
                Files: {fileCount}
              </Text>
            </Group>

            <ScrollArea style={{ flex: 1, minHeight: "400px" }}>
              {folders.length === 0 && isLoadingFolders ? (
                <Center h={200}>
                  <Stack align="center" gap="md">
                    <Loader size="lg" />
                    <Text c="dimmed">Loading folders...</Text>
                  </Stack>
                </Center>
              ) : folders.length === 0 && !isLoadingFolders ? (
                <Center h={200}>
                  <Text c="dimmed">No folders found</Text>
                </Center>
              ) : (
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
                        }}
                        onClick={() => navigateToFolder(folder.name)}
                      >
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

                        <Stack align="center" gap="xs">
                          <IconFolder size={32} />
                          <Text size="sm" ta="center" lineClamp={2}>
                            {folder.name}
                          </Text>
                        </Stack>
                      </Card>
                    );
                  })}

                  {isLoadingFolders && folders.length > 0 && (
                    <Card
                      shadow="sm"
                      padding="md"
                      radius="md"
                      style={{ opacity: 0.7 }}
                    >
                      <Center h="100%">
                        <Stack align="center" gap="xs">
                          <Loader size="sm" />
                          <Text size="xs" c="dimmed">
                            Loading...
                          </Text>
                        </Stack>
                      </Center>
                    </Card>
                  )}
                </SimpleGrid>
              )}
            </ScrollArea>

            {persistentSelections.size > 0 && (
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

            <Group justify="space-between" mt="xl">
              <Button
                variant="default"
                onClick={async () => {
                  await cleanupAndResetState();
                  onClose(null);
                }}
              >
                Cancel
              </Button>
              <Group gap="md">
                {currentPath !== "/" && (
                  <Button
                    variant="outline"
                    onClick={toggleCurrentFolderSelection}
                  >
                    {persistentSelections.has(currentPath)
                      ? "Remove Current Folder"
                      : "Add Current Folder"}
                  </Button>
                )}
                <Button
                  onClick={handleSelectFolders}
                  disabled={persistentSelections.size === 0}
                >
                  Select ({persistentSelections.size})
                </Button>
              </Group>
            </Group>
          </>
        )}
      </Stack>
    </Modal>
  );
}
