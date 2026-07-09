import path from 'node:path';
import { ZavorthNativeConvergenceService } from '../../src/services/ZavorthNativeConvergenceService';

import {
  ZAVORTH_NATIVE_CONVERGENCE_CONTRACT_VERSION,
} from '../../src/contracts/ConvergenceReadinessContract';

describe('ZavorthNativeConvergenceService', () => {
  it('builds one readiness pillar for every Zavorth-native convergence area', async () => {
    const projectRoot = path.resolve(__dirname, '..', '..');
    const snapshot = await new ZavorthNativeConvergenceService({
      projectRoot,
      now: () => new Date('2026-06-01T12:00:00.000Z'),
      env: {},
    }).buildSnapshot();

    expect(snapshot.contractVersion).toBe(ZAVORTH_NATIVE_CONVERGENCE_CONTRACT_VERSION);
    expect(snapshot.generatedAt).toBe('2026-06-01T12:00:00.000Z');
    expect(snapshot.pillars).toHaveLength(10);
    expect(snapshot.summary.total).toBe(10);
    expect(snapshot.pillars.map((pillar) => pillar.id)).toEqual([
      'action-harness',
      'provider-mesh',
      'channel-mesh',
      'mnemos-learning',
      'curator-plane',
      'runtime-tui',
      'swarm-scale',
      'sandbox-control',
      'satellite-voice',
      'qa-product',
    ]);
    expect(snapshot.safety).toEqual(expect.objectContaining({
      zavorthNativeContractsOnly: true,
      noSilentMutation: true,
      actionHarnessRequiredForMutation: true,
      secretValuesSerialized: false,
      externalProjectNamesInPublicSurface: false,
    }));
  });

  it('keeps the public convergence surface Zavorth-owned and actionable', async () => {
    const projectRoot = path.resolve(__dirname, '..', '..');
    const snapshot = await new ZavorthNativeConvergenceService({
      projectRoot,
      now: () => new Date('2026-06-01T12:00:00.000Z'),
      env: {},
    }).buildSnapshot();

    const publicText = [
      snapshot.commands.doctor,
      snapshot.commands.qa,
      ...snapshot.pillars.flatMap((pillar) => [
        pillar.title,
        pillar.summary,
        ...pillar.publicInterfaces,
      ]),
    ].join('\n').toLowerCase();

    for (const forbidden of ['ope' + 'nclaw', 'her' + 'mes']) {
      expect(publicText).not.toContain(forbidden);
    }
    expect(publicText).toContain('zavorth');
    expect(snapshot.pillars.every((pillar) => pillar.evidence.length > 0)).toBe(true);
    expect(snapshot.pillars.every((pillar) => pillar.publicInterfaces.length > 0)).toBe(true);
  });

  it('renders a concise doctor report', async () => {
    const projectRoot = path.resolve(__dirname, '..', '..');
    const service = new ZavorthNativeConvergenceService({
      projectRoot,
      now: () => new Date('2026-06-01T12:00:00.000Z'),
      env: {},
    });
    const text = service.renderText(await service.buildSnapshot());

    expect(text).toContain('Zavorth Native Convergence');
    expect(text).toContain('action-harness');
    expect(text).toContain('qa:zavorth-native-convergence');
  });
});
