import { AiFirstRouterMigrationInventoryService } from '../../src/services/AiFirstRouterMigrationInventoryService.js';

describe('AiFirstRouterMigrationInventoryService', () => {
  it('inventories router surfaces without changing runtime behavior', () => {
    const service = new AiFirstRouterMigrationInventoryService({
      now: () => new Date('2026-05-06T12:00:00.000Z'),
    });

    const snapshot = service.buildSnapshot();

    expect(snapshot.generatedAt).toBe('2026-05-06T12:00:00.000Z');
    expect(snapshot.summary.totalEntries).toBeGreaterThanOrEqual(20);
    expect(snapshot.summary.promoteAiFirst).toBeGreaterThan(5);
    expect(snapshot.summary.policyGuardrails).toBeGreaterThan(5);
    expect(snapshot.gates).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'checkpoint-0-no-runtime-change',
        status: 'passed',
      }),
      expect.objectContaining({
        id: 'checkpoint-0-policy-preserved',
        status: 'passed',
      }),
    ]));
  });

  it('keeps deterministic safety components as guardrails', () => {
    const service = new AiFirstRouterMigrationInventoryService();
    const snapshot = service.buildSnapshot();
    const byId = new Map(snapshot.entries.map((entry) => [entry.id, entry]));

    expect(byId.get('risk-classifier')?.migrationDecision).toBe('keep-policy-guardrail');
    expect(byId.get('shell-safety-classifier')?.migrationDecision).toBe('keep-policy-guardrail');
    expect(byId.get('tool-exposure-policy')?.migrationDecision).toBe('keep-policy-guardrail');
    expect(byId.get('universal-intent-service')?.migrationDecision).toBe('keep-policy-guardrail');
  });

  it('marks regex-heavy semantic routers for AI-first promotion or fallback', () => {
    const service = new AiFirstRouterMigrationInventoryService();
    const snapshot = service.buildSnapshot();
    const byId = new Map(snapshot.entries.map((entry) => [entry.id, entry]));

    expect(byId.get('intent-classifier')?.migrationDecision).toBe('promote-ai-first');
    expect(byId.get('natural-language-router')?.migrationDecision).toBe('promote-ai-first');
    expect(byId.get('natural-channel-setup-turn')?.migrationDecision).toBe('promote-ai-first');
    expect(byId.get('legacy-intent-router')?.migrationDecision).toBe('keep-fallback');
    expect(byId.get('telegram-command-parser')?.migrationDecision).toBe('compatibility-only');
  });

  it('documents current and target message paths', () => {
    const service = new AiFirstRouterMigrationInventoryService();
    const snapshot = service.buildSnapshot();

    expect(snapshot.currentDefaultMessagePath.map((step) => step.id)).toEqual([
      'surface-input',
      'surface-router',
      'intent-hints',
      'control-plane',
      'policy',
      'executor',
    ]);
    expect(snapshot.targetDefaultMessagePath.map((step) => step.id)).toEqual([
      'surface-input',
      'ai-first-plan',
      'normalization',
      'policy',
      'executor',
      'receipt',
    ]);
  });
});
