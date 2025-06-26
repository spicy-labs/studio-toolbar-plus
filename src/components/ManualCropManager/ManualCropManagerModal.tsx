import React, { useState, useEffect, useCallback } from "react";
import {
  Modal,
  Box,
  Group,
  ActionIcon,
  Tooltip,
  Text,
  Button,
  Select,
} from "@mantine/core";
import { IconChevronLeft, IconChevronRight, IconX } from "@tabler/icons-react";
import { LayoutViewer } from "./LayoutViewer";
import { ManualCropEditor } from "./ManualCropEditor";
import { appStore } from "../../modalStore";
import { getStudio, getCurrentConnectors } from "../../studio/studioAdapter";
import type { DocumentConnectorWithUsage } from "../../types/connectorTypes";

interface ManualCropManagerModalProps {
  opened: boolean;
  onClose: () => void;
}

export function ManualCropManagerModal({
  opened,
  onClose,
}: ManualCropManagerModalProps) {
  const [isLayoutViewerCollapsed, setIsLayoutViewerCollapsed] = useState(false);
  const [layoutViewerWidth, setLayoutViewerWidth] = useState(400);
  const [selectedLayoutIds, setSelectedLayoutIds] = useState<string[]>([]);
  const [selectedConnectorId, setSelectedConnectorId] = useState<string>("");
  const [isResizing, setIsResizing] = useState(false);
  const [connectors, setConnectors] = useState<DocumentConnectorWithUsage[]>(
    [],
  );
  const [layoutViewerRefresh, setLayoutViewerRefresh] = useState<
    (() => void) | null
  >(null);

  const enableToolbar = appStore((state) => state.enableToolbar);
  const disableToolbar = appStore((state) => state.disableToolbar);
  const raiseError = appStore((state) => state.raiseError);

  // Load connectors function
  const loadConnectors = async () => {
    try {
      const studioResult = await getStudio();
      if (!studioResult.isOk()) {
        raiseError(
          new Error(studioResult.error?.message || "Failed to get studio"),
        );
        return;
      }
      const studio = studioResult.value;
      const connectorsResult = await getCurrentConnectors(studio);

      if (!connectorsResult.isOk()) {
        raiseError(
          new Error(
            "Failed to load connectors: " + connectorsResult.error?.message,
          ),
        );
        return;
      }

      const connectorsData = connectorsResult.value;
      setConnectors(connectorsData);

      // Load selected connector from sessionStorage or auto-select first connector
      const storedConnectorId = sessionStorage.getItem(
        "tempManualCropManager_selectedConnectorId",
      );

      if (
        storedConnectorId &&
        connectorsData.some((c) => c.id === storedConnectorId)
      ) {
        // Use stored connector if it exists in the current connectors
        setSelectedConnectorId(storedConnectorId);
      } else if (!selectedConnectorId && connectorsData.length > 0) {
        // Auto-select first connector if none selected and no valid stored connector
        const firstConnectorId = connectorsData[0].id;
        setSelectedConnectorId(firstConnectorId);
        sessionStorage.setItem(
          "tempManualCropManager_selectedConnectorId",
          firstConnectorId,
        );
      }
    } catch (error) {
      raiseError(
        error instanceof Error ? error : new Error("Failed to load connectors"),
      );
    }
  };

  // Reset state when modal opens and handle toolbar visibility
  useEffect(() => {
    if (opened) {
      // Load selected layouts from sessionStorage
      const storedSelected = sessionStorage.getItem(
        "tempManualCropManager_layoutsSelected",
      );
      if (storedSelected) {
        try {
          const selectedIds = JSON.parse(storedSelected) as string[];
          setSelectedLayoutIds(selectedIds);
        } catch (error) {
          // If parsing fails, just use empty array
          setSelectedLayoutIds([]);
        }
      } else {
        setSelectedLayoutIds([]);
      }

      setSelectedConnectorId("");
      disableToolbar(); // Hide toolbar when modal opens
      loadConnectors(); // Load connectors when modal opens
    } else {
      enableToolbar(); // Show toolbar when modal closes
    }
  }, [opened]);

  // Save selected layouts to sessionStorage whenever they change
  useEffect(() => {
    sessionStorage.setItem(
      "tempManualCropManager_layoutsSelected",
      JSON.stringify(selectedLayoutIds),
    );
  }, [selectedLayoutIds]);

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsResizing(true);
    e.preventDefault();
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isResizing) return;

    const newWidth = e.clientX;
    if (newWidth >= 200 && newWidth <= 600) {
      setLayoutViewerWidth(newWidth);
    }
  };

  const handleMouseUp = () => {
    setIsResizing(false);
  };

  useEffect(() => {
    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      return () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };
    }
  }, [isResizing]);

  const toggleLayoutViewer = () => {
    setIsLayoutViewerCollapsed(!isLayoutViewerCollapsed);
  };

  const handleConnectorChange = (value: string | null) => {
    const connectorId = value || "";
    setSelectedConnectorId(connectorId);

    // Save to sessionStorage
    if (connectorId) {
      sessionStorage.setItem(
        "tempManualCropManager_selectedConnectorId",
        connectorId,
      );
    } else {
      sessionStorage.removeItem("tempManualCropManager_selectedConnectorId");
    }
  };

  const handleClose = () => {
    enableToolbar(); // Ensure toolbar is enabled when closing
    onClose();
  };

  const handleLayoutViewerRefreshReady = useCallback(
    (refreshFn: () => void) => {
      setLayoutViewerRefresh(() => refreshFn);
    },
    [],
  );

  const handleCropsSaved = useCallback(async () => {
    // Refresh the layout viewer crop indicators when crops are saved
    if (layoutViewerRefresh) {
      layoutViewerRefresh();
    }

    // Check if any new layouts now have crops and should be added to selection
    if (selectedConnectorId) {
      try {
        const studioResult = await getStudio();
        if (studioResult.isOk()) {
          const { getManualCropsFromDocByConnector } = await import(
            "../../studio-adapter/getManualCropsFromDocByConnector"
          );
          const cropsResult = await getManualCropsFromDocByConnector(
            studioResult.value,
            selectedConnectorId,
          );

          if (cropsResult.isOk()) {
            const cropsData = cropsResult.value;
            const layoutsWithCrops = new Set(
              cropsData.layouts.map((l) => l.id),
            );

            // Add any layouts that now have crops but aren't selected
            const newLayoutsWithCrops = Array.from(layoutsWithCrops).filter(
              (layoutId) => !selectedLayoutIds.includes(layoutId),
            );

            if (newLayoutsWithCrops.length > 0) {
              setSelectedLayoutIds((prev) => [...prev, ...newLayoutsWithCrops]);
            }
          }
        }
      } catch (error) {
        // Silently fail - this is just a convenience feature
        console.warn("Failed to auto-select layouts with new crops:", error);
      }
    }
  }, [layoutViewerRefresh, selectedConnectorId, selectedLayoutIds]);

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      fullScreen
      padding={0}
      withCloseButton={false}
    >
      {/* Custom Header */}
      <Box
        style={{
          padding: "16px 24px",
          borderBottom: "1px solid var(--mantine-color-gray-3)",
          backgroundColor: "var(--mantine-color-gray-0)",
        }}
      >
        <Group justify="space-between" align="center">
          <Group gap="lg" align="center">
            <Text size="lg" fw={600}>
              Manual Crop Manager
            </Text>
            <Group gap="md" align="center">
              <Text size="sm" fw={500}>
                Show crops for connector:
              </Text>
              <Select
                placeholder="Select connector"
                data={connectors.map((connector) => ({
                  value: connector.id,
                  label:
                    connector.name +
                    " (" +
                    connector.usesInTemplate.images.reduce(
                      (acc, image) => acc + `SFrame:${image.name}, `,
                      "",
                    ) +
                    connector.usesInTemplate.variables.reduce(
                      (acc, variable) => acc + `Var:${variable.name}, `,
                      "",
                    ) +
                    ")",
                }))}
                value={selectedConnectorId}
                onChange={handleConnectorChange}
                style={{ minWidth: 200 }}
                size="sm"
              />
            </Group>
          </Group>
          <Button
            variant="subtle"
            color="gray"
            size="sm"
            leftSection={<IconX size={16} />}
            onClick={handleClose}
          >
            Close
          </Button>
        </Group>
      </Box>

      <Box style={{ display: "flex", height: "calc(100vh - 120px)" }}>
        {/* Layout Viewer Panel */}
        <Box
          style={{
            width: isLayoutViewerCollapsed ? 40 : layoutViewerWidth,
            minWidth: isLayoutViewerCollapsed ? 40 : 200,
            maxWidth: isLayoutViewerCollapsed ? 40 : 600,
            borderRight: "1px solid var(--mantine-color-gray-3)",
            display: "flex",
            flexDirection: "column",
            transition: isLayoutViewerCollapsed ? "width 0.2s ease" : "none",
          }}
        >
          {isLayoutViewerCollapsed ? (
            <Box
              style={{
                padding: "8px",
                display: "flex",
                justifyContent: "center",
              }}
            >
              <Tooltip label="Expand Layout Viewer" position="right">
                <ActionIcon
                  variant="subtle"
                  onClick={toggleLayoutViewer}
                  size="sm"
                >
                  <IconChevronRight size={16} />
                </ActionIcon>
              </Tooltip>
            </Box>
          ) : (
            <>
              <Group
                justify="space-between"
                p="md"
                style={{
                  borderBottom: "1px solid var(--mantine-color-gray-3)",
                }}
              >
                <Box style={{ fontSize: "14px", fontWeight: 500 }}>
                  Layout Viewer
                </Box>
                <Tooltip label="Collapse Layout Viewer" position="left">
                  <ActionIcon
                    variant="subtle"
                    onClick={toggleLayoutViewer}
                    size="sm"
                  >
                    <IconChevronLeft size={16} />
                  </ActionIcon>
                </Tooltip>
              </Group>
              <Box style={{ flex: 1, overflow: "hidden" }}>
                <LayoutViewer
                  selectedLayoutIds={selectedLayoutIds}
                  onSelectionChange={setSelectedLayoutIds}
                  selectedConnectorId={selectedConnectorId}
                  onRefreshFunctionReady={handleLayoutViewerRefreshReady}
                />
              </Box>
            </>
          )}
        </Box>

        {/* Resize Handle */}
        {!isLayoutViewerCollapsed && (
          <Box
            style={{
              width: 4,
              cursor: "col-resize",
              backgroundColor: isResizing
                ? "var(--mantine-color-blue-5)"
                : "transparent",
              transition: "background-color 0.2s ease",
            }}
            onMouseDown={handleMouseDown}
          />
        )}

        {/* Manual Crop Editor Panel */}
        <Box style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          <ManualCropEditor
            selectedLayoutIds={selectedLayoutIds}
            selectedConnectorId={selectedConnectorId}
            onModalClose={handleClose}
            onCropsSaved={handleCropsSaved}
          />
        </Box>
      </Box>
    </Modal>
  );
}
