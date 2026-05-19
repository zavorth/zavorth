import { execFileSync } from 'node:child_process';
import path from 'node:path';

const TSX_CLI = path.join(process.cwd(), 'node_modules', 'tsx', 'dist', 'cli.mjs');
const JEST_CLI = path.join(process.cwd(), 'node_modules', 'jest', 'bin', 'jest.js');

function run(command, args) {
  return execFileSync(command, args, {
    cwd: process.cwd(),
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

const raw = run(process.execPath, [TSX_CLI, 'scripts/zavorth-trust-approval-ux-final.ts', '--json']);
const snapshot = JSON.parse(raw);

const failures = [];
if (snapshot.contractVersion !== 'zavorth-trust-approval-ux-final/1') {
  failures.push('contract version mismatch');
}
if (snapshot.surface !== 'trust-approval-ux-final') {
  failures.push('surface mismatch');
}
if (!['ready', 'attention', 'danger'].includes(snapshot.status)) {
  failures.push('invalid status');
}
if (!Array.isArray(snapshot.cards) || snapshot.cards.length < 4) {
  failures.push('missing trust cards');
}
if (!snapshot.cards.some((card) => card.id === 'approval-inbox')) {
  failures.push('missing approval inbox card');
}
if (!snapshot.cards.some((card) => card.id === 'persistent-permissions')) {
  failures.push('missing persistent permissions card');
}
if (!snapshot.cards.some((card) => card.id === 'break-glass')) {
  failures.push('missing break glass card');
}
if (snapshot.safety?.breakGlassRequiresDoubleConfirmation !== true) {
  failures.push('break glass double confirmation safety missing');
}
if (snapshot.safety?.criticalRiskCannotBeAutoApproved !== true) {
  failures.push('critical risk safety missing');
}
if (snapshot.safety?.rawSecretsSerialized !== false) {
  failures.push('raw secret serialization safety mismatch');
}

run(process.execPath, [JEST_CLI, 'tests/services/ZavorthTrustApprovalUxFinalService.test.ts', '--runInBand']);

if (failures.length > 0) {
  console.error(`zavorth-trust-approval-ux-final check failed:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}

console.log('zavorth-trust-approval-ux-final check passed');
