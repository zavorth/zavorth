import type { AiFirstRoutePlanNormalizationResult } from '../../src/contracts/AiFirstRoutePlanContract.js';
import type { ZavorthResponseDecision } from '../../src/contracts/ZavorthResponseDecisionContract.js';
import { AiFirstPolicyGuardrailService } from '../../src/services/AiFirstPolicyGuardrailService.js';
import { AiFirstRoutePlanContractService } from '../../src/services/AiFirstRoutePlanContractService.js';

function createService(): AiFirstPolicyGuardrailService {
  let counter = 0;
  return new AiFirstPolicyGuardrailService({
    now: () => new Date('2026-05-06T17:00:00.000Z'),
    idFactory: (prefix) => `${prefix}-${++counter}`,
  });
}

function createPlanService(): AiFirstRoutePlanContractService {
  let counter = 0;
  return new AiFirstRoutePlanContractService({
    now: () => new Date('2026-05-06T17:00:00.000Z'),
    idFactory: (prefix) => `${prefix}-plan-${++counter}`,
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

describe('AiFirstPolicyGuardrailService', () => {
  it('passes a matching safe conversation shadow sample', () => {
    const service = createService();
    const snapshot = service.evaluate({
      surface: 'web',
      userMessage: 'Oi, me explique essa ideia.',
      legacyDecision: legacyDecision({}),
      rawAiPlan: {
        intent: {
          primary: 'conversation',
          confidence: 0.9,
        },
        proposedActions: [
          {
            kind: 'answer',
            summary: 'Responder em conversa.',
          },
        ],
      },
    });

    expect(snapshot.decision.status).toBe('pass');
    expect(snapshot.decision.action).toBe('allow-shadow-sample');
    expect(snapshot.decision.sampleEligibleForPromotion).toBe(true);
    expect(snapshot.mismatches).toHaveLength(0);
    expect(snapshot.decision.canExecuteNow).toBe(false);
    expect(snapshot.decision.defaultRuntimeChanged).toBe(false);
  });

  it('holds a policy-valid sample when shadow routing still has high divergence', () => {
    const service = createService();
    const snapshot = service.evaluate({
      surface: 'web',
      userMessage: 'Configure minha conta de notificacoes.',
      legacyDecision: legacyDecision({}),
      rawAiPlan: {
        intent: {
          primary: 'configuration',
          confidence: 0.89,
        },
        proposedActions: [
          {
            kind: 'configure',
            summary: 'Salvar configuracao pessoal depois de mostrar preview.',
            requestedToolIds: ['secure-storage.write'],
          },
        ],
      },
    });

    expect(snapshot.aiPlan.requiresApproval).toBe(true);
    expect(snapshot.aiPlan.requiresPreview).toBe(true);
    expect(snapshot.decision.status).toBe('hold');
    expect(snapshot.decision.action).toBe('hold-for-divergence');
    expect(snapshot.mismatches).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'shadow-high-divergence', severity: 'medium' }),
    ]));
    expect(snapshot.decision.defaultRuntimeChanged).toBe(false);
  });

  it('blocks a tampered plan that removes approval and preview for a mutation', () => {
    const planService = createPlanService();
    const planResult = planService.normalize({
      surface: 'cli',
      userMessage: 'Edite o arquivo de configuracao.',
      rawPlan: {
        intent: { primary: 'workspace-mutation' },
        proposedActions: [
          {
            kind: 'write',
            summary: 'Editar arquivo local.',
            requestedToolIds: ['write_file'],
          },
        ],
      },
    }) as AiFirstRoutePlanNormalizationResult;
    (planResult.normalized.policy.requiresApproval as boolean) = false;
    (planResult.normalized.policy.requiresPreview as boolean) = false;

    const service = createService();
    const snapshot = service.evaluate({
      surface: 'cli',
      userMessage: 'Edite o arquivo de configuracao.',
      aiPlanResult: planResult,
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
    });

    expect(snapshot.decision.status).toBe('block');
    expect(snapshot.decision.action).toBe('block-promotion');
    expect(snapshot.mismatches).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'approval-missing', severity: 'high' }),
      expect.objectContaining({ kind: 'preview-missing', severity: 'high' }),
    ]));
  });

  it('blocks a tampered plan that understates command risk', () => {
    const planService = createPlanService();
    const planResult = planService.normalize({
      surface: 'cli',
      userMessage: 'Rode npm test no terminal.',
      rawPlan: {
        intent: { primary: 'command-execution' },
        proposedActions: [
          {
            kind: 'run-command',
            summary: 'Rodar npm test.',
            requestedToolIds: ['shell.exec'],
          },
        ],
      },
    }) as AiFirstRoutePlanNormalizationResult;
    planResult.normalized.risk.level = 'safe';
    planResult.normalized.proposedActions[0]!.risk = 'safe';

    const service = createService();
    const snapshot = service.evaluate({
      surface: 'cli',
      userMessage: 'Rode npm test no terminal.',
      aiPlanResult: planResult,
      legacyDecision: legacyDecision({
        mode: 'operation',
        responsePath: 'agent-runtime',
        requestedTools: ['shell.exec'],
        diagnostics: {
          surface: 'cli',
          shouldExecute: true,
          semantic: false,
          universalIntent: null,
          trustSlider: null,
        },
      }),
    });

    expect(snapshot.decision.status).toBe('block');
    expect(snapshot.mismatches).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'risk-understated', severity: 'high' }),
    ]));
  });

  it('blocks invalid AI output before promotion', () => {
    const service = createService();
    const snapshot = service.evaluate({
      surface: 'web',
      userMessage: 'oi',
      legacyDecision: legacyDecision({}),
      rawAiPlan: 'saida invalida',
    });

    expect(snapshot.aiPlan.accepted).toBe(false);
    expect(snapshot.decision.status).toBe('block');
    expect(snapshot.mismatches).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'plan-invalid', severity: 'high' }),
    ]));
  });

  it('redacts secrets in the guardrail snapshot', () => {
    const service = createService();
    const snapshot = service.evaluate({
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
