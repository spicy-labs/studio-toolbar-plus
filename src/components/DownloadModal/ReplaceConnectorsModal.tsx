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
import type { Connector, DocumentConnector } from "../types/connectorTypes";

interface ReplaceConnectorsModalProps {
  opened: boolean;
  onClose: () => void;
  connectorsToReplace: DocumentConnector[];
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

  // Auto-select connectors based on name match when modal opens
  useEffect(() => {
    if (opened && connectorsToReplace.length > 0) {
      const autoReplacements: Record<string, string> = {};

      connectorsToReplace.forEach((docConnector) => {
        const matchingConnector = availableConnectors.find(
          (connector) => connector.name === docConnector.name,
        );
        if (matchingConnector) {
          autoReplacements[docConnector.id] = matchingConnector.id;
        }
      });

      setReplacements(autoReplacements);
    }
  }, [opened, connectorsToReplace, availableConnectors]);

  // Reset replacements when modal closes
  useEffect(() => {
    if (!opened) {
      setReplacements({});
    }
  }, [opened]);

  // Check if all connectors have replacements selected
  const allSelected = connectorsToReplace.every(
    (connector) => replacements[connector.id] !== undefined,
  );

  const handleReplacementChange = (
    connectorId: string,
    replacementId: string | null,
  ) => {
    setReplacements((prev) => {
      const updated = { ...prev };
      if (replacementId) {
        updated[connectorId] = replacementId;
      } else {
        delete updated[connectorId];
      }
      return updated;
    });
  };

  const handleContinue = () => {
    const replacementMap = new Map<string, string>();
    Object.entries(replacements).forEach(([original, replacement]) => {
      replacementMap.set(original, replacement);
    });
    onReplace(replacementMap);
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
            {connectorsToReplace.map((connector) => (
              <Table.Tr key={connector.id}>
                <Table.Td>{connector.name}</Table.Td>
                <Table.Td
                  style={{ fontFamily: "monospace", fontSize: "0.8rem" }}
                >
                  {connector.id}
                </Table.Td>
                <Table.Td>
                  <Select
                    data={availableConnectors.map((c) => ({
                      value: c.id,
                      label: c.name,
                    }))}
                    placeholder="Select a connector"
                    value={replacements[connector.id] || null}
                    onChange={(value) =>
                      handleReplacementChange(connector.id, value)
                    }
                    searchable
                    required
                  />
                </Table.Td>
              </Table.Tr>
            ))}
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
