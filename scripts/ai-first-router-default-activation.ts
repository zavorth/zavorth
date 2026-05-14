import { AiFirstOwnerControlledDefaultActivationService } from '../src/services/AiFirstOwnerControlledDefaultActivationService.js';

const args = process.argv.slice(2);
const action = String(args[0] || 'status').trim().toLowerCase();
const asJson = args.includes('--json');
const requirePass = args.includes('--require-pass');
const service = new AiFirstOwnerControlledDefaultActivationService({
  dataDir: readArg('--data-dir') || undefined,
  statePath: readArg('--state-path') || undefined,
  ledgerPath: readArg('--ledger-path') || undefined,
});

try {
  const result = run();
  if (asJson) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } else {
    process.stdout.write(`${service.renderText(result)}\n`);
  }
  if (requirePass && ['blocked', 'missing'].includes(result.status)) {
    process.exitCode = 1;
  }
} catch (error) {
  console.error('[ai-first-router-default-activation] falhou:', error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}

function run() {
  if (action === 'plan' || action === 'activate') {
    const snapshotPath = readArg('--snapshot');
    const snapshot = snapshotPath ? service.readSnapshotFile(snapshotPath) : null;
    const input = {
      snapshot,
      ownerApprovalId: readArg('--owner-approval-id'),
      apply: args.includes('--apply'),
      confirmOwnerControlledDefault: args.includes('--confirm-owner-controlled-default'),
    };
    return action === 'activate' ? service.activate(input) : service.plan(input);
  }
  if (action === 'rollback') {
    return service.rollback({
      ownerApprovalId: readArg('--owner-approval-id'),
      apply: args.includes('--apply'),
      confirmRollback: args.includes('--confirm-rollback'),
      reason: readArg('--reason'),
    });
  }
  if (action === 'status') {
    return service.status(readNumberArg('--limit') || 20);
  }
  throw new Error(`Unsupported action "${action}". Use plan, activate, status or rollback.`);
}

function readArg(name: string): string | null {
  const direct = args.find((arg) => arg.startsWith(`${name}=`));
  if (direct) {
    return direct.slice(name.length + 1);
  }
  const index = args.indexOf(name);
  if (index >= 0 && args[index + 1]) {
    return args[index + 1] || null;
  }
  return null;
}

function readNumberArg(name: string): number | null {
  const raw = readArg(name);
  if (!raw) {
    return null;
  }
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}
