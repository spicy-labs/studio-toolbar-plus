import { Result } from "typescript-result";

export type Config = {
  currentVersion: string;
  setEnableActions: boolean;
  apps: {
    errorAlert: boolean;
  };
  urls: {
    updateCheckUrl: string;
    changelogUrl: string;
    updateDownloadUrl: string;
  };
};

export function parseConfig(obj: any): Result<Config, Error> {
  if (!obj || typeof obj !== "object") {
    return Result.error(new Error("Config must be an object"));
  }

  const requiredFields: (keyof Config)[] = [
    "currentVersion",
    "setEnableActions",
    "apps",
    "urls",
  ];
  for (const field of requiredFields) {
    if (!(field in obj)) {
      return Result.error(new Error(`Missing required field: ${field}`));
    }
  }

  if (typeof obj.currentVersion !== "string") {
    return Result.error(new Error("currentVersion must be a string"));
  }

  if (typeof obj.setEnableActions !== "boolean") {
    return Result.error(new Error("setEnableActions must be a boolean"));
  }

  if (!obj.apps || typeof obj.apps !== "object") {
    return Result.error(new Error("apps must be an object"));
  }

  if (typeof obj.apps.errorAlert !== "boolean") {
    return Result.error(new Error("apps.errorAlert must be a boolean"));
  }

  if (!obj.urls || typeof obj.urls !== "object") {
    return Result.error(new Error("urls must be an object"));
  }

  if (typeof obj.urls.updateCheckUrl !== "string") {
    return Result.error(new Error("urls.updateCheckUrl must be a string"));
  }

  if (typeof obj.urls.changelogUrl !== "string") {
    return Result.error(new Error("urls.changelogUrl must be a string"));
  }

  if (typeof obj.urls.updateDownloadUrl !== "string") {
    return Result.error(new Error("urls.updateDownloadUrl must be a string"));
  }

  return Result.ok({
    currentVersion: obj.currentVersion,
    setEnableActions: obj.setEnableActions,
    apps: {
      errorAlert: obj.apps.errorAlert,
    },
    urls: {
      updateCheckUrl: obj.urls.updateCheckUrl,
      changelogUrl: obj.urls.changelogUrl,
      updateDownloadUrl: obj.urls.updateDownloadUrl,
    },
  });
}
