export type HeaderReader = Pick<Headers, 'get'>;

/**
 * Validate mutation provenance before accepting cookie/local authentication.
 * Bearer clients are not vulnerable to ambient-cookie CSRF and may omit Origin.
 */
export function validatePreferenceMutationOrigin(headers: HeaderReader): string | null {
  const authHeader = headers.get('authorization');
  if (authHeader?.trim().toLowerCase().startsWith('bearer ')) return null;

  const origin = headers.get('origin');
  const host = headers.get('host');
  if (!origin || !host) {
    return 'Origin header required for browser-authenticated preference mutations';
  }
  try {
    if (new URL(origin).host !== host) return 'Cross-origin preference mutation denied';
  } catch {
    return 'Invalid Origin header';
  }
  return null;
}

export function validateSelectionIds(input: {
  providerId: unknown;
  modelId?: unknown;
  secondaryModelId?: unknown;
  routeId?: unknown;
  channelId?: unknown;
}): string | null {
  if (typeof input.providerId !== 'string') return 'providerId must be a string';
  const providerId = input.providerId.trim();
  if (!providerId || providerId.length > 128) {
    return 'providerId is required and must be at most 128 characters';
  }
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f]/.test(providerId)) return 'providerId contains invalid control characters';
  if (!/^[a-z0-9][a-z0-9._-]*$/i.test(providerId)) {
    return 'providerId contains unsupported characters';
  }

  for (const [key, value] of Object.entries({
    modelId: input.modelId,
    secondaryModelId: input.secondaryModelId,
    routeId: input.routeId,
    channelId: input.channelId,
  })) {
    if (value == null || value === '') continue;
    if (typeof value !== 'string') return `${key} must be a string or null`;
    if (value.length > 256) return `${key} is too long`;
  // eslint-disable-next-line no-control-regex
    if (/[\u0000-\u001f]/.test(value)) return `${key} contains invalid control characters`;
    if (key === 'channelId' && !/^[a-z0-9][a-z0-9._-]*$/i.test(value)) {
      return 'channelId contains unsupported characters';
    }
  }
  return null;
}
