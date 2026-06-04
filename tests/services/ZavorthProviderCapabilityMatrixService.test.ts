import { describe, expect, it } from '@jest/globals';
import { ZavorthProviderCapabilityMatrixService } from '../../src/services/ZavorthProviderCapabilityMatrixService.js';

describe('ZavorthProviderCapabilityMatrixService', () => {
  it('exposes a canonical provider matrix with route state, proof commands and modalities', () => {
    const snapshot = new ZavorthProviderCapabilityMatrixService({
      now: () => new Date('2026-06-03T12:00:00.000Z'),
      env: {
        OPENAI_API_KEY: 'sk-redacted-test',
        COMFY_BASE_URL: 'http://127.0.0.1:8188',
      },
    }).buildSnapshot();

    expect(snapshot.surface).toBe('provider-capability-matrix');
    expect(snapshot.status).toBe('ready');
    expect(snapshot.summary.total).toBeGreaterThanOrEqual(50);
    expect(snapshot.summary.configured).toBeGreaterThanOrEqual(2);
    expect(snapshot.summary.credentialRequired).toBeGreaterThan(0);
    expect(snapshot.summary.doctorAvailable).toBe(snapshot.summary.total);
    expect(snapshot.summary.canaryAvailable).toBe(snapshot.summary.total);
    expect(snapshot.safety).toMatchObject({
      readOnlyInventory: true,
      noSecretsSerialized: true,
      liveProofRequiresExplicitCommand: true,
      compatibleDoesNotMeanDefaultEnabled: true,
    });

    const openai = snapshot.providers.find((provider) => provider.id === 'openai');
    expect(openai).toEqual(expect.objectContaining({
      id: 'openai',
      state: 'configured',
      modalities: expect.arrayContaining(['llm-chat', 'image', 'video', 'tts', 'transcription', 'embedding']),
      doctor: expect.objectContaining({ available: true }),
      canary: expect.objectContaining({ available: true }),
    }));
    expect(openai?.envRefs).toContain('OPENAI_API_KEY');
    expect(JSON.stringify(openai)).not.toContain('sk-redacted-test');

    const runway = snapshot.providers.find((provider) => provider.id === 'runway');
    expect(runway).toEqual(expect.objectContaining({
      id: 'runway',
      state: 'needs-credential',
      modalities: expect.arrayContaining(['video']),
    }));
  });

  it('filters by query and keeps enough context for LLM discovery', () => {
    const service = new ZavorthProviderCapabilityMatrixService({
      now: () => new Date('2026-06-03T12:00:00.000Z'),
    });
    const snapshot = service.buildSnapshot({ query: 'video runway' });

    expect(snapshot.providers.map((provider) => provider.id)).toContain('runway');
    expect(snapshot.llmContextBlock).toContain('Provider Capability Matrix');
    expect(snapshot.llmContextBlock).toContain('Do not infer provider coverage from src/providers only');
  });
});
