import type { ZavorthResponseDecision } from '../../src/contracts/ZavorthResponseDecisionContract.js';
import { AiFirstShadowRouterService } from '../../src/services/AiFirstShadowRouterService.js';

function createService(): AiFirstShadowRouterService {
  let counter = 0;
  return new AiFirstShadowRouterService({
    now: () => new Date('2026-05-06T16:00:00.000Z'),
    idFactory: (prefix) => `${prefix}-${++counter}`,
  });
}

function legacyDecision(input: Partial<ZavorthResponseDecision>): ZavorthResponseDecision {
  return {
    schemaVersion: 1,
    mode: 'conversation',
    confidence: 'high',
    reason: 'Current route fixture.',
    sourceReason: 'conversation-only',
    target: { type: 'none', value: null },
    requestedTools: [],
    responsePath: 'fast-chat',
    shouldCreateArtifact: false,
    shouldShowArtifactInChat: false,
    artifactPolicy: {
      shouldCreateArtifact: false,
      shouldShowArtifactInChat: false,
      reason: 'fixture',
    },
    diagnostics: {
      surface: 'web',
      shouldExecute: false,
      semantic: false,
      universalIntent: null,
      trustSlider: null,
    },
    ...input,
  };
}

describe('AiFirstShadowRouterService', () => {
  it('keeps current runtime authoritative when routes match', () => {
    const service = createService();
    const snapshot = service.compare({
      surface: 'web',
      userMessage: 'Oi, me explique uma ideia.',
      legacyDecision: legacyDecision({}),
      rawAiPlan: {
        intent: {
          primary: 'conversation',
          confidence: 0.9,
          summary: 'Responder como conversa.',
        },
        proposedActions: [
          {
            kind: 'answer',
            summary: 'Responder sem chamar ferramentas.',
          },
        ],
      },
    });

    expect(snapshot.recommendation.defaultRuntimeChanged).toBe(false);
    expect(snapshot.recommendation.keepCurrentRuntimeDecision).toBe(true);
    expect(snapshot.summary.totalDivergences).toBe(0);
    expect(snapshot.recommendation.action).toBe('ready-for-shadow-batch');
    expect(snapshot.gates).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'checkpoint-2-shadow-only', status: 'passed' }),
      expect.objectContaining({ id: 'checkpoint-2-current-runtime-preserved', status: 'passed' }),
    ]));
  });

  it('detects conversation versus configuration divergence', () => {
    const service = createService();
    const snapshot = service.compare({
      surface: 'web',
      userMessage: 'Configure minha conta para receber notificacoes.',
      legacyDecision: legacyDecision({}),
      rawAiPlan: {
        intent: {
          primary: 'configuration',
          confidence: 0.88,
        },
        proposedActions: [
          {
            kind: 'configure',
            summary: 'Salvar configuracao pessoal apos preview.',
            requestedToolIds: ['secure-storage.write'],
          },
        ],
      },
    });

    expect(snapshot.summary.high).toBeGreaterThanOrEqual(1);
    expect(snapshot.divergences.map((entry) => entry.kind)).toEqual(expect.arrayContaining([
      'intent-family',
      'execution-posture',
    ]));
    expect(snapshot.recommendation.action).toBe('investigate-divergence');
    expect(snapshot.recommendation.defaultRuntimeChanged).toBe(false);
  });

  it('flags policy divergence when current route would execute without approval path', () => {
    const service = createService();
    const snapshot = service.compare({
      surface: 'cli',
      userMessage: 'Edite o arquivo de configuracao.',
      legacyDecision: legacyDecision({
        mode: 'operation',
        responsePath: 'agent-runtime',
        requestedTools: ['write_file'],
        diagnostics: {
          surface: 'cli',
          shouldExecute: true,
          semantic: false,
          universalIntent: null,
          trustSlider: null,
        },
      }),
      rawAiPlan: {
        intent: {
          primary: 'workspace-mutation',
          confidence: 0.93,
        },
        proposedActions: [
          {
            kind: 'write',
            summary: 'Editar arquivo de configuracao depois de mostrar preview.',
            requestedToolIds: ['write_file'],
          },
        ],
      },
    });

    expect(snapshot.divergences).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: 'policy',
        severity: 'high',
      }),
    ]));
    expect(snapshot.aiFirst.requiresApproval).toBe(true);
    expect(snapshot.aiFirst.requiresPreview).toBe(true);
  });

  it('records AI plan quality divergence for invalid model output', () => {
    const service = createService();
    const snapshot = service.compare({
      surface: 'web',
      userMessage: 'oi',
      legacyDecision: legacyDecision({}),
      rawAiPlan: 'texto solto sem objeto',
    });

    expect(snapshot.aiFirst.accepted).toBe(false);
    expect(snapshot.divergences).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: 'ai-plan-quality',
        severity: 'high',
      }),
    ]));
    expect(snapshot.recommendation.defaultRuntimeChanged).toBe(false);
  });

  it('redacts secrets from the shadow snapshot', () => {
    const service = createService();
    const snapshot = service.compare({
      surface: 'web',
      userMessage: 'Configure usando token: xoxb-test-token-placeholder-123456.',
      legacyDecision: legacyDecision({}),
      rawAiPlan: {
        intent: { primary: 'configuration' },
        proposedActions: [
          {
            kind: 'configure',
            summary: 'Salvar token: xoxb-test-token-placeholder-123456.',
            requestedToolIds: ['secure-storage.write'],
            payloadPreview: {
              token: 'xoxb-test-token-placeholder-123456',
            },
          },
        ],
      },
    });

    const serialized = JSON.stringify(snapshot);
    expect(serialized).not.toContain('xoxb-test-token-placeholder-123456');
    expect(serialized).toContain('[redacted-secret]');
  });
});
