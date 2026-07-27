import { PtySessionService } from '../../src/services/PtySessionService';
import { HostPowerModeService } from '../../src/services/HostPowerModeService';
import { PtySessionApprovalService } from '../../src/services/PtySessionApprovalService';
import { Database } from '../../src/storage/Database';

// Mock node-pty behavior
jest.mock('node-pty', () => {
  return {
    spawn: jest.fn().mockImplementation(() => ({
      onData: jest.fn(),
      onExit: jest.fn(),
      kill: jest.fn(),
      write: jest.fn()
    }))
  };
});

describe('PtySessionService', () => {
  let service: PtySessionService;

  beforeEach(() => {
    // Force a fresh instance if possible, or just use the singleton
    service = PtySessionService.getInstance();
  });

  afterEach(async () => {
    await service.terminateAllForWorkspace('ws-test');
  });

  it('fails closed when node-pty is unavailable', () => {
    // The singleton might already have loaded node-pty, let's mock the availability
    (service as any).isAvailable = false;
    expect(service.getIsAvailable()).toBe(false);
    expect(service.startSession('s1', 'ws1')).rejects.toThrow('PTY_UNAVAILABLE');
    (service as any).isAvailable = true; // restore
  });

  it('starts session calling node-pty spawn', async () => {
    const pty = require('node-pty');
    (service as any).pendingSessionData.set('s2', { cwd: '.', shell: 'powershell.exe' });

    // We mock HostPowerMode to true
    jest.spyOn(HostPowerModeService.getInstance(), 'isHostPowerModeEnabled').mockReturnValue(true);

    // We mock approval to return something
    jest.spyOn(service['approvalService'], 'getApprovedSession').mockResolvedValue({} as any);

    await service.startSession('s2', 'ws-test');

    expect(pty.spawn).toHaveBeenCalled();
  });

  it('kills process on terminate', async () => {
    const ptyProcess = { kill: jest.fn(), onData: jest.fn(), onExit: jest.fn(), write: jest.fn() };
    (service as any).activeSessions.set('s3', ptyProcess);

    await service.terminateSession('s3', 'ws-test');
    expect(ptyProcess.kill).toHaveBeenCalled();
  });

  it('generates output chunks with monotonic seq', () => {
    (service as any).sessionOutputBuffers.set('s4', []);
    (service as any).sessionSequenceNumbers.set('s4', 0);

    (service as any).handlePtyOutput('s4', 'hello');
    (service as any).handlePtyOutput('s4', 'world');

    const output = service.getOutput('s4', 0);
    expect(output.length).toBe(2);
    expect(output[0].seq).toBe(1);
    expect(output[0].chunk).toBe('hello');
    expect(output[1].seq).toBe(2);
    expect(output[1].chunk).toBe('world');

    const outputAfter1 = service.getOutput('s4', 1);
    expect(outputAfter1.length).toBe(1);
    expect(outputAfter1[0].seq).toBe(2);
  });
});

