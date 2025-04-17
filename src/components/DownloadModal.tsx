import React, { useRef, useState } from "react";
import {
  Modal,
  Text,
  Stack,
  Group,
  Button,
  Checkbox,
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
import type { Connector, ConnectorResponse, DocumentConnector } from "../types/connectorTypes";

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
  const [nameMatches, setNameMatches] = useState<Record<string, string>>({});
  const [downloadTemplateFonts, setDownloadTemplateFonts] = useState(false);

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

      // Get token and baseUrl from configuration - we'll need these for multiple operations
      const token = (await studioResult.value.configuration.getValue("GRAFX_AUTH_TOKEN"))
        .parsedData;
      const baseUrl = (await studioResult.value.configuration.getValue("ENVIRONMENT_API"))
        .parsedData;

      // Get template ID from URL
      const urlPath = window.location.href;
      const templateIdMatch = urlPath.match(/templates\/([\w-]+)/);
      let templateId = '';
      let templateName = 'document';

      if (templateIdMatch && templateIdMatch[1]) {
        templateId = templateIdMatch[1];

        // Get token and baseUrl from configuration
        const token = (await studioResult.value.configuration.getValue("GRAFX_AUTH_TOKEN"))
          .parsedData;
        const baseUrl = (await studioResult.value.configuration.getValue("ENVIRONMENT_API"))
          .parsedData;

        try {
          // Fetch template details to get the name
          const templateResponse = await fetch(`${baseUrl}templates/${templateId}`, {
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          });

          if (templateResponse.ok) {
            const templateData = await templateResponse.json();
            if (templateData && templateData.data && templateData.data.name) {
              templateName = templateData.data.name;
            }
          }
        } catch (error) {
          console.warn('Failed to fetch template name:', error);
          // Continue with default name if template fetch fails
        }
      }

      // Create a blob from the document state
      const jsonStr = JSON.stringify(documentResult.value, null, 2);
      const blob = new Blob([jsonStr], { type: "application/json" });

      // Create a download link and trigger it
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${templateName}.json`;
      document.body.appendChild(a);
      a.click();

      // Clean up
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 0);

      // Additional step for template fonts if checkbox is checked
      if (downloadTemplateFonts) {
        try {
          // Extract font families from the document
          // Using type assertion since we don't have exact type information
          const docValue = documentResult.value as any;

          if (docValue && docValue.stylekit && Array.isArray(docValue.stylekit.fontFamilies)) {
            const fontFamilies = docValue.stylekit.fontFamilies;

            // Prepare all font downloads first
            const fontDownloads = [];

            // Process each font family
            for (const fontFamily of fontFamilies) {
              // Process each font style in the font family
              if (fontFamily && Array.isArray(fontFamily.fontStyles) && fontFamily.fontStyles.length > 0) {
                for (const fontStyle of fontFamily.fontStyles) {
                  // Get the font style ID
                  const fontStyleId = fontStyle.fontStyleId;
                  if (!fontStyleId) {
                    console.warn('Font style ID is missing', fontStyle);
                    continue;
                  }

                  // Add this font to the download queue
                  fontDownloads.push({ fontStyleId, fontFamily: fontFamily.name });
                }
              }
            }

            // Close the modal after we've gathered all the font information
            onClose();

            // Now process all the downloads
            for (const download of fontDownloads) {
              try {
                // Fetch font style details
                const fontStyleResponse = await fetch(`${baseUrl}font-styles/${download.fontStyleId}`, {
                  headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json'
                  }
                });

                if (!fontStyleResponse.ok) {
                  console.warn(`Failed to fetch font style details for ${download.fontStyleId}: ${fontStyleResponse.statusText}`);
                  continue;
                }

                const fontStyleDetails = await fontStyleResponse.json();

                // Download the font file
                const fontDownloadResponse = await fetch(`${baseUrl}font-styles/${download.fontStyleId}/download`, {
                  headers: {
                    Authorization: `Bearer ${token}`
                  }
                });

                if (!fontDownloadResponse.ok) {
                  console.warn(`Failed to download font ${fontStyleDetails.fileName}: ${fontDownloadResponse.statusText}`);
                  continue;
                }

                // Create a blob from the font file
                const fontBlob = await fontDownloadResponse.blob();

                // Create a download link and trigger it
                const fontUrl = URL.createObjectURL(fontBlob);
                const fontLink = document.createElement("a");
                fontLink.href = fontUrl;
                // Find the last dot and insert the font name before it
                const lastDotIndex = fontStyleDetails.fileName.lastIndexOf('.');
                const fileName = fontStyleDetails.fileName.slice(0, lastDotIndex) + "_" + fontStyleDetails.name + fontStyleDetails.fileName.slice(lastDotIndex);
                fontLink.download = fileName;
                document.body.appendChild(fontLink);
                fontLink.click();

                // Clean up
                setTimeout(() => {
                  document.body.removeChild(fontLink);
                  URL.revokeObjectURL(fontUrl);
                }, 100); // Slightly longer timeout to handle multiple downloads

                // Add a small delay between downloads to prevent overwhelming the browser
                await new Promise(resolve => setTimeout(resolve, 300));
              } catch (error) {
                console.warn(`Error downloading font ${download.fontStyleId} from family ${download.fontFamily}:`, error);
              }
            }
          } else {
            console.warn('No font families found in the document');
            // Close the modal even if no fonts were found
            onClose();
          }
        } catch (fontError) {
          console.error("Error downloading template fonts:", fontError);
          raiseError(new Error(`Error downloading template fonts: ${fontError instanceof Error ? fontError.message : String(fontError)}`));
          // Close the modal even if there was an error
          onClose();
        }
      } else {
        // Close the modal if we're not downloading fonts
        onClose();
      }
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
              const nameMatchesMap: Record<string, string> = {};

              // First check for exact ID matches
              for (const docConnector of documentConnectors) {
                if (docConnector.source.source === "grafx" && docConnector.source.id) {
                  const sourceId = docConnector.source.id;
                  const foundConnector = connectorResponse.data.find(c => c.id === sourceId);

                  if (!foundConnector) {
                    // Try to find by name
                    const nameMatch = connectorResponse.data.find(c => c.name === docConnector.name);

                    if (nameMatch) {
                      // Store the name match for auto-selection in the modal
                      nameMatchesMap[docConnector.id] = nameMatch.id;
                      // Update the ID in the JSON
                      docConnector.source.id = nameMatch.id;
                      // Still add to missing connectors list to show in the modal
                      missingConnectorsList.push(docConnector);
                    } else {
                      // Add to missing connectors list
                      missingConnectorsList.push(docConnector);
                    }
                  }
                }
              }

              // Set the name matches for use in the replacement modal
              setNameMatches(nameMatchesMap);

              if (missingConnectorsList.length > 0) {
                // Check if all missing connectors have name matches
                const allHaveMatches = missingConnectorsList.every(connector =>
                  nameMatchesMap[connector.id] !== undefined
                );

                if (!allHaveMatches) {
                  // Show replacement modal for manual selection if not all have matches
                  setMissingConnectors(missingConnectorsList);
                  setReplacementModalOpened(true);
                  return;
                }
              }

              // If no missing connectors or all have matches, update the JSON and load
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

          <Stack gap="xs">
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
            <Checkbox
              label="Download template fonts"
              checked={downloadTemplateFonts}
              onChange={(event) => setDownloadTemplateFonts(event.currentTarget.checked)}
            />
          </Stack>
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
        nameMatches={nameMatches}
      />
    </>
  );
}

