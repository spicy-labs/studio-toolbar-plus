import type { CropMetadata, SubjectArea } from "./smartCrop.types";

/**
 * Clamps a subject area to ensure it stays within normalized bounds (0-1).
 * This function ensures that:
 * 1. The origin (x, y) is at least 0
 * 2. The right edge (x + width) does not exceed 1
 * 3. The bottom edge (y + height) does not exceed 1
 * 4. Width and height are never negative
 *
 * @param cropMetadata - The crop metadata containing the subject area to clamp
 * @returns A new CropMetadata object with the clamped subject area
 */
export function clampSubjectAreaToBounds(
  cropMetadata: CropMetadata
): CropMetadata {
  // Extract the subject area based on the metadata type
  const subjectArea: SubjectArea = cropMetadata.manualCropMetadata
    ? cropMetadata.manualCropMetadata.subjectArea
    : cropMetadata.visionCropMetadata.subjectArea;

  // Create a copy to avoid modifying the original object
  const clampedArea: SubjectArea = { ...subjectArea };

  // Step 1: Clamp the origin (x, y) to be at least 0.
  // If x is -0.1, it becomes 0. If it's 0.2, it remains 0.2.
  clampedArea.x = Math.max(0, clampedArea.x);
  clampedArea.y = Math.max(0, clampedArea.y);

  // Step 2: Adjust width to ensure the right edge (x + width) is not > 1.
  // The maximum allowed width is (1 - x). We take the smaller of the
  // current width and the maximum allowed width.
  clampedArea.width = Math.min(clampedArea.width, 1 - clampedArea.x);

  // Step 3: Adjust height to ensure the bottom edge (y + height) is not > 1.
  // The maximum allowed height is (1 - y).
  clampedArea.height = Math.min(clampedArea.height, 1 - clampedArea.y);

  // Step 4: Final safety check. In edge cases (e.g., if x was > 1),
  // the width/height could become negative. Clamp them to 0.
  clampedArea.width = Math.max(0, clampedArea.width);
  clampedArea.height = Math.max(0, clampedArea.height);

  // Return a new CropMetadata object with the clamped subject area
  if (cropMetadata.manualCropMetadata) {
    return {
      manualCropMetadata: {
        ...cropMetadata.manualCropMetadata,
        subjectArea: clampedArea,
      },
    };
  } else {
    return {
      manualCropMetadata: null,
      visionCropMetadata: {
        ...cropMetadata.visionCropMetadata,
        subjectArea: clampedArea,
      },
    };
  }
}
