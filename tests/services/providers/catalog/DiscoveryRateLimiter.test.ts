import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DiscoveryRateLimiter } from '../../../../src/services/providers/catalog/DiscoveryRateLimiter.js';

describe('DiscoveryRateLimiter', () => {
  let limiter: DiscoveryRateLimiter;

  beforeEach(() => {
    limiter = new DiscoveryRateLimiter({
      maxRequestsPerMinute: 5,
      maxRequestsPerHour: 20,
      burstLimit: 3,
      cooldownMs: 1000,
    });
  });

  describe('check()', () => {
    it('should allow first request', () => {
      const result = limiter.check('test-provider');
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(4);
    });

    it('should track remaining requests', () => {
      limiter.consume('test-provider');
      limiter.consume('test-provider');
      const result = limiter.check('test-provider');
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(2);
    });

    it('should block after max requests per minute', () => {
      for (let i = 0; i < 5; i++) {
        limiter.consume('test-provider');
      }
      const result = limiter.check('test-provider');
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('rate_limited_minute');
    });

    it('should block after burst limit', () => {
      for (let i = 0; i < 3; i++) {
        limiter.consume('test-provider');
      }
      const result = limiter.check('test-provider');
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('burst_limit_exceeded');
    });

    it('should track different providers separately', () => {
      for (let i = 0; i < 3; i++) {
        limiter.consume('provider-a');
      }
      const result = limiter.check('provider-b');
      expect(result.allowed).toBe(true);
    });
  });

  describe('consume()', () => {
    it('should record request', () => {
      limiter.consume('test-provider');
      const state = limiter.getState('test-provider');
      expect(state).toBeDefined();
      expect(state!.requests.length).toBe(1);
    });
  });

  describe('reset()', () => {
    it('should reset provider state', () => {
      limiter.consume('test-provider');
      limiter.reset('test-provider');
      const result = limiter.check('test-provider');
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(4);
    });
  });

  describe('resetAll()', () => {
    it('should reset all providers', () => {
      limiter.consume('provider-a');
      limiter.consume('provider-b');
      limiter.resetAll();
      const resultA = limiter.check('provider-a');
      const resultB = limiter.check('provider-b');
      expect(resultA.allowed).toBe(true);
      expect(resultB.allowed).toBe(true);
    });
  });
});
