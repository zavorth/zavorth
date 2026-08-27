import { assertProviderRequestTargetAllowed } from './EgressGuard.js';

export async function sanitizedProviderFetch(url: string, init?: RequestInit): Promise<Response> {
  await assertProviderRequestTargetAllowed(url);
  return fetch(url, init);
}