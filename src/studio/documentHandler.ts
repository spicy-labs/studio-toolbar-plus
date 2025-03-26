import type SDK from "@chili-publish/studio-sdk";
import { Result } from "typescript-result";
import { handleStudioFunc } from "./utils";

export async function getCurrentDocumentState(studio:SDK) {
    return handleStudioFunc(studio.document.getCurrentState);
}

export async function loadDocumentFromJsonStr(studio:SDK, document:string) {
    return handleStudioFunc(studio.document.load, document)
}