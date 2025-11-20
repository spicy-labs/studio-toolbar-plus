export type ManualCrop = {
  frameId: string;
  frameName: string;
  name: string;
  left: number;
  top: number;
  width: number;
  height: number;
  rotationDegrees: number;
  originalParentWidth: number;
  originalParentHeight: number;
  unit: "px" | "in" | "mm" | "cm" | "pt";
};

export type FrameProperty = {
  id: string;
  type?: string;
  perAssetCrop?: PerAssetCrop;
  [key: string]: any;
};

export type PerAssetCrop = {
  [connectorId: string]: {
    [assetName: string]: AssetCrop;
  };
};

export type AssetCrop = {
  left: number;
  top: number;
  width: number;
  height: number;
  rotationDegrees: number;
  originalParentWidth: number;
  originalParentHeight: number;
  unit: "px" | "in" | "mm" | "cm" | "pt";
};

export type DocumentLayout = {
  id: string;
  name: string;
  parentId?: string;
  frameProperties: FrameProperty[];
  [key: string]: any;
};

export type DocumentState = {
  layouts: DocumentLayout[];
  [key: string]: any;
};
