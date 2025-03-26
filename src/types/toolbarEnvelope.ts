import type { LayoutMap } from "./layoutConfigTypes"

export type ToolbarEnvelope = {
    layoutMaps: LayoutMap[];
}

export function createEmptyEnvelope():ToolbarEnvelope {
    return {
        layoutMaps: []
    }
}