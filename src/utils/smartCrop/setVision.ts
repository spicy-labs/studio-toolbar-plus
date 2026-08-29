import { Result } from "typescript-result";
import {
  convertVisionToManualCropMetadata,
  type CropMetadata,
} from "./smartCrop.types";
import { sha256Concat } from "./sha256Concat";
import { fetchWithAuth } from "../fetchWithAuth";

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
  connectorId,
  asset,
  metadata,
  skipUpload = false,
}: {
  connectorId: string;
  metadata: CropMetadata;
  asset: string;
  skipUpload?: boolean;
}): Promise<Result<void, Error>> {
  try {
    const url = `external-media/${await sha256Concat(
      connectorId,
      asset
    )}/vision`;

    const body = JSON.stringify(
      metadata.manualCropMetadata == null
        ? convertVisionToManualCropMetadata(metadata)
        : metadata
    );

    const response = await fetchWithAuth(url, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body,
    });
    if (!response.ok) {
      if (response.status === 400) {
        throw new BadRequestError(
          `Bad request setting vision for ${asset}`,
          await response.text(),
          body
        );
      }
      if (response.status === 404) {
        if (skipUpload) {
          throw new SettingVisonBotFoundError(
            `Not found for ${asset} after upload attempt`,
            JSON.stringify({ url, body }),
            await response.text(),
            url
          );
        }

        const uploadResult = await uploadImage({
          connectorId,
          asset,
        });

        return uploadResult.map(async () => {
          return await setVision({
            connectorId,
            asset,
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
        : new Error(`Unknown error occurred setting vision for ${asset}`)
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
  connectorId,
  asset,
}: {
  connectorId: string;
  asset: string;
}) {
  try {
    const url = `external-media/${await sha256Concat(connectorId, asset)}/vision`;

    const base64Image =
      "iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAAXNSR0IArs4c6QAAADtJREFUKFNjZGBg+M9ABGAkS+EnLi642XzfvqHYAzcRWRFMBbJisEJsitAV00ghyBri3AhzD1G+JhTmAJCTHwEL6mXhAAAAAElFTkSuQmCC";

    const imageBlob = base64ToBlob(base64Image, "image/png");
    const imageFile = new File([imageBlob], "image.png", { type: "image/png" });

    const formData = new FormData();
    formData.append("file", imageFile);

    const response = await fetchWithAuth(url, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status} on ${url}`);
    }

    return Result.ok(undefined);
  } catch (error) {
    return Result.error(
      error instanceof Error
        ? error
        : new Error(`Unknown error occurred during image upload for ${asset}`)
    );
  }
}
