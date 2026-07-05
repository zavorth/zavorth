import { AuthRateLimiter } from '../../src/gateway/AuthRateLimiter';

describe('AuthRateLimiter', () => {
  let limiter: AuthRateLimiter;

  beforeEach(() => {
    limiter = new AuthRateLimiter({
      windowMs: 60000,
      maxAttempts: 5,
    });
  });

  describe('Basic rate limiting', () => {
    it('should not block when under limit', () => {
      for (let i = 0; i < 4; i++) {
        limiter.recordFailure('gateway', 'user1');
      }
      expect(limiter.isBlocked('gateway', 'user1')).toBe(false);
    });

    it('should block after max attempts exceeded', () => {
      for (let i = 0; i < 5; i++) {
        limiter.recordFailure('gateway', 'user1');
      }
      expect(limiter.isBlocked('gateway', 'user1')).toBe(true);
    });

    it('should track separate users', () => {
      for (let i = 0; i < 5; i++) {
        limiter.recordFailure('gateway', 'user1');
      }
      expect(limiter.isBlocked('gateway', 'user1')).toBe(true);
      expect(limiter.isBlocked('gateway', 'user2')).toBe(false);
    });
  });

  describe('Success recording', () => {
    it('should reset count on success', () => {
      for (let i = 0; i < 4; i++) {
        limiter.recordFailure('gateway', 'user1');
      }
      limiter.recordSuccess('gateway', 'user1');
      expect(limiter.isBlocked('gateway', 'user1')).toBe(false);
    });
  });

  describe('Loopback exemption', () => {
    it('should not block loopback addresses', () => {
      for (let i = 0; i < 10; i++) {
        limiter.recordFailure('gateway', '127.0.0.1');
      }
      expect(limiter.isBlocked('gateway', '127.0.0.1')).toBe(false);
    });

    it('should block non-loopback addresses', () => {
      for (let i = 0; i < 5; i++) {
        limiter.recordFailure('gateway', '203.0.113.1');
      }
      expect(limiter.isBlocked('gateway', '203.0.113.1')).toBe(true);
    });
  });

  describe('Scope isolation', () => {
    it('should track different scopes separately', () => {
      for (let i = 0; i < 5; i++) {
        limiter.recordFailure('gateway', 'user1');
      }
      expect(limiter.isBlocked('gateway', 'user1')).toBe(true);
      expect(limiter.isBlocked('api', 'user1')).toBe(false);
    });
  });
});
