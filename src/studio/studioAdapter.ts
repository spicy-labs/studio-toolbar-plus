import type { EditorResponse } from "@chili-publish/studio-sdk";
import { Result } from "typescript-result";
import {
  type PrivateData,
  type ActionTrigger,
  type default as SDKType,
  ActionEditorEvent,
  VariableType,
  VariableVisibilityType,
} from "@chili-publish/studio-sdk";

declare global {
  interface Window {
    SDK: SDKType;
  }
}

export type SDKExtended = SDKType & {
  customToolbarLoaded: boolean;
};

export async function getStudio() {
  if (window.SDK == null)
    return Result.error(new Error("Studio SDK does not exist on the window"));
  return Result.ok(window.SDK as SDKExtended);
}

export async function handleStudioFunc<T, Args extends any[]>(
  studioFunction: (...args: Args) => Promise<EditorResponse<T>>,
  ...functionArgs: Args
) {
  const result = await Result.wrap(studioFunction)(...functionArgs);

  return result.map((er) => {
    if (er.success) {
      const data = er.parsedData;
      if (data == null) {
        return Result.error(Error(`parsedData is null`));
      } else {
        return data;
      }
    } else {
      return Result.error(
        Error(`Studio Returned Error ${er.status}:${er.error}`)
      );
    }
  });
}
