import { ZavorthGovernanceRecipeApiService } from '../src/services/ZavorthGovernanceRecipeApiService.js';

const args = process.argv.slice(2);
const asJson = args.includes('--json');
const action = resolveAction();
const input = {
  recipeId: readOption('--recipe'),
  targetItemId: readOption('--plan') || readOption('--target') || readOption('--inspect'),
  search: readOption('--search'),
  dryRun: !args.includes('--live'),
  approvalId: readOption('--approval-id'),
};

const api = new ZavorthGovernanceRecipeApiService();

if (action === 'plan') {
  const plan = api.plan(input);
  write(plan || { error: 'governance recipe plan not found' });
} else if (action === 'dry-run') {
  const receipt = api.dryRun(input);
  write(receipt || { error: 'governance recipe dry-run not found' });
} else {
  const snapshot = api.buildSnapshot(input);
  if (asJson) {
    write(snapshot);
  } else {
    console.log(api.renderReport(input));
  }
}

function resolveAction(): 'list' | 'plan' | 'dry-run' {
  const positional = args.find((arg) => !arg.startsWith('--'));
  if (positional === 'plan') {
    return 'plan';
  }
  if (positional === 'dry-run' || positional === 'execute') {
    return 'dry-run';
  }
  if (args.includes('--plan') || args.includes('--target') || args.includes('--inspect')) {
    return 'plan';
  }
  if (args.includes('--dry-run')) {
    return 'dry-run';
  }
  return 'list';
}

function write(value: unknown): void {
  if (asJson) {
    console.log(JSON.stringify(value, null, 2));
    return;
  }
  if (value && typeof value === 'object' && 'recipeId' in value && 'targetItemId' in value) {
    const plan = value as {
      recipeId: string;
      targetItemId: string;
      status?: string;
      dryRunOnly?: boolean;
      permissions?: { approvalRequired?: boolean; approvalReason?: string };
      rollback?: { strategy?: string };
      narrative?: { headline?: string; operatorSummary?: string; nextAction?: string };
    };
    console.log('Zavorth Governance Recipe Plan');
    console.log('');
    console.log(`${plan.recipeId} -> ${plan.targetItemId}`);
    console.log(`Status: ${plan.status || 'unknown'} | dryRunOnly=${Boolean(plan.dryRunOnly)}`);
    console.log(`Approval: ${Boolean(plan.permissions?.approvalRequired)} | ${plan.permissions?.approvalReason || 'n/a'}`);
    console.log(`Rollback: ${plan.rollback?.strategy || 'none'}`);
    console.log('');
    console.log(plan.narrative?.operatorSummary || plan.narrative?.headline || 'Plan generated.');
    console.log(`Next: ${plan.narrative?.nextAction || 'Review plan before live activation.'}`);
    return;
  }
  console.log(String(value));
}

function readOption(name: string): string | null {
  const index = args.indexOf(name);
  if (index < 0) {
    return null;
  }
  const value = args[index + 1];
  if (!value || value.startsWith('--')) {
    return null;
  }
  return value;
}
