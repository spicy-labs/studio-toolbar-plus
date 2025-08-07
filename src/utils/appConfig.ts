import { Result } from "typescript-result";

// Error types for getDefaultConfig
export class ManifestRequestError extends Error {
  readonly _tag = "ManifestRequestError";
  constructor(message: string) {
    super(message);
    this.name = "ManifestRequestError";
  }
}

export class ParseManifestError extends Error {
  readonly _tag = "ParseManifestError";
  constructor(message: string) {
    super(message);
    this.name = "ParseManifestError";
  }
}

export type AppConfigKeys =
  | "showSnapshot"
  | "showFramePositionViewer"
  | "showLayoutManager"
  | "showMagicLayouts"
  | "showAspectLock"
  | "showLayoutImageMapper"
  | "showUploadDownload"
  | "showTestError"
  | "showConnectorCleanup"
  | "showManualCropManager"
  | "showConnectorFolderBrowser"
  | "showOutput";

export type AppStatus = "none" | "sponsored" | "deprecated" | "experimental";

export type AppInfo = {
  enabled: boolean;
  status: AppStatus;
};

export type AppFullConfig = {
  [key in AppConfigKeys]: AppInfo;
};

export type AppConfig = {
  [key in AppConfigKeys]: boolean;
};

export function appConfigFromFullConfig(fullConfig: AppFullConfig): AppConfig {
  const config: AppConfig = {} as AppConfig;
  for (const [key, value] of Object.entries(fullConfig)) {
    config[key as AppConfigKeys] = value.enabled;
  }
  return config;
}

export async function getDefaultConfig(): Promise<
  Result<[AppFullConfig, string], Error>
> {
  try {
    // Make API request to GitHub manifest.json
    const response = await fetch(
      "https://raw.githubusercontent.com/spicy-labs/studio-toolbar-plus/main/manifest.json"
    );

    if (!response.ok) {
      return Result.error(
        new ManifestRequestError(
          `Failed to fetch manifest: ${response.status} ${response.statusText}`
        )
      );
    }

    const manifestData = await response.json();

    // Parse the JSON to get the current version
    if (!manifestData.version || typeof manifestData.version !== "string") {
      return Result.error(
        new ParseManifestError("Invalid or missing version in manifest")
      );
    }

    const version = manifestData.version;

    // Parse the JSON to get the default AppConfig
    if (!manifestData.appConfig || typeof manifestData.appConfig !== "object") {
      return Result.error(
        new ParseManifestError("Invalid or missing appConfig in manifest")
      );
    }

    const appConfig = manifestData.appConfig as AppFullConfig;

    // Validate the toolbarConfig structure
    for (const [key, value] of Object.entries(appConfig)) {
      if (
        !value ||
        typeof value !== "object" ||
        typeof value.enabled !== "boolean" ||
        !["none", "sponsored", "deprecated", "experimental"].includes(
          value.status
        )
      ) {
        return Result.error(
          new ParseManifestError(
            `Invalid toolbarConfig entry for ${key}: expected {enabled: boolean, status: "none" | "sponsored" | "deprecated" | "experimental"}`
          )
        );
      }
    }

    return Result.ok([appConfig, manifestData.version]);
  } catch (error) {
    if (
      error instanceof ManifestRequestError ||
      error instanceof ParseManifestError
    ) {
      return Result.error(error);
    }

    return Result.error(
      new ManifestRequestError(
        `Network or parsing error: ${error instanceof Error ? error.message : String(error)}`
      )
    );
  }
}
