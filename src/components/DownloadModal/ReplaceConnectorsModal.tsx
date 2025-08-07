import React, { useState, useEffect } from "react";
import {
  Modal,
  Text,
  Stack,
  Group,
  Button,
  Select,
  Table,
} from "@mantine/core";
import type {
  Connector,
  DocumentConnector,
  DocumentConnectorGraFx,
  GrafxSource,
} from "../../types/connectorTypes";

interface ReplaceConnectorsModalProps {
  opened: boolean;
  onClose: () => void;
  connectorsToReplace: DocumentConnectorGraFx[];
  availableConnectors: Connector[];
  onReplace: (replacementMap: Map<string, string>) => void;
}

export function ReplaceConnectorsModal({
  opened,
  onClose,
  connectorsToReplace,
  availableConnectors,
  onReplace,
}: ReplaceConnectorsModalProps) {
  const [replacements, setReplacements] = useState<Record<string, string>>({});
  const [replacementMap, setReplacementMap] = useState<
    Map<string, { name: string; replacementId: string | null }>
  >(new Map());

  // Auto-select connectors based on name match when modal opens
  useEffect(() => {
    if (opened && connectorsToReplace.length > 0) {
      const connectorsSources = new Map<string, string>();

      for (const connector of connectorsToReplace) {
        connectorsSources.set(connector.source.id, connector.name);
      }

      const newReplacementMap = new Map();

      for (const [sourceId, name] of connectorsSources) {
        const matchingConnector = availableConnectors.find(
          (connector) => connector.name === name,
        );

        if (matchingConnector) {
          newReplacementMap.set(sourceId, {
            name,
            replacementId: matchingConnector.id,
          });
        } else {
          newReplacementMap.set(sourceId, { name, replacementId: null });
        }
      }

      setReplacementMap(newReplacementMap);
    }
  }, [opened, connectorsToReplace, availableConnectors]);

  // Reset replacements when modal closes
  useEffect(() => {
    if (!opened) {
      setReplacements({});
      setReplacementMap(new Map());
    }
  }, [opened]);

  // Check if all connectors have replacements selected
  const allSelected = Array.from(replacementMap.values()).every(
    (connector) => connector.replacementId !== null,
  );

  const handleReplacementChange = (
    connectorId: string,
    name: string,
    replacementId: string | null,
  ) => {
    setReplacementMap((prev) => {
      const updated = new Map(prev);
      if (replacementId) {
        updated.set(connectorId, { name: name, replacementId });
      } else {
        updated.delete(connectorId);
      }
      return updated;
    });
  };

  const handleContinue = () => {
    const newReplacementMap = new Map<string, string>();

    for (const [sourceId, connector] of replacementMap.entries()) {
      if (connector.replacementId) {
        newReplacementMap.set(sourceId, connector.replacementId);
      }
    }

    onReplace(newReplacementMap);
    onClose();
  };

  const handleClose = () => {
    setReplacements({});
    onClose();
  };

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      title="Replace Connectors"
      centered
      size="lg"
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
      <Stack gap="xl">
        <Text size="md">
          The following connectors from the document need to be replaced with
          available connectors:
        </Text>

        <Table>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Document Connector</Table.Th>
              <Table.Th>Original ID</Table.Th>
              <Table.Th>Replace With</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {Array.from(replacementMap.entries()).map(
              ([connectorId, connector]) => (
                <Table.Tr key={connectorId}>
                  <Table.Td>{connector.name}</Table.Td>
                  <Table.Td
                    style={{ fontFamily: "monospace", fontSize: "0.8rem" }}
                  >
                    {connectorId}
                  </Table.Td>
                  <Table.Td>
                    <Select
                      data={availableConnectors.map((c) => ({
                        value: c.id,
                        label: c.name,
                      }))}
                      placeholder="Select a connector"
                      value={connector.replacementId || null}
                      onChange={(value) =>
                        handleReplacementChange(
                          connectorId,
                          connector.name,
                          value,
                        )
                      }
                      searchable
                      required
                    />
                  </Table.Td>
                </Table.Tr>
              ),
            )}
          </Table.Tbody>
        </Table>

        <Group justify="flex-end" mt="md">
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button onClick={handleContinue} disabled={!allSelected} color="blue">
            Continue
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
