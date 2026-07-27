import { ZavorthMutationPlaneService } from '../../services/ZavorthMutationPlaneService.js';
import type { ZavorthApprovalScope } from '../../contracts/ZavorthMutationPlaneContract.js';
import { buildZavorthCliApprovalDiffSnapshot } from './ZavorthCliApprovalDiffProjection.js';
import { renderZavorthCliApprovalDiff } from './ZavorthCliApprovalDiffRenderer.js';
import type { ZavorthCliApprovalDiffSnapshot } from './ZavorthCliApprovalDiffTypes.js';

export type RunZavorthCliApprovalDiffInput = {
  projectRoot: string;
  args?: string[];
  view: 'approvals' | 'diff';
  json?: boolean;
  now?: () => Date;
  mutationPlane?: Pick<ZavorthMutationPlaneService, 'listPlans' | 'readPlan' | 'approvePlan'>;
};

export type RunZavorthCliApprovalDiffResult = {
  exitCode: number;
  output: string;
  snapshot: ZavorthCliApprovalDiffSnapshot;
};

export function runZavorthCliApprovalDiff(input: RunZavorthCliApprovalDiffInput): RunZavorthCliApprovalDiffResult {
  const args = input.args || [];
  const targetPlanId = args.find((arg) => !arg.startsWith('--') && !['approve', 'list', 'show'].includes(arg.toLowerCase())) || null;
  const approve = input.view === 'approvals' && args.includes('--yes');
  const snapshot = buildZavorthCliApprovalDiffSnapshot({
    projectRoot: input.projectRoot,
    view: input.view,
    targetPlanId,
    now: input.now,
    mutationPlane: input.mutationPlane || new ZavorthMutationPlaneService(),
    approve,
    approvedBy: readFlag(args, 'by') || 'cli',
    scope: normalizeScope(readFlag(args, 'scope')),
  });
  const output = input.json || args.includes('--json') ? `${JSON.stringify(snapshot, null, 2)}\n`
    : `${renderZavorthCliApprovalDiff(snapshot)}\n`;

  return {
    exitCode: snapshot.decision.status === 'not_found' ? 1 : 0,
    output,
    snapshot,
  };
}

function readFlag(args: string[], name: string): string | null {
  const inline = args.find((arg) => arg.startsWith(`--${name}=`));
  if (inline) {
    return inline.slice(name.length + 3);
  }
  const index = args.indexOf(`--${name}`);
  return index >= 0 && args[index + 1] && !args[index + 1].startsWith('--') ? args[index + 1] : null;
}

function normalizeScope(value: string | null): ZavorthApprovalScope {
  return value === 'session' || value === 'host' ? value : 'once';
}
