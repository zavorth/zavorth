import { describe, expect, it } from '@jest/globals';

import { ZavorthIntentDecisionService } from '../../src/services/ZavorthIntentDecisionService.js';

describe('ZavorthIntentDecisionService', () => {
  const service = new ZavorthIntentDecisionService({
    now: () => new Date('2026-06-02T12:00:00.000Z'),
  });

  it('routes natural configuration changes through the Action Harness', () => {
    const decision = service.decide({
      text: 'mude o skill governance para governed',
      channel: 'cli',
    });

    expect(decision.kind).toBe('zavorth_action');
    expect(decision.suggestedActionId).toBe('skills.governance.set');
    expect(decision.requiresPreview).toBe(true);
    expect(decision.requiresApproval).toBe(true);
  });

  it('routes broad repository work to scale planning without magic words', () => {
    const decision = service.decide({
      text: 'analise todo o repo e encontre gargalos arquiteturais em muitos arquivos',
      channel: 'web',
    });

    expect(decision.kind).toBe('swarm');
    expect(decision.backgroundAllowed).toBe(true);
    expect(decision.nextSurface).toBe('swarm-scale-plane');
  });

  it('keeps simple questions as direct responses', () => {
    const decision = service.decide({
      text: 'como esta o Zavorth agora?',
      channel: 'cli',
    });

    expect(decision.kind).toBe('direct_response');
    expect(decision.requiresApproval).toBe(false);
  });
});
