import fs from 'fs';
import os from 'os';
import path from 'path';
import { EchoExecutionLedgerService } from '../../../src/domain/execution/infrastructure/EchoExecutionLedgerService.js';
import { EchoPendingExecutionStoreService } from '../../../src/domain/execution/infrastructure/EchoPendingExecutionStoreService.js';
import { ZavorthProactivePermissionService } from '../../../src/services/ZavorthProactivePermissionService.js';
import type { EchoExecutionEntry } from '../../../src/tool-runtime/types/EchoTypes.js';

describe('Echo execution persistence', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-echo-persistence-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('persists pending permissions across service instances', async () => {
    const filePath = path.join(tempDir, 'permissions.json');
    const first = new ZavorthProactivePermissionService({ filePath });

    const request = await first.request({
      action: 'os_screenshot',
      resource: '{"mode":"fullscreen"}',
      reason: 'Risk gate requires owner approval before visual capture.',
    });

    const reloaded = new ZavorthProactivePermissionService({ filePath });
    expect(reloaded.listPending()).toEqual([
      expect.objectContaining({
        id: request.id,
        action: 'os_screenshot',
        status: 'pending',
      }),
    ]);

    reloaded.resolve(request.id, true);
    const resolved = new ZavorthProactivePermissionService({ filePath });
    expect(resolved.listPending()).toEqual([]);
    expect(resolved.check(request.id)).toEqual(expect.objectContaining({
      status: 'approved',
    }));
  });

  it('persists pending execution context for approval resume', () => {
    const filePath = path.join(tempDir, 'pending.json');
    const first = new EchoPendingExecutionStoreService({ filePath });

    first.put({
      permissionId: 'perm-1',
      kind: 'tool',
      prompt: 'tire um print',
      toolName: 'os_screenshot',
      args: { mode: 'fullscreen' },
      category: 'OS',
      sessionId: 'session-1',
      requestedAt: '2026-05-08T00:00:00.000Z',
      correlation: { sessionId: 'session-1' },
      intent: null,
    });

    const reloaded = new EchoPendingExecutionStoreService({ filePath });
    expect(reloaded.get('perm-1')).toEqual(expect.objectContaining({
      prompt: 'tire um print',
      toolName: 'os_screenshot',
      args: { mode: 'fullscreen' },
    }));

    reloaded.delete('perm-1');
    const deleted = new EchoPendingExecutionStoreService({ filePath });
    expect(deleted.get('perm-1')).toBeNull();
  });

  it('persists bounded execution history', () => {
    const filePath = path.join(tempDir, 'ledger.json');
    const first = new EchoExecutionLedgerService({ filePath, maxEntries: 2 });
    const entry = (id: string): EchoExecutionEntry => ({
      id,
      timestamp: '2026-05-08T00:00:00.000Z',
      prompt: `prompt ${id}`,
      llmRaw: null,
      toolCalls: [],
      finalResponse: `response ${id}`,
      status: 'success',
      durationMs: 1,
    });

    first.append(entry('one'));
    first.append(entry('two'));
    first.append(entry('three'));

    const reloaded = new EchoExecutionLedgerService({ filePath, maxEntries: 2 });
    expect(reloaded.list()).toEqual([
      expect.objectContaining({ id: 'two' }),
      expect.objectContaining({ id: 'three' }),
    ]);
  });
});
