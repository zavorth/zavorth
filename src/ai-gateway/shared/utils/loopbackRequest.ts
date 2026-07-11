/**
 * Local-request policy for the web runtime.
 *
 * Host headers and Request URLs are client-controlled and are therefore not
 * proof that a network peer is local. A no-credential local mode is only
 * possible when the runtime itself is configured to bind exclusively to a
 * loopback interface. Forwarded client-address headers, when present, must
 * also contain loopback addresses only.
 */

function normalizeHostname(value: string | null | undefined): string {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw) return '';

  const withoutMappedPrefix = raw.startsWith('::ffff:')
    ? raw.slice('::ffff:'.length)
    : raw;

  try {
    return new URL(withoutMappedPrefix.includes('://') ? withoutMappedPrefix : `http://${withoutMappedPrefix}`)
      .hostname.toLowerCase()
      .replace(/^\[/, '')
      .replace(/\]$/, '')
      .replace(/^::ffff:/, '');
  } catch {
    return withoutMappedPrefix
      .replace(/^\[/, '')
      .replace(/\]$/, '')
      .split(':')[0] || '';
  }
}

export function isLoopbackHostname(value: string | null | undefined): boolean {
  const hostname = normalizeHostname(value);
  return hostname === 'localhost'
    || hostname === '127.0.0.1'
    || hostname === '::1'
    || hostname === '0:0:0:0:0:0:0:1';
}

export function isLoopbackOnlyWebBinding(env: NodeJS.ProcessEnv = process.env): boolean {
  if (String(env.ZAVORTH_TRUST_LOCAL_REQUESTS || '').trim().toLowerCase() === 'false') {
    return false;
  }

  const configuredHost = String(
    env.ZAVORTH_WEB_HOST || (env.PORT ? '0.0.0.0' : '127.0.0.1'),
  ).trim();
  return isLoopbackHostname(configuredHost);
}

function header(request: Request, name: string): string {
  return String(request.headers?.get?.(name) || '').trim();
}

export function isTrustedLoopbackRequest(
  request: Request,
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  if (!isLoopbackOnlyWebBinding(env)) return false;

  const hostCandidates = [
    (() => {
      try {
        return new URL(request.url).hostname;
      } catch {
        return '';
      }
    })(),
    header(request, 'host'),
    header(request, 'x-forwarded-host'),
  ]
    .flatMap((value) => String(value || '').split(',').map((entry) => entry.trim()))
    .filter(Boolean);

  if (hostCandidates.length === 0 || !hostCandidates.every(isLoopbackHostname)) {
    return false;
  }

  const forwardedAddresses = [
    ...header(request, 'x-forwarded-for').split(',').map((entry) => entry.trim()).filter(Boolean),
    header(request, 'x-real-ip'),
    header(request, 'cf-connecting-ip'),
  ].filter(Boolean);

  return forwardedAddresses.every(isLoopbackHostname);
}
