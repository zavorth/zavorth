import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { ZavorthAutomatedSafetyHooksService } from '../../../src/services/hooks/ZavorthAutomatedSafetyHooksService';

describe('ZavorthAutomatedSafetyHooksService', () => {
  let hooks: ZavorthAutomatedSafetyHooksService;
  let tempDir: string;
  let sampleFile: string;

  beforeEach(() => {
    hooks = new ZavorthAutomatedSafetyHooksService();
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-hook-test-'));
    sampleFile = path.join(tempDir, 'sample.ts');
    fs.writeFileSync(sampleFile, 'export function compute(): number { return 42; }', 'utf8');
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {}
  });

  it('should automatically take shadow snapshot before mutating tools run', () => {
    const preResult = hooks.beforeToolExecution('write_to_file', {
      TargetFile: sampleFile,
      CodeContent: 'export function compute(): number { return 100; }',
    });

    expect(preResult.autoSnapshotTaken).toBe(true);
    expect(preResult.trackedFiles).toContain(sampleFile);
    expect(preResult.snapshotId).toBeDefined();

    const readOnlyResult = hooks.beforeToolExecution('read_file', { filePath: sampleFile });
    expect(readOnlyResult.autoSnapshotTaken).toBe(false);
  });

  it('should automatically trigger LSP verification and Codebase Graph indexing after tool execution', () => {
    const postResult = hooks.afterToolExecution('write_to_file', {
      TargetFile: sampleFile,
      CodeContent: 'export function newFunction(): string { return "test"; }',
    });

    expect(postResult.filesIndexedCount).toBe(1);
    expect(postResult.hasLspErrors).toBe(false);
  });

  it('should automatically compact trajectory when token budget exceeds threshold', () => {
    const turns = [
      { id: '0', role: 'user' as const, content: 'User goal', estimatedTokens: 100 },
      { id: '1', role: 'assistant' as const, content: 'Plan', estimatedTokens: 100 },
      { id: '2', role: 'tool' as const, content: 'Large output ' + 'x'.repeat(4000), estimatedTokens: 1000 },
      { id: '3', role: 'assistant' as const, content: 'Done', estimatedTokens: 100 },
    ];

    // Context limit of 1000 tokens (turns have 1300 tokens > 750 token threshold)
    const turnResult = hooks.beforeAgentTurn(turns, 1000);

    expect(turnResult.compressionResult).toBeDefined();
    expect(turnResult.turns.length).toBeLessThanOrEqual(turns.length);
  });

  it('should manage subagent mission wake locks lifecycle automatically', () => {
    const lock = hooks.onSubagentMissionStart('mission-123', 'full-codebase-refactor');
    expect(lock.lockId).toBeDefined();

    const ended = hooks.onSubagentMissionEnd('mission-123');
    expect(ended).toBe(true);
  });
});
