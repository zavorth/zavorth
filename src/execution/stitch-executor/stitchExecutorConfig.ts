import { ExecutionRequest } from '../../contracts/ExecutionContract.js';
import { StitchAuthConfig, StitchDeviceType, StitchModelId } from './stitchExecutorTypes.js';

type StitchConfigShape = {
  stitchApiKey?: string | null;
  stitchAccessToken?: string | null;
  stitchGoogleCloudProject?: string | null;
  stitchDefaultDeviceType?: string | null;
  stitchDefaultModelId?: string | null;
};

export function resolveStitchAuthConfig(config: StitchConfigShape): StitchAuthConfig | null {
  const apiKey = String(config.stitchApiKey || '').trim();
  if (apiKey) {
    return { apiKey };
  }

  const accessToken = String(config.stitchAccessToken || '').trim();
  const projectId = String(config.stitchGoogleCloudProject || '').trim();
  if (accessToken && projectId) {
    return { accessToken, projectId };
  }

  return null;
}

export function resolveStitchDeviceType(
  _prompt: string,
  request: ExecutionRequest,
  config: StitchConfigShape,
): StitchDeviceType {
  // Free text never selects device type — only explicit metadata / config defaults.
  const explicit = String(
    request.metadata?.stitch_device_type ||
      request.metadata?.task_metadata?.stitch_device_type ||
      config.stitchDefaultDeviceType ||
      '',
  )
    .trim()
    .toUpperCase();

  if (isSupportedStitchDeviceType(explicit)) {
    return explicit;
  }

  return 'AGNOSTIC';
}

export function resolveStitchModelId(request: ExecutionRequest, config: StitchConfigShape): StitchModelId | null {
  const explicit = String(
    request.metadata?.stitch_model_id ||
      request.metadata?.task_metadata?.stitch_model_id ||
      config.stitchDefaultModelId ||
      '',
  )
    .trim()
    .toUpperCase();

  if (explicit === 'GEMINI_3_PRO' || explicit === 'GEMINI_3_FLASH') {
    return explicit;
  }

  return null;
}

export function isSupportedStitchDeviceType(value: string): value is StitchDeviceType {
  return ['DEVICE_TYPE_UNSPECIFIED', 'MOBILE', 'DESKTOP', 'TABLET', 'AGNOSTIC'].includes(value);
}

export function buildStitchClientOptions(
  authConfig: StitchAuthConfig,
  baseUrl: string,
  timeout: number,
): Record<string, unknown> {
  return {
    ...authConfig,
    baseUrl,
    timeout,
  };
}
