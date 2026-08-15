import { ZavorthContextRecoveryAssimilationService } from '../../../src/services/ZavorthContextRecoveryAssimilationService.js';

describe('ZavorthContextRecoveryAssimilationService', () => {
  it('builds compact hot, warm and cold context without raw memory', () => {
    const service = new ZavorthContextRecoveryAssimilationService({
      now: () => new Date('2026-05-11T20:00:00.000Z'),
    });

    const snapshot = service.buildSnapshot({
      text: 'continue auditando com subagents',
      surface: 'cli',
      actorId: 'owner',
      sessionId: 'session-1',
      priorSummary: 'A etapa anterior criou action patterns seguros.',
      recentEvents: ['User pediu continuation da auditoria.'],
      memoryFacts: [
        {
          id: 'mem-1',
          layer: 'warm',
          summary: 'Workspace uses governed subagents for read-only analysis.',
          source: 'test',
          confidence: 0.92,
        },
      ],
    });

    expect(snapshot.contractVersion).toBe('2026-05-11.context-memory-error-recovery-checkpoint-3');
    expect(snapshot.status).toBe('ready');
    expect(snapshot.safety.rawMemorySerialized).toBe(false);
    expect(snapshot.safety.ledgerBeatsRecall).toBe(true);
    expect(snapshot.contextPack.hot).toHaveLength(1);
    expect(snapshot.contextPack.warm).toHaveLength(1);
    expect(snapshot.contextPack.cold).toHaveLength(1);
    expect(snapshot.contextPack.secretsSerialized).toBe(false);
    expect(snapshot.receipts.map((receipt) => receipt.kind)).toContain('checkpoint-3-context-pack');
  });

  it('classifies recoverable provider failures and avoids blind repeated tool use', () => {
    const snapshot = new ZavorthContextRecoveryAssimilationService().buildSnapshot({
      text: 'continue verificando o resultado',
      lastFailure: {
        message: 'provider timeout while observing page',
        toolId: 'browser.observe',
        attempt: 1,
      },
    });

    expect(snapshot.status).toBe('recovery-ready');
    expect(snapshot.failure.kind).toBe('provider_error');
    expect(snapshot.failure.retryable).toBe(true);
    expect(snapshot.recovery.retryAllowed).toBe(true);
    expect(snapshot.recovery.retryBudgetRemaining).toBe(1);
    expect(snapshot.recovery.avoidSameFailingToolUntilEvidenceChanges).toBe(true);
    expect(snapshot.recovery.steps.join('\n')).toContain('Avoid repeating browser.observe');
  });

  it('inherits approval boundaries from Preview engine for impact actions', () => {
    const snapshot = new ZavorthContextRecoveryAssimilationService().buildSnapshot({
      text: 'edite arquivos e rode comando powershell',
      surface: 'web',
    });

    expect(snapshot.status).toBe('approval-required');
    expect(snapshot.failure.kind).toBe('approval_missing');
    expect(snapshot.actionPattern.status).toBe('approval-required');
    expect(snapshot.receipts).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: 'approval-boundary',
        status: 'requires-approval',
      }),
    ]));
  });

  it('blocks secret-risk recovery and redacts sensitive context', () => {
    const snapshot = new ZavorthContextRecoveryAssimilationService().buildSnapshot({
      text: 'continue',
      recentEvents: ['token: sk-testsecret123456789 vazou no log'],
      lastFailure: {
        message: 'secret token leaked by tool output',
        toolId: 'tool.read',
        attempt: 1,
      },
    });

    expect(snapshot.status).toBe('blocked');
    expect(snapshot.failure.kind).toBe('secret_risk');
    expect(snapshot.recovery.nextAction).toBe('stop_and_report');
    expect(snapshot.contextPack.hot[0]?.summary).toContain('[redacted]');
    expect(snapshot.safety.secretsSerialized).toBe(false);
    expect(snapshot.receipts).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'blocked-retry' }),
    ]));
  });
});
