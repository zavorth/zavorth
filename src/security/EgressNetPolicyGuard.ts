/**
 * Egress Security Net-Policy Guard.
 * Enforces outbound network boundaries, blocking SSRF, cloud metadata exfiltration,
 * private local subnets, link-local endpoints, and unapproved ports.
 */

import { URL } from 'node:url';

export interface EgressPolicyOptions {
  serviceName?: string;
  allowLoopback?: boolean;
  allowPrivate?: boolean;
  allowedHosts?: string[];
  blockedHosts?: string[];
}

export class EgressNetPolicyGuard {
  private static readonly BLOCKED_METADATA_HOSTS = new Set([
    '169.254.169.254',
    'metadata.google.internal',
    'metadata.internal',
    'instance-data',
    '100.100.100.200', // Alibaba cloud metadata
  ]);

  private static readonly BLOCKED_PORTS = new Set([
    22,    // SSH
    23,    // Telnet
    25,    // SMTP
    135,   // RPC
    139,   // NetBIOS
    445,   // SMB
    3389,  // RDP
  ]);

  /**
   * Checks if an IP or hostname belongs to private or link-local ranges.
   */
  static isPrivateOrReservedHost(hostname: string): boolean {
    const clean = hostname.toLowerCase().replace(/^\[|\]$/g, '');

    // Check Cloud Metadata
    if (this.BLOCKED_METADATA_HOSTS.has(clean)) {
      return true;
    }

    // Check IPv4 Loopback
    if (clean === 'localhost' || clean.startsWith('127.')) {
      return true;
    }

    // Check IPv6 Loopback / Link-local
    if (clean === '::1' || clean.startsWith('fe80:') || clean.startsWith('fc00:') || clean.startsWith('fd00:')) {
      return true;
    }

    // Check IPv4 Private Subnets (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, 169.254.0.0/16)
    const ipv4Parts = clean.split('.').map(Number);
    if (ipv4Parts.length === 4 && ipv4Parts.every((n) => !isNaN(n) && n >= 0 && n <= 255)) {
      const [a, b] = ipv4Parts;
      if (a === 10) return true;
      if (a === 172 && b >= 16 && b <= 31) return true;
      if (a === 192 && b === 168) return true;
      if (a === 169 && b === 254) return true;
      if (a === 0 || a === 127) return true;
    }

    return false;
  }

  /**
   * Validates if a target URL is permitted under egress security policy.
   */
  static validateUrl(
    rawUrl: string | URL,
    options: EgressPolicyOptions = {}
  ): { allowed: boolean; reason?: string; normalizedUrl: URL } {
    let parsed: URL;
    try {
      parsed = rawUrl instanceof URL ? rawUrl : new URL(String(rawUrl));
    } catch {
      return { allowed: false, reason: 'Malformed URL scheme.', normalizedUrl: new URL('http://invalid.local') };
    }

    const service = options.serviceName || 'EgressGuard';

    // 1. Enforce http/https only
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return {
        allowed: false,
        reason: `[${service}] Blocked non-HTTP scheme "${parsed.protocol}".`,
        normalizedUrl: parsed,
      };
    }

    // 2. Enforce port security
    const port = parsed.port ? parseInt(parsed.port, 10) : parsed.protocol === 'https:' ? 443 : 80;
    if (this.BLOCKED_PORTS.has(port)) {
      return {
        allowed: false,
        reason: `[${service}] Blocked dangerous egress port ${port}.`,
        normalizedUrl: parsed,
      };
    }

    const hostname = parsed.hostname.toLowerCase();

    // 3. Explicit blocked hosts
    if (options.blockedHosts && options.blockedHosts.includes(hostname)) {
      return {
        allowed: false,
        reason: `[${service}] Host "${hostname}" is explicitly blocked by policy.`,
        normalizedUrl: parsed,
      };
    }

    // 4. Check metadata endpoints (always blocked unconditionally)
    if (this.BLOCKED_METADATA_HOSTS.has(hostname) || hostname.endsWith('.metadata.google.internal')) {
      return {
        allowed: false,
        reason: `[${service}] Blocked attempt to reach cloud instance metadata endpoint "${hostname}".`,
        normalizedUrl: parsed,
      };
    }

    // 5. Check loopback / private IP policies
    const isPrivate = this.isPrivateOrReservedHost(hostname);
    if (isPrivate) {
      const isLoopback = hostname === 'localhost' || hostname.startsWith('127.') || hostname === '::1';
      if (isLoopback && options.allowLoopback) {
        return { allowed: true, normalizedUrl: parsed };
      }
      if (options.allowPrivate) {
        return { allowed: true, normalizedUrl: parsed };
      }

      return {
        allowed: false,
        reason: `[${service}] Blocked access to private / loopback network host "${hostname}" without explicit grant.`,
        normalizedUrl: parsed,
      };
    }

    return { allowed: true, normalizedUrl: parsed };
  }

  /**
   * Asserts that a URL is allowed, throwing an error if blocked.
   */
  static assertAllowed(rawUrl: string | URL, options: EgressPolicyOptions = {}): URL {
    const result = this.validateUrl(rawUrl, options);
    if (!result.allowed) {
      throw new Error(result.reason || `Egress target blocked by security policy.`);
    }
    return result.normalizedUrl;
  }
}
