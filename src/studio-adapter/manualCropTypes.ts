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
};

export type FrameProperty = {
  id: string;
  type?: string;
  perAssetCrop?: {
    [connectorId: string]: {
      [assetName: string]: {
        left: number;
        top: number;
        width: number;
        height: number;
        rotationDegrees: number;
        originalParentWidth: number;
        originalParentHeight: number;
      };
    };
  };
  [key: string]: any;
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
