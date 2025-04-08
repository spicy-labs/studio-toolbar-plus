import type { LayoutMap } from "./layoutConfigTypes"

export type FrameSnapshot = {
    frameId: string;
    imageName: string;
    x: number;
    y: number;
    width: number;
    height: number;
}

export type FrameLayoutMap = {
    layoutId: string;
    frameSnapshots: FrameSnapshot[];
}

export type LayoutSize = {
    width:number,
    height:number,
    aspectRatioPercentage:number,
}

export type ToolbarEnvelope = {
    layoutMaps: LayoutMap[];
    frameMaps: FrameLayoutMap[];
    layoutSizes: Record<string, LayoutSize>;
}

export function createEmptyEnvelope():ToolbarEnvelope {
    return {
        layoutMaps: [],
        frameMaps: [],
        layoutSizes: {}
    }
}