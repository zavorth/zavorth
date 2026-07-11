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

  it('projects code daily loop aligned with PE', () => {
    const snapshot = new ZavorthCodeDailyLoopService({ projectRoot: process.cwd(), env: {} }).buildSnapshot();
    expect(snapshot.alignsWithDailyPe).toBe(true);
    expect(snapshot.happyPath.steps).toHaveLength(4);
    expect(snapshot.surface).toBe('code');
  });
});
