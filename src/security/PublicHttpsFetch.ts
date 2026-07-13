import { lookup } from 'node:dns/promises';
import https from 'node:https';
import net from 'node:net';

export type PublicHttpsFetchOptions = {
  maxBytes: number;
  maxRedirects?: number;
  timeoutMs?: number;
  accept?: string;
};

export function validatePublicHttpsUrl(raw: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return 'URL is invalid.';
  }
  if (parsed.protocol !== 'https:') return 'URL must use HTTPS.';
  if (parsed.username || parsed.password) return 'URL must not contain credentials.';
  const hostname = normalizeHostname(parsed.hostname);
  if (!hostname || isBlockedHostname(hostname) || isPrivateAddress(hostname)) {
    return 'URL must target a public host.';
  }
  return null;
}

export async function fetchPublicHttpsBuffer(
  raw: string,
  options: PublicHttpsFetchOptions,
  redirectCount = 0,
): Promise<Buffer> {
  const maxRedirects = options.maxRedirects ?? 5;
  if (redirectCount > maxRedirects) {
    throw new Error(`Too many redirects (limit ${maxRedirects}).`);
  }
  const target = await resolvePublicTarget(raw);
  return new Promise((resolve, reject) => {
    const request = https.get(target.url, {
      timeout: options.timeoutMs ?? 60_000,
      headers: options.accept ? { Accept: options.accept } : undefined,
      lookup: (_hostname, _lookupOptions, callback) => {
        callback(null, target.address, target.family);
      },
    }, (response) => {
      const status = response.statusCode || 0;
      if (status >= 300 && status < 400 && response.headers.location) {
        response.resume();
        let redirectUrl: string;
        try {
          redirectUrl = new URL(response.headers.location, target.url).toString();
        } catch {
          reject(new Error('Redirect URL is invalid.'));
          return;
        }
        fetchPublicHttpsBuffer(redirectUrl, options, redirectCount + 1).then(resolve, reject);
        return;
      }
      if (status < 200 || status >= 300) {
        response.resume();
        reject(new Error(`HTTP ${status} for ${target.url.toString()}`));
        return;
      }
      const declaredLength = Number(response.headers['content-length'] || 0);
      if (Number.isFinite(declaredLength) && declaredLength > options.maxBytes) {
        response.destroy(new Error(`Response exceeds ${options.maxBytes} bytes.`));
        return;
      }
      const chunks: Buffer[] = [];
      let received = 0;
      response.on('data', (chunk) => {
        const part = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        received += part.length;
        if (received > options.maxBytes) {
          response.destroy(new Error(`Response exceeds ${options.maxBytes} bytes.`));
          return;
        }
        chunks.push(part);
      });
      response.on('end', () => resolve(Buffer.concat(chunks)));
      response.on('error', reject);
    });
    request.on('error', reject);
    request.on('timeout', () => request.destroy(new Error(`Request timed out for ${target.url.toString()}`)));
  });
}

async function resolvePublicTarget(raw: string): Promise<{
  url: URL;
  address: string;
  family: 4 | 6;
}> {
  const policyError = validatePublicHttpsUrl(raw);
  if (policyError) throw new Error(policyError);
  const url = new URL(raw);
  const hostname = normalizeHostname(url.hostname);
  const literalFamily = net.isIP(hostname);
  if (literalFamily) {
    return { url, address: hostname, family: literalFamily as 4 | 6 };
  }
  const records = await lookup(hostname, { all: true, verbatim: true });
  if (records.length === 0 || records.some((record) => isPrivateAddress(record.address))) {
    throw new Error('Host resolves to a private or unsafe address.');
  }
  const selected = records[0];
  return { url, address: selected.address, family: selected.family as 4 | 6 };
}

function normalizeHostname(hostname: string): string {
  return hostname.trim().toLowerCase().replace(/^\[|\]$/g, '').replace(/\.$/, '');
}

function isBlockedHostname(hostname: string): boolean {
  return hostname === 'localhost'
    || hostname.endsWith('.localhost')
    || hostname.endsWith('.local')
    || hostname.endsWith('.internal')
    || hostname.endsWith('.home.arpa');
}

function isPrivateAddress(address: string): boolean {
  const normalized = normalizeHostname(address);
  const family = net.isIP(normalized);
  if (family === 4) {
    const [a, b] = normalized.split('.').map(Number);
    return a === 0
      || a === 10
      || a === 127
      || (a === 100 && b >= 64 && b <= 127)
      || (a === 169 && b === 254)
      || (a === 172 && b >= 16 && b <= 31)
      || (a === 192 && b === 168)
      || (a === 198 && (b === 18 || b === 19))
      || a >= 224;
  }
  if (family === 6) {
    if (normalized === '::' || normalized === '::1') return true;
    if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true;
    if (/^fe[89ab]/u.test(normalized)) return true;
    const mapped = normalized.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/u)?.[1];
    return mapped ? isPrivateAddress(mapped) : false;
  }
  return false;
}
