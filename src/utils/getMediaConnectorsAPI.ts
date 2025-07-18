import { Result } from "typescript-result";
import type { ConnectorResponse } from "../types/connectorTypes";

/**
 * Fetches media connectors from the API
 * @param baseUrl - The base URL for the API
 * @param authToken - The authentication token
 * @returns Promise<Result<ConnectorResponse, Error>> - The connector response wrapped in a Result
 */
export async function getMediaConnectorsAPI(
  baseUrl: string,
  authToken: string,
): Promise<Result<ConnectorResponse, Error>> {
  try {
    // Fetch connectors from API
    const response = await fetch(`${baseUrl}connectors`, {
      headers: {
        Authorization: `Bearer ${authToken}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      return Result.error(
        new Error(`Failed to fetch connectors: ${response.statusText}`),
      );
    }

    const connectorResponse: ConnectorResponse = await response.json();
    return Result.ok(connectorResponse);
  } catch (error) {
    return Result.error(
      error instanceof Error
        ? error
        : new Error(`Unknown error occurred: ${String(error)}`),
    );
  }
}
