import { ConnectionLockManager } from '../../../src/services/connection/ConnectionLockManager.js';

describe('ConnectionLockManager', () => {
  let lockManager: ConnectionLockManager;
  let testUserId: string;

  beforeEach(() => {
    lockManager = ConnectionLockManager.getInstance();
    testUserId = `lock-user-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  });

  afterEach(async () => {
    await lockManager.releaseLock(testUserId, 'github');
    await lockManager.releaseLock(testUserId, 'stripe');
    await lockManager.releaseLock(testUserId, 'claude');
  });

  it('acquires lock successfully and assigns sessionId', async () => {
    const res = await lockManager.acquireLock(testUserId, 'github');
    expect(res.acquired).toBe(true);
    expect(res.sessionId).toBeDefined();
    expect(typeof res.sessionId).toBe('string');
  });

  it('blocks concurrent handshake for the same target and user', async () => {
    const res1 = await lockManager.acquireLock(testUserId, 'stripe');
    expect(res1.acquired).toBe(true);

    const res2 = await lockManager.acquireLock(testUserId, 'stripe');
    expect(res2.acquired).toBe(false);
    expect(res2.error).toContain('already in progress');
  });

  it('allows re-acquiring after lock is released', async () => {
    await lockManager.acquireLock(testUserId, 'claude');
    await lockManager.releaseLock(testUserId, 'claude');

    const res = await lockManager.acquireLock(testUserId, 'claude');
    expect(res.acquired).toBe(true);
  });

  it('aborts in-flight handshake and triggers abort signal', async () => {
    await lockManager.acquireLock(testUserId, 'github');
    const signal = lockManager.getAbortSignal(testUserId, 'github');

    expect(signal).toBeDefined();
    expect(signal?.aborted).toBe(false);

    const aborted = await lockManager.abortInFlight(testUserId, 'github');
    expect(aborted).toBe(true);
    expect(signal?.aborted).toBe(true);
  });

  it('auto-expires stale lock past its TTL', async () => {
    // Acquire with short TTL (10ms)
    await lockManager.acquireLock(testUserId, 'github', 10);
    await new Promise(r => setTimeout(r, 20));

    const res = await lockManager.acquireLock(testUserId, 'github');
    expect(res.acquired).toBe(true);
  });
});
