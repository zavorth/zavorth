import { assertPublicHttpTargetAllowed } from '../ai-gateway/lib/security/egressGuard.js';
import { decideSecurityPolicy, formatSecurityPolicyReceipt } from './SecurityPolicyBroker.js';

export type SafeFetchOptions = {
  serviceName?: string;
  allowPrivateEnvVar?: string;
  allowLoopback?: boolean;
  maxRedirects?: number;
  fetchImpl?: typeof fetch;
};

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

export async function safeFetch(
  rawUrl: string | URL,
  init: RequestInit = {},
  options: SafeFetchOptions = {},
): Promise<Response> {
  return safeFetchInternal(String(rawUrl), init, {
    serviceName: options.serviceName || 'Safe fetch',
    allowPrivateEnvVar: options.allowPrivateEnvVar,
    allowLoopback: options.allowLoopback === true,
    maxRedirects: options.maxRedirects ?? 3,
    fetchImpl: options.fetchImpl || fetch,
    seen: new Set<string>(),
  });
}

async function safeFetchInternal(
  rawUrl: string,
  init: RequestInit,
  context: Required<Pick<SafeFetchOptions, 'serviceName' | 'allowLoopback' | 'maxRedirects' | 'fetchImpl'>> & {
    allowPrivateEnvVar?: string;
    seen: Set<string>;
  },
): Promise<Response> {
  const parsed = await assertSafeHttpTargetAllowed(rawUrl, {
    allowLoopback: context.allowLoopback,
    allowPrivateEnvVar: context.allowPrivateEnvVar,
    serviceName: context.serviceName,
  });
  const normalizedUrl = parsed.toString();
  if (context.seen.has(normalizedUrl)) {
    throw new Error(`${context.serviceName} redirect loop blocked`);
  }
  context.seen.add(normalizedUrl);

  const response = await context.fetchImpl(normalizedUrl, {
    ...init,
    redirect: 'manual',
  });

  if (!REDIRECT_STATUSES.has(response.status)) {
    return response;
  }
  if (context.maxRedirects <= 0) {
    throw new Error(`${context.serviceName} redirect limit exceeded`);
  }

  const location = response.headers.get('location');
  if (!location) {
    return response;
  }

  const nextUrl = new URL(location, parsed);
  return safeFetchInternal(nextUrl.toString(), init, {
    ...context,
    maxRedirects: context.maxRedirects - 1,
  });
}

async function assertSafeHttpTargetAllowed(
  rawUrl: string,
  options: Pick<SafeFetchOptions, 'serviceName' | 'allowPrivateEnvVar' | 'allowLoopback'>,
): Promise<URL> {
  const serviceName = options.serviceName || 'Safe fetch';
  if (options.allowLoopback) {
    let parsed: URL;
    try {
      parsed = new URL(rawUrl);
    } catch {
      const decision = decideSecurityPolicy({
        surface: 'web-fetch',
        operation: 'parse_url',
        target: rawUrl,
        blocked: true,
        rule: 'INVALID_HTTP_TARGET',
        reasons: [`${serviceName} URL is invalid.`],
      });
      throw new Error(`${serviceName} URL is invalid. ${formatSecurityPolicyReceipt(decision.receipt)}`);
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      const decision = decideSecurityPolicy({
        surface: 'web-fetch',
        operation: 'validate_scheme',
        target: parsed.toString(),
        blocked: true,
        rule: 'NON_HTTP_TARGET_BLOCKED',
        reasons: [`${serviceName} URL must use http or https.`],
      });
      throw new Error(`${serviceName} URL must use http or https. ${formatSecurityPolicyReceipt(decision.receipt)}`);
    }
    if (isLoopbackHost(parsed.hostname)) {
      decideSecurityPolicy({
        surface: 'web-fetch',
        operation: 'allow_loopback',
        target: parsed.toString(),
        rule: 'LOOPBACK_ALLOWED_BY_CALLER_POLICY',
        reasons: [`${serviceName} explicitly allowed loopback egress for this call.`],
      });
      return parsed;
    }
  }

  try {
    const parsed = await assertPublicHttpTargetAllowed(rawUrl, {
      allowPrivateEnvVar: options.allowPrivateEnvVar,
      serviceName: options.serviceName,
    });
    decideSecurityPolicy({
      surface: 'web-fetch',
      operation: 'public_egress',
      target: parsed.toString(),
      rule: 'PUBLIC_HTTP_TARGET_ALLOWED',
      reasons: [`${serviceName} target passed DNS/IP egress policy.`],
    });
    return parsed;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const decision = decideSecurityPolicy({
      surface: 'web-fetch',
      operation: 'public_egress',
      target: rawUrl,
      blocked: true,
      risk: 'forbidden',
      rule: 'PRIVATE_OR_UNSAFE_HTTP_TARGET_BLOCKED',
      reasons: [message],
    });
    throw new Error(`${message} ${formatSecurityPolicyReceipt(decision.receipt)}`);
  }
}

