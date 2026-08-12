export { createTestLogRepo } from './testLogRepoUtils.js';

export function fetchNoKeepAlive(input: string | URL, init: RequestInit = {}) {
  const headers = new Headers(init.headers || {});
  headers.set('Connection', 'close');
  return fetch(input, { ...init, headers });
}

export function authHeaders(token: string, extra: HeadersInit = {}) {
  const headers = new Headers(extra);
  headers.set('Authorization', `Bearer ${token}`);
  return headers;
}

export async function fetchJson(
  input: string | URL,
  init: RequestInit = {},
): Promise<{ response: Response; status: number; payload: any }> {
  const response = await fetchNoKeepAlive(input, init);
  return {
    response,
    status: response.status,
    payload: await response.json(),
  };
}

export async function fetchZavorthControlJson(
  baseUrl: string,
  route: string,
  options: {
    token?: string;
    init?: RequestInit;
  } = {},
): Promise<{ response: Response; status: number; payload: any }> {
  const headers = new Headers(options.init?.headers || {});
  if (options.token) {
    headers.set('Authorization', `Bearer ${options.token}`);
  }
  return fetchJson(`${baseUrl}${route}`, {
    ...options.init,
    headers,
  });
}
