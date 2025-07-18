import type SDK from "@chili-publish/studio-sdk";
import { handleStudioFunc } from "./utils";

export async function getFontFamilies(studio: SDK) {
  return await handleStudioFunc(studio.font.getFontFamilies);
}
