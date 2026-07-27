/**
 * Minimal GeminiKeyRotation stub for testing.
 * Implements the contract expected by GeminiKeyRotation.test.ts.
 */

export function collectGeminiApiKeys(
  env: Record<string, string | undefined>,
  configKeys?: string[],
): string[] {
  const keys: string[] = [];
  const primaryKey = env.GEMINI_API_KEY;
  if (primaryKey) keys.push(primaryKey);

  if (env.ZAVORTH_GEMINI_MULTI_KEY_TEST === '1') {
    if (env.GOOGLE_API_KEY && env.GOOGLE_API_KEY !== primaryKey) {
      keys.push(env.GOOGLE_API_KEY);
    }
    for (let i = 2; i <= 20; i++) {
      const suffixKey = env[`GEMINI_API_KEY_${i}`];
      if (suffixKey && suffixKey !== primaryKey && !keys.includes(suffixKey)) {
        keys.push(suffixKey);
      }
    }
  }

  if (configKeys && configKeys.length > 0) {
    if (keys.length === 0 && configKeys[0]) {
      keys.push(configKeys[0]);
    }
  }

  return keys;
}

export function isGeminiMultiKeyTestEnabled(env: Record<string, string | undefined>): boolean {
  return env.ZAVORTH_GEMINI_MULTI_KEY_TEST === '1';
}

export function isGeminiQuotaLikeError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const message = String((error as any).message ?? '');
  return /429|quota|rate.?limit|too many requests/i.test(message);
}

export function isGeminiKeyFailoverError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const message = String((error as any).message ?? '');
  if (/503|upstream unavailable|unavailable/i.test(message)) return true;
  if (/api key not valid|invalid.*key/i.test(message)) return true;
  if (/400|bad request|invalid request/i.test(message)) return false;
  return false;
}

export function isGeminiModelUnavailableError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const message = String((error as any).message ?? '');
  return /404|model.*no longer available|not found/i.test(message);
}

export function listGeminiModelFallbacks(
  primaryModel: string,
  env?: Record<string, string | undefined>,
): string[] {
  const models: string[] = [primaryModel];

  const backgroundModel = env?.ZAVORTH_BACKGROUND_MODEL;
  const secondaryModel = env?.ZAVORTH_SECONDARY_MODEL;

  if (secondaryModel && secondaryModel !== primaryModel) {
    models.push(secondaryModel);
  }

  if (backgroundModel && backgroundModel !== primaryModel && !models.includes(backgroundModel)) {
    if (!/flash-lite/i.test(backgroundModel)) {
      models.push(backgroundModel);
    }
  }

  return models;
}
