import type SDK from "@chili-publish/studio-sdk";
import { handleStudioFunc } from "./utils";
import type { ConnectorType } from "@chili-publish/studio-sdk";

/**
 * Get connectors by type from the Studio SDK
 */
export async function getConnectorsByType(studio: SDK, type: ConnectorType) {
  return handleStudioFunc(studio.connector.getAllByType, type);
}

/**
 * Unregister a connector from the Studio SDK
 */
export async function unregisterConnector(studio: SDK, connectorId: string) {
  return handleStudioFunc(studio.connector.unregister, connectorId);
}
