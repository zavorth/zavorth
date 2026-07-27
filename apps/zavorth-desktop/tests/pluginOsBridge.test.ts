import { describe, it, expect } from 'vitest';
import {
  mapPluginOsSnapshotToPanelData,
  summarizePluginOsPlane,
  mapPluginEntry,
  humanPluginStatus,
  humanPluginStatusLabel,
  humanTrustLabel,
  humanPluginStatusLine,
  friendlyMetricsLabelField,
  DEFAULT_HUMAN_PLUGIN_STATUS_LABELS,
} from '../src/desktop-state/pluginOsBridge';

describe('pluginOsBridge', () => {
  it('maps control plane snapshot to panel data', () => {
    const data = mapPluginOsSnapshotToPanelData({
      generatedAt: '2026-01-01T00:00:00.000Z',
      root: '/tmp/root',
      plugins: [
        {
          pluginId: 'session-scratch-janitor',
          installed: true,
          enabled: true,
          trust: 'trusted',
          runtimeState: 'enabled',
          loadEligible: true,
          findings: ['ok'],
        },
        {
          id: 'other',
          installed: true,
          enabled: false,
          trust: 'blocked',
          runtimeState: 'blocked',
        },
      ],
      discovery: { total: 2, valid: 2, loadEligible: 1, selected: 1 },
      commands: ['list', 'install'],
    });

    expect(data.plugins).toHaveLength(2);
    expect(data.plugins[0].pluginId).toBe('session-scratch-janitor');
    expect(data.plugins[0].findings).toEqual(['ok']);
    expect(data.plugins[1].pluginId).toBe('other');
    expect(data.discovery?.loadEligible).toBe(1);
    expect(data.commands).toContain('list');
    expect(data.marketplace).toEqual([]);
    expect(data.metrics).toBeNull();

    const summary = summarizePluginOsPlane(data);
    expect(summary.installed).toBe(2);
    expect(summary.enabled).toBe(1);
    expect(summary.blocked).toBe(1);
  });

  it('maps marketplace and metrics for plugin operations', () => {
    const data = mapPluginOsSnapshotToPanelData({
      generatedAt: '2026-01-02T00:00:00.000Z',
      root: '/tmp/root',
      plugins: [],
      discovery: { total: 3, valid: 3, loadEligible: 2, selected: 3 },
      curatedMarketplace: [
        {
          id: 'web-search',
          name: 'Web Search',
          tier: 'first-party',
          enabled: true,
          installed: true,
          enableHint: 'zavorth plugins enable web-search --yes',
        },
      ],
      metrics: {
        health: 'healthy',
        funnel: { discovered: 3, loadEligible: 2, enabled: 1 },
        marketplace: { firstPartyEnabled: 1, firstPartyTotal: 2 },
        mcp: { serversConfigured: 2, serversEnabled: 0 },
        receipts: { forgeReceiptFiles: 4 },
        hotFindings: [{ pluginId: 'x' }],
        deepLinks: ['zavorth plugins metrics'],
      },
      deepLinks: ['GET /api/plugin-os/metrics'],
    });

    expect(data.marketplace).toHaveLength(1);
    expect(data.marketplace[0].id).toBe('web-search');
    expect(data.metrics?.health).toBe('healthy');
    expect(data.metrics?.firstPartyTotal).toBe(2);
    expect(data.metrics?.forgeReceipts).toBe(4);
    expect(data.deepLinks).toContain('GET /api/plugin-os/metrics');
    expect(summarizePluginOsPlane(data).health).toBe('healthy');
  });

  it('handles null snapshot safely', () => {
    const data = mapPluginOsSnapshotToPanelData(null);
    expect(data.plugins).toEqual([]);
    expect(data.discovery).toBeNull();
    expect(data.marketplace).toEqual([]);
    expect(data.metrics).toBeNull();
  });

  it('mapPluginEntry ignores empty ids', () => {
    expect(mapPluginEntry({})).toBeNull();
    expect(mapPluginEntry({ pluginId: 'x', installed: true, enabled: false, trust: 'review', runtimeState: 'installed' })?.pluginId).toBe('x');
  });

  it('humanPluginStatus maps Active / Available / Needs setup / Blocked', () => {
    expect(humanPluginStatus({
      enabled: true, installed: true, trust: 'trusted', runtimeState: 'enabled',
    })).toBe('active');
    expect(humanPluginStatus({
      enabled: false, installed: false, trust: 'trusted', runtimeState: 'available',
    })).toBe('available');
    expect(humanPluginStatus({
      enabled: false, installed: true, trust: 'review', runtimeState: 'installed', loadEligible: false,
    })).toBe('needs_setup');
    expect(humanPluginStatus({
      enabled: false, installed: true, trust: 'blocked', runtimeState: 'blocked',
    })).toBe('blocked');
  });

  it('humanTrustLabel maps review/trusted/blocked without jargon', () => {
    expect(humanTrustLabel('review')).toBe('Needs review');
    expect(humanTrustLabel('trusted')).toBe('Trusted');
    expect(humanTrustLabel('blocked')).toBe('Blocked');
    expect(humanTrustLabel('review', { review: 'Precisa de revisão' })).toBe('Precisa de revisão');
  });

  it('humanPluginStatusLabel and status line use friendly copy', () => {
    expect(humanPluginStatusLabel('needs_setup')).toBe(DEFAULT_HUMAN_PLUGIN_STATUS_LABELS.needs_setup);
    expect(humanPluginStatusLabel('active', { active: 'Ativo' })).toBe('Ativo');
    const line = humanPluginStatusLine({
      enabled: true, installed: true, trust: 'trusted', runtimeState: 'enabled',
    });
    expect(line).toContain('Trusted');
    expect(line).toContain('Active');
    expect(line.toLowerCase()).not.toContain('loadeligible');
  });

  it('friendlyMetricsLabelField maps funnel jargon to coverage', () => {
    expect(friendlyMetricsLabelField('funnel')).toBe('coverage');
    expect(friendlyMetricsLabelField('coverage')).toBe('coverage');
    expect(friendlyMetricsLabelField('readyToLoad')).toBe('eligible');
    expect(friendlyMetricsLabelField('health')).toBe('health');
  });
});
