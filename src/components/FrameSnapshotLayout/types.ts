import type { FrameLayoutMap, FrameSnapshot } from "../../types/toolbarEnvelope";

// Enhanced type with layout name
export interface EnhancedFrameLayoutMap extends FrameLayoutMap {
  layoutName: string;
  frameSnapshots: EnhancedFrameSnapshot[];
}

// Enhanced type with key for table rendering
export interface EnhancedFrameSnapshot extends FrameSnapshot {
  isChecked?: boolean;
  uniqueId: string; // Unique identifier composed of frameId+imageName
}

// Type for the edit state
export type EditState = {
  key: string | null;  // "rowKey:field"
  value: string | number;
};

// Props for the main modal component
export interface FrameSnapshotLayoutModalProps {
  opened: boolean;
  onClose: () => void;
}

// Props for the card component
export interface FrameLayoutCardProps {
  layoutMap: {
    layoutId: string;
    layoutName: string;
    snapshots: EnhancedFrameSnapshot[];
  };
  onRemoveSnapshot: (layoutId: string, uniqueId: string) => Promise<void>;
  onEditCell?: (layoutId:string, key: string, value: string | number) => void;
  frameLayoutMaps: EnhancedFrameLayoutMap[];
  onUpdateFrameLayoutMaps: (updatedMaps: EnhancedFrameLayoutMap[]) => void;
}

// Props for the row component
export interface FrameSnapshotRowProps {
  snapshot: EnhancedFrameSnapshot;
  layoutId: string;
  onRemoveSnapshot: (frameId: string, imageName: string, layoutId: string, uniqueId: string) => Promise<void>;
  onEditCell?: (layoutId:string, key: string, value: string | number) => void;
  onCheckChange: (key: string, isChecked: boolean) => void;
  isChecked: boolean;
}

// Props for the editable cell component
export interface EditableCellProps {
  rowKey: string;
  field: string;
  value: string | number;
  onEditStart: (key: string, value: string | number) => void;
  isEditing: boolean;
  editValue: string | number;
  onEditChange: (value: string | number) => void;
  onEditSave: () => void;
  onEditCancel: () => void;
}

// Props for the copy to layer modal
export interface CopyToLayerModalProps {
  opened: boolean;
  onClose: () => void;
  snapshots: EnhancedFrameSnapshot[];
  sourceLayoutId: string;
  frameLayoutMaps: EnhancedFrameLayoutMap[];
  onUpdateFrameLayoutMaps: (updatedMaps: EnhancedFrameLayoutMap[]) => void;
}

// Props for the copy and add row modal
export interface CopyAndAddRowModalProps {
  opened: boolean;
  onClose: () => void;
  snapshot: EnhancedFrameSnapshot;
  layoutId: string;
  existingSnapshots: EnhancedFrameSnapshot[];
  onAddCopy: (snapshot: EnhancedFrameSnapshot, newName: string) => void;
}

// Props for the copy and replace modal
export interface CopyAndReplaceModalProps {
  opened: boolean;
  onClose: () => void;
  snapshots: EnhancedFrameSnapshot[];
  layoutId: string;
  existingSnapshots: EnhancedFrameSnapshot[];
  onAddCopy: (snapshot: EnhancedFrameSnapshot, newName: string) => void;
}
