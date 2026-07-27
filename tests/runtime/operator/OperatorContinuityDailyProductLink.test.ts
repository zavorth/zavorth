import { ZavorthDailyProductExperienceService } from '../../../src/services/ZavorthDailyProductExperienceService';
import {
  ZAVORTH_CONTROL_SETUP_CHECKLIST_VERSION,
  type ZavorthControlSetupChecklistSnapshot,
} from '../../../src/contracts/ZavorthControlSetupChecklistContract';
import {
  ZAVORTH_DAILY_CAPABILITY_FLOW_VERSION,
  type ZavorthDailyCapabilityFlowSnapshot,
} from '../../../src/contracts/ZavorthDailyCapabilityFlowContract';

describe('Daily product experience operator continuity link', () => {
  const now = () => new Date('2026-07-10T12:00:00.000Z');

  function setupSnapshot(): ZavorthControlSetupChecklistSnapshot {
    return {
      generatedAt: now().toISOString(),
      version: ZAVORTH_CONTROL_SETUP_CHECKLIST_VERSION,
      status: 'needs-setup',
      headline: 'Finish setup.',
      items: [],
      summary: { total: 0, done: 0, next: 0, needsSetup: 0, blocked: 0 },
      safety: {
        projectionOnly: true,
        rawSecretsSerialized: false,
        liveActionsRemainApprovalBound: true,
      },
    };
  }

  function capabilitySnapshot(): ZavorthDailyCapabilityFlowSnapshot {
    return {
      generatedAt: now().toISOString(),
      version: ZAVORTH_DAILY_CAPABILITY_FLOW_VERSION,
      status: 'attention',
      headline: 'Ready with review.',
      selfImprovement: {
        title: 'Melhorar comportamento',
        status: 'attention',
        promptStatus: 'needs-review',
        bestCandidateId: null,
        requiresApprovalForPromotion: true,
        noAutoApply: true,
        rollbackAvailable: true,
        stages: [],
      },
      runtimeSetup: {
        title: 'Rodar leve',
        target: 'safe-8gb-desktop',
        selectedProfile: 'safe-8gb',
        fallbackProfile: 'chat',
        alwaysOnReady: false,
        wizardSteps: [],
      },
      mcpCatalog: {
        title: 'Add tool',
        status: 'attention',
        scanned: 0,
        blocked: 0,
        needsReview: 0,
        executableToolsExposed: 0,
        items: [],
      },
      continuousEvals: {
        title: 'Rodar avaliactions',
        status: 'attention',
        commands: [],
        summary: 'projection only',
      },
      zavorthControlProjection: {
        route: '/control',
        renderMode: 'daily-capability-flow',
        cards: [],
        safety: {
          projectionOnly: true,
          rawSecretsSerialized: false,
          liveActionsRemainApprovalBound: true,
        },
      },
      nextBestActions: [],
      safety: {
        projectionOnly: true,
        noLiveActionExecuted: true,
        rawSecretsSerialized: false,
        approvalRequiredForBehaviorChange: true,
        runtimeProfileDoesNotGrantAuthority: true,
        externalToolsHeldForReviewBeforeExposure: true,
        continuousEvalDoesNotPersistByDefault: true,
      },
    };
  }

  it('projects operator continuity kernel binding without executing live mutations', async () => {
    const service = new ZavorthDailyProductExperienceService({
      now,
      setupChecklist: { buildSnapshot: () => setupSnapshot() },
      capabilityFlow: { buildSnapshot: async () => capabilitySnapshot() },
    });
    const snapshot = await service.buildSnapshot();

    expect(snapshot.safety.projectionOnly).toBe(true);
    expect(snapshot.safety.noLiveActionExecuted).toBe(true);
    expect(snapshot.safety.operatorContinuityBound).toBe(true);
    expect(snapshot.operatorContinuity).toEqual({
      kernel: 'OperatorContinuityKernel',
      contract: 'operator-continuity-envelope/1',
      dailyMutationPaths: [
        'tool-executor',
        'action-gateway',
        'agent-native-tool-loop',
        'mcp',
      ],
      projectionOnly: true,
    });
    expect(snapshot.qualityGates.covers).toEqual(
      expect.arrayContaining([
        'daily mutations emit operator continuity receipt ids and policy decisions',
      ]),
    );
  });
});
