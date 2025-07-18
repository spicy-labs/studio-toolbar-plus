import React, { useState, useEffect } from "react";
import { Modal, Text, Stack, Group, Button, Select } from "@mantine/core";
import type { Connector } from "../types/connectorTypes";

interface ConnectorSelectionModalProps {
  opened: boolean;
  onClose: () => void;
  connectors: Connector[];
  smartCropsConnectorName?: string;
  onSelect: (connectorId: string) => void;
}

export function ConnectorSelectionModal({
  opened,
  onClose,
  connectors,
  smartCropsConnectorName,
  onSelect,
}: ConnectorSelectionModalProps) {
  const [selectedConnectorId, setSelectedConnectorId] = useState<string>("");

  // Auto-select connector based on name match when modal opens
  useEffect(() => {
    if (opened && smartCropsConnectorName) {
      const matchingConnector = connectors.find(
        (connector) => connector.name === smartCropsConnectorName,
      );
      if (matchingConnector) {
        setSelectedConnectorId(matchingConnector.id);
      }
    }
  }, [opened, smartCropsConnectorName, connectors]);

  // Reset selection when modal closes
  useEffect(() => {
    if (!opened) {
      setSelectedConnectorId("");
    }
  }, [opened]);

  const handleContinue = () => {
    if (selectedConnectorId) {
      onSelect(selectedConnectorId);
      onClose();
    }
  };

  const handleClose = () => {
    setSelectedConnectorId("");
    onClose();
  };

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      title="Select Connector for Smart Crops"
      centered
      size="md"
      styles={{
        content: {
          minHeight: "300px",
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
          Select the connector where you want to upload the smart crops data:
        </Text>

        <Select
          label="Connector"
          placeholder="Choose a connector"
          data={connectors.map((connector) => ({
            value: connector.id,
            label: connector.name,
          }))}
          value={selectedConnectorId}
          onChange={(value) => setSelectedConnectorId(value || "")}
          searchable
          required
        />

        <Group justify="flex-end" mt="md">
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            onClick={handleContinue}
            disabled={!selectedConnectorId}
            color="blue"
          >
            Continue
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
