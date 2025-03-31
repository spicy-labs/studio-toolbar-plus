import { type LayoutMap } from "../../types/layoutConfigTypes";
import { useAppStore } from "../../modalStore";
import {
  loadDocFromDoc,
  loadLayoutImageMapFromDoc,
  saveLayoutImageMapToDoc,
  saveLayoutMappingToAction,
} from "../../studio/studioAdapter";
import React, { useEffect, useState, useMemo } from "react";
import styled from "styled-components";
import {
  Button,
  Group,
  MantineProvider,
  Stack,
  Title,
  Modal,
  Checkbox,
  Text,
  List,
  Alert,
} from "@mantine/core";
import {
  layoutMappingValidation,
  type ValidationReport,
} from "../../studio-adaptor/layoutMapingValidation.ts";
import { IconPlus } from "@tabler/icons-react";
import { AddMappingImageVariableModal } from "./AddMappingImageVariableModal";
import { AddDependentModal } from "./AddDependentModal";
import { LayoutConfigSection } from "./LayoutConfigSelection";
import { Result } from "typescript-result";

type LayoutImageMappingModalProps = {
  onExportCSV: () => void;
  // config: LayoutConfig;
  // onChange: (updatedConfig: LayoutConfig) => void;
};

export const LayoutImageMappingModal: React.FC<
  LayoutImageMappingModalProps
