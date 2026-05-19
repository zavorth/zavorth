import { describe, expect, it } from '@jest/globals';
import { ZavorthSupremacyParityPackService } from '../../src/services/ZavorthSupremacyParityPackService.js';

describe('ZavorthSupremacyParityPackService', () => {
  it('builds a complete parity snapshot across providers, channels, backends, skills and dashboard', async () => {
    const snapshot = await new ZavorthSupremacyParityPackService({
      now: () => new Date('2026-05-18T12:00:00.000Z'),
    }).buildSnapshot();

    expect(snapshot.contractVersion).toBe('zavorth-supremacy-parity-pack/1');
    expect(snapshot.surface).toBe('supremacy-parity-pack');
    expect(snapshot.providerParity.missingRoutes).toEqual([]);
    expect(snapshot.providerParity.routeCount).toBeGreaterThanOrEqual(80);
    expect(snapshot.gatewayMatrix.channels.map((channel) => channel.id)).toEqual(expect.arrayContaining([
      'telegram',
      'discord',
      'slack',
      'whatsapp',
      'signal',
      'email',
    ]));
    expect(snapshot.executionBackends.entries.map((backend) => backend.id)).toEqual(expect.arrayContaining([
      'local-supervised',
      'docker',
      'wsl',
      'ssh',
      'vercel-sandbox',
      'daytona',
      'generic-container',
    ]));
    expect(snapshot.skillEcosystem.nativeCategories).toHaveLength(10);
    expect(snapshot.safety).toEqual(expect.objectContaining({
      noLiveProviderClaimWithoutProof: true,
      noSkillMutationWithoutApproval: true,
      noExternalBackendLiveWithoutExplicitConfig: true,
      noDashboardStyleFork: true,
    }));
  });

  it('keeps configurable channels and backends explicit instead of claiming live status', async () => {
    const snapshot = await new ZavorthSupremacyParityPackService({
      env: {},
      now: () => new Date('2026-05-18T12:00:00.000Z'),
    }).buildSnapshot();

    expect(snapshot.gatewayMatrix.channels.find((channel) => channel.id === 'slack')?.status).toBe('configurable');
    expect(snapshot.executionBackends.entries.find((backend) => backend.id === 'ssh')?.status).toBe('not-configured');
    expect(snapshot.executionBackends.entries.every((backend) => backend.liveByDefault === false)).toBe(true);
  });

  it('blocks configured identity reference leaks', async () => {
    const files = new Map<string, string | null>([
      ['C:/fixture/src/clean.ts', 'const model = "zavorth-default-model";'],
      ['C:/fixture/src/leak.ts', `const ref = "${['legacy', 'agent', 'reference'].join('-')}";`],
      ['C:/fixture/scripts', null],
      ['C:/fixture/tests', null],
      ['C:/fixture/package.json', '{}'],
    ]);
    const dirs = new Map<string, string[]>([
      ['C:/fixture/src', ['clean.ts', 'leak.ts']],
      ['C:/fixture/scripts', []],
      ['C:/fixture/tests', []],
    ]);
    const service = new ZavorthSupremacyParityPackService({
      projectRoot: 'C:/fixture',
      now: () => new Date('2026-05-18T12:00:00.000Z'),
      maturity: {
        buildSnapshot: () => ({
          status: 'needs-attention',
          distinctions: { externalReferenceLeakFree: true },
        }),
      } as any,
      existsSync: ((target: string) => files.has(normalize(target)) || dirs.has(normalize(target))) as any,
      readFileSync: ((target: string) => files.get(normalize(target)) || '') as any,
      readdirSync: ((target: string) => dirs.get(normalize(target)) || []) as any,
      statSync: ((target: string) => ({
        isDirectory: () => dirs.has(normalize(target)),
      })) as any,
    });

    const snapshot = await service.buildSnapshot();

    expect(snapshot.summary.conceptualExternalReferenceLeaks).toBe(1);
    expect(snapshot.safety.noConceptualExternalReferences).toBe(false);
    expect(snapshot.phases.find((phase) => phase.id === 'freeze-baseline')?.status).toBe('blocked');
  });
});

function normalize(value: string): string {
  return value.replace(/\\/g, '/');
}
