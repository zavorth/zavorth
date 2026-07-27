import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const runner = process.platform === 'win32' ? 'cmd.exe' : 'npx';
const prefix = process.platform === 'win32' ? ['/d', '/s', '/c', 'npx'] : [];

for (const file of [
  'src/contracts/ZavorthNaturalRuntimeQuestionsContract.ts',
  'src/services/ZavorthNaturalRuntimeQuestionsService.ts',
  'scripts/zavorth-natural-runtime-questions.ts',
  'tests/services/ZavorthNaturalRuntimeQuestionsService.test.ts',
]) {
  if (!existsSync(path.join(root, file))) {
    throw new Error(`missing ${file}`);
  }
}

const output = execFileSync(
  runner,
  [...prefix, 'tsx', 'scripts/zavorth-natural-runtime-questions.ts', 'which providers are ready...', '--json'],
  { cwd: root, encoding: 'utf8' },
);
const snapshot = JSON.parse(output);

if (snapshot.surface !== 'natural-runtime-questions') {
  throw new Error(`unexpected surface ${snapshot.surface}`);
}
if (snapshot.intent !== 'providers_ready') {
  throw new Error(`unexpected intent ${snapshot.intent}`);
}
if (snapshot.safety.projectionOnly !== true || snapshot.safety.noLiveNetworkByDefault !== true) {
  throw new Error('natural runtime question safety invariant missing');
}
if (!snapshot.sources.every((source) => source.executionAuthority === false)) {
  throw new Error('runtime question sources must be projection-only');
}
if (/\bsk-[A-Za-z0-9_-]{12,}\b/.test(output)) {
  throw new Error('raw secret leaked in natural runtime question output');
}

const executionOutput = execFileSync(
  runner,
  [...prefix, 'tsx', 'scripts/zavorth-natural-runtime-questions.ts', 'Docker and WSL are ready for isolated run...', '--json'],
  { cwd: root, encoding: 'utf8' },
);
const executionSnapshot = JSON.parse(executionOutput);

if (executionSnapshot.intent !== 'execution_backends_ready') {
  throw new Error(`unexpected execution backend intent ${executionSnapshot.intent}`);
}
if (!executionSnapshot.answer.cards.some((card) => card.id === 'execution-backends')) {
  throw new Error('execution backend answer card missing');
}
if (!executionSnapshot.sources.some((source) =>
  source.id === 'execution-backends' &&
  source.surface === 'terminal-backends' &&
  source.executionAuthority === false
)) {
  throw new Error('execution backend source must be terminal-backends and projection-only');
}
if (
  executionSnapshot.runtimeProjection.executionAuthority !== false ||
  executionSnapshot.safety.projectionOnly !== true ||
  executionSnapshot.safety.doesNotMutateConfiguration !== true
) {
  throw new Error('execution backend runtime question must stay read-only');
}

execFileSync(
  runner,
  [...prefix, 'jest', '--runTestsByPath', 'tests/services/ZavorthNaturalRuntimeQuestionsService.test.ts', '--runInBand'],
  { cwd: root, stdio: 'inherit' },
);

console.log('[zavorth-natural-runtime-questions-check] ok');
