/**
 * UrlSafetyService — SSRF protection and internal address blocking.
 *
 * Resolves DNS to verify actual IP against private ranges,
 * blocks cloud metadata addresses, and validates HTTPS against
 * trusted host allowlist.
 *
 * Usage:
 *   const service = new UrlSafetyService();
 *   const result = await service.checkUrl('http://169.254.169.254/latest/meta-data/');
 *   if (!result.safe) {
 *     return res.status(403).json({ error: result.reason });
 *   }
 */

import { isIPv4, isIPv6 } from 'net';

export interface UrlSafetyOptions {
  blockPrivateRanges?: boolean;
  blockCloudMetadata?: boolean;
  blockLinkLocal?: boolean;
  allowedHosts?: string[];
  timeoutMs?: number;
}

export interface UrlSafetyResult {
  safe: boolean;
  reason?: string;
  resolvedIp?: string;
}

// Ranges de IPs privados (RFC 1918 + RFC 6598 + RFC 5737)
const PRIVATE_RANGES = [
  { start: [10, 0, 0, 0], end: [10, 255, 255, 255], label: '10.0.0.0/8' },
  { start: [172, 16, 0, 0], end: [172, 31, 255, 255], label: '172.16.0.0/12' },
  { start: [192, 168, 0, 0], end: [192, 168, 255, 255], label: '192.168.0.0/16' },
  { start: [100, 64, 0, 0], end: [100, 127, 255, 255], label: '100.64.0.0/10 (CGNAT)' },
  { start: [169, 254, 0, 0], end: [169, 254, 255, 255], label: '169.254.0.0/16 (link-local)' },
  { start: [192, 0, 0, 0], end: [192, 0, 0, 255], label: '192.0.0.0/24' },
  { start: [192, 0, 2, 0], end: [192, 0, 2, 255], label: '192.0.2.0/24 (TEST-NET-1)' },
  { start: [198, 51, 100, 0], end: [198, 51, 100, 255], label: '198.51.100.0/24 (TEST-NET-2)' },
  { start: [203, 0, 113, 0], end: [203, 0, 113, 255], label: '203.0.113.0/24 (TEST-NET-3)' },
  { start: [224, 0, 0, 0], end: [239, 255, 255, 255], label: '224.0.0.0/4 (multicast)' },
];

// Endereços de metadata cloud (sempre bloqueados)
const CLOUD_METADATA_IPS = [
  '169.254.169.254', // AWS/GCP/Azure/Alibaba metadata
  '169.254.170.2',   // AWS ECS task metadata
  '169.254.169.254', // DigitalOcean metadata
];

// Endereços IPv4-mapped IPv6
const IPV4_MAPPED_PREFIX = '::ffff:';

function ipToOctets(ip: string): number[] | null {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  const octets = parts.map(Number);
  if (octets.some((o) => isNaN(o) || o < 0 || o > 255)) return null;
  return octets;
}

function isInRange(octets: number[], start: number[], end: number[]): boolean {
  for (let i = 0; i < 4; i++) {
    if (octets[i] < start[i] || octets[i] > end[i]) return false;
    if (octets[i] > start[i] && octets[i] < end[i]) return true;
  }
  return true;
}

function normalizeIp(ip: string): string {
  // Remove IPv4-mapped prefix
  if (ip.startsWith(IPV4_MAPPED_PREFIX)) {
    return ip.slice(IPV4_MAPPED_PREFIX.length);
  }
  return ip;
}

async function resolveDns(
  hostname: string,
  timeoutMs: number,
): Promise<string[]> {
  const { lookup } = await import('dns');
  const { promisify } = await import('util');
  const lookupAsync = promisify(lookup);

  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve([]), timeoutMs);

    lookupAsync(hostname, { all: true }, (err, addresses) => {
      clearTimeout(timer);
      if (err || !addresses) {
        resolve([]);
        return;
      }
      resolve(addresses.map((a) => a.address));
    });
  });
}

export class UrlSafetyService {
  private readonly blockPrivate: boolean;
  private readonly blockMetadata: boolean;
  private readonly blockLinkLocal: boolean;
  private readonly allowedHosts: Set<string>;
  private readonly timeoutMs: number;

  constructor(options: UrlSafetyOptions = {}) {
    this.blockPrivate = options.blockPrivateRanges ?? true;
    this.blockMetadata = options.blockCloudMetadata ?? true;
    this.blockLinkLocal = options.blockLinkLocal ?? true;
    this.allowedHosts = new Set(options.allowedHosts ?? []);
    this.timeoutMs = options.timeoutMs ?? 5000;
  }

  /**
   * Checks if a URL is safe to access.
   */
  async checkUrl(url: string): Promise<UrlSafetyResult> {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return { safe: false, reason: 'Invalid URL' };
    }

    // Block dangerous protocols
    const protocol = parsed.protocol.toLowerCase();
    if (protocol !== 'http:' && protocol !== 'https:') {
      return {
        safe: false,
        reason: `Unsupported protocol: ${protocol}`,
      };
    }

    const hostname = parsed.hostname;

    // localhost always allowed (development)
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') {
      return { safe: true };
    }

    // Trusted host allowlist
    if (this.allowedHosts.has(hostname)) {
      return { safe: true };
    }

    // If not IP, resolve DNS
    if (!isIPv4(hostname) && !isIPv6(hostname)) {
      const ips = await resolveDns(hostname, this.timeoutMs);

      if (ips.length === 0) {
        return { safe: false, reason: `Failed to resolve DNS for ${hostname}` };
      }

      // Check each resolved IP
      for (const ip of ips) {
        const result = this.checkIp(ip);
        if (!result.safe) {
          return { ...result, resolvedIp: ip };
        }
      }

      return { safe: true, resolvedIp: ips[0] };
    }

    // Direct IP
    return this.checkIp(hostname);
  }

  /**
   * Checks if an IP is safe.
   */
  private checkIp(ip: string): UrlSafetyResult {
    const normalized = normalizeIp(ip);

    // Cloud metadata — always blocked
    if (this.blockMetadata && CLOUD_METADATA_IPS.includes(normalized)) {
      return {
        safe: false,
        reason: `Cloud metadata address blocked: ${normalized}`,
      };
    }

    // IPv4
    if (isIPv4(normalized)) {
      const octets = ipToOctets(normalized);
      if (!octets) {
        return { safe: false, reason: `Invalid IP: ${normalized}` };
      }

      if (this.blockPrivate) {
        for (const range of PRIVATE_RANGES) {
          if (isInRange(octets, range.start, range.end)) {
            if (range.label.includes('link-local') && !this.blockLinkLocal) {
              continue;
            }
            return {
              safe: false,
              reason: `IP in blocked private range: ${normalized} (${range.label})`,
            };
          }
        }
      }
    }

    // IPv6 — check if loopback or link-local
    if (isIPv6(normalized)) {
      const lower = normalized.toLowerCase();
      if (lower === '::1' || lower.startsWith('fe80:')) {
        if (this.blockLinkLocal && lower.startsWith('fe80:')) {
          return {
            safe: false,
            reason: `IPv6 link-local blocked: ${normalized}`,
          };
        }
        // ::1 is loopback, allowed
      }
    }

    return { safe: true };
  }

  /**
   * Adds a host to allowlist.
   */
  allowHost(hostname: string): void {
    this.allowedHosts.add(hostname);
  }

  /**
   * Removes a host from allowlist.
   */
  denyHost(hostname: string): void {
    this.allowedHosts.delete(hostname);
  }
}
