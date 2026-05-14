import {
  UNIVERSAL_PREVIEW_MODE_CONTRACT_VERSION,
  UniversalPreviewModeService,
} from '../../../src/runtime/agent/index.js';

describe('UniversalPreviewModeService Wave 30', () => {
  it('builds a non-executing preview envelope for risky tools', () => {
    const snapshot = new UniversalPreviewModeService({
      now: () => new Date('2026-05-03T21:00:00.000Z'),
    }).buildSnapshot({
      runId: 'run-preview',
      text: 'simule corrigir arquivo e rodar testes sem executar',
      surface: 'cli',
      requestedTools: [],
      metadata: {
        universalPreviewMode: {
          enabled: true,
        },
      },
      toolExposure: {
        mode: 'restricted',
        summary: '2 ferramentas expostas.',
        tools: [
          {
            id: 'write_file',
            label: 'Write file',
            risk: 'danger',
            requiresApproval: true,
          },
          {
            id: 'shell.exec',
            label: 'Shell exec',
            risk: 'danger',
            requiresApproval: true,
          },
        ],
      },
    });

    expect(snapshot).toEqual(expect.objectContaining({
      contractVersion: UNIVERSAL_PREVIEW_MODE_CONTRACT_VERSION,
      mode: 'preview-only',
      safety: expect.objectContaining({
        noExecutionPerformed: true,
        naturalLanguageDoesNotBypassPolicy: true,
        executorBlockedInPreviewMode: true,
        toolsActuallyCalled: [],
      }),
      risk: expect.objectContaining({
        highestRisk: 'danger',
        requiresApproval: true,
        approvalRequiredToolIds: ['write_file', 'shell.exec'],
      }),
    }));
    expect(snapshot.planSteps).toEqual(expect.arrayContaining([
      expect.objectContaining({
        toolId: 'write_file',
        kind: 'write',
        requiresApproval: true,
      }),
      expect.objectContaining({
        toolId: 'shell.exec',
        kind: 'shell',
        requiresApproval: true,
      }),
    ]));
  });

  it('does not treat arbitrary selfmod preview ids as preview-only requests', () => {
    const service = new UniversalPreviewModeService();

    expect(service.shouldUsePreviewMode({
      text: 'aplique o preview goal-preview-1',
      metadata: {},
    })).toBe(false);
    expect(service.shouldUsePreviewMode({
      text: 'mostre uma previa antes de executar a correcao',
      metadata: {},
    })).toBe(true);
  });

  it('marks selfmod apply as preview-required and blocked until specific preview flow', () => {
    const snapshot = new UniversalPreviewModeService().buildSnapshot({
      text: 'simule aplicar selfmod',
      surface: 'web',
      requestedTools: ['selfmod.apply'],
      metadata: {
        previewMode: true,
      },
      toolExposure: {
        mode: 'restricted',
        summary: 'selfmod apply',
        tools: [
          {
            id: 'selfmod.apply',
            label: 'Selfmod apply',
            group: 'selfmod',
            risk: 'danger',
            requiresApproval: true,
            policyTags: ['preview-required'],
          },
        ],
      },
    });

    expect(snapshot.risk.previewRequired).toBe(true);
    expect(snapshot.safety.selfmodApplyBlocked).toBe(true);
    expect(snapshot.risk.previewRequiredToolIds).toEqual(['selfmod.apply']);
    expect(snapshot.nextSafeAction).toContain('preview');
  });
});
