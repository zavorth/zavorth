import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  resolveUserProviderSelection,
  resolveUserChannelSelection,
  writeChannelPreference,
  requireConfiguredProviderName,
} from '../../../src/services/UserSelectionResolver.js';

describe('UserSelectionResolver', () => {
  const prev = { ...process.env };

  afterEach(() => {
    process.env = { ...prev };
  });

  it('never invents gemini or telegram when nothing is configured', () => {
    delete process.env.LLM_PROVIDER;
    delete process.env.ZAVORTH_PROVIDER;
    delete process.env.ZAVORTH_PRIMARY_CHANNEL;
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-sel-'));
    const provider = resolveUserProviderSelection({ projectRoot: dir, configProviderId: '' });
    const channel = resolveUserChannelSelection({ projectRoot: dir });
    expect(provider.configured).toBe(false);
    expect(provider.providerId).toBeNull();
    expect(channel.configured).toBe(false);
    expect(channel.channelId).toBeNull();
    expect(() => requireConfiguredProviderName({ projectRoot: dir, configProviderId: '' })).toThrow(/No provider selected/i);
  });

  it('honors env provider and preference channel without silent vendor fill-in', () => {
    process.env.LLM_PROVIDER = 'openrouter';
    process.env.ZAVORTH_MODEL_ID = 'openrouter/auto';
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-sel-'));
    const provider = resolveUserProviderSelection({ projectRoot: dir });
    expect(provider.providerId).toBe('openrouter');
    expect(provider.modelId).toBe('openrouter/auto');
    expect(provider.configured).toBe(true);

    writeChannelPreference('discord', dir);
    const channel = resolveUserChannelSelection({ projectRoot: dir });
    expect(channel.channelId).toBe('discord');
    expect(channel.source).toBe('preference');
  });

  it('prefers explicit request over env', () => {
    process.env.LLM_PROVIDER = 'openai';
    const selection = resolveUserProviderSelection({
      projectRoot: fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-sel-')),
      requestedProviderId: 'anthropic',
    });
    expect(selection.providerId).toBe('anthropic');
    expect(selection.source).toBe('request');
  });

  it('resolves an injected environment without reading ambient process state', () => {
    process.env.LLM_PROVIDER = 'gemini';
    const selection = resolveUserProviderSelection({
      projectRoot: fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-sel-')),
      env: {
        LLM_PROVIDER: 'anthropic',
        ZAVORTH_MODEL_ID: 'claude-test',
        ZAVORTH_PROVIDER_FALLBACK_ORDER: 'openai,openrouter',
      } as NodeJS.ProcessEnv,
    });

    expect(selection.providerId).toBe('anthropic');
    expect(selection.modelId).toBe('claude-test');
    expect(selection.fallbackProviderIds).toEqual(['openai', 'openrouter']);
    expect(selection.source).toBe('env');
  });
});
