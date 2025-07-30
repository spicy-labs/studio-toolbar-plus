import { z } from "zod";
import { Result } from "typescript-result";
import type { StudioPackage } from "./types";
import {
  InvalidChiliPackageError,
  NoChiliPackageError,
  MissingDocumentFileError,
  InvalidDocumentJsonError,
  MissingFontFileError,
} from "./types";

// Zod schema for StudioPackage validation
const FontDataSchema = z.object({
  filePath: z.string(),
  details: z.object({
    id: z.string(),
    name: z.string(),
    familyId: z.string(),
    familyName: z.string(),
    dateCreated: z.string(),
    extension: z.string(),
    fileName: z.string(),
    fileSize: z.number(),
  }),
});

const DocumentSchema = z.object({
  id: z.string(),
  name: z.string().nullable(),
  filePath: z.string(),
  smartCrops: z
    .object({
      filePath: z.string(),
    })
    .optional(),
  fonts: z.array(FontDataSchema),
});

const StudioPackageSchema = z.object({
  engineVersion: z.string(),
  source: z.string(),
  documents: z.array(DocumentSchema),
});

// Function to verify StudioPackage using Zod
export function verifyStudioPackage(
  packageData: any
): Result<StudioPackage, Error> {
  try {
    const result = StudioPackageSchema.safeParse(packageData);
    if (result.success) {
      return Result.ok(result.data);
    } else {
      return Result.error(
        new InvalidChiliPackageError(
          `Invalid chili-package.json structure: ${result.error.message}`
        )
      );
    }
  } catch (error) {
    return Result.error(
      new InvalidChiliPackageError(
        `Failed to parse chili-package.json: ${error instanceof Error ? error.message : String(error)}`
      )
    );
  }
}

// Function to load files from directory handle
export async function loadFilesFromDirectory(
  directoryHandle: FileSystemDirectoryHandle
): Promise<Result<File[], Error>> {
  try {
    const files: File[] = [];

    // Recursively collect all files from the directory
    async function collectFiles(
      dirHandle: FileSystemDirectoryHandle,
      path: string = ""
    ): Promise<void> {
      for await (const [name, handle] of dirHandle.entries()) {
        const currentPath = path ? `${path}/${name}` : name;

        if (handle.kind === "file") {
          const fileHandle = handle as FileSystemFileHandle;
          const file = await fileHandle.getFile();

          // Create a new File object with the full path as the name
          const fileWithPath = new File([file], currentPath, {
            type: file.type,
            lastModified: file.lastModified,
          });

          files.push(fileWithPath);
        } else if (handle.kind === "directory") {
          const subDirHandle = handle as FileSystemDirectoryHandle;
          await collectFiles(subDirHandle, currentPath);
        }
      }
    }

    await collectFiles(directoryHandle);

    // Check if chili-package.json exists
    const packageJsonFile = files.find(
      (file) => file.name === "chili-package.json"
    );
    if (!packageJsonFile) {
      return Result.error(
        new NoChiliPackageError(
          "chili-package.json file not found in the selected directory"
        )
      );
    }

    // Validate chili-package.json structure
    try {
      const packageJsonText = await packageJsonFile.text();
      const packageJsonData = JSON.parse(packageJsonText);

      const validationResult = verifyStudioPackage(packageJsonData);
      if (!validationResult.isOk()) {
        return Result.error(
          validationResult.error || new Error("Unknown validation error")
        );
      }

      const studioPackage = validationResult.value;

      // Check if document files exist
      for (const document of studioPackage.documents) {
        const documentFile = files.find(
          (file) => file.name === document.filePath
        );
        if (!documentFile) {
          return Result.error(
            new MissingDocumentFileError(
              `Document file not found: ${document.filePath}`
            )
          );
        }

        // Validate document JSON
        try {
          const documentText = await documentFile.text();
          JSON.parse(documentText);
        } catch (error) {
          return Result.error(
            new InvalidDocumentJsonError(
              `Invalid JSON in document file ${document.filePath}: ${error instanceof Error ? error.message : String(error)}`
            )
          );
        }
      }

      // Check if font files exist
      for (const document of studioPackage.documents) {
        for (const font of document.fonts) {
          const fontFile = files.find((file) => file.name === font.filePath);
          if (!fontFile) {
            return Result.error(
              new MissingFontFileError(`Font file not found: ${font.filePath}`)
            );
          }
        }
      }

      return Result.ok(files);
    } catch (error) {
      return Result.error(
        new InvalidChiliPackageError(
          `Failed to parse chili-package.json: ${error instanceof Error ? error.message : String(error)}`
        )
      );
    }
  } catch (error) {
    return Result.error(
      new Error(
        `Failed to read directory: ${error instanceof Error ? error.message : String(error)}`
      )
    );
  }
}

// Helper function to sanitize folder name
export const sanitizeFolderName = (name: string): string => {
  return name.replace(/[^a-zA-Z0-9\-_ ]/g, "");
};

// Helper function to generate timestamp
export const generateTimestamp = (): string => {
  const now = new Date();
  // Standard ISO format: "2023-03-15T10:00:00.000Z"
  const isoString = now.toISOString();

  // Sanitize for folder names (replace 'T', ':', '.', 'Z' with something safe like '-')
  const sanitizedFolderName = isoString
    .replace(/[-:.]/g, "_") // Replace -, :, . with _
    .replace("Z", "");

  return sanitizedFolderName;
};

// Helper function to validate folder name
export const validateFolderName = (name: string): string => {
  const illegalChars = name.match(/[^a-zA-Z0-9\-_ ]/g);
  if (illegalChars) {
    const uniqueChars = [...new Set(illegalChars)];
    return `Illegal characters: ${uniqueChars.join(", ")}`;
  }
  return "";
};

// Helper function to get document ID from URL
export const getDocumentId = (): string => {
  const urlPath = window.location.href;
  const templateIdMatch = urlPath.match(/templates\/([\w-]+)/);
  return templateIdMatch ? templateIdMatch[1] : "document";
};
