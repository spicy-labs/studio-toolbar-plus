import { useState, useEffect } from "react";
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
  IconPlaystationSquare,
  IconSparkles,
  IconSettings,
  IconPlug,
  IconCrop,
  IconFileExport,
  IconDownload,
} from "@tabler/icons-react";
import { appStore } from "../modalStore";
import { FrameSnapshotLayoutModal } from "./FrameSnapshotLayout/FrameSnapshotLayoutModal";
import { AddFrameSnapshotModal } from "./AddFrameSnapshotModal";
import { LayoutManagerModal } from "./LayoutManagerModal";
import { DownloadModal } from "./DownloadModal";
import { MagicLayoutsModal } from "./MagicLayoutsModal";
import { ConnectorCleanupModal } from "./ConnectorCleanupModal";
import { ManualCropManagerModal } from "./ManualCropManager/ManualCropManagerModal";
import { OutTemplateModal } from "./OutTemplateModal";
import {
  ToolbarSettingsModal,
  type AppConfig,
  defaultConfig,
} from "./ToolbarSettingsModal";
import { saveLayoutSizingToAction } from "../studio/studioAdapter";

export function Toolbar() {
  const [visible, setVisible] = useState(false);
  const [isDownloadUploadModalOpen, setIsDownloadUploadModalOpen] =
    useState(false);
  const [isConvertModalOpen, setIsConvertModalOpen] = useState(false);
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const [isFramePositionViewerOpen, setIsFramePositionViewerOpen] =
    useState(false);
  const [isAddFrameSnapshotModalOpen, setIsAddFrameSnapshotModalOpen] =
    useState(false);
  const [isLayoutManagerOpen, setIsLayoutManagerOpen] = useState(false);
  const [isMagicLayoutsModalOpen, setIsMagicLayoutsModalOpen] = useState(false);
  const [isConnectorCleanupModalOpen, setIsConnectorCleanupModalOpen] =
    useState(false);
  const [isManualCropManagerModalOpen, setIsManualCropManagerModalOpen] =
    useState(false);
  const [isOutTemplateModalOpen, setIsOutTemplateModalOpen] = useState(false);
  const [isAspectLockConfirmModalOpen, setIsAspectLockConfirmModalOpen] =
    useState(false); // State for the confirmation modal
  const [isAspectLockSuccessModalOpen, setIsAspectLockSuccessModalOpen] =
    useState(false); // State for the success modal
  const [aspectLockSuccessMessage, setAspectLockSuccessMessage] = useState(""); // State for the dynamic success message
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [appConfig, setAppConfig] = useState<AppConfig>(defaultConfig);
  const [updateInfo, setUpdateInfo] = useState<{
    currentVersion: string;
    latestVersion: string;
  } | null>(null);
  const effects = appStore((store) => store.effects);
  const raiseError = appStore((store) => store.raiseError);
  const disableToolbar = appStore((store) => store.disableToolbar);

  const handleTestError = () => {
    raiseError(new Error("This is a test error message"));
  };

  const handleSettings = () => {
    setIsSettingsModalOpen(true);
  };

  const setVisibleIntercept = (value: boolean) => {
    const isToolbarEnabled = appStore.getState().state.isToolbarEnabled;
    if (!isToolbarEnabled) {
      setVisible(false);
    } else {
      setVisible(value);
    }
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

  // Function to reload configuration from localStorage
  const reloadConfig = () => {
    const savedConfig = localStorage.getItem("tempUserConfig");
    if (savedConfig) {
      try {
        const parsedConfig = JSON.parse(savedConfig);
        setAppConfig({ ...defaultConfig, ...parsedConfig });
      } catch (error) {
        console.error("Failed to parse saved config:", error);
        setAppConfig(defaultConfig);
      }
    } else {
      setAppConfig(defaultConfig);
    }
  };

  // Load configuration from localStorage on component mount
  useEffect(() => {
    reloadConfig();
  }, []);

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

  const handleMagicLayouts = () => {
    setVisible(false);
    setIsMagicLayoutsModalOpen(true);
  };

  const handleConnectorCleanup = () => {
    setVisible(false);
    setIsConnectorCleanupModalOpen(true);
  };

  const handleManualCropManager = () => {
    setVisible(false);
    setIsManualCropManagerModalOpen(true);
  };

  const handleOutTemplate = () => {
    setVisible(false);
    setIsOutTemplateModalOpen(true);
  };

  const handleAspectLock = () => {
    setIsAspectLockConfirmModalOpen(true); // Open the confirmation modal first
  };

  const handleConfirmAspectLock = async (value: boolean) => {
    setIsAspectLockConfirmModalOpen(false); // Close confirmation modal
    (await saveLayoutSizingToAction(value)).fold(
      (_) => {
        setAspectLockSuccessMessage(
          value
            ? "Success in turning Aspect Ratio On"
            : "Success in turning Aspect Ratio Off",
        );
        setIsAspectLockSuccessModalOpen(true); // Open success modal on success
      },
      (err) =>
        raiseError(err ?? Error(`Error setting aspect lock to ${value}`)),
    );
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
              {appConfig.showSnapshot && (
                <Tooltip
                  label="Snapshot Image Position"
                  position="bottom"
                  withArrow
                >
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
              )}
              {appConfig.showFramePositionViewer && (
                <Tooltip
                  label="Frame Position Viewer"
                  position="bottom"
                  withArrow
                >
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
              )}
              {appConfig.showMagicLayouts && (
                <Tooltip label="Magic Layouts" position="bottom" withArrow>
                  <ActionIcon
                    variant="filled"
                    color="purple"
                    size="lg"
                    aria-label="Magic Layouts"
                    onClick={handleMagicLayouts}
                  >
                    <IconSparkles size={20} />
                  </ActionIcon>
                </Tooltip>
              )}
              {appConfig.showLayoutManager && (
                <Tooltip label="Layout Manager" position="bottom" withArrow>
                  <ActionIcon
                    variant="filled"
                    color="blue"
                    size="lg"
                    aria-label="Layout Manager"
                    onClick={handleLayoutManager}
                  >
                    <IconListTree size={20} />
                  </ActionIcon>
                </Tooltip>
              )}
              {appConfig.showAspectLock && (
                <Tooltip label="Aspect Lock" position="bottom" withArrow>
                  <ActionIcon
                    variant="filled"
                    color="blue"
                    size="lg"
                    aria-label="Aspect Lock"
                    onClick={handleAspectLock}
                  >
                    <IconPlaystationSquare size={20} />
                  </ActionIcon>
                </Tooltip>
              )}

              {appConfig.showUploadDownload && (
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
              )}
              {appConfig.showLayoutImageMapper && (
                <Tooltip
                  label="Layout Image Mapper"
                  position="bottom"
                  withArrow
                >
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
              )}
              {appConfig.showTestError && (
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
              )}
              {appConfig.showConnectorCleanup && (
                <Tooltip label="Connector Cleanup" position="bottom" withArrow>
                  <ActionIcon
                    variant="filled"
                    color="blue"
                    size="lg"
                    aria-label="Connector Cleanup"
                    onClick={handleConnectorCleanup}
                  >
                    <IconPlug size={20} />
                  </ActionIcon>
                </Tooltip>
              )}
              {appConfig.showManualCropManager && (
                <Tooltip
                  label="Manual Crop Manager"
                  position="bottom"
                  withArrow
                >
                  <ActionIcon
                    variant="filled"
                    color="blue"
                    size="lg"
                    aria-label="Manual Crop Manager"
                    onClick={handleManualCropManager}
                  >
                    <IconCrop size={20} />
                  </ActionIcon>
                </Tooltip>
              )}
              {appConfig.showOutTemplate && (
                <Tooltip label="Out Template" position="bottom" withArrow>
                  <ActionIcon
                    variant="filled"
                    color="blue"
                    size="lg"
                    aria-label="Out Template"
                    onClick={handleOutTemplate}
                  >
                    <IconDownload size={20} />
                  </ActionIcon>
                </Tooltip>
              )}
              <Tooltip label="Settings" position="bottom" withArrow>
                <ActionIcon
                  variant="filled"
                  color="gray"
                  size="lg"
                  aria-label="Settings"
                  onClick={handleSettings}
                >
                  <IconSettings size={20} />
                </ActionIcon>
              </Tooltip>
            </Group>
          </Box>
        )}
      </Transition>

      {/* Download Modal */}
      {appConfig.showUploadDownload && (
        <DownloadModal
          opened={isDownloadUploadModalOpen}
          onClose={() => setIsDownloadUploadModalOpen(false)}
        />
      )}

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
      {isFramePositionViewerOpen && appConfig.showFramePositionViewer && (
        <FrameSnapshotLayoutModal
          opened={isFramePositionViewerOpen}
          onClose={() => setIsFramePositionViewerOpen(false)}
        />
      )}

      {/* Add Frame Snapshot Modal */}
      {isAddFrameSnapshotModalOpen && appConfig.showSnapshot && (
        <AddFrameSnapshotModal
          opened={isAddFrameSnapshotModalOpen}
          onClose={() => setIsAddFrameSnapshotModalOpen(false)}
          raiseError={raiseError}
        />
      )}

      {/* Layout Manager Modal */}
      {isLayoutManagerOpen && appConfig.showLayoutManager && (
        <LayoutManagerModal
          opened={isLayoutManagerOpen}
          onClose={() => setIsLayoutManagerOpen(false)}
        />
      )}

      {/* Magic Layouts Modal */}
      {isMagicLayoutsModalOpen && appConfig.showMagicLayouts && (
        <MagicLayoutsModal
          opened={isMagicLayoutsModalOpen}
          onClose={() => setIsMagicLayoutsModalOpen(false)}
        />
      )}

      {/* Connector Cleanup Modal */}
      {appConfig.showConnectorCleanup && (
        <ConnectorCleanupModal
          opened={isConnectorCleanupModalOpen}
          onClose={() => setIsConnectorCleanupModalOpen(false)}
        />
      )}

      {/* Manual Crop Manager Modal */}
      {appConfig.showManualCropManager && (
        <ManualCropManagerModal
          opened={isManualCropManagerModalOpen}
          onClose={() => setIsManualCropManagerModalOpen(false)}
        />
      )}

      {/* Out Template Modal */}
      {appConfig.showOutTemplate && (
        <OutTemplateModal
          opened={isOutTemplateModalOpen}
          onClose={() => setIsOutTemplateModalOpen(false)}
        />
      )}

      {/* Aspect Lock Success Modal */}
      {/* Aspect Lock Confirmation Modal */}
      {appConfig.showAspectLock && (
        <Modal
          opened={isAspectLockConfirmModalOpen}
          onClose={() => setIsAspectLockConfirmModalOpen(false)}
          title="Confirm Aspect Lock Change"
          centered
          size="sm"
        >
          <Text>Turn Aspect Lock On?</Text>
          <Group justify="flex-end" mt="md">
            <Button
              variant="default"
              onClick={() => handleConfirmAspectLock(false)}
            >
              No
            </Button>
            <Button color="blue" onClick={() => handleConfirmAspectLock(true)}>
              Yes
            </Button>
          </Group>
        </Modal>
      )}

      {/* Aspect Lock Success Modal */}
      {appConfig.showAspectLock && (
        <Modal
          opened={isAspectLockSuccessModalOpen}
          onClose={() => {
            setIsAspectLockSuccessModalOpen(false);
            setAspectLockSuccessMessage(""); // Reset message on close
          }}
          title="Aspect Lock Status"
          centered
          size="sm"
        >
          <Text>{aspectLockSuccessMessage}</Text>
          <Group justify="flex-end" mt="md">
            <Button
              onClick={() => {
                setIsAspectLockSuccessModalOpen(false);
                setAspectLockSuccessMessage(""); // Reset message on close
              }}
            >
              Close
            </Button>
          </Group>
        </Modal>
      )}

      {/* Toolbar Settings Modal */}
      <ToolbarSettingsModal
        opened={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        config={appConfig}
        onConfigChange={setAppConfig}
        onReloadConfig={reloadConfig}
      />
    </>
  );
}
