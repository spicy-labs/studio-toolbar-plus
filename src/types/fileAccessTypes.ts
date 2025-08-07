// File System Access API type definitions for showDirectoryPicker() and related APIs
// Based on: https://developer.mozilla.org/en-US/docs/Web/API/Window/showDirectoryPicker

/**
 * Well-known directory names that can be used as startIn values
 */
export type WellKnownDirectory =
  | "desktop"
  | "documents"
  | "downloads"
  | "music"
  | "pictures"
  | "videos";

/**
 * Access mode for directory picker
 */
export type DirectoryPickerMode = "read" | "readwrite";

/**
 * Options for showDirectoryPicker()
 */
export interface DirectoryPickerOptions {
  /**
   * By specifying an ID, the browser can remember different directories for different IDs.
   * If the same ID is used for another picker, the picker opens in the same directory.
   */
  id?: string;

  /**
   * A string that defaults to "read" for read-only access or "readwrite" for read and write access to the directory.
   */
  mode?: DirectoryPickerMode;

  /**
   * A FileSystemHandle or a well known directory to open the dialog in.
   */
  startIn?: FileSystemHandle | WellKnownDirectory;
}

/**
 * Base interface for all file system handles
 */
export interface FileSystemHandle {
  /**
   * The kind of entry this handle represents
   */
  readonly kind: "file" | "directory";

  /**
   * The name of the entry this handle represents
   */
  readonly name: string;

  /**
   * Compares two handles to see if they represent the same entry
   */
  isSameEntry(other: FileSystemHandle): Promise<boolean>;

  /**
   * Queries the current permission state of the handle
   */
  queryPermission(descriptor?: FileSystemHandlePermissionDescriptor): Promise<PermissionState>;

  /**
   * Requests permission for the handle
   */
  requestPermission(descriptor?: FileSystemHandlePermissionDescriptor): Promise<PermissionState>;
}

/**
 * Permission descriptor for file system handles
 */
export interface FileSystemHandlePermissionDescriptor {
  /**
   * The mode of access
   */
  mode?: "read" | "readwrite";
}

/**
 * Handle for file system files
 */
export interface FileSystemFileHandle extends FileSystemHandle {
  readonly kind: "file";

  /**
   * Gets the File object for this handle
   */
  getFile(): Promise<File>;

  /**
   * Creates a writable stream for this file
   */
  createWritable(options?: FileSystemCreateWritableOptions): Promise<FileSystemWritableFileStream>;
}

/**
 * Options for creating a writable stream
 */
export interface FileSystemCreateWritableOptions {
  /**
   * Whether to keep the existing data
   */
  keepExistingData?: boolean;
}

/**
 * Writable stream for file system files
 */
export interface FileSystemWritableFileStream extends WritableStream {
  /**
   * Writes data to the stream
   */
  write(data: FileSystemWriteChunkType): Promise<void>;

  /**
   * Seeks to a position in the file
   */
  seek(position: number): Promise<void>;

  /**
   * Truncates the file to a given size
   */
  truncate(size: number): Promise<void>;
}

/**
 * Data that can be written to a file system writable stream
 */
export type FileSystemWriteChunkType =
  | BufferSource
  | Blob
  | string
  | WriteParams;

/**
 * Parameters for write operations
 */
export interface WriteParams {
  /**
   * The type of write operation
   */
  type: "write" | "seek" | "truncate";

  /**
   * The data to write (for write operations)
   */
  data?: BufferSource | Blob | string;

  /**
   * The position to seek to (for seek operations)
   */
  position?: number;

  /**
   * The size to truncate to (for truncate operations)
   */
  size?: number;
}

/**
 * Handle for file system directories
 */
export interface FileSystemDirectoryHandle extends FileSystemHandle {
  readonly kind: "directory";

  /**
   * Gets a file handle for a file in this directory
   */
  getFileHandle(name: string, options?: FileSystemGetFileOptions): Promise<FileSystemFileHandle>;

  /**
   * Gets a directory handle for a subdirectory in this directory
   */
  getDirectoryHandle(name: string, options?: FileSystemGetDirectoryOptions): Promise<FileSystemDirectoryHandle>;

  /**
   * Removes a file or directory from this directory
   */
  removeEntry(name: string, options?: FileSystemRemoveOptions): Promise<void>;

  /**
   * Resolves the path from this directory to a given handle
   */
  resolve(possibleDescendant: FileSystemHandle): Promise<string[] | null>;

  /**
   * Returns an async iterator of the entries in this directory
   */
  entries(): AsyncIterableIterator<[string, FileSystemHandle]>;

  /**
   * Returns an async iterator of the entry names in this directory
   */
  keys(): AsyncIterableIterator<string>;

  /**
   * Returns an async iterator of the entry handles in this directory
   */
  values(): AsyncIterableIterator<FileSystemHandle>;

  /**
   * Async iterator symbol
   */
  [Symbol.asyncIterator](): AsyncIterableIterator<[string, FileSystemHandle]>;
}

/**
 * Options for getting a file handle
 */
export interface FileSystemGetFileOptions {
  /**
   * Whether to create the file if it doesn't exist
   */
  create?: boolean;
}

/**
 * Options for getting a directory handle
 */
export interface FileSystemGetDirectoryOptions {
  /**
   * Whether to create the directory if it doesn't exist
   */
  create?: boolean;
}

/**
 * Options for removing entries
 */
export interface FileSystemRemoveOptions {
  /**
   * Whether to remove recursively (for directories)
   */
  recursive?: boolean;
}

/**
 * Global window interface extension for File System Access API
 */
declare global {
  interface Window {
    /**
     * Shows a directory picker dialog
     */
    showDirectoryPicker(options?: DirectoryPickerOptions): Promise<FileSystemDirectoryHandle>;

    /**
     * Shows a file picker dialog for opening files
     */
    showOpenFilePicker(options?: OpenFilePickerOptions): Promise<FileSystemFileHandle[]>;

    /**
     * Shows a file picker dialog for saving a file
     */
    showSaveFilePicker(options?: SaveFilePickerOptions): Promise<FileSystemFileHandle>;
  }
}

/**
 * Options for showOpenFilePicker()
 */
export interface OpenFilePickerOptions {
  /**
   * Whether to allow multiple file selection
   */
  multiple?: boolean;

  /**
   * Array of allowed file types
   */
  types?: FilePickerAcceptType[];

  /**
   * Whether to exclude accept all option
   */
  excludeAcceptAllOption?: boolean;

  /**
   * ID for remembering the last used directory
   */
  id?: string;

  /**
   * Starting directory
   */
  startIn?: FileSystemHandle | WellKnownDirectory;
}

/**
 * Options for showSaveFilePicker()
 */
export interface SaveFilePickerOptions {
  /**
   * Suggested file name
   */
  suggestedName?: string;

  /**
   * Array of allowed file types
   */
  types?: FilePickerAcceptType[];

  /**
   * Whether to exclude accept all option
   */
  excludeAcceptAllOption?: boolean;

  /**
   * ID for remembering the last used directory
   */
  id?: string;

  /**
   * Starting directory
   */
  startIn?: FileSystemHandle | WellKnownDirectory;
}

/**
 * File type specification for file pickers
 */
export interface FilePickerAcceptType {
  /**
   * Description of the file type
   */
  description?: string;

  /**
   * MIME types and file extensions
   */
  accept: Record<string, string[]>;
}
