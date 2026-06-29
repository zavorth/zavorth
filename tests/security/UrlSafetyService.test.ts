import { describe, it, expect, beforeEach } from '@jest/globals';
import { UrlSafetyService } from '../../src/security/UrlSafetyService.js';

describe('UrlSafetyService', () => {
  let service: UrlSafetyService;

  beforeEach(() => {
    service = new UrlSafetyService({
      blockPrivateRanges: true,
      blockCloudMetadata: true,
      blockLinkLocal: true,
    });
  });

  it('blocks invalid URLs', async () => {
    const result = await service.checkUrl('not-a-url');
    expect(result.safe).toBe(false);
    expect(result.reason).toContain('inválida');
  });

  it('blocks non-http protocols', async () => {
    const result = await service.checkUrl('ftp://example.com');
    expect(result.safe).toBe(false);
    expect(result.reason).toContain('Protocolo');
  });

  it('allows localhost', async () => {
    const result = await service.checkUrl('http://localhost:3000');
    expect(result.safe).toBe(true);
  });

  it('allows 127.0.0.1', async () => {
    const result = await service.checkUrl('http://127.0.0.1:8080');
    expect(result.safe).toBe(true);
  });

  it('blocks cloud metadata IP', async () => {
    const result = await service.checkUrl('http://169.254.169.254/latest/meta-data/');
    expect(result.safe).toBe(false);
    expect(result.reason).toContain('metadata cloud');
  });

  it('blocks private IP 10.x.x.x', async () => {
    const result = await service.checkUrl('http://10.0.0.1/admin');
    expect(result.safe).toBe(false);
    expect(result.reason).toContain('privado');
  });

  it('blocks private IP 192.168.x.x', async () => {
    const result = await service.checkUrl('http://192.168.1.1/admin');
    expect(result.safe).toBe(false);
    expect(result.reason).toContain('privado');
  });

  it('allows public IPs', async () => {
    const result = await service.checkUrl('http://8.8.8.8');
    expect(result.safe).toBe(true);
  });

  it('respects allowedHosts', async () => {
    service.allowHost('10.0.0.1');
    const result = await service.checkUrl('http://10.0.0.1');
    expect(result.safe).toBe(true);
  });

  it('removes host from allowlist', async () => {
    // Use IP directly to avoid DNS resolution
    service.allowHost('10.0.0.1');
    service.denyHost('10.0.0.1');
    const result = await service.checkUrl('http://10.0.0.1');
    expect(result.safe).toBe(false);
  });
});
