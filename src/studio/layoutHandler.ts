import type SDK from "@chili-publish/studio-sdk";
import { Result } from "typescript-result";
import { handleStudioFunc } from "./utils";
import {
  ConstraintMode,
  type PrivateData,
  type ResizableLayoutPropertiesUpdate,
} from "@chili-publish/studio-sdk";

type GetPrivateDataProps = {
  studio: SDK;
  id: string;
};

export async function getPrivateData({ studio, id }: GetPrivateDataProps) {
  const result = await handleStudioFunc(studio.layout.getPrivateData, id);

  console.log(result);

  if (result.isError()) return result;

  return Result.try(() => result.value as PrivateData);
}

type SetPrivateDataProps = {
  privateData: PrivateData;
} & GetPrivateDataProps;

export async function setPrivateData({
  studio,
  id,
  privateData,
}: SetPrivateDataProps) {
  return await handleStudioFunc(studio.layout.setPrivateData, id, privateData);
}

type layoutResizeUpdate =
  | {
      enabled: boolean;
      minWidth: number | null;
      maxWidth: number | null;
      minHeight: number | null;
      maxHeight: number | null;
      constrainMode: ConstraintMode.none | ConstraintMode.locked;
    }
  | {
      enabled: boolean;
      minWidth: number | null;
      maxWidth: number | null;
      minHeight: number | null;
      maxHeight: number | null;
      constrainMode: ConstraintMode.range;
      vertical: {
        min: number;
        max: number;
      } | null;
      horizontal: {
        min: number;
        max: number;
      } | null;
    };

export function convertLayoutResizeUpdateToSDKUpdate(
  update: layoutResizeUpdate,
): ResizableLayoutPropertiesUpdate {
  const sdkUpdate: ResizableLayoutPropertiesUpdate = {
    enabled: { value: update.enabled },
    constraintMode: { value: update.constrainMode },
  };

  // Add dimension constraints if they are not null
  if (update.minWidth !== null) {
    sdkUpdate.minWidth = { value: String(update.minWidth) };
  }
  if (update.maxWidth !== null) {
    sdkUpdate.maxWidth = { value: String(update.maxWidth) };
  }
  if (update.minHeight !== null) {
    sdkUpdate.minHeight = { value: String(update.minHeight) };
  }
  if (update.maxHeight !== null) {
    sdkUpdate.maxHeight = { value: String(update.maxHeight) };
  }
  sdkUpdate.aspectRange = null;

  // Handle constraint mode specific properties
  if (update.constrainMode === ConstraintMode.range) {
    // For range mode, add aspect range if vertical and horizontal constraints are present
    if (update.vertical !== null && update.horizontal !== null) {
      sdkUpdate.aspectRange = {
        value: {
          min: {
            horizontal: update.horizontal.min,
            vertical: update.vertical.min,
          },
          max: {
            horizontal: update.horizontal.max,
            vertical: update.vertical.max,
          },
        },
      };
    }
  }

  return sdkUpdate;
}

export async function setLayoutResizable(
  studio: SDK,
  id: string,
  layoutUpdate: layoutResizeUpdate,
) {
  const sdkUpdate = convertLayoutResizeUpdateToSDKUpdate(layoutUpdate);
  return await handleStudioFunc(
    studio.layout.setResizableByUser,
    id,
    sdkUpdate,
  );
}

export async function getAllLayouts(studio: SDK) {
  return await handleStudioFunc(studio.layout.getAll);
}

export async function getLayoutById(studio: SDK, id: string) {
  return await handleStudioFunc(studio.layout.getById, id);
}

export async function setLayoutAvailable(
  studio: SDK,
  id: string,
  available: boolean,
) {
  return await handleStudioFunc(
    studio.layout.setAvailableForUser,
    id,
    available,
  );
}

export async function getSelected(studio: SDK) {
  return await handleStudioFunc(studio.layout.getSelected);
}

export async function updateLayoutResizable(
  studio: SDK,
  id: string,
  update: ResizableLayoutPropertiesUpdate,
) {
  return await handleStudioFunc(studio.layout.setResizableByUser, id, update);
}

export async function deleteLayout(studio: SDK, id: string) {
  return await handleStudioFunc(studio.layout.remove, id);
}
