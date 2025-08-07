import type { ImageBrowserFolderSelection } from "../ImageBrowser";
import type { FontData } from "../../types/fontTypes";

export type ModalState =
  | "initial"
  | "downloadSettings"
  | "downloading"
  | "tasks"
  | "uploadInstructions"
  | "uploading";

export interface DownloadSettings {
  includeFonts: boolean;
  includeGrafxMedia: boolean;
  includeSmartCrops: boolean;
  removeToolbarData: boolean;
  removeUnusedConnectors: boolean;
  useOriginalFontFileNames: boolean;
  addTimestamp: boolean;
}

export interface DownloadFile {
  id: string;
  name: string;
  status: "pending" | "downloading" | "complete" | "error";
  error?: string;
}

export interface TaskItem {
  id: string;
  name: string;
  type:
    | "download"
    | "query_folder"
    | "get_vision"
    | "smart_crops"
    | "package_processing"
    | "font_upload"
    | "smart_crop_upload"
    | "document_load";
  status: "pending" | "processing" | "complete" | "error" | "info";
  error?: string;
  tooltip?: string;
}

export interface SmartCropsData {
  connectorId: string;
  connectorName: string;
  crops: {
    assetId: string;
    metadata: any; // CropMetadata type
  }[];
}

export interface StudioPackage {
  engineVersion: string;
  source: string;
  documents: Array<{
    id: string;
    name: string | null;
    filePath: string;
    smartCrops?: {
      filePath: string;
    };
    fonts: {
      filePath: string;
      details: FontData;
    }[];
  }>;
}

// Custom error classes for upload functionality
export class InvalidChiliPackageError extends Error {
  readonly _tag = "InvalidChiliPackageError";
  constructor(message: string) {
    super(message);
    this.name = "InvalidChiliPackageError";
  }
}

export class NoChiliPackageError extends Error {
  readonly _tag = "NoChiliPackageError";
  constructor(message: string) {
    super(message);
    this.name = "NoChiliPackageError";
  }
}

export class MissingDocumentFileError extends Error {
  readonly _tag = "MissingDocumentFileError";
  constructor(message: string) {
    super(message);
    this.name = "MissingDocumentFileError";
  }
}

export class InvalidDocumentJsonError extends Error {
  readonly _tag = "InvalidDocumentJsonError";
  constructor(message: string) {
    super(message);
    this.name = "InvalidDocumentJsonError";
  }
}

export class MissingFontFileError extends Error {
  readonly _tag = "MissingFontFileError";
  constructor(message: string) {
    super(message);
    this.name = "MissingFontFileError";
  }
}

export class FontAlreadyExistsError extends Error {
  readonly _tag = "FontAlreadyExistsError";
  constructor(message: string) {
    super(message);
    this.name = "FontAlreadyExistsError";
  }
}

export class MissingSmartCropsFileError extends Error {
  readonly _tag = "MissingSmartCropsFileError";
  constructor(message: string) {
    super(message);
    this.name = "MissingSmartCropsFileError";
  }
}

export class InvalidSmartCropsJsonError extends Error {
  readonly _tag = "InvalidSmartCropsJsonError";
  constructor(message: string) {
    super(message);
    this.name = "InvalidSmartCropsJsonError";
  }
}

export class FailedToFetchConnectorsError extends Error {
  readonly _tag = "FailedToFetchConnectorsError";
  constructor(message: string) {
    super(message);
    this.name = "FailedToFetchConnectorsError";
  }
}
