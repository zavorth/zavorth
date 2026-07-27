import { CAPABILITY_SETUP_CONVERSATION_CONTRACT_VERSION } from '../../src/contracts/CapabilitySetupConversationContract';
import { ZavorthCapabilitySetupConversationApiService } from '../../src/services/ZavorthCapabilitySetupConversationApiService';
import { ZavorthCapabilitySetupConversationService } from '../../src/services/ZavorthCapabilitySetupConversationService';

describe('ZavorthCapabilitySetupConversationService', () => {
  it('explains missing secret setup in plain language without serializing raw values', () => {
    const service = new ZavorthCapabilitySetupConversationService({
      now: () => new Date('2026-05-08T14:00:00.000Z'),
    });

    const snapshot = service.buildSnapshot({
      packId: 'official-ops-skills',
      targetItemId: 'skill:zavorth-pulse',
      text: 'quero ativar zavorth pulse com token sk-test-secret-value-1234567890',
      audience: 'everyday',
    });

    expect(snapshot.contractVersion).toBe(CAPABILITY_SETUP_CONVERSATION_CONTRACT_VERSION);
    expect(snapshot.status).toBe('needs_secret');
    expect(snapshot.request.redactedText).toContain('[SECRET_REDACTED]');
    expect(JSON.stringify(snapshot)).not.toContain('sk-test-secret-value-1234567890');
    expect(snapshot.secureRequests.map((request) => request.inputMode)).toContain('secure-secret-entry');
    expect(snapshot.secureRequests.every((request) => request.rawValueAcceptedInChat === false)).toBe(true);
    expect(snapshot.reply.headline).toContain('Zavorth Pulse');
    expect(snapshot.reply.body).toContain('entrada segura');
    expect(snapshot.safety).toMatchObject({
      noJargonByDefault: true,
      rawSecretsSerialized: false,
      liveActivationApplied: false,
    });
  });

  it('guides readiness checks after secrets are present', () => {
    const service = new ZavorthCapabilitySetupConversationService({
      now: () => new Date('2026-05-08T14:00:00.000Z'),
    });

    const snapshot = service.buildSnapshot({
      packId: 'official-ops-skills',
      targetItemId: 'skill:zavorth-pulse',
      text: 'configure zavorth pulse',
      audience: 'everyday',
      providedSecrets: {
        'calendar.oauth': 'calendar-secret-value-that-must-not-leak',
        'mail.oauth': 'mail-secret-value-that-must-not-leak',
      },
      availableSecretRefs: ['calendar.oauth', 'mail.oauth'],
    });

    expect(snapshot.status).toBe('needs_readiness');
    expect(snapshot.secureRequests.some((request) => request.inputMode === 'confirmation')).toBe(true);
    expect(snapshot.explanationCards.length).toBeGreaterThan(0);
    expect(JSON.stringify(snapshot)).not.toContain('calendar-secret-value-that-must-not-leak');
    expect(snapshot.reply.body).toContain('teste');
  });

  it('reaches owner-ready state after readiness and approval are complete', () => {
    const api = new ZavorthCapabilitySetupConversationApiService({
      now: () => new Date('2026-05-08T14:00:00.000Z'),
    });

    const snapshot = api.buildSnapshot({
      packId: 'official-ops-skills',
      targetItemId: 'skill:release-readiness',
      text: 'ative release readiness',
      audience: 'owner',
      approvalId: 'approval-release',
      completedManualSteps: ['review scope and approval budget'],
      completedReadinessChecks: ['release-readiness-readiness', 'artifact-receipt-policy'],
    });

    expect(snapshot.status).toBe('ready_for_owner');
    expect(snapshot.reply.headline).toContain('Release Readiness');
    expect(snapshot.reply.nextQuestion).toContain('pedido final');
    expect(snapshot.safety.liveActivationApplied).toBe(false);
    expect(snapshot.flowSnapshot.status).toBe('ready_for_controlled_activation');
  });

  it('renders concise non-technical reply through CLI facade service', () => {
    const api = new ZavorthCapabilitySetupConversationApiService({
      now: () => new Date('2026-05-08T14:00:00.000Z'),
    });

    const reply = api.renderReply({
      packId: 'official-ops-skills',
      targetItemId: 'skill:zavorth-pulse',
      text: 'configure zavorth pulse',
      audience: 'everyday',
    });

    expect(reply).toContain('entrada segura');
    expect(reply).toContain('Eu not vou guardar valuees sensiveis');
    expect(reply).not.toContain('MCP');
  });
});
