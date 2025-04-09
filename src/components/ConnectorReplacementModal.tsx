import React, { useState, useEffect } from "react";
import {
  Modal,
  Text,
  Stack,
  Group,
  Button,
  Table,
  Select,
} from "@mantine/core";
import type { Connector, DocumentConnector } from "../types/connectorTypes";

interface ConnectorReplacementModalProps {
  opened: boolean;
  onClose: () => void;
  missingConnectors: DocumentConnector[];
  availableConnectors: Connector[];
  onReplace: (replacements: { original: string; replacement: string }[]) => void;
}

export function ConnectorReplacementModal({
  opened,
  onClose,
  missingConnectors,
  availableConnectors,
  onReplace,
}: ConnectorReplacementModalProps) {
  const [replacements, setReplacements] = useState<Record<string, string>>({});
  const mediaConnectors = availableConnectors.filter((c) => c.type === "media");

  // Check if all missing connectors have replacements selected
  const allSelected = missingConnectors.every(
    (connector) => replacements[connector.id] !== undefined
  );

  const handleReplace = () => {
    const replacementArray = Object.entries(replacements).map(
      ([original, replacement]) => ({
        original,
        replacement,
      })
    );
    onReplace(replacementArray);
    onClose();
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Missing Connectors Detected"
      size="lg"
      centered
    >
      <Stack>
        <Text size="sm">
          The following connectors in your document were not found in your current environment.
          Please select replacement connectors:
        </Text>

        <Table>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Original Connector</Table.Th>
              <Table.Th>ID</Table.Th>
              <Table.Th>Replace With</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {missingConnectors.map((connector) => (
              <Table.Tr key={connector.id}>
                <Table.Td>{connector.name}</Table.Td>
                <Table.Td>{connector.id}</Table.Td>
                <Table.Td>
                  <Select
                    data={mediaConnectors.map((c) => ({
                      value: c.id,
                      label: c.name,
                    }))}
                    placeholder="Select a connector"
                    onChange={(value) => {
                      if (value) {
                        setReplacements((prev) => ({
                          ...prev,
                          [connector.id]: value,
                        }));
                      }
                    }}
                  />
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>

        <Group justify="flex-end">
          <Button onClick={onClose} variant="outline">
            Cancel
          </Button>
          <Button onClick={handleReplace} disabled={!allSelected}>
            Replace Connectors
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}