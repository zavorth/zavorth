import { ZavorthEndToEndMissionFlowPublicRuntimeCertificationService } from '../../src/services/ZavorthEndToEndMissionFlowPublicRuntimeCertificationService.js';

describe('ZavorthEndToEndMissionFlowPublicRuntimeCertificationService Phase 8', () => {
  it('certifies the public daily mission flow without execution bypass', async () => {
    const snapshot = await new ZavorthEndToEndMissionFlowPublicRuntimeCertificationService({
      now: () => new Date('2026-05-14T14:00:00.000Z'),
      subagentSkillCompletion: {
        buildSnapshot: async () => ({
          status: 'passed',
          summary: {
            entries: 7,
            bridgeReadySkills: 17,
            rawSecretsSerialized: false,
            workspaceMutationPerformed: false,
            externalIoPerformed: false,
          },
          liveCompletion: {
            skillLiveUseRequiresOwnerApproval: true,
          },
        }) as any,
      },
      schedulerPerceptionDeviceCompletion: {
        buildSnapshot: async () => ({
          status: 'passed',
          summary: {
            entries: 6,
            rawSecretsSerialized: false,
            workspaceMutationPerformed: false,
            externalIoPerformed: false,
          },
          liveCompletion: {
            defaultRouteRequiresReadinessProof: true,
          },
          safety: {
            deviceActionsOwnerGated: true,
          },
        }) as any,
      },
    }).buildSnapshot({
      request: 'Review this workspace safely and produce a receipt.',
      sessionId: 'phase-8-test-session',
    });

    expect(snapshot.contractVersion).toBe('2026-05-14.phase-8-end-to-end-mission-flow-public-runtime-certification');
    expect(snapshot.status).toBe('passed');
    expect(snapshot.summary.previewFirst).toBe(true);
    expect(snapshot.summary.approvalRequestVisible).toBe(true);
    expect(snapshot.summary.receiptReady).toBe(true);
    expect(snapshot.summary.missionTraceable).toBe(true);
    expect(snapshot.summary.providerReadinessHonest).toBe(true);
    expect(snapshot.summary.channelReadinessHonest).toBe(true);
    expect(snapshot.summary.subagentSkillReady).toBe(true);
    expect(snapshot.summary.schedulerPerceptionDeviceReady).toBe(true);
    expect(snapshot.summary.publicRuntimeCanBypassPolicy).toBe(false);
    expect(snapshot.summary.commandCenterCanExecute).toBe(false);
    expect(snapshot.summary.rawSecretsSerialized).toBe(false);
    expect(snapshot.summary.workspaceMutationPerformed).toBe(false);
    expect(snapshot.summary.externalIoPerformed).toBe(false);
    expect(snapshot.dailyUseCertification.userCanAskNaturally).toBe(true);
    expect(snapshot.dailyUseCertification.userGetsMissionPreview).toBe(true);
    expect(snapshot.dailyUseCertification.userGetsReceiptEvidence).toBe(true);
    expect(snapshot.dailyUseCertification.liveMutationRequiresApprovalAndReadiness).toBe(true);
    expect(snapshot.safety.noRuntimeBypassFromPublicSurfaces).toBe(true);
    expect(snapshot.entries.map((entry) => entry.id)).toEqual(expect.arrayContaining([
      'runtime-api.status-health',
      'mission.preview-first',
      'approval.request-visible',
      'receipt.ready',
      'providers.readiness-honest',
      'channels.readiness-honest',
      'subagents.skills.completion',
      'scheduler.perception.device.completion',
      'public-surfaces.no-bypass',
    ]));
  });
});
