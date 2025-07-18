import { Result } from "typescript-result";
import { z } from "zod";

// Shared types
export type PointOfInterest = {
  x: number;
  y: number;
};

export type SubjectArea = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type ManualCropMetadata = {
  manualCropMetadata: {
    pointOfInterest: PointOfInterest;
    subjectArea: SubjectArea;
  };
};

export type DetectedObject = {
  class: string[];
  confidence: number;
  subjectArea: SubjectArea;
};

export type VisionCropMetadata = {
  manualCropMetadata: null;
  visionCropMetadata: {
    category: string;
    pointOfInterest: PointOfInterest;
    subjectArea: SubjectArea;
    detectedObjects: DetectedObject[];
    version: string;
  };
};

// Union type supporting both formats
export type CropMetadata = ManualCropMetadata | VisionCropMetadata;

// Error class
export class InvalidCropMetadataError extends Error {
  public type = "InvalidCropMetadataError";
  public cropData = "string";

  constructor(message: string, cropData: string) {
    super(message);
    this.cropData = cropData;
  }
}

// Enhanced verification function supporting both formats
export function verifyCropMetadata(metadata: any): Result<CropMetadata, Error> {
  const PointOfInterestSchema = z.object({
    x: z.number(),
    y: z.number(),
  });

  const SubjectAreaSchema = z.object({
    x: z.number(),
    y: z.number(),
    width: z.number(),
    height: z.number(),
  });

  const DetectedObjectSchema = z.object({
    class: z.array(z.string()),
    confidence: z.number(),
    subjectArea: SubjectAreaSchema,
  });

  // V1 Manual Crop Schema
  const ManualCropMetadataSchema = z.object({
    manualCropMetadata: z.object({
      pointOfInterest: PointOfInterestSchema,
      subjectArea: SubjectAreaSchema,
    }),
  });

  // V2 Vision Crop Schema
  const VisionCropMetadataSchema = z.object({
    manualCropMetadata: z.null(),
    visionCropMetadata: z.object({
      category: z.string(),
      pointOfInterest: PointOfInterestSchema,
      subjectArea: SubjectAreaSchema,
      detectedObjects: z.array(DetectedObjectSchema),
      version: z.string(),
    }),
  });

  // Try V1 format first
  const manualResult = ManualCropMetadataSchema.safeParse(metadata);
  if (manualResult.success) {
    return Result.ok(manualResult.data);
  }

  // Try V2 format
  const visionResult = VisionCropMetadataSchema.safeParse(metadata);
  if (visionResult.success) {
    return Result.ok(visionResult.data);
  }

  // Neither format matched
  return Result.error(
    new InvalidCropMetadataError(
      "Invalid crop metadata format",
      JSON.stringify(metadata)
    )
  );
}

export function convertVisionToManualCropMetadata(
  visionMetadata: VisionCropMetadata
): ManualCropMetadata {
  return {
    manualCropMetadata: {
      pointOfInterest: visionMetadata.visionCropMetadata.pointOfInterest,
      subjectArea: visionMetadata.visionCropMetadata.subjectArea,
    },
  };
}
