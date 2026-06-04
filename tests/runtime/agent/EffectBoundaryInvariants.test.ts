import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = process.cwd();

function read(relativePath: string): string {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

describe('Effect Boundary invariants', () => {
  it('keeps native LLM tool execution behind the effect boundary', () => {
    const executor = read('src/runtime/agent/AgentRunLlmRuntimeExecutor.ts');
    const source = read('src/runtime/agent/AgentRunNativeToolLoopService.ts');
    const executeToolIndex = source.indexOf('this.toolRuntime.executeTool');
    const safeObservationIndex = source.indexOf('const safeObservation =');
    const deferredIndex = source.indexOf('effect-boundary-deferred');

    expect(executor).toContain('AgentRunNativeToolLoopService');
    expect(executor).toContain('this.nativeToolLoop.run');
    expect(source).toContain('mapToolCallToEffectDecision');
    expect(source).toContain('effect-boundary-deny');
    expect(source).toContain('sideEffectsDeferred');
    expect(executeToolIndex).toBeGreaterThan(safeObservationIndex);
    expect(executeToolIndex).toBeGreaterThan(deferredIndex);
  });

  it('keeps safe observation tools explicit and auditable', () => {
    const safeTools = read('src/tools/governance/SafeObservationTools.ts');
    const nativeLoop = read('src/runtime/agent/AgentRunNativeToolLoopService.ts');

    for (const toolName of ['get_datetime', 'read_file', 'list_directory', 'workspace.read', 'workspace.list']) {
      expect(safeTools).toContain(`'${toolName}'`);
    }
    expect(nativeLoop).toContain('safeObservations');
    expect(nativeLoop).toContain('isSafeObservationTool');
  });

  it('keeps open-ended user text on an LLM-preferred path', () => {
    const classifier = read('src/runtime/agent/NaturalFirstRunClassifier.ts');

    expect(classifier).toMatch(/route:\s*'llm-reply'[\s\S]{0,220}usesLlm:\s*'preferred'/);
    expect(classifier).toMatch(/route:\s*'slash-command'[\s\S]{0,220}usesLlm:\s*'not-required'/);
  });

  it('passes the standalone invariant check used by CI scripts', () => {
    const output = execFileSync(
      process.execPath,
      ['scripts/effect-boundary-invariants-check.mjs'],
      { cwd: root, encoding: 'utf8' },
    );

    expect(output).toContain('[effect-boundary-invariants]');
    expect(output).toContain('passed');
  });
});
