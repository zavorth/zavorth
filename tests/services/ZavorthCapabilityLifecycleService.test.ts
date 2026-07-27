import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { ZavorthCapabilityLifecycleService } from '../../src/services/ZavorthCapabilityLifecycleService.js';
import type { ZavorthCapabilityUsageSignalsSnapshot } from '../../src/contracts/ZavorthCapabilityUsageSignalsContract.js';

describe('ZavorthCapabilityLifecycleService', () => {
  test('previews promote, archive and inspect decisions without writing the store', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-capability-lifecycle-test-'));
    const storeFile = path.join(tmp, 'lifecycle.json');
    const service = new ZavorthCapabilityLifecycleService({
      storeFile,
      now: () => new Date('2026-06-02T12:00:00.000Z'),
      usageSignals: { snapshot: () => usageSnapshot() },
    });

    const preview = service.preview();

    expect(preview.planned).toBe(3);
    expect(preview.decisions.map((decision) => decision.kind).sort()).toEqual(['archive', 'inspect', 'promote']);
    expect(preview.safety).toMatchObject({
      localOnly: true,
      noLiveActivation: true,
      noDeletion: true,
      approvalBoundaryPreserved: true,
    });
    expect(fs.existsSync(storeFile)).toBe(false);
  });

  test('blocks promote/archive without approval but still allows a later approved apply', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-capability-lifecycle-test-'));
    const service = new ZavorthCapabilityLifecycleService({
      storeFile: path.join(tmp, 'lifecycle.json'),
      usageSignals: { snapshot: () => usageSnapshot() },
    });

    const blocked = service.apply({ actor: 'operator' });

    expect(blocked.summary.decisions).toBe(3);
    expect(blocked.decisions.filter((decision) => decision.status === 'blocked')).toHaveLength(2);
    expect(blocked.decisions.find((decision) => decision.kind === 'inspect')?.status).toBe('applied');

    const applied = service.apply({ actor: 'operator', approvalId: 'approval:ok' });

    expect(applied.summary.promoted).toBe(1);
    expect(applied.summary.archived).toBe(1);
    expect(applied.summary.receipts).toBeGreaterThanOrEqual(5);
    expect(applied.safety).toMatchObject({
      usageSignalsOnly: true,
      noPromptContent: true,
      noSecrets: true,
      noNetworkUsed: true,
      noLiveActivation: true,
      noDeletion: true,
    });
  });

  test('is idempotent for applied lifecycle decisions', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-capability-lifecycle-test-'));
    const service = new ZavorthCapabilityLifecycleService({
      storeFile: path.join(tmp, 'lifecycle.json'),
      usageSignals: { snapshot: () => usageSnapshot() },
    });

    const first = service.apply({ approvalId: 'approval:ok' });
    const second = service.apply({ approvalId: 'approval:ok' });

    expect(first.summary.applied).toBe(3);
    expect(second.summary.applied).toBe(3);
    expect(second.preview.planned).toBe(0);
  });
});

function usageSnapshot(): ZavorthCapabilityUsageSignalsSnapshot {
  return {
    contractVersion: '2026-06-02.capability-usage-signals.v1',
    generatedAt: '2026-06-02T12:00:00.000Z',
    surface: 'capability-usage-signals',
    status: 'attention',
    storeFile: 'memory',
    summary: {
      actions: 3,
      events: 10,
      activeActions: 1,
      attentionActions: 1,
      promoteCandidates: 1,
      archiveCandidates: 1,
    },
    actions: [
      actionSummary('capability.candidate.fast-search', 'Fast search', 'promote_candidate', {
        shown: 1,
        previewed: 1,
        succeeded: 2,
      }),
      actionSummary('capability.candidate.stale-tool', 'Stale tool', 'archive_candidate', {
        abandoned: 2,
      }),
      actionSummary('capability.candidate.channel-send', 'Channel send', 'needs_attention', {
        failed: 1,
        blocked: 1,
      }),
    ],
    recentEvents: [],
    safety: {
      localOnly: true,
      noPromptContent: true,
      noSecrets: true,
      noNetworkUsed: true,
      aggregatedForPromotion: true,
    },
    commands: {
      list: 'zavorth actions usage',
      record: 'zavorth actions usage --record --action <action-id> --event previewed',
      json: 'zavorth actions usage --json',
      nextAction: 'Use local signals for capability lifecycle decisions.',
    },
  };
}

function actionSummary(
  actionId: string,
  title: string,
  recommendation: 'promote_candidate' | 'keep_learning' | 'needs_attention' | 'archive_candidate',
  counts: Partial<ZavorthCapabilityUsageSignalsSnapshot['actions'][number]['counters']>,
): ZavorthCapabilityUsageSignalsSnapshot['actions'][number] {
  const counters = {
    shown: 0,
    lookedUp: 0,
    previewed: 0,
    approved: 0,
    rejected: 0,
    applied: 0,
    succeeded: 0,
    failed: 0,
    blocked: 0,
    abandoned: 0,
    receiptRead: 0,
    ...counts,
  };
  return {
    actionId,
    capabilityId: actionId,
    title,
    status: recommendation === 'needs_attention' ? 'attention' : recommendation === 'promote_candidate' ? 'active' : 'quiet',
    counters,
    rates: {
      previewRate: counters.shown > 0 ? counters.previewed / counters.shown : 0,
      approvalRate: 1,
      successRate: counters.succeeded > 0 ? 1 : 0,
      abandonmentRate: counters.abandoned > 0 ? 1 : 0,
      blockRate: counters.blocked > 0 ? 1 : 0,
    },
    performance: {
      samples: counters.succeeded > 0 ? 2 : 0,
      p50Ms: counters.succeeded > 0 ? 120 : null,
      p95Ms: counters.succeeded > 0 ? 180 : null,
      maxMs: counters.succeeded > 0 ? 180 : null,
    },
    lastSeenAt: '2026-06-02T12:00:00.000Z',
    recommendation,
    nextSafeAction: 'test',
  };
}
