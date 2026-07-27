import { execFileSync } from 'node:child_process';
import path from 'node:path';

const TSX_CLI = path.join(process.cwd(), 'node_modules', 'tsx', 'dist', 'cli.mjs');
const JEST_CLI = path.join(process.cwd(), 'node_modules', 'jest', 'bin', 'jest.js');

function run(args) {
  return execFileSync(process.execPath, args, {
    cwd: process.cwd(),
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: 20 * 1024 * 1024,
  });
}

const raw = run([TSX_CLI, 'scripts/zavorth-daily-use-scenario-test.ts', '--json']);
const snapshot = JSON.parse(raw);
const failures = [];

if (snapshot.contractVersion !== 'zavorth-daily-use-scenario-test/1') failures.push('contract version mismatch');
if (snapshot.surface !== 'daily-use-scenario-test') failures.push('surface mismatch');
if (!['passed', 'attention', 'failed'].includes(snapshot.status)) failures.push('invalid status');
if (snapshot.summary?.scenarios !== 5) failures.push('expected exactly five daily-use scenarios');
if (snapshot.summary?.failed !== 0) failures.push('daily-use scenario has failed cases');
for (const id of ['faculdade-documentos', 'provider-llm', 'skill-curator', 'telegram-remote', 'agent-review-swarm']) {
  if (!snapshot.scenarios?.some((scenario) => scenario.id === id)) failures.push(`missing scenario ${id}`);
}
if (snapshot.safety?.dryRunOnly !== true) failures.push('dry-run-only safety missing');
if (snapshot.safety?.noTelegramMessageSent !== true) failures.push('telegram no-send safety missing');
if (snapshot.safety?.noLiveProviderProbeByDefault !== true) failures.push('provider no-live-probe safety missing');
if (snapshot.scenarios?.some((scenario) => scenario.safety?.rawSecretsSerialized !== false)) failures.push('scenario serialized raw secrets');
if (snapshot.scenarios?.some((scenario) => !scenario.nextAction)) failures.push('scenario missing next action');

run([JEST_CLI, 'tests/services/ZavorthDailyUseScenarioTestService.test.ts', '--runInBand']);

if (failures.length > 0) {
  console.error(`[zavorth-daily-use-scenario-test-check] failed:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}

console.log('[zavorth-daily-use-scenario-test-check] ok');
