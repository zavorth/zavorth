import fs from 'fs';
import os from 'os';
import path from 'path';
import { config } from '../../src/config/index.js';
import { Database } from '../../src/storage/Database';
import { HostPowerModeService } from '../../src/services/HostPowerModeService';
import { HostCommandPayloadCache } from '../../src/services/HostCommandPayloadCache';

describe('HostPowerModeService', () => {
  let db: Database;
  let service: HostPowerModeService;
  const workspaceId = 'test-workspace';
  const originalDbPath = config.dbPath;
  const tempDirs: string[] = [];

  beforeEach(async () => {
    // Close any global Database singleton instance so we can switch paths
    const dbInstance = (Database as any).instance;
    if (dbInstance) {
      dbInstance.close();
    }

    const tempDir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-hpm-test-')));
    tempDirs.push(tempDir);
    config.dbPath = path.join(tempDir, 'zavorth-test.db');

    db = await Database.getInstance();
    service = HostPowerModeService.getInstance();
    db.run('DELETE FROM workspace_host_command_proposals');
    HostCommandPayloadCache.getInstance().clear();
  });

  afterEach(async () => {
    service.destroy();
    HostCommandPayloadCache.getInstance().destroy();

    const dbInstance = (Database as any).instance;
    if (dbInstance) {
      dbInstance.close();
    }

    config.dbPath = originalDbPath;

    for (const dir of tempDirs) {
      try {
        if (fs.existsSync(dir)) {
          fs.rmSync(dir, { recursive: true, force: true });
        }
      } catch (error: unknown) {
        // ignore cleanup errors
      }
    }
    tempDirs.length = 0;
  });

  it('starts disabled by default', () => {
    const state = service.getState(workspaceId);
    expect(state.enabled).toBe(false);
    expect(state.timeLeftSeconds).toBe(0);
  });

  it('can be enabled with a TTL capped at 30 minutes', async () => {
    // Enable for 45 minutes, should cap at 30
    await service.enable(workspaceId, 45);
    const state = service.getState(workspaceId);
    expect(state.enabled).toBe(true);
    expect(state.timeLeftSeconds).toBeGreaterThan(1700);
    expect(state.timeLeftSeconds).toBeLessThanOrEqual(1800);
  });

  it('can be manually disabled and performs cleanup', async () => {
    await service.enable(workspaceId, 10);

    // Add dummy proposal and payload cache
    db.run(
      `INSERT INTO workspace_host_command_proposals (
        operation_id, workspace_id, command_hash, command_preview_redacted,
        args_hash, args_preview_redacted, cwd_hash, cwd_suffix,
        shell, risk_level, reason_redacted, approved, expires_at, created_at
      ) VALUES ('test-id', ?, 'h1', 'p1', 'h2', 'p2', 'h3', 's3', 0, 'LOW', 'r', 0, '2030-01-01', '2020-01-01')`,
      [workspaceId]
    );
    HostCommandPayloadCache.getInstance().set('test-id', 'echo', ['hi'], '.');

    expect(HostCommandPayloadCache.getInstance().get('test-id')).toBeDefined();

    // Disable HPM
    await service.disable(workspaceId);

    const state = service.getState(workspaceId);
    expect(state.enabled).toBe(false);

    // Verify DB cleaned
    const row = db.get('SELECT * FROM workspace_host_command_proposals WHERE operation_id = ?', ['test-id']);
    expect(row).toBeUndefined();

    // Verify cache cleared
    expect(HostCommandPayloadCache.getInstance().get('test-id')).toBeUndefined();
  });

  it('auto-expires and runs cleanup when checked after TTL expires', async () => {
    jest.useFakeTimers();

    await service.enable(workspaceId, 15);

    // Add dummy proposal
    db.run(
      `INSERT INTO workspace_host_command_proposals (
        operation_id, workspace_id, command_hash, command_preview_redacted,
        args_hash, args_preview_redacted, cwd_hash, cwd_suffix,
        shell, risk_level, reason_redacted, approved, expires_at, created_at
      ) VALUES ('test-id-expire', ?, 'h1', 'p1', 'h2', 'p2', 'h3', 's3', 0, 'LOW', 'r', 0, '2030-01-01', '2020-01-01')`,
      [workspaceId]
    );
    HostCommandPayloadCache.getInstance().set('test-id-expire', 'echo', ['hi'], '.');

    // Advance time by 16 minutes
    jest.advanceTimersByTime(16 * 60 * 1000);

    // Flush microtasks to allow timer callbacks to start executing
    await Promise.resolve();
    await Promise.resolve();

    const state = service.getState(workspaceId);
    expect(state.enabled).toBe(false);

    // Flush microtasks again to allow any handleExpiration triggered by getState to finish
    await Promise.resolve();
    await Promise.resolve();

    // Verify cleanup
    const row = db.get('SELECT * FROM workspace_host_command_proposals WHERE operation_id = ?', ['test-id-expire']);
    expect(row).toBeUndefined();
    expect(HostCommandPayloadCache.getInstance().get('test-id-expire')).toBeUndefined();

    jest.useRealTimers();
  });
});
