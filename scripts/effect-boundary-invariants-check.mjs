import fs from 'fs';
import path from 'path';

const root = process.cwd();
const checks = [];

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function check(id, ok, detail) {
  checks.push({ id, ok, detail });
}

const executorPath = 'src/runtime/agent/AgentRunLlmRuntimeExecutor.ts';
const executor = read(executorPath);
const nativeLoopPath = 'src/runtime/agent/AgentRunNativeToolLoopService.ts';
const nativeLoop = read(nativeLoopPath);
const safeToolsPath = 'src/tools/governance/SafeObservationTools.ts';
const safeTools = read(safeToolsPath);
const classifierPath = 'src/runtime/agent/NaturalFirstRunClassifier.ts';
const classifier = read(classifierPath);

check(
  'effect-boundary/executor-delegates-native-loop',
  executor.includes('AgentRunNativeToolLoopService') && executor.includes('this.nativeToolLoop.run'),
  `${executorPath} must delegate native tool execution to AgentRunNativeToolLoopService.`,
);

check(
  'effect-boundary/native-loop-imports-tool-mapper',
  nativeLoop.includes('mapToolCallToEffectDecision') && nativeLoop.includes('ToolEffectRegistry'),
  `${nativeLoopPath} must map native tool calls through the effect boundary.`,
);

check(
  'effect-boundary/native-loop-audits-safe-observations',
  nativeLoop.includes('safeObservations') && nativeLoop.includes('isSafeObservationTool'),
  `${nativeLoopPath} must audit safe observation fast-path tool calls.`,
);

check(
  'effect-boundary/native-loop-defers-side-effects',
  nativeLoop.includes('sideEffectsDeferred') && nativeLoop.includes('effect-boundary-deferred'),
  `${nativeLoopPath} must defer non-observation effects instead of executing them directly.`,
);

check(
  'effect-boundary/native-loop-denies-untrusted-side-effects',
  nativeLoop.includes('effectBoundaryDenied') && nativeLoop.includes('effect-boundary-deny'),
  `${nativeLoopPath} must deny untrusted side effects at the effect boundary.`,
);

const executeToolIndex = nativeLoop.indexOf('this.toolRuntime.executeTool');
const safeObservationIndex = nativeLoop.indexOf('const safeObservation =');
const deferredIndex = nativeLoop.indexOf('effect-boundary-deferred');
check(
  'effect-boundary/execute-tool-after-boundary',
  executeToolIndex > safeObservationIndex && executeToolIndex > deferredIndex,
  `${nativeLoopPath} must evaluate safe/deferred/deny branches before executeTool.`,
);

for (const toolName of ['get_datetime', 'read_file', 'list_directory', 'workspace.read', 'workspace.list']) {
  check(
    `effect-boundary/safe-observation-tool/${toolName}`,
    safeTools.includes(`'${toolName}'`),
    `${safeToolsPath} must keep ${toolName} in the safe observation allowlist.`,
  );
}

check(
  'cognitive-freedom/free-text-prefers-llm',
  /route:\s*'llm-reply'[\s\S]{0,220}usesLlm:\s*'preferred'/.test(classifier),
  `${classifierPath} must route open free-text questions to an LLM-preferred path.`,
);

check(
  'cognitive-freedom/slash-command-is-small-exception',
  /route:\s*'slash-command'[\s\S]{0,220}usesLlm:\s*'not-required'/.test(classifier),
  `${classifierPath} may reserve no-LLM handling for explicit operator shortcuts.`,
);

const failures = checks.filter((entry) => !entry.ok);
if (failures.length > 0) {
  for (const failure of failures) {
    console.error(`[effect-boundary-invariants] FAIL ${failure.id}: ${failure.detail}`);
  }
  console.error(`[effect-boundary-invariants] ${failures.length}/${checks.length} invariant(s) failed.`);
  process.exit(1);
}

console.log(`[effect-boundary-invariants] ${checks.length} invariant(s) passed.`);
