import { describe, expect, it } from 'vitest';
import {
  appendReceipt,
  extractReceiptsFromSnapshot,
  loadReceipts,
  persistReceipts,
} from '../src/desktop-state/receiptsLedger';
import {
  classifyReadiness,
  readinessFromChannel,
  readinessFromProvider,
  readinessFromTool,
} from '../src/desktop-state/readiness';
import {
  isTelemetryOptIn,
  loadTelemetryEvents,
  setTelemetryOptIn,
  trackDesktopEvent,
} from '../src/desktop-state/localTelemetry';
import { buildDesktopUpdateStatus } from '../src/desktop-state/desktopUpdate';



function memoryStorage(seed: Record<string, string> = {}) {
  const map = new Map(Object.entries(seed));
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => {
      map.set(key, value);
    },
  };
}

describe('receipts ledger', () => {
  it('appends and persists receipts', () => {
    const store = memoryStorage();
    const next = appendReceipt([], {
      kind: 'approval',
      title: 'Approved host command',
      summary: 'User approved a scoped host command.',
      status: 'ok',
    }, store);
    expect(next).toHaveLength(1);
    expect(loadReceipts(store)[0].title).toContain('Approved');
    persistReceipts([], store);
    expect(loadReceipts(store)).toHaveLength(0);
  });

  it('fills empty titles on append so proof strip never gets blank chips', () => {
    const store = memoryStorage();
    const next = appendReceipt([], {
      kind: 'runtime',
      title: '   ',
      summary: '',
      status: 'ok',
    }, store);
    expect(next[0].title).toBe('Runtime proof');
    expect(next[0].summary).toBe('No details.');
  });

    it('extracts receipts from experience snapshot bags', () => {
    const receipts = extractReceiptsFromSnapshot({
      receipts: [{ receiptId: 'r1', title: 'Chat', status: 'ok', summary: 'Delivered' }],
      memory: { receipts: [{ id: 'r2', kind: 'memory', title: 'Forgot fact', status: 'applied' }] },
    });
    expect(receipts.length).toBeGreaterThanOrEqual(2);
  });
});

describe('readiness honesty', () => {
  it('classifies live, setup, available and blocked', () => {
    expect(classifyReadiness({ liveReady: true }).state).toBe('live');
    expect(classifyReadiness({ status: 'needs_setup' }).state).toBe('needs_setup');
    expect(classifyReadiness({ configured: true }).label).toMatch(/Available/i);
    expect(classifyReadiness({ configured: true }).state).not.toBe('live');
    expect(classifyReadiness({ blocked: true }).state).toBe('blocked');
  });

  it('never maps status-only available/ready to live', () => {
    expect(classifyReadiness({ status: 'available' }).state).toBe('available');
    expect(classifyReadiness({ status: 'ready' }).state).toBe('available');
    expect(classifyReadiness({ status: 'ok' }).state).toBe('available');
    expect(classifyReadiness({ status: 'healthy' }).state).toBe('available');
    expect(classifyReadiness({ status: 'active' }).state).toBe('available');
  });

  it('labels providers/channels/tools honestly', () => {
    // "configured" alone is not live-ready — catalog/setup honesty.
    expect(readinessFromProvider({ status: 'configured' }).state).toBe('needs_setup');
    expect(readinessFromProvider({ status: 'configured', connected: true }).state).toBe('live');
    // ready alone without connection is catalog, not live
    expect(readinessFromProvider({ status: 'ready', ready: true }).state).not.toBe('live');
    expect(readinessFromChannel({ liveReady: true }).state).toBe('live');
    expect(readinessFromChannel({ status: 'ready', liveReady: false }).state).not.toBe('live');
    expect(readinessFromTool({ status: 'blocked', risk: 'high' }).state).toBe('blocked');
    expect(readinessFromTool({ status: 'catalog' }).detail || '').toMatch(/not the same as live/i);
    // tool status "ready" without liveReady is muted available, not live
    expect(readinessFromTool({ status: 'ready' }).state).toBe('available');
    expect(readinessFromTool({ status: 'ready', liveReady: true }).state).toBe('live');
  });
});

describe('local telemetry', () => {
  it('only records when opted in and redacts secrets', () => {
    const store = memoryStorage();
    setTelemetryOptIn(false, store as Storage);
    expect(trackDesktopEvent('panel_open', { panel: 'chat' }, store as Storage)).toBeNull();
    setTelemetryOptIn(true, store as Storage);
    expect(isTelemetryOptIn(store as Storage)).toBe(true);
    trackDesktopEvent('panel_open', { panel: 'receipts', token: 'secret-value', prompt: 'hello' }, store as Storage);
    const events = loadTelemetryEvents(store as Storage);
    expect(events[0].name).toBe('panel_open');
    expect(events[0].props?.token).toBeUndefined();
    expect(events[0].props?.prompt).toBeUndefined();
    expect(events[0].props?.panel).toBe('receipts');
  });
});

describe('update status builder', () => {
  it('marks available GitHub updates and explicit unconfigured override', () => {
    const available = buildDesktopUpdateStatus({
      currentVersion: '0.1.0',
      latestVersion: '0.2.0',
      providerConfigured: true,
      source: 'github',
    });
    expect(available.state).toBe('available');
    expect(available.canOpenGithub).toBe(true);

    // Default channel is GitHub; only source=none + providerConfigured=false is pure manual.
    const unconfigured = buildDesktopUpdateStatus({
      currentVersion: '0.1.0',
      providerConfigured: false,
      source: 'none',
    });
    expect(unconfigured.state).toBe('unconfigured');
  });
});
