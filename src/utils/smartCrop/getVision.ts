import { Result } from "typescript-result";
import { sha256Concat } from "./sha256Concat";
import { verifyCropMetadata, type CropMetadata } from "./smartCrop.types";
class VisionNotFoundError extends Error {
  public type = "VisionNotFoundError";
}

class SettingVisonBotFoundError extends Error {
  public type = "SettingVisonBotFoundError";
  constructor(
    message: string,
    public requestBody: string,
    public responseBody: string,
    public url: string
  ) {
    super(message);
  }
}

class AuthorizationError extends Error {
  public type = "AuthorizationError";
}

class BadRequestError extends Error {
  public type = "BadRequestError";
  constructor(
    message: string,
    public responseBody: string,
    public requestBody: string
  ) {
    super(message);
  }
}

type EnvironmentDetails = {
  baseUrl: string;
  connectorId: string;
  authorization: string;
};

export async function getVision({
  baseUrl,
  connectorId,
  asset,
  authorization,
}: EnvironmentDetails & { asset: string }): Promise<
  Result<CropMetadata, Error>
> {
  try {
    const url = `${baseUrl}external-media/${await sha256Concat(
      connectorId,
      asset
    )}/vision`;

    const response = await fetch(url, {
      headers: {
        Authorization: "Bearer " + authorization,
      },
    });
    if (!response.ok) {
      if (response.status === 401) {
        throw new AuthorizationError(`Authorization failed for ${baseUrl}`);
      }
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
        : new Error(`Unknown error occurred for ${baseUrl}`)
    );
  }
}