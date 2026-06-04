import { ZavorthAdaptiveSemanticClassifierService } from '../../src/services/ZavorthAdaptiveSemanticClassifierService.js';
import type { ZavorthAdaptiveSemanticLlmGate } from '../../src/contracts/ZavorthAdaptiveLearningSemanticContract.js';

describe('ZavorthAdaptiveSemanticClassifierService', () => {
  it('uses an LLM gate for unknown-language sensitivity and returns governed provider classification', async () => {
    const llmGate: ZavorthAdaptiveSemanticLlmGate = {
      classify: jest.fn(async () => JSON.stringify({
        language: 'ka',
        recommendedLane: 'red',
        sensitivity: 'sensitive',
        risk: 'medium',
        confidence: 0.93,
        reasons: ['semantic-sensitive-user-state'],
        usedFor: ['safety_only'],
        claim: 'Sensitive user-state inference detected by the LLM gate.',
      })),
    };
    const service = new ZavorthAdaptiveSemanticClassifierService({ llmGate });

    const classification = await service.classify({
      text: '\u10db\u10dd\u10db\u10ee\u10db\u10d0\u10e0\u10d4\u10d1\u10d4\u10da\u10d8 \u10eb\u10d0\u10da\u10d8\u10d0\u10dc \u10db\u10dd\u10ec\u10e7\u10da\u10d5\u10d0\u10d3\u10d8\u10d0',
      redactedText: '\u10db\u10dd\u10db\u10ee\u10db\u10d0\u10e0\u10d4\u10d1\u10d4\u10da\u10d8 \u10eb\u10d0\u10da\u10d8\u10d0\u10dc \u10db\u10dd\u10ec\u10e7\u10da\u10d5\u10d0\u10d3\u10d8\u10d0',
      technicalFindings: [],
      sourceSurface: 'test',
    });
    const gateInput = (llmGate.classify as jest.Mock).mock.calls[0][0];

    expect(llmGate.classify).toHaveBeenCalledTimes(1);
    expect(gateInput.redactedText).not.toContain('token=');
    expect(gateInput.responseSchema).toContain('"recommendedLane":"green|yellow|red"');
    expect(gateInput.systemPrompt).toContain('Return only valid JSON');
    expect(classification).toEqual(expect.objectContaining({
      provider: 'semantic-provider',
      language: 'ka',
      recommendedLane: 'red',
      sensitivity: 'sensitive',
      risk: 'medium',
      confidence: 0.93,
    }));
    expect(classification.usedFor).toEqual(['safety_only']);
    expect(classification.evidence).toEqual(expect.arrayContaining(['semantic-provider:llm-gated-json']));
  });

  it('does not call the LLM gate for high-confidence local low-risk preferences', async () => {
    const llmGate: ZavorthAdaptiveSemanticLlmGate = {
      classify: jest.fn(async () => JSON.stringify({
        language: 'en',
        recommendedLane: 'red',
        sensitivity: 'sensitive',
        risk: 'medium',
        confidence: 0.99,
      })),
    };
    const service = new ZavorthAdaptiveSemanticClassifierService({ llmGate });

    const classification = await service.classify({
      text: 'The user prefers direct Portuguese answers with evidence and concise tradeoffs.',
      redactedText: 'The user prefers direct Portuguese answers with evidence and concise tradeoffs.',
      technicalFindings: [],
      sourceSurface: 'test',
    });

    expect(llmGate.classify).not.toHaveBeenCalled();
    expect(classification.provider).toBe('local-heuristic');
    expect(classification.recommendedLane).toBe('green');
  });

  it('downgrades weak LLM Green Lane responses to Yellow digest review', async () => {
    const llmGate: ZavorthAdaptiveSemanticLlmGate = {
      classify: jest.fn(async () => JSON.stringify({
        language: 'mn',
        recommendedLane: 'green',
        sensitivity: 'normal',
        risk: 'low',
        confidence: 0.52,
        reasons: ['weak-green'],
        usedFor: ['response_style'],
        claim: 'The user might prefer short answers.',
      })),
    };
    const service = new ZavorthAdaptiveSemanticClassifierService({ llmGate });

    const classification = await service.classify({
      text: '\u0442\u043e\u0432\u0447 \u0445\u0430\u0440\u0438\u0443\u043b\u0442 \u0445\u04af\u0441\u044d\u0436 \u0431\u0430\u0439\u043d\u0430',
      redactedText: '\u0442\u043e\u0432\u0447 \u0445\u0430\u0440\u0438\u0443\u043b\u0442 \u0445\u04af\u0441\u044d\u0436 \u0431\u0430\u0439\u043d\u0430',
      technicalFindings: [],
      sourceSurface: 'test',
    });

    expect(classification.provider).toBe('semantic-provider');
    expect(classification.recommendedLane).toBe('yellow');
    expect(classification.sensitivity).toBe('normal');
    expect(classification.reasons).toEqual(expect.arrayContaining(['semantic-provider-low-confidence-staged']));
  });
});
