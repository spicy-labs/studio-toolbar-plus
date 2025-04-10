import React, { useRef, useState } from "react";
import {
  Modal,
  Text,
  Stack,
  Group,
  Button,
} from "@mantine/core";
import {
  IconDownload,
  IconUpload,
} from "@tabler/icons-react";
import { appStore } from "../modalStore";
import {
  getCurrentDocumentState,
  loadDocumentFromJsonStr,
} from "../studio/documentHandler";
import { getStudio } from "../studio/studioAdapter";
import { ConnectorReplacementModal } from "./ConnectorReplacementModal";
import type { Connector, ConnectorResponse, DocumentConnector, GrafxSource } from "../types/connectorTypes";

interface DownloadModalProps {
  opened: boolean;
  onClose: () => void;
}


export function DownloadModal({ opened, onClose }: DownloadModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const raiseError = appStore(store => store.raiseError);
  const [replacementModalOpened, setReplacementModalOpened] = useState(false);
  const [missingConnectors, setMissingConnectors] = useState<DocumentConnector[]>([]);
  const [availableConnectors, setAvailableConnectors] = useState<Connector[]>([]);
  const [pendingJsonContent, setPendingJsonContent] = useState<string>("");

  const handleDownload = async () => {
    try {
      const studioResult = await getStudio();
      if (!studioResult.isOk()) {
        raiseError(
          new Error(studioResult.error?.message || "Failed to get studio"),
        );
        return;
      }

      const documentResult = await getCurrentDocumentState(studioResult.value);
      if (!documentResult.isOk()) {
        raiseError(
          new Error(
            documentResult.error?.message || "Failed to get document state",
          ),
        );
        return;
      }

      // Create a blob from the document state
      const jsonStr = JSON.stringify(documentResult.value, null, 2);
      const blob = new Blob([jsonStr], { type: "application/json" });

      // Create a download link and trigger it
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "document.json";
      document.body.appendChild(a);
      a.click();

      // Clean up
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 0);
    } catch (error) {
      raiseError(error instanceof Error ? error : new Error(String(error)));
    }
  };

  const handleUpload = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const content = e.target?.result as string;
        setPendingJsonContent(content);

        try {
          // Parse the JSON to check for connectors
          const jsonData = JSON.parse(content);
          
          if (jsonData.connectors && Array.isArray(jsonData.connectors)) {
            const studioResult = await getStudio();
            if (!studioResult.isOk()) {
              raiseError(
                new Error(studioResult.error?.message || "Failed to get studio"),
              );
              return;
            }

            // Get token and baseUrl from configuration
            const token = (await studioResult.value.configuration.getValue("GRAFX_AUTH_TOKEN"))
              .parsedData;
            const baseUrl = (await studioResult.value.configuration.getValue("ENVIRONMENT_API"))
              .parsedData;

            // Fetch connectors from API
            try {
              const response = await fetch(`${baseUrl}connectors`, {
                headers: {
                  Authorization: `Bearer ${token}`,
                  'Content-Type': 'application/json'
                }
              });

              if (!response.ok) {
                throw new Error(`Failed to fetch connectors: ${response.statusText}`);
              }

              const connectorResponse: ConnectorResponse = await response.json();
              setAvailableConnectors(connectorResponse.data);

              // Check for missing connectors
              const documentConnectors = jsonData.connectors as DocumentConnector[];
              const missingConnectorsList: DocumentConnector[] = [];

              // First check for exact ID matches
              for (const docConnector of documentConnectors) {
                if (docConnector.source.source === "grafx" && docConnector.source.id) {
                  const sourceId = docConnector.source.id;
                  const foundConnector = connectorResponse.data.find(c => c.id === sourceId);
                  
                  if (!foundConnector) {
                    // Try to find by name
                    const nameMatch = connectorResponse.data.find(c => c.name === docConnector.name);
                    
                    if (nameMatch) {
                      // Update the ID in the JSON
                      docConnector.source.id = nameMatch.id;
                    } else {
                      // Add to missing connectors list
                      missingConnectorsList.push(docConnector);
                    }
                  }
                }
              }

              if (missingConnectorsList.length > 0) {
                // Show replacement modal
                setMissingConnectors(missingConnectorsList);
                setReplacementModalOpened(true);
                return;
              }

              // If no missing connectors, update the JSON and load
              const updatedContent = JSON.stringify(jsonData);
              await loadDocument(studioResult.value, updatedContent);
            } catch (error) {
              raiseError(error instanceof Error ? error : new Error(String(error)));
            }
          } else {
            // No connectors in the JSON, proceed with normal loading
            const studioResult = await getStudio();
            if (!studioResult.isOk()) {
              raiseError(
                new Error(studioResult.error?.message || "Failed to get studio"),
              );
              return;
            }
            
            await loadDocument(studioResult.value, content);
          }
        } catch (parseError) {
          raiseError(
            new Error(`Invalid JSON format: ${parseError instanceof Error ? parseError.message : String(parseError)}`)
          );
        }
      };
      reader.readAsText(file);
    } catch (error) {
      raiseError(error instanceof Error ? error : new Error(String(error)));
    }

    // Reset the file input
    if (event.target) {
      event.target.value = "";
    }
  };
  const loadDocument = async (studio: any, content: string) => {
    const loadResult = await loadDocumentFromJsonStr(
      studio,
      content,
    );
    if (!loadResult.isOk()) {
      raiseError(
        new Error(loadResult.error?.message || "Failed to load document"),
      );
      return;
    }

    onClose();
  };

  const handleConnectorReplacements = async (replacements: { original: string; replacement: string }[]) => {
    try {
      const jsonData = JSON.parse(pendingJsonContent);
      
      if (jsonData.connectors && Array.isArray(jsonData.connectors)) {
        // Update connector IDs based on replacements
        const documentConnectors = jsonData.connectors as DocumentConnector[];
        
        for (const docConnector of documentConnectors) {
          if (docConnector.source.source === "grafx") {
            const replacement = replacements.find(r => r.original === docConnector.id);
            if (replacement) {
              docConnector.source.id = replacement.replacement;
            }
          }
        }
        
        // Get studio and load the updated document
        const studioResult = await getStudio();
        if (!studioResult.isOk()) {
          raiseError(
            new Error(studioResult.error?.message || "Failed to get studio"),
          );
          return;
        }
        
        const updatedContent = JSON.stringify(jsonData);
        await loadDocument(studioResult.value, updatedContent);
      }
    } catch (error) {
      raiseError(error instanceof Error ? error : new Error(String(error)));
    }
  };

  return (
    <>
      <Modal
        opened={opened}
        onClose={onClose}
        title="Document Upload/Download"
        centered
      >
        <Stack>
          <Text size="sm">
            Uploading and downloading only transfers the JSON not assets.
          </Text>

          <Group>
            <Button onClick={handleDownload} color="blue">
              <Group gap="xs">
                <IconDownload size={20} />
                <span>Download</span>
              </Group>
            </Button>

            <Button onClick={handleUpload} color="green">
              <Group gap="xs">
                <IconUpload size={20} />
                <span>Upload</span>
              </Group>
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Hidden file input for upload */}
      <input
        type="file"
        ref={fileInputRef}
        style={{ display: "none" }}
        accept=".json"
        onChange={handleFileChange}
      />

      {/* Connector Replacement Modal */}
      <ConnectorReplacementModal
        opened={replacementModalOpened}
        onClose={() => setReplacementModalOpened(false)}
        missingConnectors={missingConnectors}
        availableConnectors={availableConnectors}
        onReplace={handleConnectorReplacements}
      />
    </>
  );
}

// Helper function to check if a source is a GrafxSource
function isGrafxSource(source: any): source is GrafxSource {
  return source && typeof source === 'object' && source.source === 'grafx' && 'id' in source;
}