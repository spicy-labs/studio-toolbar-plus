import type { EditorResponse } from "@chili-publish/studio-sdk";
import { Result } from "typescript-result";

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
        Error(`Studio Returned Error ${er.status}:${er.error}`),
      );
    }
  });
}
