import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  resolveConsensusPanel,
  writeConsensusProfile,
  readConsensusProfile,
} from '../../../src/services/ConsensusPanelResolver.js';

describe('ConsensusPanelResolver (user-owned)', () => {
  let root: string;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-consensus-'));
    fs.mkdirSync(path.join(root, 'data', 'runtime'), { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('does not invent product-default models when user has no stack', () => {
    const panel = resolveConsensusPanel({
      projectRoot: root,
      env: {} as NodeJS.ProcessEnv,
      strategy: 'auto',
      previewOnly: false,
      isProviderAvailable: () => true,
    });
    expect(panel.ok).toBe(false);
    expect(panel.reviewers).toEqual([]);
    expect(panel.reason).toMatch(/No consensus panel|Only one model/i);
    expect(panel.guidance.some((g) => /never invents/i.test(g))).toBe(true);
  });

  it('uses explicit reviewers from the user call', () => {
    const panel = resolveConsensusPanel({
      projectRoot: root,
      strategy: 'auto',
      explicitReviewers: [
        { provider: 'ollama', model: 'llama3.2' },
        { provider: 'deepseek', model: 'deepseek-chat' },
      ],
      explicitSynthesizer: { provider: 'ollama', model: 'llama3.2' },
      isProviderAvailable: () => true,
    });
    expect(panel.ok).toBe(true);
    expect(panel.strategy).toBe('explicit');
    expect(panel.reviewers).toHaveLength(2);
    expect(panel.reviewers[0].model).toBe('llama3.2');
    expect(panel.reviewers.some((r) => /gpt-4o/i.test(r.model))).toBe(false);
  });

  it('builds user_stack from preference primary+secondary+fallbacks', () => {
    fs.writeFileSync(
      path.join(root, 'data', 'runtime', 'provider-selection-preferences.json'),
      JSON.stringify({
        providerId: 'ollama',
        modelId: 'llama3.2',
        secondaryModelId: 'qwen2.5',
        fallbackProviderIds: ['deepseek:deepseek-chat'],
      }),
      'utf8',
    );

    const panel = resolveConsensusPanel({
      projectRoot: root,
      env: {} as NodeJS.ProcessEnv,
      strategy: 'user_stack',
      isProviderAvailable: () => true,
    });

    expect(panel.ok).toBe(true);
    expect(panel.strategy).toBe('user_stack');
    expect(panel.reviewers.length).toBeGreaterThanOrEqual(2);
    expect(panel.reviewers.map((r) => r.model).sort()).toEqual(
      expect.arrayContaining(['llama3.2', 'qwen2.5', 'deepseek-chat']),
    );
  });

  it('uses saved profile when strategy=profile', () => {
    writeConsensusProfile({
      enabled: true,
      defaultMode: 'fallback',
      reviewers: [
        { provider: 'xai', model: 'grok-2' },
        { provider: 'mistral', model: 'mistral-large-latest' },
      ],
      synthesizer: { provider: 'xai', model: 'grok-2' },
    }, root);

    const panel = resolveConsensusPanel({
      projectRoot: root,
      strategy: 'profile',
      isProviderAvailable: () => true,
    });
    expect(panel.ok).toBe(true);
    expect(panel.strategy).toBe('profile');
    expect(panel.modeDefault).toBe('fallback');
    expect(readConsensusProfile(root)?.reviewers).toHaveLength(2);
  });
});
