import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const TSX_CLI = path.join(root, 'node_modules', 'tsx', 'dist', 'cli.mjs');
const JEST_CLI = path.join(root, 'node_modules', 'jest', 'bin', 'jest.js');

for (const file of [
  'src/services/ZavorthOneCommandOperatorCheckService.ts',
  'scripts/zavorth-one-command-operator-check.ts',
  'tests/services/ZavorthOneCommandOperatorCheckService.test.ts',
]) {
  if (!existsSync(path.join(root, file))) {
    throw new Error(`missing ${file}`);
  }
}

function run(args) {
  return execFileSync(process.execPath, args, {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: 20 * 1024 * 1024,
  });
}

const raw = run([TSX_CLI, 'scripts/zavorth-one-command-operator-check.ts', '--json']);
const snapshot = JSON.parse(raw);
const failures = [];

if (snapshot.contractVersion !== 'zavorth-one-command-operator-check/1') failures.push('contract version mismatch');
if (snapshot.surface !== 'one-command-operator-check') failures.push('surface mismatch');
if (!['ready', 'attention', 'blocked'].includes(snapshot.status)) failures.push('invalid status');
if (snapshot.summary?.areas !== 5) failures.push('expected exactly five operator areas');
for (const id of ['ready-to-go', 'daily-use', 'dashboard-permissions', 'trust-approvals', 'operator-safety']) {
  if (!snapshot.areas?.some((area) => area.id === id)) failures.push(`missing area ${id}`);
}
if (snapshot.safety?.noPromptExecution !== true) failures.push('prompt execution safety missing');
if (snapshot.safety?.noToolExecution !== true) failures.push('tool execution safety missing');
if (snapshot.safety?.noLiveTransactionExecution !== true) failures.push('transaction safety missing');
if (snapshot.safety?.dashboardCanExecuteTargetAction !== false) failures.push('dashboard execution boundary missing');
if (snapshot.source?.dashboard?.permissionPanel?.items?.length !== 5) failures.push('dashboard permission panel not linked');
if (snapshot.summary?.liveProviderProbeRequested !== false) failures.push('default check must not run live provider probe');

run([JEST_CLI, 'tests/services/ZavorthOneCommandOperatorCheckService.test.ts', '--runInBand']);

if (failures.length > 0) {
  console.error(`[zavorth-one-command-operator-check] failed:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}

console.log('[zavorth-one-command-operator-check] ok');
