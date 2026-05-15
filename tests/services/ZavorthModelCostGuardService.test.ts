import { describe, expect, it } from '@jest/globals';
import { ZavorthModelCostGuardService } from '../../src/services/ZavorthModelCostGuardService';

describe('ZavorthModelCostGuardService', () => {
  it('keeps paid hosted model escalation approval-gated', () => {
    const snapshot = new ZavorthModelCostGuardService().buildContract({
      profile: 'personal',
      request: 'review this entire repository deeply with subagents',
    });

    expect(snapshot.surface).toBe('model-cost-guard');
    expect(snapshot.estimate.riskOfCostSurprise).toBe('high');
    expect(snapshot.routing.decision).toBe('ask_before_live');
    expect(snapshot.safety.paidEscalationRequiresApproval).toBe(true);
    expect(snapshot.safety.rawSecretsSerialized).toBe(false);
  });

  it('allows conservative preview/local work without paid spend', () => {
    const snapshot = new ZavorthModelCostGuardService().buildContract({
      profile: 'personal',
      autonomy: 'conservative',
      request: 'summarize this small note',
      provider: 'ollama',
    });

    expect(snapshot.autonomy).toBe('conservative');
    expect(snapshot.routing.recommendedTier).toBe('low');
    expect(snapshot.budget.effectiveMaxCents).toBe(0);
    expect(snapshot.routing.decision).toBe('ask_before_live');
    expect(snapshot.userFacingCopy.short).toContain('ask before');
  });

  it('treats unknown/custom pricing as approval-required instead of free', () => {
    const snapshot = new ZavorthModelCostGuardService().buildContract({
      profile: 'developer',
      request: 'fix a bug safely',
      provider: 'custom-openai-compatible',
      maxCents: 100,
    });

    const custom = snapshot.providerCards.find((card) => card.id === 'custom-openai-compatible');
    expect(custom?.tier).toBe('unknown');
    expect(custom?.liveUseNeedsApproval).toBe(true);
    expect(snapshot.safety.costLimitIsAdvisoryUntilProviderReportsUsage).toBe(true);
  });
});
