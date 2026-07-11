import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  resolveUserProviderSelection,
  resolveUserChannelSelection,
  writeChannelPreference,
  writeProviderPreference,
  resolveUserSelectionBundle,
} from '../../../src/services/UserSelectionResolver.js';
import {
  listUserSelectionChannels,
  listUserSelectionProviders,
  onboardingProviderToRuntimeId,
} from '../../../src/services/selection/UserSelectionCatalog.js';
import { DailyReturnContinuityService } from '../../../src/services/DailyReturnContinuityService.js';
import { KillerMissionExecuteService } from '../../../src/services/KillerMissionExecuteService.js';
import { ZavorthCodeDailyLoopService } from '../../../src/services/ZavorthCodeDailyLoopService.js';

describe('V9 user selection write path', () => {
  it('writes provider + secondary + channel and resolver reads them back', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-sel-write-'));
    const provider = writeProviderPreference({
      projectRoot: dir,
      providerId: 'openai',
      modelId: 'gpt-4o-mini',
      secondaryModelId: 'gpt-4o',
    });
    expect(provider.configured).toBe(true);
    expect(provider.providerId).toBe('openai');
    expect(provider.secondaryModelId).toBe('gpt-4o');

    const channel = writeChannelPreference('discord', dir);
    expect(channel.channelId).toBe('discord');

    const resolved = resolveUserProviderSelection({ projectRoot: dir, env: {} });
    expect(resolved.providerId).toBe('openai');
    expect(resolved.modelId).toBe('gpt-4o-mini');
    expect(resolved.secondaryModelId).toBe('gpt-4o');
    expect(resolveUserChannelSelection({ projectRoot: dir, env: {} }).channelId).toBe('discord');

    const bundle = resolveUserSelectionBundle({ projectRoot: dir, env: {} });
    expect(bundle.provider.providerId).toBe('openai');
    expect(bundle.channel.channelId).toBe('discord');
  });

  it('keeps a single catalog for providers and channels', () => {
    const providers = listUserSelectionProviders();
    const channels = listUserSelectionChannels();
    expect(providers.length).toBeGreaterThanOrEqual(5);
    expect(channels.some((entry) => entry.id === 'desktop')).toBe(true);
    expect(onboardingProviderToRuntimeId('google')).toBe('gemini');
    expect(providers.every((entry) => entry.id && entry.label)).toBe(true);
  });

  it('clears primary modelId when explicitly set to null', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-sel-clear-'));
    writeProviderPreference({
      projectRoot: dir,
      providerId: 'openai',
      modelId: 'gpt-4o-mini',
      secondaryModelId: 'gpt-4o',
    });
    writeProviderPreference({
      projectRoot: dir,
      providerId: 'openai',
      modelId: null,
      secondaryModelId: null,
    });
    const resolved = resolveUserProviderSelection({ projectRoot: dir, env: {} });
    expect(resolved.providerId).toBe('openai');
    expect(resolved.modelId).toBeNull();
    expect(resolved.secondaryModelId).toBeNull();
  });

  it('preserves receipt metadata when direct write merges over governed preference', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-sel-merge-'));
    const file = path.join(dir, 'data', 'runtime', 'provider-selection-preferences.json');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify({
      providerId: 'openai',
      modelId: 'gpt-4o',
      secondaryModelId: null,
      routeId: 'openai',
      familyId: 'openai',
      source: 'provider-selection-ux',
      updatedAt: '2026-07-01T00:00:00.000Z',
      receiptId: 'receipt-test-1',
    }, null, 2));
    writeProviderPreference({
      projectRoot: dir,
      providerId: 'anthropic',
      modelId: 'claude-sonnet',
    });
    const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
    expect(raw.providerId).toBe('anthropic');
    expect(raw.receiptId).toBe('receipt-test-1');
    expect(raw.source).toBe('provider-selection-ux');
  });
});

describe('V11 continuity ritual pending tasks', () => {
  it('surfaces one primary next action from pending tasks', () => {
    const snapshot = new DailyReturnContinuityService().buildSnapshot({
      providerReady: true,
      pendingApprovals: 0,
      pendingTasks: ['Finish weekly report draft', 'Check calendar'],
      sessions: [{ id: 's1', title: 'Yesterday', updatedAt: '2026-07-10T20:00:00.000Z' }],
      previousOpenAt: '2026-07-10T09:00:00.000Z',
      currentOpenAt: '2026-07-11T10:00:00.000Z',
    });
    expect(snapshot.pendingTasks[0]).toBe('Finish weekly report draft');
    expect(snapshot.nextAction.kind).toBe('resume-task');
    expect(snapshot.nextAction.title).toBe('Finish weekly report draft');
  });
});

describe('V11 killer execute + code loop', () => {
  it('skips killer execute without --live', async () => {
    const report = await new KillerMissionExecuteService({
      projectRoot: process.cwd(),
      env: {},
    }).run({ live: false, audience: 'developer' });
    expect(report.liveRequested).toBe(false);
    expect(report.receipts.every((entry) => entry.status === 'skipped')).toBe(true);
    expect(report.ok).toBe(true);
  });

  it('does not treat all-blocked live killer runs as ok', async () => {
    const report = await new KillerMissionExecuteService({
      projectRoot: process.cwd(),
      env: {} as NodeJS.ProcessEnv,
    }).run({ live: true, audience: 'personal' });
    expect(report.liveRequested).toBe(true);
    expect(report.executed).toBe(0);
    expect(report.ok).toBe(false);
    expect(report.receipts.every((entry) => entry.status === 'blocked' || entry.status === 'skipped')).toBe(true);
  });

  it('projects code daily loop aligned with PE structure without auto-completing ask/review', () => {
    const snapshot = new ZavorthCodeDailyLoopService({ projectRoot: process.cwd(), env: {} }).buildSnapshot();
    expect(snapshot.alignsWithDailyPe).toBe(true);
    expect(snapshot.happyPath.steps).toHaveLength(4);
    expect(snapshot.surface).toBe('code');
    expect(snapshot.peAligned.chatReady).toBe(snapshot.chatReady);
    expect(snapshot.peAligned.happyPathSteps).toBe(4);
    expect(snapshot.happyPath.steps.find((s) => s.id === 'first-ask')?.done).toBe(false);
    expect(snapshot.happyPath.steps.find((s) => s.id === 'review')?.done).toBe(false);
  });

  it('executes killer live path with injected runtime (no network)', async () => {
    const report = await new KillerMissionExecuteService({
      projectRoot: process.cwd(),
      env: { LLM_PROVIDER: 'openai' } as NodeJS.ProcessEnv,
      runtimeFactory: () => ({
        chatDetailed: async () => ({
          providerName: 'openai',
          modelName: 'gpt-test',
          response: {
            content: 'Today plan: 1) review inbox action 2) write notes 3) approval only if sending email.',
            toolCalls: [],
            finishReason: 'stop',
          },
          route: {
            source: 'test',
            requestedProviderName: 'openai',
            primaryProviderName: 'openai',
            providerName: 'openai',
            modelName: 'gpt-test',
            fallbackAllowed: false,
            fallbackUsed: false,
            providerChain: ['openai'],
            attempts: [],
            request: { messageCount: 1, toolCount: 0, inputChars: 10 },
          },
        } as any),
      }),
    }).run({ live: true, audience: 'personal' });
    expect(report.liveRequested).toBe(true);
    expect(report.executed).toBe(1);
    expect(report.ok).toBe(true);
    expect(report.receipts[0]?.status).toBe('pass');
  });
});