> = ({ onExportCSV = () => console.log("Export CSV clicked") }) => {
  const { state, effects: events, raiseError, enableToolbar } = useAppStore();
  const [validationReport, setValidationReport] =
    useState<ValidationReport | null>(null);
  const [isValidationModalOpen, setIsValidationModalOpen] = useState(false);

  // Filter image variables from documentState
  const imageVariables = useMemo(() => {
    return state.studio.document.variables.filter(
      (variable) => variable.type === "image",
    );
  }, [state.studio.document.variables]);

  // Transform image variables into format required by Mantine Select
  const imageVariableOptions = useMemo(() => {
    return imageVariables.map((variable) => ({
      value: variable.id,
      label: variable.name,
    }));
  }, [imageVariables]);

  // Load config when component mounts if it"s not loaded yet
  useEffect(() => {
    const loadConfig = async () => {
      if (
        !state.studio.isLayoutConfigLoaded &&
        !state.studio.isDocumentLoaded
      ) {
        const resultDoc = await loadDocFromDoc();
        const resultLayoutMap = await loadLayoutImageMapFromDoc();

        resultLayoutMap.fold((layoutMapArray) => {
          resultDoc.fold((doc) => {
            // Create a combined validation report
            const combinedReport: ValidationReport = {
              removedLayoutIds: [],
              removedVariables: [],
              removedDependents: [],
              removedVariableValues: [],
            };

            // Process each layout map in the array
            const cleanedConfigArray = layoutMapArray.map((config) => {
              // Validate the layout mapping against the document
              const { cleanLayoutMap, report } = layoutMappingValidation(
                config,
                doc,
              );

              // Combine the reports
              combinedReport.removedLayoutIds.push(...report.removedLayoutIds);
              combinedReport.removedVariables.push(...report.removedVariables);
              combinedReport.removedDependents.push(
                ...report.removedDependents,
              );
              combinedReport.removedVariableValues.push(
                ...report.removedVariableValues,
              );

              return cleanLayoutMap;
            });

            // Check if any items were removed during validation
            const hasRemovedItems =
              combinedReport.removedLayoutIds.length > 0 ||
              combinedReport.removedVariables.length > 0 ||
              combinedReport.removedDependents.length > 0 ||
              combinedReport.removedVariableValues.length > 0;

            if (hasRemovedItems) {
              // Store the report and show the validation modal
              setValidationReport(combinedReport);
              setIsValidationModalOpen(true);

              // Load the cleaned config
              events.studio.layoutImageMapping.load(cleanedConfigArray);
            } else {
              // No validation issues, load the original config
              events.studio.layoutImageMapping.load(layoutMapArray);
            }

            events.studio.document.load(doc);
          }, raiseError);
        }, raiseError);
      }
    };

    if (state.modal.isModalVisible) loadConfig();
  }, [state.modal.isModalVisible]);

  if (!state.modal.isModalVisible) return null;

  const handleClose = () => {
    events.studio.document.unload();
    events.studio.layoutImageMapping.unload();
    enableToolbar();
    events.modal.hideModal();
    // enableToolbar();
  };

  const handleSave = async () => {
    // Save the layout image mapping to the document
    const saveToDocResult = await saveLayoutImageMapToDoc(
      state.studio.layoutImageMapping,
    );

    saveToDocResult
      .map(async (_) => {
        return await saveLayoutMappingToAction(
          state.studio.layoutImageMapping,
          state.studio.document,
        );
      })
      .fold(handleClose, (e) => (e ? raiseError(e) : e));
  };

  // Handle layout config changes
  const handleConfigChange = (updatedConfig: LayoutMap[]) => {
    events.studio.layoutImageMapping.load(updatedConfig);
  };

  // Modal Header Component
  const ModalHeader: React.FC = () => {
    return (
      <TopBar>
        <Group justify="space-between" w="100%">
          <Title order={4} c="white">
            Layout Image Mapping Tool
          </Title>
          <Button
            leftSection={<IconPlus size={16} />}
            onClick={() => events.studio.layoutImageMapping.addLayoutMap()}
          >
            Add Mapping
          </Button>
        </Group>
      </TopBar>
    );
  };

  // Modal Footer Component
  const ModalFooter: React.FC = () => {
    return (
      <BottomBar>
        <Group justify="flex-end" gap="sm">
          <Checkbox defaultChecked label="Generate Action" />
          {/* <Button onClick={onExportCSV}>Export CSV</Button> */}
          <Button color="green" onClick={handleSave}>
            Save
          </Button>
          <Button onClick={handleClose}>Close</Button>
        </Group>
      </BottomBar>
    );
  };

  return (
    <MantineProvider defaultColorScheme="dark">
      <Modal
        trapFocus={false}
        styles={{
          body: {
            width: "100%",
            height: "90%",
            padding: "0px",
            backgroundColor: "#4a4949",
            borderRadius: "8px",
            display: "flex",
            flexDirection: "column",
            boxShadow: "0 4px 8px rgba(0, 0, 0, 0.2)",
            overflow: "hidden",
          },
          content: {
            width: "100%",
            height: "100%",
            justifyContent: "center",
            alignItems: "center",
            display: "flex",
          },
        }}
        centered
        fullScreen
        opened={state.modal.isModalVisible}
        onClose={handleClose}
        withCloseButton={false}
      >
        <ModalHeader />

        <Content>
          {!state.studio.isLayoutConfigLoaded ||
          !state.studio.isDocumentLoaded ? (
            <LoadingSpinner />
          ) : (
            <Stack h="100%" gap="md">
              {state.studio.layoutImageMapping.map((config, index) => (
                <LayoutConfigSection
                  key={index}
                  mapConfig={config}
                  index={index}

                  // onAddDependent={(configId, variableId) => {
                  //   setCurrentConfigIndex(
                  //     state.studio.layoutImageMapping.findIndex(
                  //       (c) => c.id === configId,
                  //     ),
                  //   );
                  //   setCurrentVariableId(variableId);
                  //   setIsAddDependentModalOpen(true);
                  // }}
                />
              ))}
            </Stack>
          )}
        </Content>

        <ModalFooter />
      </Modal>

      <AddMappingImageVariableModal
        currentMapConfig={
          state.studio.layoutImageMapping.find(
            (config) => config.id === state.modal.currentSelectedMapId,
          ) || null
        }
      />

      <AddDependentModal />

      {/* Validation Report Modal */}
      <Modal
        opened={isValidationModalOpen}
        onClose={() => setIsValidationModalOpen(false)}
        title={<Title order={4}>Layout Mapping Validation</Title>}
        centered
        size="lg"
      >
        <Stack gap="md">
          <Alert color="yellow" title="Items Removed from Layout Mapping">
            <Text>
              Values were deleted from the document and thus we also removed
              those values from your layout mapping.
            </Text>
          </Alert>

          {validationReport && (
            <>
              {validationReport.removedLayoutIds.length > 0 && (
                <Stack gap="xs">
                  <Text fw={600}>Removed Layout IDs:</Text>
                  <List>
                    {validationReport.removedLayoutIds.map((id, index) => (
                      <List.Item key={index}>{id}</List.Item>
                    ))}
                  </List>
                </Stack>
              )}

              {validationReport.removedVariables.length > 0 && (
                <Stack gap="xs">
                  <Text fw={600}>Removed Variables:</Text>
                  <List>
                    {validationReport.removedVariables.map((id, index) => (
                      <List.Item key={index}>{id}</List.Item>
                    ))}
                  </List>
                </Stack>
              )}

              {validationReport.removedDependents.length > 0 && (
                <Stack gap="xs">
                  <Text fw={600}>Removed Dependents:</Text>
                  <List>
                    {validationReport.removedDependents.map((item, index) => (
                      <List.Item key={index}>
                        Variable ID: {item.variableId} (from Image Variable:{" "}
                        {item.imageVariableId})
                      </List.Item>
                    ))}
                  </List>
                </Stack>
              )}

              {validationReport.removedVariableValues.length > 0 && (
                <Stack gap="xs">
                  <Text fw={600}>Removed Variable Values:</Text>
                  <List>
                    {validationReport.removedVariableValues.map(
                      (item, index) => (
                        <List.Item key={index}>
                          Value: {item.value} (from Image Variable:{" "}
                          {item.imageVariableId}, Group:{" "}
                          {item.dependentGroupIndex})
                        </List.Item>
                      ),
                    )}
                  </List>
                </Stack>
              )}
            </>
          )}

          <Group justify="flex-end">
            <Button onClick={() => setIsValidationModalOpen(false)}>OK</Button>
          </Group>
        </Stack>
      </Modal>
    </MantineProvider>
  );
};

// Styled components for modal layout
const TopBar = styled.div`
  padding: 16px 20px;
  background-color: #3a3939;
  border-bottom: 1px solid #5a5a5a;
`;

const Content = styled.div`
  flex: 1;
  padding: 20px;
  overflow-y: auto;
`;

const BottomBar = styled.div`
  padding: 16px 20px;
  background-color: #3a3939;
  border-top: 1px solid #5a5a5a;
`;

const LoadingSpinner = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100%;

  &:after {
    content: "";
    width: 40px;
    height: 40px;
    border: 4px solid #f3f3f3;
    border-top: 4px solid #be4bdb;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    0% {
      transform: rotate(0deg);
    }
    100% {
      transform: rotate(360deg);
    }
  }
`;
