import { ZavorthPerceptionCrossSurfaceCertificationService } from '../../../src/services/ZavorthPerceptionCrossSurfaceCertificationService';
import { ZavorthAgentGateway } from '../../../src/runtime/agent';
import {
  buildDashboardAdapterInputFromCommandCenterRuntimeProjection,
  buildCommandCenterRuntimeProjectionFromZavorthAgentGatewaySnapshot,
} from '../../../src/ai-gateway/app/(dashboard)/control/command-center/projections';

function createIdFactory() {
  let index = 0;
  return (prefix: string) => `${prefix}-perception-phase6-${++index}`;
}

describe('ZavorthPerceptionCrossSurfaceCertificationService', () => {
  it('certifies perception/control surfaces with mock-safe fixtures', async () => {
    const service = new ZavorthPerceptionCrossSurfaceCertificationService({
      now: () => new Date('2026-05-11T12:00:00.000Z'),
    });

    const snapshot = await service.buildSnapshot();

    expect(snapshot.source).toBe('ZavorthPerceptionCrossSurfaceCertificationService');
    expect(snapshot.status).toBe('passed');
    expect(snapshot.certificationMatrix).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'pc-screenshot', status: 'passed' }),
      expect.objectContaining({ id: 'browser-dom', status: 'passed' }),
      expect.objectContaining({ id: 'browser-screenshot', status: 'passed' }),
      expect.objectContaining({ id: 'adb-screenshot', status: 'passed' }),
      expect.objectContaining({ id: 'adb-ui-dump', status: 'passed' }),
      expect.objectContaining({ id: 'blocked-terminal-automation', status: 'passed' }),
      expect.objectContaining({ id: 'blocked-secrets-screen', status: 'passed' }),
      expect.objectContaining({ id: 'approval-required-tap-type-click', status: 'passed' }),
      expect.objectContaining({ id: 'cancel-pause', status: 'passed' }),
      expect.objectContaining({ id: 'receipts-retention', status: 'passed' }),
    ]));
    expect(snapshot.surfaceProjections).toHaveLength(7);
    expect(snapshot.surfaceProjections.every((surface) => surface.fallbackTextAvailable)).toBe(true);
    expect(snapshot.commandCenterProjection.surface.visualMutationApplied).toBe(false);
    expect(snapshot.commandCenterProjection.pendingPlans).toEqual(expect.arrayContaining([
      expect.objectContaining({ status: 'approval-required', approvalRequired: true }),
    ]));
    expect(snapshot.commandCenterProjection.artifacts.every((artifact) =>
      artifact.redacted === true && artifact.rawContentStored === false,
    )).toBe(true);
    expect(snapshot.liveCanary).toEqual(expect.objectContaining({
      enabled: false,
      requiresExplicitFlag: true,
      requiresOwnerApproval: true,
    }));
  });

  it('projects perception control into Command Center runtime projection without visual mutation', async () => {
    const service = new ZavorthPerceptionCrossSurfaceCertificationService({
      now: () => new Date('2026-05-11T12:05:00.000Z'),
    });
    const certification = await service.buildSnapshot();
    const gateway = new ZavorthAgentGateway({
      now: () => new Date('2026-05-11T12:05:00.000Z'),
      idFactory: createIdFactory(),
    });

    const result = await gateway.handle({
      userId: 'owner',
      channel: 'web',
      sessionId: 'session-perception-phase6',
      text: 'mostre a projecao de percepcao',
      requestedTools: [],
      metadata: {
        perceptionControl: certification.commandCenterProjection,
      },
    });

    const projection = buildCommandCenterRuntimeProjectionFromZavorthAgentGatewaySnapshot(
      gateway.buildSnapshot({ activeRunId: result.run.id }),
    );
    const adapterInput = buildDashboardAdapterInputFromCommandCenterRuntimeProjection(projection);

    expect(projection.perceptionControl).toEqual(expect.objectContaining({
      source: 'ZavorthPerceptionCrossSurfaceCertificationService',
      status: 'passed',
      surface: expect.objectContaining({
        visualMutationApplied: false,
      }),
    }));
    expect(projection.perceptionControl?.targets).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'pc' }),
      expect.objectContaining({ kind: 'browser' }),
      expect.objectContaining({ kind: 'android' }),
    ]));
    expect(adapterInput.perceptionControl).toEqual(expect.objectContaining({
      status: 'passed',
    }));
    expect(adapterInput.runtime?.perceptionControl).toEqual(expect.objectContaining({
      status: 'passed',
    }));
  });
});
