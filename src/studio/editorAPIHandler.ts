import { type EditorAPI } from "@chili-publish/studio-sdk/lib/src/types/CommonTypes";

import type SDK from "@chili-publish/studio-sdk";
import { type EditorResponse } from "@chili-publish/studio-sdk";
import { Result } from "typescript-result";
import type {
  PerAssetCrop,
  AssetCrop,
} from "../studio-adapter/manualCropTypes";

type EditorResponseWithoutParsedData<T> = Omit<EditorResponse<T>, "parsedData">;

function simplifyEditorResponse<T>(
  editorResponse: EditorResponse<T>,
): EditorResponseWithoutParsedData<T> {
  return {
    ...editorResponse,
  };
}

async function handleApiCall<T, Args extends any[] = any[]>(
  apiCall: (...args: Args) => Promise<EditorResponse<string>>,
  ...args: Args
) {
  const result = await Result.try(async () =>
    simplifyEditorResponse(await apiCall(...args)),
  );

  console.log("handleApiCall result", result);

  return result.map((res) => {
    if (res.success) {
      const data = res.data;
      if (data != null) {
        if (data === "") {
          return Result.ok(undefined as T);
        }

        return Result.try(() => JSON.parse(data) as T);
      }

      return Result.error(Error(`parsedData is null`));
    } else {
      return Result.error(
        Error(`Studio Returned Error ${res.status}:${res.error}`),
      );
    }
  });
}

export type GetPerAssetCropParams = {
  studio: SDK;
  layoutId: string;
  frameId: string;
};

export async function getPerAssetCrop({
  studio,
  layoutId,
  frameId,
}: GetPerAssetCropParams) {
  const api = await studio.editorAPI;
  return handleApiCall<{ perAssetCrop: PerAssetCrop }>(
    api.getPerAssetCrop,
    layoutId,
    frameId,
  );
}

type SetPerAssetCropParams = {
  studio: SDK;
  perAssetCrop: AssetCrop;
  layoutId: string;
  frameId: string;
  remoteConnectorId: string;
  assetId: string;
};

export async function setPerAssetCrop({
  studio,
  perAssetCrop,
  layoutId,
  frameId,
  remoteConnectorId,
  assetId,
}: SetPerAssetCropParams) {
  const api = await studio.editorAPI;
  return handleApiCall(
    api.setPerAssetCrop,
    layoutId,
    frameId,
    remoteConnectorId,
    assetId,
    JSON.stringify(perAssetCrop),
  );
}
