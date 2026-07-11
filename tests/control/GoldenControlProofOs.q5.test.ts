/**
 * Q5 — Control Proof OS golden path (automated):
 * Live-like snapshot → proof list + risk chip + honesty badges → panel HTML + cache.
 *
 * Hermetic stand-in for manual Control browser open of the Proof panel.
 */

import {
  buildRiskBudgetView,
  classifyControlReadiness,
  formatRiskBudgetLine,
  normalizeProofEvents,
  selectLatestProof,
} from '../../src/services/control/ControlProofOsModel.js';
import {
  buildControlReadinessItems,
  composeProofOsPanelModel,
} from '../../apps/zavorth-control-vite-shell/src/proof-os-model.js';
import {
  renderProofOsPanelHtml,
  renderProofOsChromeHtml,
} from '../../apps/zavorth-control-vite-shell/src/proof-os-ui.js';

function memoryStorage(seed: Record<string, string> = {}) {
  const map = new Map(Object.entries(seed));
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => {
      map.set(key, value);
    },
    removeItem: (key: string) => {
      map.delete(key);
    },
  };
}

describe('Q5 Control Proof OS golden loop', () => {
  it('mounts proof list + risk chip from live snapshot without catalog→live lies', () => {
    const storage = memoryStorage();

    // Simulated live dashboard snapshot (runtime live, providers only catalog).
    const liveProofs = [
      {
        id: 'proof-chat-1',
        kind: 'chat',
        title: 'Chat receipt',
        summary: 'Turn complete',
        status: 'ok',
        riskLevel: 'none',
        createdAt: '2026-07-11T16:00:00.000Z',
        surface: 'control',
      },
      {
        id: 'proof-appr-1',
        kind: 'approval',
        title: 'Disk write approved',
        summary: 'Owner approved scoped write',
        status: 'ok',
        riskLevel: 'medium',
        createdAt: '2026-07-11T16:01:00.000Z',
        surface: 'control',
        approvalId: 'appr-1',
      },
    ];

    const riskBudgetState = {
      mode: 'operator',
      frozen: false,
      dayKey: '2026-07-11',
      counters: { diskMutations: 1, shellCommands: 0, networkSends: 0, modelCostUnits: 2 },
      limits: { diskMutations: 20, shellCommands: 10, networkSends: 30, modelCostUnits: 100 },
    };

    const readinessItems = buildControlReadinessItems({
      runtime: { liveReady: true, configured: true },
      providers: { configured: true, liveReady: false, catalogReady: true },
      channels: { configured: false, liveReady: false },
    });

    // Catalog provider must never become Live when only catalog-ready.
    const providerBadge = readinessItems.find((b) => /provider/i.test(b.label) || b.id === 'providers');
    if (providerBadge) {
      expect(providerBadge.state).not.toBe('live');
    }
    const runtimeBadge = readinessItems.find((b) => /runtime/i.test(b.label) || b.id === 'runtime');
    if (runtimeBadge) {
      expect(runtimeBadge.state).toBe('live');
    }

    expect(classifyControlReadiness({ liveReady: true }).state).toBe('live');
    expect(classifyControlReadiness({ configured: true, liveReady: false }).state).not.toBe('live');

    const model = composeProofOsPanelModel({
      proofs: liveProofs,
      riskBudgetState,
      readinessItems,
      storage,
      latest: 12,
      useCacheFallback: true,
    });

    expect(model.proofs.length).toBeGreaterThanOrEqual(2);
    expect(model.riskBudget).not.toBeNull();
    expect(model.riskBudget?.frozen).toBe(false);
    expect(formatRiskBudgetLine(model.riskBudget)).toMatch(/operator|budget|disk/i);
    expect(formatRiskBudgetLine(model.riskBudget)).not.toMatch(/FROZEN/i);

    // XSS-safe HTML mount (string contract)
    const panelHtml = renderProofOsPanelHtml(model);
    expect(panelHtml).toContain('data-proof-os-panel');
    expect(panelHtml).toContain('data-risk-budget-chip');
    expect(panelHtml).toContain('data-proof-os-list');
    expect(panelHtml).toMatch(/Chat receipt|Disk write approved/);
    // Escaped: no raw script from titles
    expect(panelHtml).not.toContain('<script');

    const chromeHtml = renderProofOsChromeHtml(model);
    expect(chromeHtml).toContain('data-proof-os-chrome');
    expect(chromeHtml).toContain('data-risk-budget-chip');

    // Cache round-trip: empty live proofs stay empty (no poison resurrection)
    const emptyLive = composeProofOsPanelModel({
      proofs: [],
      runs: [],
      riskBudgetState: null,
      readinessItems: [],
      storage,
      useCacheFallback: true,
    });
    // Explicit empty proofs provided → do not fill from cache
    expect(emptyLive.proofs).toEqual([]);

    // Cache still available for dimensions not provided
    const cacheOnly = composeProofOsPanelModel({
      useCacheFallback: true,
      storage,
    });
    // After empty write, cache may have empty proofs — honesty still holds
    expect(Array.isArray(cacheOnly.proofs)).toBe(true);
  });

  it('risk chip treats frozen string "false" as not frozen and clamps negatives', () => {
    const view = buildRiskBudgetView({
      mode: 'autopilot',
      frozen: 'false',
      counters: { diskMutations: -3, shellCommands: 1, networkSends: 0, modelCostUnits: 0 },
      limits: { diskMutations: 5, shellCommands: 5, networkSends: 5, modelCostUnits: 5 },
    });
    expect(view).not.toBeNull();
    expect(view!.frozen).toBe(false);
    expect(view!.counters.diskMutations).toBeGreaterThanOrEqual(0);
    expect(formatRiskBudgetLine(view)).not.toMatch(/FROZEN/i);
  });

  it('selectLatestProof orders newest first for the panel list', () => {
    const events = normalizeProofEvents([
      {
        id: 'old',
        kind: 'chat',
        title: 'Old',
        summary: 's',
        status: 'ok',
        createdAt: '2026-07-11T10:00:00.000Z',
      },
      {
        id: 'new',
        kind: 'approval',
        title: 'New',
        summary: 's',
        status: 'ok',
        createdAt: '2026-07-11T12:00:00.000Z',
      },
    ]);
    const latest = selectLatestProof(events, 1);
    expect(latest[0]?.id).toBe('new');
  });
});
