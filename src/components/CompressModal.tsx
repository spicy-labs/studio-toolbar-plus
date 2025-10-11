import { useState } from "react";
import {
  Modal,
  Text,
  Stack,
  Group,
  Button,
  Loader,
  Alert,
  List,
} from "@mantine/core";
import { IconAlertTriangle, IconCheck } from "@tabler/icons-react";
import { appStore } from "../modalStore";
import { getStudio } from "../studio/studioAdapter";
import {
  getAllLayouts,
  deleteLayout,
  setPrivateData,
} from "../studio/layoutHandler";
import { getCurrentDocumentState } from "../studio/documentHandler";
import type { Layout } from "@chili-publish/studio-sdk";

interface CompressModalProps {
  opened: boolean;
  onClose: () => void;
}

interface CompressionReport {
  magicLayoutsRemoved: number;
  magicLayoutNames: string[];
  privateDataCleared: boolean;
  fileSizeDeltaKB: number;
}

export function CompressModal({ opened, onClose }: CompressModalProps) {
  const raiseError = appStore((store) => store.raiseError);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [compressionReport, setCompressionReport] =
    useState<CompressionReport | null>(null);
  const [isSizeModalOpen, setIsSizeModalOpen] = useState(false);
  const [currentSize, setCurrentSize] = useState<string | null>(null);
  const [isGettingSize, setIsGettingSize] = useState(false);

  const handleStartCompress = () => {
    // Open confirmation modal instead of directly compressing
    setIsConfirmModalOpen(true);
  };

  const handleConfirmCompress = async () => {
    setIsConfirmModalOpen(false);
    setIsProcessing(true);

    let initialSizeKB = 0;

    try {
      // Get Studio instance
      const studioResult = await getStudio();
      if (!studioResult.isOk()) {
        raiseError(
          new Error("Failed to get studio: " + studioResult.error?.message)
        );
        return;
      }
      const studio = studioResult.value;

      // 0. Get initial document state and calculate file size
      const initialDocStateResult = await getCurrentDocumentState(studio);
      if (!initialDocStateResult.isOk()) {
        raiseError(
          new Error(
            "Failed to get initial document state: " +
              initialDocStateResult.error?.message
          )
        );
        return;
      }

      const initialDocJson = JSON.stringify(initialDocStateResult.value);
      const initialBlob = new Blob([initialDocJson], {
        type: "application/json",
      });
      initialSizeKB = initialBlob.size / 1024;

      // 1. Get all layouts
      const layoutsResult = await getAllLayouts(studio);
      if (!layoutsResult.isOk()) {
        raiseError(
          new Error("Failed to get layouts: " + layoutsResult.error?.message)
        );
        return;
      }

      const layouts = layoutsResult.value as Layout[];

      // 2. Filter for magic layouts (layouts with ✨ in the name)
      const magicLayouts = layouts.filter((layout) =>
        layout.name.includes("✨")
      );

      // 3. Delete each magic layout
      const deletedLayoutNames: string[] = [];
      for (const layout of magicLayouts) {
        const deleteResult = await deleteLayout(studio, layout.id);
        if (!deleteResult.isOk()) {
          raiseError(
            new Error(
              `Failed to delete layout ${layout.name}: ${deleteResult.error?.message}`
            )
          );
          return;
        }
        deletedLayoutNames.push(layout.name);
      }

      // 4. Set privateData to {} on layout with id "0"
      const setPrivateDataResult = await setPrivateData({
        studio,
        id: "0",
        privateData: {},
      });

      if (!setPrivateDataResult.isOk()) {
        raiseError(
          new Error(
            "Failed to clear private data: " +
              setPrivateDataResult.error?.message
          )
        );
        return;
      }

      // 5. Get final document state and calculate file size
      const finalDocStateResult = await getCurrentDocumentState(studio);
      if (!finalDocStateResult.isOk()) {
        raiseError(
          new Error(
            "Failed to get final document state: " +
              finalDocStateResult.error?.message
          )
        );
        return;
      }

      const finalDocJson = JSON.stringify(finalDocStateResult.value);
      const finalBlob = new Blob([finalDocJson], { type: "application/json" });
      const finalSizeKB = finalBlob.size / 1024;

      const fileSizeDeltaKB = initialSizeKB - finalSizeKB;

      // 6. Create compression report
      setCompressionReport({
        magicLayoutsRemoved: magicLayouts.length,
        magicLayoutNames: deletedLayoutNames,
        privateDataCleared: true,
        fileSizeDeltaKB,
      });
    } catch (error) {
      raiseError(error instanceof Error ? error : new Error(String(error)));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCancelConfirm = () => {
    setIsConfirmModalOpen(false);
  };

  const handleCloseAfterCompress = () => {
    setCompressionReport(null);
    onClose();
  };

  const handleGetCurrentSize = async () => {
    setIsGettingSize(true);
    try {
      // Get Studio instance
      const studioResult = await getStudio();
      if (!studioResult.isOk()) {
        raiseError(
          new Error("Failed to get studio: " + studioResult.error?.message)
        );
        return;
      }
      const studio = studioResult.value;

      // Get current document state and calculate file size
      const docStateResult = await getCurrentDocumentState(studio);
      if (!docStateResult.isOk()) {
        raiseError(
          new Error(
            "Failed to get document state: " + docStateResult.error?.message
          )
        );
        return;
      }

      const docJson = JSON.stringify(docStateResult.value);
      const blob = new Blob([docJson], { type: "application/json" });
      const sizeKB = blob.size / 1024;

      const formattedSize =
        sizeKB > 1000
          ? `${(sizeKB / 1024).toFixed(2)} MB`
          : `${sizeKB.toFixed(2)} KB`;

      setCurrentSize(formattedSize);
      setIsSizeModalOpen(true);
    } catch (error) {
      raiseError(error instanceof Error ? error : new Error(String(error)));
    } finally {
      setIsGettingSize(false);
    }
  };

  const handleCloseSizeModal = () => {
    setIsSizeModalOpen(false);
    setCurrentSize(null);
  };

  return (
    <>
      <Modal
        opened={opened}
        onClose={
          isProcessing
            ? () => {}
            : compressionReport
              ? handleCloseAfterCompress
              : onClose
        }
        title="Compress Document Assets"
        centered
        size="50%"
        closeOnClickOutside={!isProcessing}
        closeOnEscape={!isProcessing}
        withCloseButton={!isProcessing}
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
        <Stack gap="md">
          {compressionReport ? (
            // Show compression report after completion
            <Stack gap="lg" style={{ minHeight: "200px" }}>
              <Alert
                icon={<IconCheck size={20} />}
                color="green"
                title="Compression Complete"
              >
                The document has been successfully compressed.
              </Alert>

              <Stack gap="md">
                <Text size="md" fw={500}>
                  Compression Report:
                </Text>

                <List spacing="sm">
                  <List.Item>
                    <Text>
                      <strong>Magic Layouts Removed:</strong>{" "}
                      {compressionReport.magicLayoutsRemoved}
                    </Text>
                  </List.Item>
                  <List.Item>
                    <Text>
                      <strong>Private Data Cleared:</strong>{" "}
                      {compressionReport.privateDataCleared ? "Yes" : "No"}
                    </Text>
                  </List.Item>
                  <List.Item>
                    <Text>
                      <strong>File size decreased by:</strong>{" "}
                      {compressionReport.fileSizeDeltaKB > 1000
                        ? `${(compressionReport.fileSizeDeltaKB / 1024).toFixed(2)} MB`
                        : `${compressionReport.fileSizeDeltaKB.toFixed(2)} KB`}
                    </Text>
                  </List.Item>
                </List>

                {compressionReport.magicLayoutNames.length > 0 && (
                  <Stack gap="xs">
                    <Text size="sm" fw={500}>
                      Deleted Magic Layouts:
                    </Text>
                    <List size="sm" spacing="xs">
                      {compressionReport.magicLayoutNames.map((name, index) => (
                        <List.Item key={index}>{name}</List.Item>
                      ))}
                    </List>
                  </Stack>
                )}
              </Stack>
            </Stack>
          ) : (
            <>
              <Text size="sm" c="dimmed">
                Compress template this will remove Toolbar data and Magic
                Layouts.
              </Text>

              {isProcessing ? (
                <Group justify="center" style={{ minHeight: "200px" }}>
                  <Stack align="center" gap="md">
                    <Loader size="lg" />
                    <Text>Processing compression...</Text>
                    <Text size="sm" c="dimmed">
                      Please wait, do not close this window
                    </Text>
                  </Stack>
                </Group>
              ) : (
                <Stack gap="lg" style={{ minHeight: "200px" }}>
                  <Alert
                    icon={<IconAlertTriangle size={20} />}
                    color="red"
                    title="Warning: Destructive Process"
                  >
                    This compression process is destructive and will permanently
                    remove Toolbar data and Magic Layouts. If you save after
                    compression, you will be unable to go back.
                  </Alert>

                  <Text>This process will:</Text>
                  <List spacing="sm">
                    <List.Item>
                      Delete all Magic Layouts (layouts with ✨ in the name) and
                      their sub-layouts
                    </List.Item>
                    <List.Item>
                      Clear all Toolbar private data from the document
                    </List.Item>
                  </List>
                </Stack>
              )}
            </>
          )}

          <Group justify="space-between" mt="xl">
            {compressionReport ? (
              <>
                <div /> {/* Empty div for spacing */}
                <Button onClick={handleCloseAfterCompress} size="md">
                  Close
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="default"
                  onClick={handleGetCurrentSize}
                  loading={isGettingSize}
                  disabled={isProcessing || isGettingSize}
                >
                  Get Current Size
                </Button>
                <Group gap="md">
                  <Button
                    variant="default"
                    onClick={onClose}
                    disabled={isProcessing}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleStartCompress}
                    loading={isProcessing}
                    disabled={isProcessing}
                    size="md"
                    color="red"
                  >
                    Start Compression
                  </Button>
                </Group>
              </>
            )}
          </Group>
        </Stack>
      </Modal>

      {/* Confirmation Modal */}
      <Modal
        opened={isConfirmModalOpen}
        onClose={isProcessing ? () => {} : handleCancelConfirm}
        title="Confirm Compression"
        centered
        size="md"
        closeOnClickOutside={!isProcessing}
        closeOnEscape={!isProcessing}
        styles={{
          title: {
            fontSize: "1.25rem",
            fontWeight: 600,
          },
        }}
      >
        <Stack gap="lg">
          <Alert
            icon={<IconAlertTriangle size={20} />}
            color="red"
            title="Warning: Destructive Process"
          >
            This process is destructive and will permanently remove Toolbar data
            and Magic Layouts from your document.
          </Alert>

          <Text size="md" fw={500}>
            If you save after compression, you will be unable to go back.
          </Text>

          <Text size="sm" c="dimmed">
            Are you sure you want to continue?
          </Text>

          <Group justify="flex-end" mt="md">
            <Button
              variant="outline"
              onClick={handleCancelConfirm}
              size="md"
              disabled={isProcessing}
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmCompress}
              color="red"
              size="md"
              disabled={isProcessing}
            >
              Continue
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Current Size Modal */}
      <Modal
        opened={isSizeModalOpen}
        onClose={handleCloseSizeModal}
        title="Current Template Size"
        centered
        size="md"
        styles={{
          title: {
            fontSize: "1.25rem",
            fontWeight: 600,
          },
        }}
      >
        <Stack gap="lg">
          <Text size="md">The current template size is:</Text>

          <Text size="xl" fw={700} ta="center" c="blue">
            {currentSize}
          </Text>

          <Text size="sm" c="dimmed">
            This size is calculated from the current document state as a JSON
            file.
          </Text>

          <Group justify="flex-end" mt="md">
            <Button onClick={handleCloseSizeModal} size="md">
              Close
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}
