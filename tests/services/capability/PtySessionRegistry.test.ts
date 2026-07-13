import { PtySessionService } from '../../../src/services/PtySessionService.js';

describe('PtySessionService registry / reattach / reaper', () => {
  let service: PtySessionService;

  beforeEach(() => {
    // Fresh instance without relying on singleton pollution
    service = new PtySessionService(
      {
        isHostPowerModeEnabled: () => true,
        registerOnDisableCallback: () => undefined,
      } as any,
      {
        getApprovedSession: async () => null,
        updateSessionStatus: async () => undefined,
      } as any,
      {
        logWorkspaceEvent: () => undefined,
      } as any,
    );
    service.stopReaper();
  });

  afterEach(() => {
    service.stopReaper();
  });

  it('issues attach token on pending registration', () => {
    service.registerPendingSession('pty_test_1', 'C:\\tmp', 'powershell');
    const entry = service.getRegistryEntry('pty_test_1');
    expect(entry?.status).toBe('pending');
    expect(entry?.attachToken).toMatch(/^ptyatk_/);
    expect(service.getAttachToken('pty_test_1')).toBe(entry?.attachToken);
  });

  it('reattaches via token and returns ring buffer catch-up', () => {
    service.registerPendingSession('pty_test_2', 'C:\\tmp', 'powershell');
    const token = service.getAttachToken('pty_test_2')!;
    // Simulate buffered output without live process
    (service as any).sessionOutputBuffers.set('pty_test_2', [
      { seq: 1, sessionId: 'pty_test_2', chunk: 'hello', truncated: false, createdAt: new Date().toISOString() },
      { seq: 2, sessionId: 'pty_test_2', chunk: 'world', truncated: false, createdAt: new Date().toISOString() },
    ]);
    (service as any).sessionSequenceNumbers.set('pty_test_2', 2);
    const reg = (service as any).sessionRegistry.get('pty_test_2');
    reg.status = 'detached';
    reg.workspaceId = 'ws-1';

    const result = service.reattach(token, 1);
    expect(result.ok).toBe(true);
    expect(result.sessionId).toBe('pty_test_2');
    expect(result.output).toHaveLength(1);
    expect(result.output[0].chunk).toBe('world');
  });

  it('rejects invalid attach tokens', () => {
    const result = service.reattach('ptyatk_invalid');
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/invalid|expired/i);
  });

  it('lists registry entries with attach tokens for Control API clients', () => {
    service.registerPendingSession('pty_list_1', 'C:\\tmp', 'powershell');
    const listed = service.listRegistry();
    expect(listed.some((e) => e.sessionId === 'pty_list_1' && /^ptyatk_/.test(e.attachToken))).toBe(true);
  });

  it('reaps idle detached sessions after retention', () => {
    service.registerPendingSession('pty_old', 'C:\\tmp', 'bash');
    const entry = (service as any).sessionRegistry.get('pty_old');
    entry.status = 'detached';
    entry.lastActivityAt = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    (service as any).sessionOutputBuffers.set('pty_old', [
      { seq: 1, sessionId: 'pty_old', chunk: 'x', truncated: false, createdAt: new Date().toISOString() },
    ]);

    const { dropped } = service.reapIdleSessions(1_000);
    expect(dropped).toContain('pty_old');
    expect(service.getRegistryEntry('pty_old')).toBeNull();
  });
});
