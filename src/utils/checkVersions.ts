import { Result } from "typescript-result";

// Error types for checkVersions
export class FromIsNotSemanticError extends Error {
  readonly _tag = "FromIsNotSemanticError";
  constructor(message: string) {
    super(message);
    this.name = "FromIsNotSemanticError";
  }
}

export class ToIsNotSemanticError extends Error {
  readonly _tag = "ToIsNotSemanticError";
  constructor(message: string) {
    super(message);
    this.name = "ToIsNotSemanticError";
  }
}

export class UnknownError extends Error {
  readonly _tag = "UnknownError";
  constructor(message: string) {
    super(message);
    this.name = "UnknownError";
  }
}

type VersionComparisonResult = "greater" | "equal" | "less";
type VersionError = FromIsNotSemanticError | ToIsNotSemanticError | UnknownError;

/**
 * Compares two semantic version strings
 * @param from - The version to compare from
 * @param to - The version to compare to
 * @returns Result containing comparison result ("greater" | "equal" | "less") or error
 */
export function checkVersions(
  from: string,
  to: string
): Result<VersionComparisonResult, VersionError> {
  try {
    // Validate 'from' version
    const fromParts = from.split(".").map(Number);
    if (
      fromParts.length !== 3 ||
      fromParts.some((part) => isNaN(part) || part < 0)
    ) {
      return Result.error(
        new FromIsNotSemanticError(
          `Invalid semantic version format for 'from': ${from}. Expected format: x.y.z where x, y, z are non-negative numbers.`
        )
      );
    }

    // Validate 'to' version
    const toParts = to.split(".").map(Number);
    if (
      toParts.length !== 3 ||
      toParts.some((part) => isNaN(part) || part < 0)
    ) {
      return Result.error(
        new ToIsNotSemanticError(
          `Invalid semantic version format for 'to': ${to}. Expected format: x.y.z where x, y, z are non-negative numbers.`
        )
      );
    }

    const [fromMajor, fromMinor, fromPatch] = fromParts;
    const [toMajor, toMinor, toPatch] = toParts;

    // Compare major version
    if (fromMajor > toMajor) {
      return Result.ok("greater");
    } else if (fromMajor < toMajor) {
      return Result.ok("less");
    }

    // Major versions are equal, compare minor version
    if (fromMinor > toMinor) {
      return Result.ok("greater");
    } else if (fromMinor < toMinor) {
      return Result.ok("less");
    }

    // Major and minor versions are equal, compare patch version
    if (fromPatch > toPatch) {
      return Result.ok("greater");
    } else if (fromPatch < toPatch) {
      return Result.ok("less");
    }

    // All versions are equal
    return Result.ok("equal");
  } catch (error) {
    return Result.error(
      new UnknownError(
        `Unexpected error during version comparison: ${error instanceof Error ? error.message : String(error)}`
      )
    );
  }
}
