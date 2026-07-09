import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ZavorthGitLockTool } from '../../src/tools/ZavorthGitLockTool.js';
import { CreateFileTool } from '../../src/tools/CreateFileTool.js';
import { WorkspaceWriteTool } from '../../src/tools/workspace/WorkspaceWriteTool.js';
import { WorkspaceEditTool } from '../../src/tools/workspace/WorkspaceEditTool.js';
import { Database } from '../../src/storage/Database.js';
import { config } from '../../src/config/index.js';
import { executionContextScope } from '../../src/runtime/context/ExecutionContextScope.js';

describe('ZavorthGitLockTool', () => {
  let tmpDirs: string[] = [];
  const originalDbPath = config.dbPath;
  const originalCwd = process.cwd();
  let tempDir = '';

  beforeEach(async () => {
    Database.instance = null;
    (Database as any).initPromise = null;

    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-lock-test-'));
    tmpDirs.push(tempDir);
    process.chdir(tempDir);

    // Setup temporary database path
    config.dbPath = path.join(tempDir, 'zavorth.db');
  });

  afterEach(() => {
    try {
      Database.instance?.close();
    } catch {
      // Ignore
    }
    Database.instance = null;
    (Database as any).initPromise = null;

    config.dbPath = originalDbPath;
    process.chdir(originalCwd);

    for (const dir of tmpDirs) {
      try {
        fs.rmSync(dir, { recursive: true, force: true });
      } catch {
        // Ignore
      }
    }
    tmpDirs = [];
  });

  it('acquires and releases locks', async () => {
    const tool = new ZavorthGitLockTool();
    const filepath = 'output/test.txt';

    // 1. Acquire lock
    const acqResponse = JSON.parse(await tool.execute({ action: 'acquire', filepath, subagentId: 'sub-1' }));
    expect(acqResponse.success).toBe(true);
    expect(acqResponse.message).toContain('Lock acquired successfully');

    // 2. Try acquiring the same lock by same subagent (should succeed/noop)
    const reAcqResponse = JSON.parse(await tool.execute({ action: 'acquire', filepath, subagentId: 'sub-1' }));
    expect(reAcqResponse.success).toBe(true);

    // 3. Try acquiring the lock by another subagent (should fail)
    const otherAcqResponse = JSON.parse(await tool.execute({ action: 'acquire', filepath, subagentId: 'sub-2' }));
    expect(otherAcqResponse.success).toBe(false);
    expect(otherAcqResponse.error).toContain('locked by another subagent');

    // 4. Release lock by another subagent (should fail)
    const otherRelResponse = JSON.parse(await tool.execute({ action: 'release', filepath, subagentId: 'sub-2' }));
    expect(otherRelResponse.success).toBe(false);
    expect(otherRelResponse.error).toContain('Cannot release lock owned by subagent');

    // 5. Release lock by owner subagent (should succeed)
    const relResponse = JSON.parse(await tool.execute({ action: 'release', filepath, subagentId: 'sub-1' }));
    expect(relResponse.success).toBe(true);

    // 6. Release lock when not locked (should be noop/success)
    const relNoLockResponse = JSON.parse(await tool.execute({ action: 'release', filepath, subagentId: 'sub-1' }));
    expect(relNoLockResponse.success).toBe(true);
  });

  it('prevents CreateFileTool writing to locked files', async () => {
    const lockTool = new ZavorthGitLockTool();
    const fileTool = new CreateFileTool();
    const filepath = 'output/locked.txt';

    // Lock the file for subagent-1
    await lockTool.execute({ action: 'acquire', filepath, subagentId: 'subagent-1' });

    // Run writing in context of subagent-2
    await executionContextScope.run({
      traceId: 'trace-1',
      runId: 'run-1',
      sessionId: 'subagent-2',
      surface: 'test',
      requestedBy: 'test-runner',
    }, async () => {
      const response = JSON.parse(await fileTool.execute({ filepath, content: 'some new content' }));
      expect(response.error).toContain('locked by another subagent');
    });

    // Run writing in context of subagent-1 (lock owner)
    await executionContextScope.run({
      traceId: 'trace-1',
      runId: 'run-1',
      sessionId: 'subagent-1',
      surface: 'test',
      requestedBy: 'test-runner',
    }, async () => {
      const response = JSON.parse(await fileTool.execute({ filepath, content: 'some new content' }));
      expect(response.success).toBe(true);
    });
  });

  it('prevents WorkspaceWriteTool writing to locked files', async () => {
    const lockTool = new ZavorthGitLockTool();
    const writeTool = new WorkspaceWriteTool();
    const filepath = 'locked.txt';

    // Lock the file for subagent-1
    await lockTool.execute({ action: 'acquire', filepath, subagentId: 'subagent-1' });

    // Run writing in context of subagent-2
    await executionContextScope.run({
      traceId: 'trace-1',
      runId: 'run-1',
      sessionId: 'subagent-2',
      surface: 'test',
      requestedBy: 'test-runner',
    }, async () => {
      await expect(writeTool.execute({ filepath, content: 'hello' })).rejects.toThrow('locked by another subagent');
    });
  });

  it('prevents WorkspaceEditTool editing locked files', async () => {
    const lockTool = new ZavorthGitLockTool();
    const editTool = new WorkspaceEditTool();
    const filepath = 'target.txt';

    // Create file first
    fs.mkdirSync(path.join(tempDir, 'output'), { recursive: true });
    fs.writeFileSync(path.join(tempDir, 'output', 'target.txt'), 'original content\nhere', 'utf-8');

    // Lock the file for subagent-1
    await lockTool.execute({ action: 'acquire', filepath, subagentId: 'subagent-1' });

    // Run editing in context of subagent-2 (should throw lock error)
    await executionContextScope.run({
      traceId: 'trace-1',
      runId: 'run-1',
      sessionId: 'subagent-2',
      surface: 'test',
      requestedBy: 'test-runner',
    }, async () => {
      await expect(editTool.execute({
        filepath: 'target.txt',
        search: 'original content',
        replace: 'new content',
      })).rejects.toThrow('locked by another subagent');
    });

    // Run editing in context of subagent-1 (lock owner)
    await executionContextScope.run({
      traceId: 'trace-1',
      runId: 'run-1',
      sessionId: 'subagent-1',
      surface: 'test',
      requestedBy: 'test-runner',
    }, async () => {
      const result = JSON.parse(await editTool.execute({
        filepath: 'target.txt',
        search: 'original content',
        replace: 'new content',
      }));
      expect(result.success).toBe(true);
    });
  });
});
