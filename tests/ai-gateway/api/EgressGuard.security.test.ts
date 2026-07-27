import { readFileSync } from 'fs';
import { join } from 'path';
jest.mock('@/shared/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}), { virtual: true });
import {
  assertPublicHttpTargetAllowed,
  isPrivateNetworkAddress,
} from '../../../src/ai-gateway/lib/security/egressGuard';
import { deliverWebhook } from '../../../src/ai-gateway/lib/webhookDispatcher';

function readApiRoute(...segments: string[]): string {
  return readFileSync(join(process.cwd(), 'src/ai-gateway/app/api', ...segments, 'route.ts'), 'utf8');
}

function readValidationFile(name: string): string {
  return readFileSync(
    join(process.cwd(), 'src/ai-gateway/lib/providers/validation', name),
    'utf8'
  );
}

function readVersionManagerFile(name: string): string {
  return readFileSync(
    join(process.cwd(), 'src/ai-gateway/lib/versionManager', name),
    'utf8'
  );
}

function readProviderModelsFile(name: string): string {
  return readFileSync(
    join(process.cwd(), 'src/ai-gateway/app/api/providers/[id]/models', name),
    'utf8'
  );
}

function expectGuardBeforeFetch(source: string, guardCall: string, fetchCall = 'fetch('): void {
  const guardIndex = source.indexOf(guardCall);
  const fetchIndex = source.indexOf(fetchCall);
  expect(guardIndex).toBeGreaterThanOrEqual(0);
  expect(fetchIndex).toBeGreaterThanOrEqual(0);
  expect(guardIndex).toBeLessThan(fetchIndex);
}

describe('egress guard hardening', () => {
  const originalAllowPrivate = process.env.ALLOW_PRIVATE_EGRESS_TARGETS;

  afterEach(() => {
    if (originalAllowPrivate === undefined) {
      delete process.env.ALLOW_PRIVATE_EGRESS_TARGETS;
    } else {
      process.env.ALLOW_PRIVATE_EGRESS_TARGETS = originalAllowPrivate;
    }
    jest.restoreAllMocks();
  });

  it('classifies private, loopback and unroutable addresses as unsafe', () => {
    expect(isPrivateNetworkAddress('127.0.0.1')).toBe(true);
    expect(isPrivateNetworkAddress('10.0.0.1')).toBe(true);
    expect(isPrivateNetworkAddress('172.16.0.1')).toBe(true);
    expect(isPrivateNetworkAddress('192.168.1.10')).toBe(true);
    expect(isPrivateNetworkAddress('169.254.169.254')).toBe(true);
    expect(isPrivateNetworkAddress('::1')).toBe(true);
    expect(isPrivateNetworkAddress('::ffff:127.0.0.1')).toBe(true);
    expect(isPrivateNetworkAddress('203.0.113.10')).toBe(true);
    expect(isPrivateNetworkAddress('8.8.8.8')).toBe(false);
  });

  it('blocks localhost and private IP targets before outbound fetches', async () => {
    await expect(
      assertPublicHttpTargetAllowed('http://localhost:3000/internal', { serviceName: 'Test' })
    ).rejects.toThrow('localhost');
    await expect(
      assertPublicHttpTargetAllowed('http://127.0.0.1:3000/internal', { serviceName: 'Test' })
    ).rejects.toThrow('private or loopback');
    await expect(
      assertPublicHttpTargetAllowed('file:///etc/passwd', { serviceName: 'Test' })
    ).rejects.toThrow('http or https');
  });

  it('keeps a deliberate env-gated escape there istch for local labs', async () => {
    process.env.ALLOW_PRIVATE_EGRESS_TARGETS = 'true';
    await expect(
      assertPublicHttpTargetAllowed('http://127.0.0.1:3000/internal', { serviceName: 'Test' })
    ).resolves.toBeInstanceOf(URL);
  });

  it('blocks webhook redirects to private network targets before following them', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch' as any).mockResolvedValueOnce(
      new Response(null, {
        status: 302,
        headers: { location: 'http://127.0.0.1:33333/internal' },
      }) as any,
    );

    const result = await deliverWebhook(
      'http://8.8.8.8/hook',
      { event: 'test.ping', timestamp: new Date(0).toISOString(), data: {} },
      'secret',
      0,
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('private or loopback');
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('guards provider-node validation URLs before fetch', () => {
    const route = readApiRoute('provider-nodes', 'validate');

    expect(route).toContain('assertProviderValidationTargetAllowed');
    expectGuardBeforeFetch(route, 'await assertProviderValidationTargetAllowed(modelsUrl)');
  });

  it('guards provider validation helpers before configurable fetches', () => {
    const files = [
      readValidationFile('openaiLike.ts'),
      readValidationFile('anthropicLike.ts'),
      readValidationFile('claudeCodeCompatible.ts'),
      readValidationFile('geminiLike.ts'),
      readValidationFile('registeredOpenaiLike.ts'),
    ];

    for (const source of files) {
      expect(source).toContain('assertProviderValidationTargetAllowed');
      expectGuardBeforeFetch(source, 'await assertProviderValidationTargetAllowed');
    }

    const specialty = readFileSync(
      join(process.cwd(), 'src/ai-gateway/lib/providers/validationSpecialtyProviders.ts'),
      'utf8'
    );
    expect(specialty).toContain('assertProviderValidationTargetAllowed(messagesUrl)');
    expectGuardBeforeFetch(
      specialty,
      'await assertProviderValidationTargetAllowed(messagesUrl)',
      'fetch(messagesUrl'
    );
    const searchGuard = specialty.indexOf('await assertProviderValidationTargetAllowed(url)');
    const searchFetch = specialty.indexOf('fetch(', searchGuard);
    expect(searchGuard).toBeGreaterThanOrEqual(0);
    expect(searchFetch).toBeGreaterThan(searchGuard);
  });

  it('guards provider model discovery fetchers before outbound catalog fetches', () => {
    const source = readProviderModelsFile('providerModelsFetchers.ts');
    const glmGuard = source.indexOf('await assertProviderValidationTargetAllowed(url)');
    const glmFetch = source.indexOf('fetch(url, {', glmGuard);
    const quotaGuard = source.indexOf('await assertProviderValidationTargetAllowed(quotaUrl)');
    const quotaFetch = source.indexOf('fetch(quotaUrl, {', quotaGuard);
    const pageGuard = source.indexOf('await assertProviderValidationTargetAllowed(pageUrl)');
    const pageFetch = source.indexOf('fetch(pageUrl, {', pageGuard);

    expect(glmGuard).toBeGreaterThanOrEqual(0);
    expect(glmFetch).toBeGreaterThan(glmGuard);
    expect(quotaGuard).toBeGreaterThanOrEqual(0);
    expect(quotaFetch).toBeGreaterThan(quotaGuard);
    expect(pageGuard).toBeGreaterThanOrEqual(0);
    expect(pageFetch).toBeGreaterThan(pageGuard);
  });

  it('does not trust forwarded host headers for combo internal tests', () => {
    const route = readApiRoute('combos', 'test');

    expect(route).not.toContain('x-forwarded-host');
    expect(route).not.toContain('x-forwarded-proto');
    expect(route).toContain('new URL(request.url)');
  });

  it('guards configurable tool health and binary download URLs', () => {
    const healthMonitor = readVersionManagerFile('healthMonitor.ts');
    const binaryManager = readVersionManagerFile('binaryManager.ts');

    expect(healthMonitor).toContain('safeFetch');
    expect(healthMonitor).toContain('allowLoopback: true');
    expect(healthMonitor).toContain('ALLOW_PRIVATE_TOOL_HEALTH_TARGETS');
    expect(binaryManager).toContain('safeFetch');
    expect(binaryManager).toContain('validateArchiveEntries("zip"');
    expect(binaryManager).toContain('validateArchiveEntries("tar"');
    expect(binaryManager).toContain('Unsafe ${kind} archive entry blocked');
    expect(binaryManager).toContain('Trusted SHA256 checksum missing');
    expect(binaryManager).toContain('assertSafeVersion(version)');
    const removalSection = binaryManager.slice(binaryManager.indexOf('export async function removeVersion'));
    expectGuardBeforeFetch(removalSection, 'version = assertSafeVersion(version)', 'fs.rm(');
  });
});
