import React, { useRef, useState } from "react";
import {
  Modal,
  Text,
  Stack,
  Group,
  Button,
  Loader,
  Alert,
  SimpleGrid,
} from "@mantine/core";
import {
  IconDownload,
  IconUpload,
  IconAlertCircle,
  IconFileText,
} from "@tabler/icons-react";
import { appStore } from "../modalStore";
import {
  getCurrentDocumentState,
  loadDocumentFromJsonStr,
} from "../studio/documentHandler";
import { getStudio } from "../studio/studioAdapter";
import { ConnectorReplacementModal } from "./ConnectorReplacementModal";
import type {
  Connector,
  ConnectorResponse,
  DocumentConnector,
} from "../types/connectorTypes";
import type {
  FontFamily,
  FontStyle,
  FontMigrationProgress,
  FontToMigrate,
  FontFamiliesResponse,
  FontStylesResponse,
  FontUploadResponse,
} from "../types/fontTypes";

interface DownloadModalProps {
  opened: boolean;
  onClose: () => void;
}

export function DownloadModal({ opened, onClose }: DownloadModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const raiseError = appStore((store) => store.raiseError);
  const [replacementModalOpened, setReplacementModalOpened] = useState(false);
  const [missingConnectors, setMissingConnectors] = useState<
    DocumentConnector[]
  >([]);
  const [availableConnectors, setAvailableConnectors] = useState<Connector[]>(
    [],
  );
  const [pendingJsonContent, setPendingJsonContent] = useState<string>("");
  const [nameMatches, setNameMatches] = useState<Record<string, string>>({});
  const [fontMigrationProgress, setFontMigrationProgress] =
    useState<FontMigrationProgress | null>(null);
  const [showPackageWarning, setShowPackageWarning] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  // Button 1: Download Document JSON (Blue)
  const handleDownloadDocumentJson = async () => {
    setIsDownloading(true);
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

      // Get template name for filename
      const templateName = await getTemplateName(studioResult.value);

      // Prepare document data (no additional properties)
      const documentData = { ...documentResult.value } as any;
      const fileName = `${templateName}.json`;

      // Create and download the file
      downloadJsonFile(documentData, fileName);
      onClose();
    } catch (error) {
      raiseError(error instanceof Error ? error : new Error(String(error)));
    } finally {
      setIsDownloading(false);
    }
  };

  // Button 2: Download Template Package (Blue)
  const handleDownloadTemplatePackage = async () => {
    setIsDownloading(true);
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

      // Get token and baseUrl from configuration
      const token = (
        await studioResult.value.configuration.getValue("GRAFX_AUTH_TOKEN")
      ).parsedData;
      const baseUrl = (
        await studioResult.value.configuration.getValue("ENVIRONMENT_API")
      ).parsedData;

      // Get template name for filename
      const templateName = await getTemplateName(studioResult.value);

      // Prepare document data with token and baseUrl properties
      const documentData = { ...documentResult.value } as any;

      // Ensure properties object exists
      if (!documentData.properties) {
        documentData.properties = {};
      }

      // Store token and baseUrl in document properties
      documentData.properties.token = token;
      documentData.properties.baseUrl = baseUrl;

      const fileName = `${templateName}.packageJson`;

      // Create and download the file
      downloadJsonFile(documentData, fileName);

      // Show package warning
      setShowPackageWarning(true);
      setTimeout(() => setShowPackageWarning(false), 5000);

      onClose();
    } catch (error) {
      raiseError(error instanceof Error ? error : new Error(String(error)));
    } finally {
      setIsDownloading(false);
    }
  };

  // Helper function to get template name
  const getTemplateName = async (studio: any): Promise<string> => {
    try {
      // Get token and baseUrl from configuration
      const token = (await studio.configuration.getValue("GRAFX_AUTH_TOKEN"))
        .parsedData;
      const baseUrl = (await studio.configuration.getValue("ENVIRONMENT_API"))
        .parsedData;

      // Get template ID from URL
      const urlPath = window.location.href;
      const templateIdMatch = urlPath.match(/templates\/([\w-]+)/);
      let templateName = "document";

      if (templateIdMatch && templateIdMatch[1]) {
        const templateId = templateIdMatch[1];

        try {
          // Fetch template details to get the name
          const templateResponse = await fetch(
            `${baseUrl}templates/${templateId}`,
            {
              headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
              },
            },
          );

          if (templateResponse.ok) {
            const templateData = await templateResponse.json();
            if (templateData && templateData.data && templateData.data.name) {
              templateName = templateData.data.name;
            }
          }
        } catch (error) {
          // Continue with default name if template fetch fails
          raiseError(
            error instanceof Error
              ? error
              : new Error("Failed to fetch template name"),
          );
        }
      }

      return templateName;
    } catch (error) {
      raiseError(error instanceof Error ? error : new Error(String(error)));
      return "document";
    }
  };

  // Helper function to download JSON file
  const downloadJsonFile = (data: any, fileName: string) => {
    const jsonStr = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();

    // Clean up
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 0);
  };

  // Button 3: Upload Document JSON or Template Package (Green)
  const handleUpload = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  // Button 4: Download Document Fonts (Blue)
  const handleDownloadFonts = async () => {
    setIsDownloading(true);
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

      // Get token and baseUrl from configuration
      const token = (
        await studioResult.value.configuration.getValue("GRAFX_AUTH_TOKEN")
      ).parsedData as string;
      const baseUrl = (
        await studioResult.value.configuration.getValue("ENVIRONMENT_API")
      ).parsedData as string;

      // Extract font families from document
      const documentData = documentResult.value as any;
      if (
        !documentData.stylekit?.fontFamilies ||
        !Array.isArray(documentData.stylekit.fontFamilies)
      ) {
        raiseError(new Error("No fonts found in document"));
        return;
      }

      const fontFamilies = documentData.stylekit.fontFamilies as FontFamily[];
      if (fontFamilies.length === 0) {
        raiseError(new Error("No fonts found in document"));
        return;
      }

      // Download fonts with deduplication and create ledger
      await downloadDocumentFonts(fontFamilies, token, baseUrl);
    } catch (error) {
      raiseError(error instanceof Error ? error : new Error(String(error)));
    } finally {
      setIsDownloading(false);
    }
  };

  // Font download function with deduplication and ledger creation
  const downloadDocumentFonts = async (
    fontFamilies: FontFamily[],
    token: string,
    baseUrl: string,
  ) => {
    try {
      const downloadedFonts = new Set<string>(); // For deduplication
      const ledgerEntries: string[] = [];
      const templateName = await getTemplateName({
        configuration: {
          getValue: async (key: string) => ({
            parsedData: key === "GRAFX_AUTH_TOKEN" ? token : baseUrl,
          }),
        },
      });

      // Collect all font styles with deduplication
      const fontsToDownload: {
        family: FontFamily;
        style: FontStyle;
        fileName: string;
      }[] = [];

      for (const family of fontFamilies) {
        for (const style of family.fontStyles) {
          // Get font style details to get the actual fileName
          try {
            const fontStyleResponse = await fetch(
              `${baseUrl}font-families/${family.fontFamilyId}/styles`,
              {
                headers: {
                  Authorization: `Bearer ${token}`,
                  "Content-Type": "application/json",
                },
              },
            );

            if (fontStyleResponse.ok) {
              const fontStylesData: FontStylesResponse =
                await fontStyleResponse.json();
              const fontStyleDetails = fontStylesData.data.find(
                (fs) => fs.id === style.fontStyleId,
              );

              if (fontStyleDetails) {
                const lastDotIndex = fontStyleDetails.fileName.lastIndexOf(".");
                const fontBaseName = fontStyleDetails.fileName.slice(
                  0,
                  lastDotIndex,
                );

                // Check for deduplication using the base font name
                if (!downloadedFonts.has(fontBaseName)) {
                  downloadedFonts.add(fontBaseName);

                  // Create ledger entry mapping display name to actual font name
                  const displayName =
                    style.name + fontStyleDetails.fileName.slice(lastDotIndex);
                  ledgerEntries.push(`${displayName} -> ${fontBaseName}`);

                  fontsToDownload.push({
                    family,
                    style,
                    fileName:
                      fontBaseName +
                      fontStyleDetails.fileName.slice(lastDotIndex),
                  });
                }
              }
            }
          } catch (error) {
            raiseError(
              error instanceof Error
                ? error
                : new Error(
                    `Failed to get font style details for ${style.name}`,
                  ),
            );
          }
        }
      }

      // Download each unique font
      for (let i = 0; i < fontsToDownload.length; i++) {
        const { style, fileName } = fontsToDownload[i];

        try {
          const fontDownloadResponse = await fetch(
            `${baseUrl}font-styles/${style.fontStyleId}/download`,
            {
              headers: {
                Authorization: `Bearer ${token}`,
              },
            },
          );

          if (fontDownloadResponse.ok) {
            const fontBlob = await fontDownloadResponse.blob();

            // Download the font file
            const url = URL.createObjectURL(fontBlob);
            const a = document.createElement("a");
            a.href = url;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();

            // Clean up
            setTimeout(() => {
              document.body.removeChild(a);
              URL.revokeObjectURL(url);
            }, 100 * i); // Stagger cleanup to avoid conflicts
          } else {
            raiseError(new Error(`Failed to download font: ${style.name}`));
          }
        } catch (error) {
          raiseError(
            error instanceof Error
              ? error
              : new Error(`Error downloading font ${style.name}`),
          );
        }
      }

      // Create and download the ledger file
      if (ledgerEntries.length > 0) {
        const ledgerContent = `# Font Ledger for ${templateName}\n\nThis file maps the display names to actual font file names:\n\n${ledgerEntries.join(
          "\n",
        )}`;
        const ledgerBlob = new Blob([ledgerContent], { type: "text/markdown" });
        const ledgerUrl = URL.createObjectURL(ledgerBlob);
        const ledgerLink = document.createElement("a");
        ledgerLink.href = ledgerUrl;
        ledgerLink.download = `${templateName}_font_ledger.md`;
        document.body.appendChild(ledgerLink);
        ledgerLink.click();

        // Clean up
        setTimeout(() => {
          document.body.removeChild(ledgerLink);
          URL.revokeObjectURL(ledgerUrl);
        }, 1000);
      }

      onClose();
    } catch (error) {
      raiseError(error instanceof Error ? error : new Error(String(error)));
    }
  };

  // Font migration function
  const migrateFonts = async (
    sourceFontFamilies: FontFamily[],
    sourceToken: string,
    sourceBaseUrl: string,
    targetToken: string,
    targetBaseUrl: string,
  ) => {
    try {
      setFontMigrationProgress({
        total: 0,
        completed: 0,
        status: "checking",
      });

      // Step 1: Get target font families
      const targetFontsResponse = await fetch(
        `${targetBaseUrl}font-families?sortBy=Name&sortOrder=asc`,
        {
          headers: {
            Authorization: `Bearer ${targetToken}`,
            "Content-Type": "application/json",
          },
        },
      );

      if (!targetFontsResponse.ok) {
        throw new Error(
          `Failed to fetch target fonts: ${targetFontsResponse.statusText}`,
        );
      }

      const targetFontsData: FontFamiliesResponse =
        await targetFontsResponse.json();
      const fontsToMigrate: FontToMigrate[] = [];

      // Step 2: Compare source and target fonts
      for (const sourceFamily of sourceFontFamilies) {
        const targetFamily = targetFontsData.data.find(
          (tf) => tf.name === sourceFamily.name,
        );

        if (targetFamily) {
          // Family exists, check styles
          const targetStylesResponse = await fetch(
            `${targetBaseUrl}font-families/${targetFamily.id}/styles`,
            {
              headers: {
                Authorization: `Bearer ${targetToken}`,
                "Content-Type": "application/json",
              },
            },
          );

          if (targetStylesResponse.ok) {
            const targetStylesData: FontStylesResponse =
              await targetStylesResponse.json();

            for (const sourceStyle of sourceFamily.fontStyles) {
              const targetStyle = targetStylesData.data.find(
                (ts) => ts.name === sourceStyle.name,
              );

              if (!targetStyle) {
                fontsToMigrate.push({
                  sourceFamily,
                  sourceStyle,
                  targetExists: false,
                });
              }
            }
          }
        } else {
          // Family doesn't exist, add all styles
          for (const sourceStyle of sourceFamily.fontStyles) {
            fontsToMigrate.push({
              sourceFamily,
              sourceStyle,
              targetExists: false,
            });
          }
        }
      }

      // Step 3: Update progress with total count
      setFontMigrationProgress({
        total: fontsToMigrate.length,
        completed: 0,
        status: "downloading",
      });

      // Step 4: Migrate fonts
      for (let i = 0; i < fontsToMigrate.length; i++) {
        const fontToMigrate = fontsToMigrate[i];

        setFontMigrationProgress({
          total: fontsToMigrate.length,
          completed: i,
          status: "downloading",
          current: `${fontToMigrate.sourceFamily.name} - ${fontToMigrate.sourceStyle.name}`,
        });

        try {
          // Download font from source
          const fontDownloadResponse = await fetch(
            `${sourceBaseUrl}font-styles/${fontToMigrate.sourceStyle.fontStyleId}/download`,
            {
              headers: {
                Authorization: `Bearer ${sourceToken}`,
              },
            },
          );

          if (!fontDownloadResponse.ok) {
            raiseError(
              new Error(
                `Failed to download font: ${fontDownloadResponse.statusText}`,
              ),
            );
            continue;
          }

          const fontBlob = await fontDownloadResponse.blob();

          // Upload font to target
          const formData = new FormData();
          formData.append(
            "file",
            fontBlob,
            `${fontToMigrate.sourceFamily.name}-${fontToMigrate.sourceStyle.name}.ttf`,
          );

          const uploadResponse = await fetch(
            `${targetBaseUrl}font-styles/temp`,
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${targetToken}`,
              },
              body: formData,
            },
          );

          if (!uploadResponse.ok) {
            raiseError(
              new Error(`Failed to upload font: ${uploadResponse.statusText}`),
            );
            continue;
          }

          const uploadData: FontUploadResponse = await uploadResponse.json();

          if (uploadData.data.preloadedData.length > 0) {
            const preloadedFont = uploadData.data.preloadedData[0];

            // Patch the font
            const patchResponse = await fetch(
              `${targetBaseUrl}font-styles/temp/${uploadData.batchId}`,
              {
                method: "PATCH",
                headers: {
                  Authorization: `Bearer ${targetToken}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify([
                  {
                    fontStyleId: preloadedFont.id,
                    familyName: fontToMigrate.sourceFamily.name,
                    styleName: fontToMigrate.sourceStyle.name,
                  },
                ]),
              },
            );

            if (patchResponse.ok) {
              // Confirm the upload
              const confirmResponse = await fetch(
                `${targetBaseUrl}font-styles/temp/${uploadData.batchId}/confirm`,
                {
                  method: "POST",
                  headers: {
                    Authorization: `Bearer ${targetToken}`,
                  },
                },
              );

              if (!confirmResponse.ok) {
                raiseError(
                  new Error(
                    `Failed to confirm font upload: ${confirmResponse.statusText}`,
                  ),
                );
              }
            }
          }
        } catch (error) {
          raiseError(
            error instanceof Error
              ? error
              : new Error(
                  `Error migrating font ${fontToMigrate.sourceFamily.name} - ${fontToMigrate.sourceStyle.name}`,
                ),
          );
        }
      }

      // Step 5: Complete
      setFontMigrationProgress({
        total: fontsToMigrate.length,
        completed: fontsToMigrate.length,
        status: "complete",
      });

      // Hide progress after 3 seconds
      setTimeout(() => {
        setFontMigrationProgress(null);
      }, 3000);
    } catch (error) {
      setFontMigrationProgress({
        total: 0,
        completed: 0,
        status: "error",
        error: error instanceof Error ? error.message : String(error),
      });

      // Hide error after 5 seconds
      setTimeout(() => {
        setFontMigrationProgress(null);
      }, 5000);
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

          // Check if this is a package file and has stored token/baseUrl
          const isPackageFile = file.name.endsWith(".packageJson");
          const hasStoredCredentials =
            jsonData.properties?.token && jsonData.properties?.baseUrl;

          if (jsonData.connectors && Array.isArray(jsonData.connectors)) {
            const studioResult = await getStudio();
            if (!studioResult.isOk()) {
              raiseError(
                new Error(
                  studioResult.error?.message || "Failed to get studio",
                ),
              );
              return;
            }

            // Get token and baseUrl from configuration
            const token = (
              await studioResult.value.configuration.getValue(
                "GRAFX_AUTH_TOKEN",
              )
            ).parsedData;
            const baseUrl = (
              await studioResult.value.configuration.getValue("ENVIRONMENT_API")
            ).parsedData;

            // Fetch connectors from API
            try {
              const response = await fetch(`${baseUrl}connectors`, {
                headers: {
                  Authorization: `Bearer ${token}`,
                  "Content-Type": "application/json",
                },
              });

              if (!response.ok) {
                throw new Error(
                  `Failed to fetch connectors: ${response.statusText}`,
                );
              }

              const connectorResponse: ConnectorResponse =
                await response.json();
              setAvailableConnectors(connectorResponse.data);

              // Check for missing connectors
              const documentConnectors =
                jsonData.connectors as DocumentConnector[];
              const missingConnectorsList: DocumentConnector[] = [];
              const nameMatchesMap: Record<string, string> = {};

              // First check for exact ID matches
              for (const docConnector of documentConnectors) {
                if (
                  docConnector.source.source === "grafx" &&
                  docConnector.source.id
                ) {
                  const sourceId = docConnector.source.id;
                  const foundConnector = connectorResponse.data.find(
                    (c) => c.id === sourceId,
                  );

                  if (!foundConnector) {
                    // Try to find by name
                    const nameMatch = connectorResponse.data.find(
                      (c) => c.name === docConnector.name,
                    );

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
                const allHaveMatches = missingConnectorsList.every(
                  (connector) => nameMatchesMap[connector.id] !== undefined,
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
              await loadDocument(
                studioResult.value,
                updatedContent,
                isPackageFile && hasStoredCredentials,
              );
            } catch (error) {
              raiseError(
                error instanceof Error ? error : new Error(String(error)),
              );
            }
          } else {
            // No connectors in the JSON, proceed with normal loading
            const studioResult = await getStudio();
            if (!studioResult.isOk()) {
              raiseError(
                new Error(
                  studioResult.error?.message || "Failed to get studio",
                ),
              );
              return;
            }

            await loadDocument(
              studioResult.value,
              content,
              isPackageFile && hasStoredCredentials,
            );
          }
        } catch (parseError) {
          raiseError(
            new Error(
              `Invalid JSON format: ${
                parseError instanceof Error
                  ? parseError.message
                  : String(parseError)
              }`,
            ),
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
  const loadDocument = async (
    studio: any,
    content: string,
    isPackageFile = false,
  ) => {
    try {
      const jsonData = JSON.parse(content);

      // Check if this is a package file with font migration needed
      if (
        isPackageFile &&
        jsonData.properties?.token &&
        jsonData.properties?.baseUrl
      ) {
        // Get current environment token and baseUrl
        const targetToken = (
          await studio.configuration.getValue("GRAFX_AUTH_TOKEN")
        ).parsedData;
        const targetBaseUrl = (
          await studio.configuration.getValue("ENVIRONMENT_API")
        ).parsedData;

        // Extract source credentials
        const sourceToken = jsonData.properties.token;
        const sourceBaseUrl = jsonData.properties.baseUrl;

        // Check if we have font families to migrate
        if (
          jsonData.stylekit?.fontFamilies &&
          Array.isArray(jsonData.stylekit.fontFamilies)
        ) {
          const sourceFontFamilies = jsonData.stylekit
            .fontFamilies as FontFamily[];

          if (sourceFontFamilies.length > 0) {
            // Start font migration
            await migrateFonts(
              sourceFontFamilies,
              sourceToken,
              sourceBaseUrl,
              targetToken,
              targetBaseUrl,
            );
          }
        }

        // Remove the stored credentials before loading
        delete jsonData.properties.token;
        delete jsonData.properties.baseUrl;
        content = JSON.stringify(jsonData);
      }

      const loadResult = await loadDocumentFromJsonStr(studio, content);
      if (!loadResult.isOk()) {
        raiseError(
          new Error(loadResult.error?.message || "Failed to load document"),
        );
        return;
      }

      onClose();
    } catch (error) {
      raiseError(error instanceof Error ? error : new Error(String(error)));
    }
  };

  const handleConnectorReplacements = async (
    replacements: { original: string; replacement: string }[],
  ) => {
    try {
      const jsonData = JSON.parse(pendingJsonContent);

      if (jsonData.connectors && Array.isArray(jsonData.connectors)) {
        // Update connector IDs based on replacements
        const documentConnectors = jsonData.connectors as DocumentConnector[];

        for (const docConnector of documentConnectors) {
          if (docConnector.source.source === "grafx") {
            const replacement = replacements.find(
              (r) => r.original === docConnector.id,
            );
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
        // Check if original file was a package file
        const isPackageFile =
          pendingJsonContent.includes('"token"') &&
          pendingJsonContent.includes('"baseUrl"');
        await loadDocument(studioResult.value, updatedContent, isPackageFile);
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
        size="50%"
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
          <Text size="md" style={{ textAlign: "center", marginBottom: "1rem" }}>
            Choose an action for document management. Downloads transfer JSON
            only, not assets.
          </Text>

          <SimpleGrid cols={2} spacing="xl" style={{ marginTop: "1rem" }}>
            {/* Button 1: Download Document JSON */}
            <Button
              onClick={handleDownloadDocumentJson}
              color="blue"
              loading={isDownloading}
              disabled={isDownloading}
              fullWidth
              size="lg"
              style={{
                height: "80px",
                fontSize: "1rem",
                fontWeight: 500,
              }}
            >
              <Group gap="md" style={{ flexDirection: "column" }}>
                <IconDownload size={28} />
                <span>Download Document JSON</span>
              </Group>
            </Button>

            {/* Button 2: Download Template Package */}
            <Button
              onClick={handleDownloadTemplatePackage}
              color="blue"
              loading={isDownloading}
              disabled={isDownloading}
              fullWidth
              size="lg"
              style={{
                height: "80px",
                fontSize: "1rem",
                fontWeight: 500,
              }}
            >
              <Group gap="md" style={{ flexDirection: "column" }}>
                <IconDownload size={28} />
                <span>Download Template Package</span>
              </Group>
            </Button>

            {/* Button 3: Upload Document JSON or Template Package */}
            <Button
              onClick={handleUpload}
              color="green"
              disabled={isDownloading}
              fullWidth
              size="lg"
              style={{
                height: "80px",
                fontSize: "1rem",
                fontWeight: 500,
              }}
            >
              <Group gap="md" style={{ flexDirection: "column" }}>
                <IconUpload size={28} />
                <span>Upload JSON/Package</span>
              </Group>
            </Button>

            {/* Button 4: Download Document Fonts */}
            <Button
              onClick={handleDownloadFonts}
              color="blue"
              loading={isDownloading}
              disabled={isDownloading}
              fullWidth
              size="lg"
              style={{
                height: "80px",
                fontSize: "1rem",
                fontWeight: 500,
              }}
            >
              <Group gap="md" style={{ flexDirection: "column" }}>
                <IconFileText size={28} />
                <span>Download Document Fonts</span>
              </Group>
            </Button>
          </SimpleGrid>
        </Stack>

        {/* Package Warning */}
        {showPackageWarning && (
          <Alert
            icon={<IconAlertCircle size="1rem" />}
            title="Package Warning"
            color="orange"
            style={{ marginTop: "1rem" }}
          >
            Package is only active for a short-period.
          </Alert>
        )}

        {/* Font Migration Progress */}
        {fontMigrationProgress && (
          <Alert
            icon={
              fontMigrationProgress.status === "error" ? (
                <IconAlertCircle size="1rem" />
              ) : (
                <Loader size="sm" />
              )
            }
            title={
              fontMigrationProgress.status === "checking"
                ? "Checking Fonts"
                : fontMigrationProgress.status === "downloading" ||
                    fontMigrationProgress.status === "uploading"
                  ? `Number of Fonts To Move: ${fontMigrationProgress.completed}/${fontMigrationProgress.total}`
                  : fontMigrationProgress.status === "complete"
                    ? "Font Migration Complete"
                    : "Font Migration Error"
            }
            color={
              fontMigrationProgress.status === "error"
                ? "red"
                : fontMigrationProgress.status === "complete"
                  ? "green"
                  : "blue"
            }
            style={{ marginTop: "1rem" }}
          >
            {fontMigrationProgress.current && (
              <Text size="sm">Current: {fontMigrationProgress.current}</Text>
            )}
            {fontMigrationProgress.error && (
              <Text size="sm" style={{ color: "red" }}>
                {fontMigrationProgress.error}
              </Text>
            )}
          </Alert>
        )}
      </Modal>

      {/* Hidden file input for upload */}
      <input
        type="file"
        ref={fileInputRef}
        style={{ display: "none" }}
        accept=".json,.packageJson"
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
