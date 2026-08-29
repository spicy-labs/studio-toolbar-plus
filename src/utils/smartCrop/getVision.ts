import { Result } from "typescript-result";
import { sha256Concat } from "./sha256Concat";
import { verifyCropMetadata, type CropMetadata } from "./smartCrop.types";
import { fetchWithAuth } from "../fetchWithAuth";

class VisionNotFoundError extends Error {
  public type = "VisionNotFoundError";
}

export async function getVision({
  connectorId,
  asset,
}: {
  connectorId: string;
  asset: string;
}): Promise<Result<CropMetadata, Error>> {
  try {
    const url = `external-media/${await sha256Concat(
      connectorId,
      asset
    )}/vision`;

    const response = await fetchWithAuth(url);
    if (!response.ok) {
      if (response.status === 404) {
        throw new VisionNotFoundError(`Vision not found for ${asset}`);
      }
      throw new Error(`HTTP error! status: ${response.status} on ${url}`);
    }

    const data = await response.json();
    return verifyCropMetadata(data);
  } catch (error) {
    return Result.error(
      error instanceof Error
        ? error
        : new Error(`Unknown error occurred getting vision for ${asset}`)
    );
  }
}
