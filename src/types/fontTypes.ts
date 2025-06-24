// Font-related type definitions for template package functionality

export interface FontStyle {
  id: string;
  fontStyleId: string;
  fontFamilyId: string;
  connectorId: string;
  name: string;
  isDefault: boolean;
}

export interface FontFamily {
  id: string;
  name: string;
  connectorId: string;
  fontFamilyId: string;
  fontStyles: FontStyle[];
}

// API Response types for font families endpoint
export interface Font {
  id: string;
  name: string;
  fontStylesCount: number;
  dateCreated: string;
  lastModifiedDate: string;
  extensions: string[];
}

export interface Links {
  nextPage?: string;
}

export interface FontFamiliesResponse {
  pageSize: number;
  links: Links;
  data: Font[];
}

// API Response types for font styles endpoint
export interface FontData {
  id: string;
  name: string;
  familyId: string;
  familyName: string;
  dateCreated: string;
  extension: string;
  fileName: string;
  fileSize: number;
}

export interface FontStylesResponse {
  pageSize: number;
  links: Links;
  data: FontData[];
}

// Font upload response types
export interface PreloadedFontData {
  id: string;
  name: string;
  familyName: string;
  fileName: string;
  errors: string[];
  canBeUploaded: boolean;
}

export interface FontUploadResponse {
  batchId: string;
  links: Record<string, any>;
  data: {
    fontFamilies: string[];
    preloadedData: PreloadedFontData[];
  };
}

// Font migration tracking
export interface FontToMigrate {
  sourceFamily: FontFamily;
  sourceStyle: FontStyle;
  targetExists: boolean;
}

export interface FontMigrationProgress {
  total: number;
  completed: number;
  current?: string;
  status: 'checking' | 'downloading' | 'uploading' | 'complete' | 'error';
  error?: string;
}
