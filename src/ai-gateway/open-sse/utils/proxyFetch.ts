export function isTlsFingerprintActive(): boolean {
  return process.env.OPENSSE_TLS_FINGERPRINT === "1";
}

export async function runWithProxyContext<T>(
  proxy: string | null,
  fn: () => Promise<T>
): Promise<T> {
  const originalHttpsProxy = globalThis.process?.env?.HTTPS_PROXY;
  if (proxy) {
    process.env.HTTPS_PROXY = proxy;
    process.env.HTTP_PROXY = proxy;
  }
  try {
    return await fn();
  } finally {
    if (proxy) {
      if (originalHttpsProxy) {
        process.env.HTTPS_PROXY = originalHttpsProxy;
      } else {
        delete process.env.HTTPS_PROXY;
      }
      delete process.env.HTTP_PROXY;
    }
  }
}

export async function runWithTlsTracking<T>(url: string, fn: () => Promise<T>): Promise<T> {
  const tlsActive = isTlsFingerprintActive();
  if (tlsActive) {
    const marker = `[tls:${url}]`;
    console.log(`${marker} start`);
    try {
      const result = await fn();
      console.log(`${marker} success`);
      return result;
    } catch (error) {
      console.log(`${marker} error`);
      throw error;
    }
  }
  return fn();
}

export async function proxyFetch(
  url: string,
  init?: RequestInit,
  proxyInfo?: { proxy?: string }
): Promise<Response> {
  return runWithProxyContext(proxyInfo?.proxy || null, () => fetch(url, init));
}

export default proxyFetch;
