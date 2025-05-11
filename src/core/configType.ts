import { Result } from "typescript-result";

export type Config = {
  currentVersion: string;
  setEnableActions: boolean;
  apps: {
    errorAlert: boolean;
  }
  updateCheckUrl: string;
  changelogUrl: string;
}

export function parseConfig(obj: any): Result<Config, Error> {
  if (!obj || typeof obj !== 'object') {
    return Result.error(new Error('Config must be an object'));
  }

  const requiredFields: (keyof Config)[] = ['currentVersion', 'setEnableActions', 'apps', 'updateCheckUrl', 'changelogUrl'];
  for (const field of requiredFields) {
    if (!(field in obj)) {
      return Result.error(new Error(`Missing required field: ${field}`));
    }
  }

  if (typeof obj.currentVersion !== 'string') {
    return Result.error(new Error('currentVersion must be a string'));
  }

  if (typeof obj.setEnableActions !== 'boolean') {
    return Result.error(new Error('setEnableActions must be a boolean'));
  }

  if (!obj.apps || typeof obj.apps !== 'object') {
    return Result.error(new Error('apps must be an object'));
  }

  if (typeof obj.apps.errorAlert !== 'boolean') {
    return Result.error(new Error('apps.errorAlert must be a boolean'));
  }

  if (typeof obj.updateCheckUrl !== 'string') {
    return Result.error(new Error('updateCheckUrl must be a string'));
  }

  if (typeof obj.changelogUrl !== 'string') {
    return Result.error(new Error('changelogUrl must be a string'));
  }

  return Result.ok({
    currentVersion: obj.currentVersion,
    setEnableActions: obj.setEnableActions,
    apps: {
      errorAlert: obj.apps.errorAlert
    },
    updateCheckUrl: obj.updateCheckUrl,
    changelogUrl: obj.changelogUrl
  });
}