function isLoopbackHost(hostname: string): boolean {
  const normalized = String(hostname || '').toLowerCase().replace(/^\[|\]$/g, '');
  return normalized === 'localhost'
    || normalized.endsWith('.localhost')
    || normalized === '127.0.0.1'
    || normalized.startsWith('127.')
    || normalized === '::1'
    || normalized === '0:0:0:0:0:0:0:1';
}

export async function readSafeJsonResponse<T>(
  response: Response,
  serviceLabel: string,
  maxBytes = 16 * 1024 * 1024,
): Promise<T> {
  const contentLengthHeader = response.headers?.get?.('content-length');
  if (contentLengthHeader) {
    const contentLength = parseInt(contentLengthHeader, 10);
    if (!isNaN(contentLength) && contentLength > maxBytes) {
      throw new Error(
        `Egress response size limit exceeded: ${serviceLabel} returned a content-length of ${contentLength} bytes, which exceeds the max allowed limit of ${maxBytes} bytes.`
      );
    }
  }

  if (!response.body) {
    const text = await response.text();
    const bytes = new TextEncoder().encode(text).length;
    if (bytes > maxBytes) {
      throw new Error(
        `Egress response size limit exceeded: ${serviceLabel} body size ${bytes} bytes exceeds the max allowed limit of ${maxBytes} bytes.`
      );
    }
    return JSON.parse(text) as T;
  }

  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  if (typeof (response.body as any).getReader === 'function') {
    const reader = (response.body as any).getReader();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }
        if (value) {
          totalBytes += value.length;
          if (totalBytes > maxBytes) {
            await reader.cancel();
            throw new Error(
              `Egress response size limit exceeded: ${serviceLabel} stream exceeded the max allowed limit of ${maxBytes} bytes.`
            );
          }
          chunks.push(value);
        }
      }
    } finally {
      reader.releaseLock();
    }
  } else if (typeof (response.body as any)[Symbol.asyncIterator] === 'function') {
    const stream = response.body as any;
    for await (const chunk of stream) {
      const buf = typeof chunk === 'string' ? new TextEncoder().encode(chunk) : chunk;
      totalBytes += buf.length;
      if (totalBytes > maxBytes) {
        if (typeof stream.destroy === 'function') {
          stream.destroy();
        }
        throw new Error(
          `Egress response size limit exceeded: ${serviceLabel} stream exceeded the max allowed limit of ${maxBytes} bytes.`
        );
      }
      chunks.push(buf);
    }
  } else {
    const text = await response.text();
    const bytes = new TextEncoder().encode(text).length;
    if (bytes > maxBytes) {
      throw new Error(
        `Egress response size limit exceeded: ${serviceLabel} body size ${bytes} bytes exceeds the max allowed limit of ${maxBytes} bytes.`
      );
    }
    return JSON.parse(text) as T;
  }

  const concatenated = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    concatenated.set(chunk, offset);
    offset += chunk.length;
  }

  const decoder = new TextDecoder('utf-8');
  const text = decoder.decode(concatenated);
  return JSON.parse(text) as T;
}
