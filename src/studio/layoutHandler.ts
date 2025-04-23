import type SDK from "@chili-publish/studio-sdk";
import { Result } from "typescript-result";
import { handleStudioFunc } from "./utils";
import type {
  PrivateData,
  ResizableLayoutPropertiesUpdate,
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

export async function getAllLayouts(studio: SDK) {
  return await handleStudioFunc(studio.layout.getAll);
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

