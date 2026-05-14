import { OperationalMaturityService } from '../../../src/domain/platform-ecosystem/application/OperationalMaturityService';

describe('OperationalMaturityService', () => {
  it('builds a canonical maturity snapshot for advanced surfaces', () => {
    const service = new OperationalMaturityService({
      projectRoot: process.cwd(),
      now: () => new Date('2026-05-08T00:00:00.000Z'),
    });

    const snapshot = service.buildSnapshot();
    const ids = snapshot.capabilities.map((capability) => capability.id);

    expect(snapshot.schemaVersion).toBe('operational-maturity.v1');
    expect(ids).toEqual(expect.arrayContaining([
      'browser-mcp',
      'local-voice-dictation',
      'swarm-executor',
      'session-v2-pty',
      'session-recorder-dvr',
      'nexus-surface',
      'echo-edge-layer',
    ]));
    expect(snapshot.invariants).toEqual({
      nexusIsSurfaceOnly: true,
      echoIsEdgeLayerOnly: true,
      noParallelRuntimeClaim: true,
    });
    expect(snapshot.summary.officialButProvisioned).toBeGreaterThan(0);
    expect(snapshot.summary.experimental).toBeGreaterThan(0);
  });

  it('validates evidence and renders a human console view', () => {
    const service = new OperationalMaturityService({
      projectRoot: process.cwd(),
      now: () => new Date('2026-05-08T00:00:00.000Z'),
    });

    const report = service.validate();
    const rendered = service.renderConsole(report.snapshot);

    expect(report.ok).toBe(true);
    expect(rendered).toContain('Zavorth Operational Maturity');
    expect(rendered).toContain('Nexus Surface');
    expect(rendered).toContain('Echo Edge Layer');
  });
});
