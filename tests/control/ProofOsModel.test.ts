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
  selectLatestProof,
  serializeProofOsCache,
} from '../../src/services/control/ControlProofOsModel';

describe('ControlProofOsModel', () => {
  describe('classifyControlReadiness', () => {
    it('never maps catalog-only to live', () => {
      const badge = classifyControlReadiness({ catalogReady: true, liveReady: false });
      expect(badge.state).toBe('catalog');
      expect(badge.label).toBe('Catalog only');
      expect(badge.state).not.toBe('live');
    });

    it('returns live only when liveReady is explicit', () => {
      const live = classifyControlReadiness({ liveReady: true, catalogReady: true });
      expect(live.state).toBe('live');
      expect(live.label).toBe('Live');
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
  });

  describe('risk budget view', () => {
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

    it('returns null for empty state-like input', () => {
      expect(buildRiskBudgetView(null)).toBeNull();
      expect(buildRiskBudgetView({})).toBeNull();
      expect(formatRiskBudgetLine(null)).toBe('Risk budget · unavailable');
    });
  });

  describe('cache serialize/parse', () => {
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
  });
});
