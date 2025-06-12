import type SDK from "@chili-publish/studio-sdk";
import { Result } from "typescript-result";
import { handleStudioFunc } from "./utils";

export async function getSelected(studio:SDK) {
    return handleStudioFunc(studio.frame.getSelected);
}

export async function getById(studio:SDK, id:string) {
    return handleStudioFunc(studio.frame.getById, id);
}

export async function getAll(studio:SDK) {
    return handleStudioFunc(studio.frame.getAll);
}

export async function getPropertiesOnSelectedLayout(studio:SDK) {
    return handleStudioFunc(studio.frame.getPropertiesOnSelectedLayout);
}

export async function getPropertiesOnLayout(studio:SDK, layoutId:string) {
    return handleStudioFunc(studio.frame.getAllLayoutProperties, layoutId);
}