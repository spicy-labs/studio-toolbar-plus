import { Result } from "typescript-result";
import type { ConnectorResponse } from "../types/connectorTypes";
import { fetchWithAuth } from "./fetchWithAuth";

export async function getConnectorsAPI(): Promise<
  Result<ConnectorResponse, Error>
> {
  try {
    const response = await fetchWithAuth("connectors", {
      headers: {
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
