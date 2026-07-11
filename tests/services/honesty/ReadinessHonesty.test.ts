/**
 * P11 — Honesty enforcement: catalog ≠ live.
 * Source: src/services/honesty/ReadinessHonesty.ts
 * Keep semantics aligned with desktop readiness.ts and ControlTrustLoopModel.
 */

import {
  classifyHonestReadiness,
  honestReadinessFromProvider,
  honestReadinessFromTool,
} from '../../../src/services/honesty/ReadinessHonesty';

describe('ReadinessHonesty', () => {
  describe('classifyHonestReadiness', () => {
    it('returns blocked before anything else', () => {
      const badge = classifyHonestReadiness({
        blocked: true,
        liveReady: true,
        status: 'ready',
      });
      expect(badge.state).toBe('blocked');
      expect(badge.tone).toBe('danger');
    });

    it('grants live only when liveReady === true', () => {
      expect(classifyHonestReadiness({ liveReady: true }).state).toBe('live');
      expect(classifyHonestReadiness({ liveReady: true, status: 'catalog' }).state).toBe('live');
    });

    it('never grants live from status-only strings', () => {
      for (const status of ['available', 'ready', 'ok', 'healthy', 'active', 'live', 'connected', 'trusted']) {
        const badge = classifyHonestReadiness({ status });
        expect(badge.state).not.toBe('live');
        expect(badge.tone).not.toBe('ready');
      }
    });

    it('never maps catalog-only configured to live', () => {
      const catalog = classifyHonestReadiness({ configured: true, liveReady: false, status: 'configured' });
      expect(catalog.state).not.toBe('live');
      expect(['available', 'needs_setup']).toContain(catalog.state);
    });

    it('treats liveReady false as never-live', () => {
      expect(classifyHonestReadiness({ liveReady: false, status: 'ready' }).state).not.toBe('live');
      expect(classifyHonestReadiness({ liveReady: false, configured: true }).state).not.toBe('live');
      expect(classifyHonestReadiness({ liveReady: false }).state).toBe('needs_setup');
    });

    it('returns needs_setup for setup status / configured false', () => {
      expect(classifyHonestReadiness({ status: 'needs_setup' }).state).toBe('needs_setup');
      expect(classifyHonestReadiness({ configured: false }).state).toBe('needs_setup');
    });

    it('returns unknown when no signals', () => {
      expect(classifyHonestReadiness({}).state).toBe('unknown');
    });
  });

  describe('honestReadinessFromProvider', () => {
    it('grants live only for connected or explicit liveReady', () => {
      expect(honestReadinessFromProvider({ connected: true }).state).toBe('live');
      expect(honestReadinessFromProvider({ liveReady: true }).state).toBe('live');
    });

    it('does not treat ready alone as live', () => {
      const badge = honestReadinessFromProvider({ status: 'ready', ready: true });
      expect(badge.state).not.toBe('live');
      expect(['available', 'needs_setup']).toContain(badge.state);
    });

    it('treats configured/catalog status as not live', () => {
      expect(honestReadinessFromProvider({ status: 'configured' }).state).toBe('needs_setup');
    });
  });

  describe('honestReadinessFromTool', () => {
    it('blocks high-risk deny/block statuses', () => {
      expect(honestReadinessFromTool({ status: 'blocked', risk: 'high' }).state).toBe('blocked');
    });

    it('does not treat status ready as live without liveReady', () => {
      expect(honestReadinessFromTool({ status: 'ready' }).state).toBe('available');
      expect(honestReadinessFromTool({ status: 'trusted' }).state).toBe('available');
    });

    it('grants live only with explicit liveReady', () => {
      expect(honestReadinessFromTool({ status: 'ready', liveReady: true }).state).toBe('live');
    });

    it('notes catalog is not live for unknown tool statuses', () => {
      expect(honestReadinessFromTool({ status: 'catalog' }).detail || '').toMatch(/not the same as live/i);
    });
  });
});
