import { describe, expect, it } from '@jest/globals';

import { ZavorthIntentDecisionService } from '../../src/services/ZavorthIntentDecisionService.js';

describe('ZavorthIntentDecisionService', () => {
  const service = new ZavorthIntentDecisionService({
    now: () => new Date('2026-06-02T12:00:00.000Z'),
  });

  it('never keyword-routes free text into product surfaces', () => {
    const samples = [
      'mude o skill governance para governed',
      'analise todo o repo e encontre gargalos arquiteturais em muitos files',
      'aprove a tarefa pendente',
      'remember in project memory',
      'rode npm install no sandbox',
      'envie no telegram',
    ];
    for (const text of samples) {
      const decision = service.decide({ text, channel: 'cli' });
      expect(decision.kind).toBe('direct_response');
      expect(decision.nextSurface).toBe('llm');
      expect(decision.requiresApproval).toBe(false);
    }
  });

  it('accepts structured kind for Action Harness without free-text scanning', () => {
    const decision = service.decide({
      text: 'apply governance change',
      channel: 'cli',
      kind: 'zavorth_action',
      metadata: { suggestedActionId: 'skills.governance.set' },
    });

    expect(decision.kind).toBe('zavorth_action');
    expect(decision.suggestedActionId).toBe('skills.governance.set');
    expect(decision.requiresPreview).toBe(true);
    expect(decision.requiresApproval).toBe(true);
    expect(decision.nextSurface).toBe('action-harness');
  });

  it('accepts structured swarm kind without magic words', () => {
    const decision = service.decide({
      text: 'large audit request payload for tools',
      channel: 'web',
      kind: 'swarm',
    });

    expect(decision.kind).toBe('swarm');
    expect(decision.backgroundAllowed).toBe(true);
    expect(decision.nextSurface).toBe('swarm-scale-plane');
  });

  it('keeps simple questions as direct responses', () => {
    const decision = service.decide({
      text: 'como esta o Zavorth agora-',
      channel: 'cli',
    });

    expect(decision.kind).toBe('direct_response');
    expect(decision.requiresApproval).toBe(false);
  });
});
