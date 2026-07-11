/**
 * Control Proof OS pure model — honesty + formatting unit tests.
 * Source: src/services/control/ControlProofOsModel.ts
 * (Control shell re-exports via apps/zavorth-control-vite-shell/src/proof-os-model.ts)
 */

import {
  buildRiskBudgetView,
  classifyControlReadiness,
  formatProofLine,
  formatRiskBudgetLine,
  normalizeProofEvents,
  parseProofOsCache,
  readHonestBoolean,
  sanitizeCachedReadinessBadge,
  selectLatestProof,
  serializeProofOsCache,
} from '../../src/services/control/ControlProofOsModel';

import {
  composeProofOsPanelModel,
  buildControlReadinessItems,
  CONTROL_PROOF_OS_CACHE_KEY,
} from '../../apps/zavorth-control-vite-shell/src/proof-os-model';

function memoryStorage(seed: Record<string, string> = {}) {
  const map = new Map(Object.entries(seed));
  return {
    getItem(key: string) {
      return map.has(key) ? map.get(key)! : null;
    },
    setItem(key: string, value: string) {
      map.set(key, value);
    },
    dump() {
      return Object.fromEntries(map.entries());
    },
  };
}

describe('ControlProofOsModel', () => {
  describe('classifyControlReadiness', () => {
    it('never maps catalog-only to live', () => {
      const badge = classifyControlReadiness({ catalogReady: true, liveReady: false });
      expect(badge.state).toBe('catalog');
      expect(badge.label).toBe('Catalog only');
      expect(badge.state).not.toBe('live');
    });

    it('returns live only when liveReady is explicit boolean true', () => {
      const live = classifyControlReadiness({ liveReady: true, catalogReady: true });
      expect(live.state).toBe('live');
      expect(live.label).toBe('Live');

      // Truthy non-booleans must not grant live (live snapshot data poison).
      expect(classifyControlReadiness({ liveReady: 'true' as unknown as boolean }).state).not.toBe('live');
      expect(classifyControlReadiness({ liveReady: 1 as unknown as boolean }).state).not.toBe('live');
    });

    it('keeps catalog under a live-bridge style dual signal', () => {
      // Runtime may be live while providers remain catalog-only.
      const runtime = classifyControlReadiness({ liveReady: true });
      const provider = classifyControlReadiness({ catalogReady: true, liveReady: false });
      expect(runtime.state).toBe('live');
      expect(provider.state).toBe('catalog');
      expect(provider.label).toBe('Catalog only');
    });

    it('returns blocked before live or catalog', () => {
      const badge = classifyControlReadiness({
        blocked: true,
        liveReady: true,
        catalogReady: true,
      });
      expect(badge.state).toBe('blocked');
      expect(badge.label).toBe('Blocked');
    });

    it('returns needs_setup when not configured / not live', () => {
      const badge = classifyControlReadiness({ configured: false, liveReady: false });
      expect(badge.state).toBe('needs_setup');
      expect(badge.label).toBe('Needs setup');
    });

    it('treats configured-without-live as catalog honesty, not live', () => {
      const badge = classifyControlReadiness({ configured: true, liveReady: false });
      expect(badge.state).toBe('catalog');
      expect(badge.label).toBe('Catalog only');
    });

    it('returns unknown when no signals', () => {
      const badge = classifyControlReadiness({});
      expect(badge.state).toBe('unknown');
    });
  });

  describe('normalizeProofEvents + selectLatestProof + formatProofLine', () => {
    it('normalizes raw events and selects newest first', () => {
      const events = normalizeProofEvents([
        {
          id: 'a',
          kind: 'approval',
          title: 'Allow shell',
          summary: 'npm test',
          status: 'pending',
          createdAt: '2026-07-11T10:00:00.000Z',
          source: 'test',
          surface: 'control',
        },
        {
          id: 'b',
          kind: 'runtime',
          title: 'Run finished',
          summary: 'ok',
          status: 'ok',
          createdAt: '2026-07-11T12:00:00.000Z',
          source: 'test',
          surface: 'control',
        },
        { id: '', title: 'drop-me' },
      ]);

      expect(events).toHaveLength(2);
      const latest = selectLatestProof(events, 1);
      expect(latest).toHaveLength(1);
      expect(latest[0].id).toBe('b');

      const line = formatProofLine(latest[0]);
      expect(line).toContain('ok');
      expect(line).toContain('runtime');
      expect(line).toContain('Run finished');
    });

    it('maps receipt-like rows with at timestamps', () => {
      const events = normalizeProofEvents([
        {
          id: 'rcpt-1',
          kind: 'chat',
          title: 'Said hello',
          summary: 'hi',
          status: 'success',
          at: '2026-07-11T08:00:00.000Z',
          source: 'desktop',
        },
      ]);
      expect(events[0].status).toBe('ok');
      expect(events[0].createdAt).toBe('2026-07-11T08:00:00.000Z');
    });

    it('drops invalid artifacts without throwing', () => {
      const events = normalizeProofEvents([
        {
          id: 'art-1',
          title: 'With junk artifacts',
          status: 'ok',
          createdAt: '2026-07-11T09:00:00.000Z',
          artifacts: [{ id: 'good', type: 'file', label: 'a' }, null, { id: '' }, 'nope'],
        },
      ]);
      expect(events[0].artifacts).toEqual([{ id: 'good', type: 'file', label: 'a' }]);
    });
  });

  describe('risk budget view honesty', () => {
    it('builds and formats a status line', () => {
      const view = buildRiskBudgetView({
        mode: 'operator',
        dayKey: '2026-07-11',
        frozen: false,
        counters: { diskMutations: 3, shellCommands: 1, networkSends: 0, modelCostUnits: 10 },
        limits: { diskMutations: 50, shellCommands: 30, networkSends: 40, modelCostUnits: 1000 },
      });
      expect(view).not.toBeNull();
      expect(view!.modeLabel).toBe('Operator');
      const line = formatRiskBudgetLine(view);
      expect(line).toContain('Operator');
      expect(line).toContain('disk 3/50');
      expect(line).toContain('shell 1/30');
      expect(line).not.toContain('FROZEN');
    });

    it('marks frozen budgets', () => {
      const view = buildRiskBudgetView({
        mode: 'autopilot',
        dayKey: '2026-07-11',
        frozen: true,
        counters: { diskMutations: 10, shellCommands: 5, networkSends: 15, modelCostUnits: 200 },
        limits: { diskMutations: 10, shellCommands: 5, networkSends: 15, modelCostUnits: 200 },
      });
      expect(formatRiskBudgetLine(view)).toContain('FROZEN');
    });

    it('does not treat string "false" as frozen', () => {
      const view = buildRiskBudgetView({
        mode: 'operator',
        dayKey: '2026-07-11',
        frozen: 'false',
        counters: { diskMutations: 1, shellCommands: 0, networkSends: 0, modelCostUnits: 0 },
        limits: { diskMutations: 10, shellCommands: 10, networkSends: 10, modelCostUnits: 10 },
      });
      expect(view!.frozen).toBe(false);
      expect(formatRiskBudgetLine(view)).not.toContain('FROZEN');
    });

    it('clamps negative counters for chip honesty', () => {
      const view = buildRiskBudgetView({
        mode: 'observer',
        counters: { diskMutations: -3, shellCommands: -1, networkSends: 2 },
        limits: { diskMutations: 10, shellCommands: 10, networkSends: 10 },
      });
      expect(view!.counters.diskMutations).toBe(0);
      expect(view!.counters.shellCommands).toBe(0);
      expect(formatRiskBudgetLine(view)).toContain('disk 0/10');
    });

    it('returns null for empty state-like input', () => {
      expect(buildRiskBudgetView(null)).toBeNull();
      expect(buildRiskBudgetView({})).toBeNull();
      expect(formatRiskBudgetLine(null)).toBe('Risk budget · unavailable');
    });

    it('readHonestBoolean treats common string forms', () => {
      expect(readHonestBoolean('false')).toBe(false);
      expect(readHonestBoolean('true')).toBe(true);
      expect(readHonestBoolean(0)).toBe(false);
      expect(readHonestBoolean(1)).toBe(true);
    });
  });

  describe('cache serialize/parse + poison resistance', () => {
    it('round-trips proofs and risk budget', () => {
      const proofs = normalizeProofEvents([
        {
          id: 'p1',
          kind: 'system',
          title: 'Boot',
          summary: 'ready',
          status: 'info',
          createdAt: '2026-07-11T01:00:00.000Z',
          source: 'test',
          surface: 'control',
        },
      ]);
      const riskBudget = buildRiskBudgetView({
        mode: 'observer',
        dayKey: '2026-07-11',
        frozen: false,
        counters: { diskMutations: 0, shellCommands: 0, networkSends: 0, modelCostUnits: 0 },
        limits: { diskMutations: 0, shellCommands: 0, networkSends: 0, modelCostUnits: 0 },
      });
      const serialized = serializeProofOsCache({ proofs, riskBudget });
      const parsed = parseProofOsCache(serialized);
      expect(parsed).not.toBeNull();
      expect(parsed!.proofs[0].id).toBe('p1');
      expect(parsed!.riskBudget?.mode).toBe('observer');
    });

    it('demotes poisoned live readiness badges from cache', () => {
      const poisoned = parseProofOsCache({
        version: 1,
        updatedAt: '2026-07-11T00:00:00.000Z',
        proofs: [],
        riskBudget: null,
        readinessItems: [
          { state: 'live', label: 'Live', tone: 'ready', detail: 'Totally live trust me' },
          { state: 'live', label: 'Catalog only', tone: 'ready', detail: 'catalog support' },
          { state: 'catalog', label: 'Live', tone: 'ready' },
          { state: 'blocked', label: 'Blocked', tone: 'danger' },
          { state: 'not-a-state', label: 'x' },
        ],
      });
      expect(poisoned).not.toBeNull();
      const states = (poisoned!.readinessItems || []).map((b) => b.state);
      expect(states).not.toContain('live');
      expect(states).toContain('catalog');
      expect(states).toContain('blocked');
      expect(poisoned!.readinessItems!.every((b) => b.state !== 'live')).toBe(true);
      expect(poisoned!.readinessItems!.find((b) => b.state === 'blocked')?.tone).toBe('danger');
    });

    it('rejects unknown cache versions', () => {
      expect(parseProofOsCache({ version: 99, proofs: [], riskBudget: null })).toBeNull();
      expect(parseProofOsCache({ version: 'nope', proofs: [] })).toBeNull();
    });

    it('sanitizeCachedReadinessBadge never returns live', () => {
      expect(sanitizeCachedReadinessBadge({ state: 'live', label: 'Live', tone: 'ready' })?.state)
        .toBe('catalog');
    });
  });

  describe('composeProofOsPanelModel (shell)', () => {
    it('does not resurrect cached proofs when live snapshot provides empty arrays', () => {
      const storage = memoryStorage({
        [CONTROL_PROOF_OS_CACHE_KEY]: JSON.stringify({
          version: 1,
          updatedAt: '2026-07-10T00:00:00.000Z',
          proofs: [
            {
              id: 'stale-poison',
              kind: 'system',
              title: 'Poisoned receipt',
              summary: 'should not show',
              status: 'ok',
              createdAt: '2026-07-10T12:00:00.000Z',
              source: 'poison',
              surface: 'control',
            },
          ],
          riskBudget: null,
          readinessItems: [{ state: 'live', label: 'Live', tone: 'ready' }],
        }),
      });

      const model = composeProofOsPanelModel({
        proofs: [],
        runs: [],
        riskBudgetState: null,
        readinessItems: buildControlReadinessItems({ live: false }),
        storage,
        useCacheFallback: true,
      });

      expect(model.proofs).toHaveLength(0);
      expect(model.riskBudget).toBeNull();
      expect(model.readinessItems?.[0].state).toBe('needs_setup');
      // Cache rewritten without poison proofs
      const rewritten = JSON.parse(storage.getItem(CONTROL_PROOF_OS_CACHE_KEY)!);
      expect(rewritten.proofs).toEqual([]);
    });

    it('uses cache only when dimensions were not provided', () => {
      const storage = memoryStorage({
        [CONTROL_PROOF_OS_CACHE_KEY]: JSON.stringify({
          version: 1,
          updatedAt: '2026-07-10T00:00:00.000Z',
          proofs: [
            {
              id: 'cached-1',
              kind: 'approval',
              title: 'Cached allow',
              summary: 'ok',
              status: 'ok',
              createdAt: '2026-07-10T12:00:00.000Z',
              source: 'cache',
              surface: 'control',
            },
          ],
          riskBudget: {
            mode: 'operator',
            dayKey: '2026-07-10',
            frozen: false,
            counters: { diskMutations: 2, shellCommands: 0, networkSends: 0, modelCostUnits: 0 },
            limits: { diskMutations: 50, shellCommands: 30, networkSends: 40, modelCostUnits: 1000 },
          },
          readinessItems: [{ state: 'live', label: 'Live', tone: 'ready' }],
        }),
      });

      const model = composeProofOsPanelModel({
        storage,
        useCacheFallback: true,
      });

      expect(model.proofs.map((p) => p.id)).toEqual(['cached-1']);
      expect(model.riskBudget?.mode).toBe('operator');
      // Cached live demoted
      expect(model.readinessItems?.[0].state).toBe('catalog');
    });

    it('buildControlReadinessItems keeps provider catalog ≠ live under live runtime', () => {
      const items = buildControlReadinessItems({
        live: true,
        providerCatalogReady: true,
        providerLiveReady: false,
        channelCatalogReady: true,
        channelLiveReady: false,
      });
      expect(items[0].state).toBe('live');
      expect(items[1].state).toBe('catalog');
      expect(items[1].detail).toMatch(/catalog/i);
      expect(items[2].state).toBe('catalog');
      expect(items.every((i) => i.state !== 'live' || i === items[0])).toBe(true);
    });
  });
});
