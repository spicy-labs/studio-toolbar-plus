import { Result } from "typescript-result";
import {
  convertVisionToManualCropMetadata,
  type CropMetadata,
} from "./smartCrop.types";
import { sha256Concat } from "./sha256Concat";

type EnvironmentDetails = {
  baseUrl: string;
  connectorId: string;
  authorization: string;
};

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

export async function setVision({
  baseUrl,
  connectorId,
  asset,
  authorization,
  metadata,
  skipUpload = false,
}: EnvironmentDetails & {
  metadata: CropMetadata;
  asset: string;
  skipUpload?: boolean;
}): Promise<Result<void, Error>> {
  try {
    const url = `${baseUrl}external-media/${await sha256Concat(
      connectorId,
      asset
    )}/vision`;

    const response = await fetch(url, {
      method: "PUT",
      headers: {
        Authorization: "Bearer " + authorization,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(
        metadata.manualCropMetadata == null
          ? convertVisionToManualCropMetadata(metadata)
          : metadata
      ),
    });
    if (!response.ok) {
      if (response.status === 400) {
        throw new BadRequestError(
          `Bad request for ${baseUrl}`,
          await response.text(),
          JSON.stringify(
            metadata.manualCropMetadata == null
              ? convertVisionToManualCropMetadata(metadata)
              : metadata
          )
        );
      }
      if (response.status === 401) {
        throw new AuthorizationError(`Authorization failed for ${baseUrl}`);
      }
      if (response.status === 404) {
        if (skipUpload) {
          throw new SettingVisonBotFoundError(
            `Not found for ${asset} after upload attempt`,
            JSON.stringify({
              url,
              headers: {
                Authorization: "Bearer " + authorization,
                "Content-Type": "application/json",
              },
              body: JSON.stringify(metadata),
            }),
            await response.text(),
            url
          );
        }

        // Try to upload the image first
        const uploadResult = await uploadImage({
          baseUrl,
          connectorId,
          asset,
          authorization,
        });

        return uploadResult.map(async () => {
          // Upload was successful, retry setVision with skipUpload=true
          return await setVision({
            baseUrl,
            connectorId,
            asset,
            authorization,
            metadata,
            skipUpload: true,
          });
        });
      }
      throw new Error(`HTTP error! status: ${response.status} on ${url}`);
    }
    return Result.ok(undefined);
  } catch (error) {
    return Result.error(
      error instanceof Error
        ? error
        : new Error(`Unknown error occurred for ${baseUrl}`)
    );
  }
}

function base64ToBlob(base64Data: string, contentType = "") {
  const byteCharacters = atob(base64Data);
  const byteNumbers = new Array(byteCharacters.length);

  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }

  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type: contentType });
}

export async function uploadImage({
  baseUrl,
  connectorId,
  asset,
  authorization,
}: EnvironmentDetails & {
  asset: string;
}) {
  try {
    const url = `${baseUrl}external-media/${await sha256Concat(connectorId, asset)}/vision`;

    // Hardcoded base64 image data
    const base64Image =
      "iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAAXNSR0IArs4c6QAAADtJREFUKFNjZGBg+M9ABGAkS+EnLi642XzfvqHYAzcRWRFMBbJisEJsitAV00ghyBri3AhzD1G+JhTmAJCTHwEL6mXhAAAAAElFTkSuQmCC";

    // Convert base64 to Blob
    const imageBlob = base64ToBlob(base64Image, "image/png");

    // Create a File object from the Blob
    const imageFile = new File([imageBlob], "image.png", { type: "image/png" });

    const formData = new FormData();
    formData.append("file", imageFile);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: "Bearer " + authorization,
      },
      body: formData,
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new AuthorizationError(`Authorization failed for ${baseUrl}`);
      }
      throw new Error(`HTTP error! status: ${response.status} on ${url}`);
    }

    return Result.ok(undefined);
  } catch (error) {
    return Result.error(
      error instanceof Error
        ? error
        : new Error(`Unknown error occurred during image upload for ${baseUrl}`)
    );
  }
}
