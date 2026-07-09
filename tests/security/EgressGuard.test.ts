import { EgressGuard } from '../../src/security/EgressGuard';

describe('EgressGuard', () => {
  let guard: EgressGuard;

  beforeEach(() => {
    guard = new EgressGuard();
  });

  describe('Private IP detection', () => {
    it('should block 127.x.x.x (loopback)', () => {
      expect(guard.isPrivateNetworkAddress('127.0.0.1')).toBe(true);
      expect(guard.isPrivateNetworkAddress('127.255.255.255')).toBe(true);
    });

    it('should block 10.x.x.x (private class A)', () => {
      expect(guard.isPrivateNetworkAddress('10.0.0.1')).toBe(true);
      expect(guard.isPrivateNetworkAddress('10.255.255.255')).toBe(true);
    });

    it('should block 172.16-31.x.x (private class B)', () => {
      expect(guard.isPrivateNetworkAddress('172.16.0.1')).toBe(true);
      expect(guard.isPrivateNetworkAddress('172.31.255.255')).toBe(true);
    });

    it('should block 192.168.x.x (private class C)', () => {
      expect(guard.isPrivateNetworkAddress('192.168.0.1')).toBe(true);
      expect(guard.isPrivateNetworkAddress('192.168.255.255')).toBe(true);
    });

    it('should allow public IPs', () => {
      expect(guard.isPrivateNetworkAddress('8.8.8.8')).toBe(false);
      expect(guard.isPrivateNetworkAddress('1.1.1.1')).toBe(false);
      // 203.0.113.0/24 is TEST-NET-3 and is intentionally treated as non-public.
      expect(guard.isPrivateNetworkAddress('203.0.113.1')).toBe(true);
      expect(guard.isPrivateNetworkAddress('93.184.216.34')).toBe(false);
    });
  });

  describe('URL validation', () => {
    it('should block localhost URLs', () => {
      expect(guard.isUrlAllowed('http://localhost:3000')).toBe(false);
      expect(guard.isUrlAllowed('http://127.0.0.1:8080')).toBe(false);
    });

    it('should block private network URLs', () => {
      expect(guard.isUrlAllowed('http://192.168.1.1/api')).toBe(false);
      expect(guard.isUrlAllowed('http://10.0.0.1/admin')).toBe(false);
    });

    it('should allow public URLs', () => {
      expect(guard.isUrlAllowed('https://api.openai.com/v1')).toBe(true);
      expect(guard.isUrlAllowed('https://github.com')).toBe(true);
    });

    it('should handle invalid URLs gracefully', () => {
      expect(guard.isUrlAllowed('not-a-url')).toBe(false);
      expect(guard.isUrlAllowed('')).toBe(false);
    });
  });

  describe('DNS rebinding protection', () => {
    it('should detect DNS rebinding attempts', () => {
      expect(guard.isDnsRebindingAttempt('http://localhost')).toBe(true);
      expect(guard.isDnsRebindingAttempt('http://0.0.0.0')).toBe(true);
      expect(guard.isDnsRebindingAttempt('http://[::1]')).toBe(true);
    });

    it('should allow normal DNS resolution', () => {
      expect(guard.isDnsRebindingAttempt('https://api.openai.com')).toBe(false);
    });
  });
});
