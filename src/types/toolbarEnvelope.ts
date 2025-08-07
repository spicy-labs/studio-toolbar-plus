import type { LayoutMap } from "./layoutConfigTypes";

export type FrameSnapshot = {
  frameId: string;
  imageName: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type FrameLayoutMap = {
  layoutId: string;
  frameSnapshots: FrameSnapshot[];
};

export type LayoutSize = {
  width: number;
  height: number;
  aspectRatio: number;
  sizing: {
    maxHeight: number | null;
    maxWidth: number | null;
    minHeight: number | null;
    minWidth: number | null;
  }
};

export type DefaultDownloadSettings = {
  includeFonts: boolean;
  includeGrafxMedia: boolean;
  includeSmartCrops: boolean;
  removeToolbarData: boolean;
  removeUnusedConnectors: boolean;
  useOriginalFontFileNames: boolean;
  addTimestamp: boolean;
  smartCropsConnectorSelection?: {
    selectedFolders: string[];
    connectorId: string;
    connectorName: string;
  };
};

export type ToolbarEnvelope = {
  layoutMaps: LayoutMap[];
  frameMaps: FrameLayoutMap[];
  layoutSizes: Record<string, LayoutSize>;
  defaultDownloadSettings?: DefaultDownloadSettings;
};

export function createEmptyEnvelope(): ToolbarEnvelope {
  return {
    layoutMaps: [],
    frameMaps: [],
    layoutSizes: {},
    defaultDownloadSettings: {
      includeFonts: true,
      includeGrafxMedia: false,
      includeSmartCrops: false,
      removeToolbarData: false,
      removeUnusedConnectors: false,
      useOriginalFontFileNames: false,
      addTimestamp: true,
    },
  };
}
