import { Result } from "typescript-result";

export type Config = {
  setEnableActions: boolean;
  apps: {
    errorAlert: boolean;
  }
}

export function parseConfig(obj: any): Result<Config, Error> {
  if (!obj || typeof obj !== 'object') {
    return Result.error(new Error('Config must be an object'));
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

  return Result.ok({
    setEnableActions: obj.setEnableActions,
    apps: {
      errorAlert: obj.apps.errorAlert
    }
  });
}
