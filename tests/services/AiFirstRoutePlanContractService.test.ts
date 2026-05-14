import { AI_FIRST_ROUTE_PLAN_CONTRACT_VERSION } from '../../src/contracts/AiFirstRoutePlanContract.js';
import { AiFirstRoutePlanContractService } from '../../src/services/AiFirstRoutePlanContractService.js';

function createService(): AiFirstRoutePlanContractService {
  let counter = 0;
  return new AiFirstRoutePlanContractService({
    now: () => new Date('2026-05-06T15:00:00.000Z'),
    idFactory: (prefix) => `${prefix}-${++counter}`,
  });
}

describe('AiFirstRoutePlanContractService', () => {
  it('normalizes a plain language setup request into a gated route plan', () => {
    const service = createService();
    const result = service.normalize({
      surface: 'chat',
      userMessage: 'Configure minha conta e me explique de forma simples.',
      rawPlan: {
        audience: {
          level: 'plain',
          hideTechnicalJargon: true,
        },
        intent: {
          primary: 'configuration',
          confidence: 0.91,
          summary: 'Configurar uma conta pessoal com ajuda guiada.',
        },
        goal: {
          userFacing: 'Configurar a conta do usuario.',
          internalSummary: 'Preparar configuracao assistida e validar acesso.',
        },
        proposedActions: [
          {
            id: 'save-settings',
            kind: 'configure',
            label: 'Salvar configuracao',
            summary: 'Salvar configuracao pessoal depois de mostrar preview.',
            requestedToolIds: ['secure-storage.write'],
            target: { type: 'account', value: 'personal-settings' },
          },
        ],
      },
    });

    expect(result.accepted).toBe(true);
    expect(result.normalized.contractVersion).toBe(AI_FIRST_ROUTE_PLAN_CONTRACT_VERSION);
    expect(result.normalized.intent.primary).toBe('configuration');
    expect(result.normalized.audience.level).toBe('plain');
    expect(result.normalized.audience.hideTechnicalJargon).toBe(true);
    expect(result.normalized.policy.requiresApproval).toBe(true);
    expect(result.normalized.policy.requiresPreview).toBe(true);
    expect(result.normalized.policy.canExecuteNow).toBe(false);
    expect(result.normalized.policy.nextSafeAction).toBe('preview-then-request-permission');
  });

  it('redacts secrets from the user message and action payloads', () => {
    const service = createService();
    const result = service.normalize({
      userMessage: 'Use token: xoxb-secret-token-123456 e senha: minha-senha-super-secreta.',
      rawPlan: {
        intent: { primary: 'configuration' },
        goal: 'Salvar segredo privado.',
        proposedActions: [
          {
            kind: 'configure',
            summary: 'Salvar secret: shh-secret-123456 em armazenamento seguro.',
            payloadPreview: {
              token: 'xoxb-secret-token-123456',
              secret: 'shh-secret-123456',
              nested: {
                password: 'minha-senha-super-secreta',
              },
            },
          },
        ],
      },
    });

    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain('xoxb-secret-token-123456');
    expect(serialized).not.toContain('shh-secret-123456');
    expect(serialized).not.toContain('minha-senha-super-secreta');
    expect(serialized).toContain('[redacted-secret]');
    expect(result.normalized.input.rawMessageStored).toBe(false);
  });

  it('does not let a dangerous AI proposal remove approval gates', () => {
    const service = createService();
    const result = service.normalize({
      userMessage: 'Limpe tudo que nao presta.',
      rawPlan: {
        intent: { primary: 'command-execution' },
        proposedActions: [
          {
            kind: 'run-command',
            summary: 'Executar rm -rf em arquivos antigos.',
            requiresApproval: false,
            requiresPreview: false,
          },
        ],
      },
    });

    expect(result.normalized.risk.level).toBe('danger');
    expect(result.normalized.risk.sideEffects).toContain('destructive');
    expect(result.normalized.policy.requiresApproval).toBe(true);
    expect(result.normalized.policy.requiresPreview).toBe(true);
    expect(result.normalized.policy.canExecuteNow).toBe(false);
    expect(result.normalized.policy.planCannotAuthorizeExecution).toBe(true);
  });

  it('asks for clarification before acting when required information is missing', () => {
    const service = createService();
    const result = service.normalize({
      userMessage: 'Configure minhas mensagens.',
      rawPlan: {
        intent: { primary: 'configuration' },
        missingInformation: [
          {
            id: 'which-account',
            prompt: 'Qual conta voce quer configurar?',
            reason: 'Evitar salvar a configuracao no lugar errado.',
            required: true,
          },
        ],
        proposedActions: [
          {
            kind: 'configure',
            summary: 'Salvar configuracao depois que a conta for escolhida.',
          },
        ],
      },
    });

    expect(result.normalized.missingInformation).toHaveLength(1);
    expect(result.normalized.policy.nextSafeAction).toBe('ask-clarification');
    expect(result.normalized.policy.canExecuteNow).toBe(false);
  });

  it('falls back safely for invalid or empty AI output', () => {
    const service = createService();
    const result = service.normalize({
      userMessage: '',
      rawPlan: 'nao sou um objeto',
    });

    expect(result.accepted).toBe(false);
    expect(result.normalized.intent.primary).toBe('unknown');
    expect(result.normalized.proposedActions[0]?.kind).toBe('ask-clarification');
    expect(result.normalized.policy.canExecuteNow).toBe(false);
    expect(result.normalized.diagnostics.errors).toContain('raw-plan-not-an-object');
  });
});
