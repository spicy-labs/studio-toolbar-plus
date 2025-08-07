import type SDK from "@chili-publish/studio-sdk";
import { handleStudioFunc } from "./utils";
import type { ConnectorType } from "@chili-publish/studio-sdk";
import { ConnectorRegistrationSource } from "@chili-publish/studio-sdk/lib/src/next";

/**
 * Get connectors by type from the Studio SDK
 */
export async function getConnectorsByType(studio: SDK, type: ConnectorType) {
  return handleStudioFunc(studio.connector.getAllByType, type);
}

/**
 * Register a connector with the Studio SDK
 */
export async function registerConnector(studio: SDK, id: string) {
  return handleStudioFunc(studio.next.connector.register, {
    id,
    source: ConnectorRegistrationSource.grafx,
  });
}

/**
 * Unregister a connector from the Studio SDK
 */
export async function unregisterConnector(studio: SDK, connectorId: string) {
  return handleStudioFunc(studio.connector.unregister, connectorId);
}
