import fs from 'fs';
import os from 'os';
import path from 'path';
import { HostActionLedgerService } from '../../src/services/HostActionLedgerService.js';
import type { SystemOverlordActionRecord } from '../../src/contracts/SystemOverlordContract.js';

describe('HostActionLedgerService', () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    while (tempDirs.length > 0) {
      const target = tempDirs.pop();
      if (target && fs.existsSync(target)) {
        fs.rmSync(target, { recursive: true, force: true });
      }
    }
  });

  it('records and reads host actions from a jsonl ledger', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-host-ledger-'));
    tempDirs.push(root);
    const service = new HostActionLedgerService({
      ledgerFile: path.join(root, 'host-actions.jsonl'),
    });
    const record: SystemOverlordActionRecord = {
      actionId: 'action-1',
      runId: 'run-1',
      requestedBy: 'user-1',
      surface: 'web',
      createdAt: '2026-04-11T00:00:00.000Z',
      updatedAt: '2026-04-11T00:00:00.000Z',
      status: 'completed',
      request: {
        capability: 'host.shell',
        command: 'git status',
      },
      decision: {
        allowed: true,
        requiresApproval: false,
        reason: 'ok',
        capability: 'host.shell',
        profile: 'safe',
        requiredProfile: 'safe',
        autonomyLevel: 1,
        requiredAutonomyLevel: 1,
        runtimeTarget: 'host',
        mutating: false,
        blockedReason: null,
      },
      command: 'git status',
      workspace: root,
      stdout: 'ok',
      stderr: null,
      exitCode: 0,
      errorCode: null,
      errorMessage: null,
      rollbackAvailable: false,
      metadata: {},
    };

    service.record(record);

    expect(service.list()).toEqual([record]);
    expect(service.find('action-1')).toEqual(record);
    expect(service.find('missing')).toBeNull();
  });
});
