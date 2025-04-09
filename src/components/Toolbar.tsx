import React, { useState, useEffect } from "react";
import {
  ActionIcon,
  Box,
  Transition,
  Group,
  Tooltip,
  Button,
  Modal,
  Text,
  Stack,
} from "@mantine/core";
import {
  IconBug,
  IconMapBolt,
  IconArrowsTransferUpDown,
  IconExternalLink,
  IconCameraPlus,
  IconPhotoCog,
  IconListTree,
} from "@tabler/icons-react";
import { useAppStore } from "../modalStore";
import { FrameSnapshotLayoutModal } from "./FrameSnapshotLayoutModal";
import { AddFrameSnapshotModal } from "./AddFrameSnapshotModal";
import { LayoutManagerModal } from "./LayoutManagerModal";
import { DownloadModal } from "./DownloadModal";

export function Toolbar() {
  const [visible, setVisible] = useState(false);
  const [isDownloadUploadModalOpen, setIsDownloadUploadModalOpen] =
    useState(false);
  const [isConvertModalOpen, setIsConvertModalOpen] = useState(false);
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const [isFramePositionViewerOpen, setIsFramePositionViewerOpen] = useState(false);
  const [isAddFrameSnapshotModalOpen, setIsAddFrameSnapshotModalOpen] = useState(false);
  const [isLayoutManagerOpen, setIsLayoutManagerOpen] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<{
    currentVersion: string;
    latestVersion: string;
  } | null>(null);

  const { effects, raiseError, state, disableToolbar } = useAppStore();

  const handleTestError = () => {
    raiseError(new Error("This is a test error message"));
  };

  const setVisibleIntercept = (value: boolean) => {
    if (!state.isToolbarEnabled) {
      setVisible(false);
    }
    setVisible(value);
  };

  const handleUploadDownloadClick = () => {
    setIsDownloadUploadModalOpen(true);
  };

  // Handle dismissing update notification
  const handleDismissUpdate = () => {
    if (updateInfo) {
      // Fallback for local storage if chrome API isn't available
      localStorage.setItem(
        "toolbarplus_last_notified_version",
        updateInfo.latestVersion,
      );
    }
    setIsUpdateModalOpen(false);
  };

  // Listen for update notifications
  useEffect(() => {
    // Check for version info div (from content script)
    const versionDiv = document.getElementById("toolbar-version");
    if (versionDiv) {
      const currentVersion = versionDiv.dataset.currentVersion;
      const latestVersion = versionDiv.dataset.latestVersion;

      if (currentVersion && latestVersion && currentVersion !== latestVersion) {
        setUpdateInfo({
          currentVersion,
          latestVersion,
        });
        setIsUpdateModalOpen(true);
      }
    }

    // // Listen for custom event from content script
    // const updateListener = (e: CustomEvent) => {
    //   if (e.detail && e.detail.currentVersion && e.detail.latestVersion) {
    //     setUpdateInfo({
    //       currentVersion: e.detail.currentVersion,
    //       latestVersion: e.detail.latestVersion
    //     });
    //     setIsUpdateModalOpen(true);
    //   }
    // };

    // document.addEventListener('toolbarPlusUpdate', updateListener as EventListener);
    // return () => {
    //   document.removeEventListener('toolbarPlusUpdate', updateListener as EventListener);
    // };

    const handleMouseMove = (event: MouseEvent) => {
      if (event.clientY <= 40) {
        setVisibleIntercept(true);
      }
      if (event.clientY > 50) {
        setVisibleIntercept(false);
      }
    };

    // Add event listener for mouse movement on the document
    document.addEventListener("mousemove", handleMouseMove);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
    };
  }, []);

  const handleLayoutClick = () => {
    setVisible(false);
    disableToolbar();
    effects.modal.showModal();
  };

  const handleFramePositionViewer = () => {
    setVisible(false);
    setIsFramePositionViewerOpen(true);
  };

  const handleSnapshot = () => {
    setVisible(false);
    setIsAddFrameSnapshotModalOpen(true);
  };

  const handleLayoutManager = () => {
    setVisible(false);
    setIsLayoutManagerOpen(true);
  };

  return (
    <>
      <Transition
        mounted={visible}
        transition="slide-down"
        duration={300}
        timingFunction="ease"
      >
        {(styles) => (
          <Box
            style={{
              ...styles,
              position: "fixed",
              top: 0,
              left: "50%",
              transform: "translateX(-50%)",
              zIndex: 1000,
              width: "60%",
              backgroundColor: "#25262b", // Dark background
              padding: "10px",
              display: "flex",
              justifyContent: "center",
              boxShadow: "0 2px 10px rgba(0, 0, 0, 0.2)",
              borderBottom: "1px solid #373A40",
            }}
            onMouseLeave={() => setVisible(false)}
          >
            <Group gap="lg">
              <Tooltip label="Snapshot Image Position" position="bottom" withArrow>
                <ActionIcon
                  variant="filled"
                  color="blue"
                  size="lg"
                  aria-label="Snapshot Image Position"
                  onClick={handleSnapshot}
                >
                  <IconCameraPlus size={20} />
                </ActionIcon>
              </Tooltip>
              <Tooltip label="Frame Position Viewer" position="bottom" withArrow>
                <ActionIcon
                  variant="filled"
                  color="blue"
                  size="lg"
                  aria-label="Frame Position Viewer"
                  onClick={handleFramePositionViewer}
                >
                  <IconPhotoCog size={20} />
                </ActionIcon>
              </Tooltip>
              {/* <Tooltip label="Layout Manager" position="bottom" withArrow>
                <ActionIcon
                  variant="filled"
                  color="blue"
                  size="lg"
                  aria-label="Layout Manager"
                  onClick={handleLayoutManager}
                >
                  <IconListTree size={20} />
                </ActionIcon>
              </Tooltip> */}
              <Tooltip
                label="Upload/Download Document"
                position="bottom"
                withArrow
              >
                <ActionIcon
                  variant="filled"
                  color="blue"
                  size="lg"
                  aria-label="Upload/Download"
                  onClick={handleUploadDownloadClick}
                >
                  <IconArrowsTransferUpDown size={20} />
                </ActionIcon>
              </Tooltip>
              <Tooltip label="Layout Image Mapper" position="bottom" withArrow>
                <ActionIcon
                  variant="filled"
                  color="blue"
                  size="lg"
                  aria-label="Layout"
                  onClick={handleLayoutClick}
                >
                  <IconMapBolt size={20} />
                </ActionIcon>
              </Tooltip>
              <Tooltip label="Test Error" position="bottom" withArrow>
                <ActionIcon
                  variant="filled"
                  color="red"
                  size="lg"
                  aria-label="Test Error"
                  onClick={handleTestError}
                >
                  <IconBug size={20} />
                </ActionIcon>
              </Tooltip>
            </Group>
          </Box>
        )}
      </Transition>

      {/* Download Modal */}
      <DownloadModal
        opened={isDownloadUploadModalOpen}
        onClose={() => setIsDownloadUploadModalOpen(false)}
      />

      {/* Update Available Modal */}
      <Modal
        opened={isUpdateModalOpen}
        onClose={() => setIsUpdateModalOpen(false)}
        title="Update Available"
        centered
      >
        <Stack>
          <Text>A new version of Studio Toolbar Plus is available!</Text>
          <Text size="sm">
            Current version: {updateInfo?.currentVersion}
            <br />
            Latest version: {updateInfo?.latestVersion}
          </Text>
          <Group justify="space-between" mt="md">
            <Button onClick={handleDismissUpdate} variant="subtle" color="gray">
              Dismiss
            </Button>
            <Button
              component="a"
              href="https://github.com/spicy-labs/studio-toolbar-plus/"
              target="_blank"
              rightSection={<IconExternalLink size={16} />}
              color="blue"
            >
              Download Update
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Frame Position Viewer Modal */}
      {isFramePositionViewerOpen && (
        <FrameSnapshotLayoutModal
          opened={isFramePositionViewerOpen}
          onClose={() => setIsFramePositionViewerOpen(false)}
        />
      )}
      
      {/* Add Frame Snapshot Modal */}
      {isAddFrameSnapshotModalOpen && (
        <AddFrameSnapshotModal
          opened={isAddFrameSnapshotModalOpen}
          onClose={() => setIsAddFrameSnapshotModalOpen(false)}
          raiseError={raiseError}
        />
      )}
      
      {/* Layout Manager Modal */}
      {isLayoutManagerOpen && (
        <LayoutManagerModal
          opened={isLayoutManagerOpen}
          onClose={() => setIsLayoutManagerOpen(false)}
        />
      )}
    </>
  );
}
