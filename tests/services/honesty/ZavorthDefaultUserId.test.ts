import {
  normalizeZavorthUserId,
  resolveCliDefaultUserId,
  ZAVORTH_DEFAULT_USER_ID,
} from '../../../src/services/ZavorthDefaultUserId.js';

describe('ZavorthDefaultUserId honesty', () => {
  it('uses local-user as the canonical default', () => {
    expect(ZAVORTH_DEFAULT_USER_ID).toBe('local-user');
    expect(normalizeZavorthUserId(null)).toBe('local-user');
    expect(normalizeZavorthUserId('')).toBe('local-user');
    expect(normalizeZavorthUserId('  Alice/1  ')).toBe('Alice_1');
  });

  it('CLI default prefers flag, then allowlist, then env, then local-user', () => {
    expect(resolveCliDefaultUserId({ flagUserId: 'cli-me' })).toBe('cli-me');
    expect(resolveCliDefaultUserId({ allowedUserIds: ['111'] })).toBe('111');
    expect(resolveCliDefaultUserId({ envUser: 'os-user' })).toBe('os-user');
    expect(resolveCliDefaultUserId({})).toBe('local-user');
  });
});
