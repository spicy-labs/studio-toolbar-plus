import { useState, useEffect } from "react";
import {
  Modal,
  Text,
  Stack,
  Group,
  Button,
  Table,
  Checkbox,
  Loader,
  ScrollArea,
  Alert,
  Select,
} from "@mantine/core";
import { IconAlertCircle } from "@tabler/icons-react";
import { getCurrentConnectors, mergeConnectors } from "../studio/studioAdapter";
import { unregisterConnector } from "../studio/connectorAdapter";
import { getStudio } from "../studio/studioAdapter";
import { useAppStore } from "../modalStore";
import type { DocumentConnectorWithUsage } from "../types/connectorTypes";

interface ConnectorCleanupModalProps {
  opened: boolean;
  onClose: () => void;
}

export function ConnectorCleanupModal({
  opened,
  onClose,
}: ConnectorCleanupModalProps) {
  const [connectors, setConnectors] = useState<DocumentConnectorWithUsage[]>(
    [],
  );
  const [selectedConnectors, setSelectedConnectors] = useState<Set<string>>(
    new Set(),
  );
  const [isLoading, setIsLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isMergeModalOpen, setIsMergeModalOpen] = useState(false);
  const [mergeTargetId, setMergeTargetId] = useState<string | null>(null);
  const [isMerging, setIsMerging] = useState(false);
  const { raiseError } = useAppStore();

  // Load connectors when modal opens
  useEffect(() => {
    if (opened) {
      loadConnectors();
    }
  }, [opened]);

  const loadConnectors = async () => {
    setIsLoading(true);
    setSelectedConnectors(new Set());

    try {
      const studioResult = await getStudio();
      if (!studioResult.isOk()) {
        raiseError(
          new Error(studioResult.error?.message || "Failed to get studio"),
        );
        return;
      }

      const connectorsResult = await getCurrentConnectors(studioResult.value);
      if (!connectorsResult.isOk()) {
        raiseError(
          new Error(
            connectorsResult.error?.message || "Failed to load connectors",
          ),
        );
        return;
      }

      setConnectors(connectorsResult.value);
    } catch (error) {
      raiseError(error instanceof Error ? error : new Error(String(error)));
    } finally {
      setIsLoading(false);
    }
  };

  const handleConnectorToggle = (connectorId: string) => {
    const newSelected = new Set(selectedConnectors);
    if (newSelected.has(connectorId)) {
      newSelected.delete(connectorId);
    } else {
      newSelected.add(connectorId);
    }
    setSelectedConnectors(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedConnectors.size === connectors.length) {
      setSelectedConnectors(new Set());
    } else {
      setSelectedConnectors(new Set(connectors.map((c) => c.id)));
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedConnectors.size === 0) return;

    setIsDeleting(true);

    try {
      const studioResult = await getStudio();
      if (!studioResult.isOk()) {
        raiseError(
          new Error(studioResult.error?.message || "Failed to get studio"),
        );
        return;
      }

      const studio = studioResult.value;
      const selectedIds = Array.from(selectedConnectors);

      // Delete each selected connector
      for (const connectorId of selectedIds) {
        const result = await unregisterConnector(studio, connectorId);
        if (!result.isOk()) {
          raiseError(
            new Error(
              `Failed to delete connector ${connectorId}: ${result.error?.message}`,
            ),
          );
          // Continue with other deletions even if one fails
        }
      }

      // Reload connectors after deletion
      await loadConnectors();
    } catch (error) {
      raiseError(error instanceof Error ? error : new Error(String(error)));
    } finally {
      setIsDeleting(false);
    }
  };

  const handleMergeConnectors = () => {
    if (selectedConnectors.size < 2) return;
    setMergeTargetId(null);
    setIsMergeModalOpen(true);
  };

  const handleMergeCancel = () => {
    setIsMergeModalOpen(false);
    setMergeTargetId(null);
  };

  const handleMergeConfirm = async () => {
    if (!mergeTargetId || selectedConnectors.size < 2) return;

    setIsMerging(true);

    try {
      const studioResult = await getStudio();
      if (!studioResult.isOk()) {
        raiseError(
          new Error(studioResult.error?.message || "Failed to get studio"),
        );
        return;
      }

      const studio = studioResult.value;
      const selectedIds = Array.from(selectedConnectors);

      // Call mergeConnectors function
      const result = await mergeConnectors(studio, mergeTargetId, selectedIds);
      if (!result.isOk()) {
        raiseError(
          new Error(result.error?.message || "Failed to merge connectors"),
        );
        return;
      }

      // Close merge modal and reload connectors
      setIsMergeModalOpen(false);
      setMergeTargetId(null);
      await loadConnectors();
    } catch (error) {
      raiseError(error instanceof Error ? error : new Error(String(error)));
    } finally {
      setIsMerging(false);
    }
  };

  const formatUsageCount = (usage: { images: any[]; variables: any[] }) => {
    const imageCount = usage.images.length;
    const variableCount = usage.variables.length;

    if (imageCount === 0 && variableCount === 0) {
      return "None";
    }

    const parts = [];
    if (imageCount > 0)
      parts.push(`${imageCount} frame${imageCount !== 1 ? "s" : ""}`);
    if (variableCount > 0)
      parts.push(`${variableCount} variable${variableCount !== 1 ? "s" : ""}`);

    return parts.join(", ");
  };

  const hasSelectedConnectors = selectedConnectors.size > 0;
  const isAllSelected =
    selectedConnectors.size === connectors.length && connectors.length > 0;

  return (
    <>
      <Modal
        opened={opened}
        onClose={onClose}
        title="Connector Cleanup"
        size="xl"
        centered
      >
        <Stack>
          <Text size="sm" c="dimmed">
            Manage and remove unused connectors from your document.
          </Text>

          {isLoading ? (
            <Group justify="center" p="xl">
              <Loader size="md" />
              <Text>Loading connectors...</Text>
            </Group>
          ) : (
            <>
              {connectors.length === 0 ? (
                <Alert icon={<IconAlertCircle size={16} />} color="blue">
                  No connectors found in this document.
                </Alert>
              ) : (
                <>
                  <Group justify="space-between">
                    <Group>
                      <Button
                        onClick={handleDeleteSelected}
                        disabled={
                          !hasSelectedConnectors || isDeleting || isMerging
                        }
                        color="red"
                        loading={isDeleting}
                      >
                        Delete Selected ({selectedConnectors.size})
                      </Button>

                      <Button
                        onClick={handleMergeConnectors}
                        disabled={
                          selectedConnectors.size < 2 || isDeleting || isMerging
                        }
                        color="blue"
                        variant="outline"
                      >
                        Merge Connectors
                      </Button>
                    </Group>

                    <Checkbox
                      label={`Select All (${connectors.length})`}
                      checked={isAllSelected}
                      indeterminate={hasSelectedConnectors && !isAllSelected}
                      onChange={handleSelectAll}
                      disabled={isDeleting || isMerging}
                    />
                  </Group>

                  <ScrollArea h={400}>
                    <Table striped highlightOnHover>
                      <Table.Thead>
                        <Table.Tr>
                          <Table.Th w={50}></Table.Th>
                          <Table.Th>Name</Table.Th>
                          <Table.Th>Type</Table.Th>
                          <Table.Th>ID</Table.Th>
                          <Table.Th>Usage</Table.Th>
                        </Table.Tr>
                      </Table.Thead>
                      <Table.Tbody>
                        {connectors.map((connector) => (
                          <Table.Tr key={connector.id}>
                            <Table.Td>
                              <Checkbox
                                checked={selectedConnectors.has(connector.id)}
                                onChange={() =>
                                  handleConnectorToggle(connector.id)
                                }
                                disabled={isDeleting}
                              />
                            </Table.Td>
                            <Table.Td>{connector.name}</Table.Td>
                            <Table.Td>
                              <Text tt="capitalize">{connector.type}</Text>
                            </Table.Td>
                            <Table.Td>
                              <Text size="xs" c="dimmed" ff="monospace">
                                {connector.id}
                              </Text>
                            </Table.Td>
                            <Table.Td>
                              <Text size="sm">
                                {formatUsageCount(connector.usesInTemplate)}
                              </Text>
                            </Table.Td>
                          </Table.Tr>
                        ))}
                      </Table.Tbody>
                    </Table>
                  </ScrollArea>
                </>
              )}
            </>
          )}

          <Group justify="flex-end">
            <Button onClick={onClose} variant="outline">
              Close
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Merge Connectors Modal */}
      <Modal
        opened={isMergeModalOpen}
        onClose={handleMergeCancel}
        title="Merge All Connectors together"
        centered
        size="md"
      >
        <Stack>
          <Text size="sm" c="dimmed">
            Select the connector to merge all selected connectors into. The
            other connectors will be removed and all references will be updated.
          </Text>

          <Stack gap="md">
            <Text fw={500}>Merge into:</Text>
            <Select
              placeholder="Select target connector"
              data={Array.from(selectedConnectors).map((id) => {
                const connector = connectors.find((c) => c.id === id);
                return {
                  value: id,
                  label: connector ? `${connector.name} (${id})` : id,
                };
              })}
              value={mergeTargetId}
              onChange={setMergeTargetId}
              disabled={isMerging}
            />
          </Stack>

          <Group justify="flex-end" mt="md">
            <Button
              onClick={handleMergeCancel}
              variant="outline"
              disabled={isMerging}
            >
              Cancel
            </Button>
            <Button
              onClick={handleMergeConfirm}
              disabled={!mergeTargetId || isMerging}
              loading={isMerging}
              color="blue"
            >
              Merge
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}
