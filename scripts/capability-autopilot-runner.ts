#!/usr/bin/env node
import { requireAutopilotCapabilityId } from '../src/services/CapabilityAutopilotSelection.js';
import { CapabilityAutopilotApprovedRepairRunnerService } from '../src/services/CapabilityAutopilotApprovedRepairRunnerService.js';
import { CapabilityAutopilotReceiptService } from '../src/services/CapabilityAutopilotReceiptService.js';
import type {
  CapabilityReceipt,
  CapabilityRepairRunResult,
} from '../src/contracts/CapabilityAutopilotContract.js';
import type { PermissionRequest } from '../src/contracts/PermissionRequest.js';

type CapabilityAutopilotRunnerCheck = {
  id: string;
  status: 'pass' | 'warn' | 'fail';
  title: string;
  reason: string;
  evidence: string[];
};

type CapabilityAutopilotRunnerSnapshot = {
  stage: '61';
  surface: 'capability-autopilot-runner';
  generatedAt: string;
  capabilityId: string;
  status: 'ready' | 'attention' | 'blocked';
  summary: {
    ok: boolean;
    passed: number;
    warnings: number;
    failed: number;
  };
  dryRun: boolean;
  receipt: CapabilityReceipt;
  run: CapabilityRepairRunResult;
  checks: CapabilityAutopilotRunnerCheck[];
  nextRecommendedStage: {
    stage: '62';
    title: string;
    reason: string;
  };
};

const argv = process.argv.slice(2);
const asJson = argv.includes('--json');
const requirePass = argv.includes('--require-pass') || argv.includes('--gate');
const dryRun = !argv.includes('--apply');
const capabilityId = (() => { try { return requireAutopilotCapabilityId(typeof argv !== 'undefined' ? argv : process.argv.slice(2)); } catch (error) { process.stderr.write('[' + 'capability-autopilot-runner' + '] ' + (error instanceof Error ? error.message : String(error)) + '\n'); process.exit(1); return ''; } })();

main().catch((error) => {
  process.stderr.write(`[capability-autopilot-runner] failure: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});

async function main(): Promise<void> {
  const receiptService = new CapabilityAutopilotReceiptService();
  const receipt = await receiptService.buildCapabilityReceipt(capabilityId, {
    surface: 'cli',
    audience: asJson ? 'technical_operator' : 'everyday_user',
  });

  if (!receipt.repairPlan) {
    throw new Error(`Capability ${capabilityId} did not generate repair plan.`);
  }

  const runner = new CapabilityAutopilotApprovedRepairRunnerService();
  const run = await runner.runApprovedRepair({
    repairPlan: receipt.repairPlan,
    permissions: buildFixtureApprovals(receipt),
    dryRun,
    requestedBy: 'gate-61-gate',
  });
  const snapshot = buildSnapshot(receipt, run, dryRun);

  if (asJson) {
    process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
  } else {
    process.stdout.write(`${renderReport(snapshot)}\n`);
  }

  if (requirePass && !snapshot.summary.ok) {
    process.exitCode = 1;
  }
}

function readArg(prefix: string): string | null {
  const found = argv.find((arg) => arg.startsWith(prefix));
  const value = found ? found.slice(prefix.length).trim() : '';
  return value || null;
}

function buildFixtureApprovals(receipt: CapabilityReceipt): PermissionRequest[] {
  const repairPlan = receipt.repairPlan;
  if (!repairPlan) {
    return [];
  }

  return repairPlan.permissionRequirements.map((requirement, index) => ({
    permission_id: `gate-61-fixture-${index + 1}`,
    created_at: receipt.generatedAt,
    updated_at: receipt.generatedAt,
    task_id: receipt.resumeIntent?.taskId || null,
    executor: receipt.readiness?.executor?.executorName || repairPlan.capabilityId,
    kind: requirement.kind,
    status: 'approved',
    scope: requirement.scope === 'host' || requirement.scope === 'persistent'
      ? 'persistent'
      : requirement.scope === 'session'
        ? 'session'
        : requirement.scope === 'once'
          ? 'once'
          : 'workspace',
    workspace: receipt.resumeIntent?.workspace || null,
    requested_value: requirement.requestedValue || null,
    resolved_value: requirement.resolvedValue || null,
    reason: requirement.reason,
    requested_by: receipt.resumeIntent?.userId || 'gate-61-gate',
    decided_by: 'gate-61-gate',
    decision_note: 'Local fixture of Runtime gateway1 gate; does not persist in ledger.',
    metadata: {
      capability_autopilot: true,
      stage: 'capability-autopilot-repair-runner',
      requirement_id: requirement.id,
      fixture: true,
    },
  }));
}

function buildSnapshot(
  receipt: CapabilityReceipt,
  run: CapabilityRepairRunResult,
  dryRun: boolean,
): CapabilityAutopilotRunnerSnapshot {
  const checks = buildChecks(receipt, run, dryRun);
  const failed = checks.filter((check) => check.status === 'fail').length;
  const warnings = checks.filter((check) => check.status === 'warn').length;
  const passed = checks.filter((check) => check.status === 'pass').length;

  return {
    stage: '61',
    surface: 'capability-autopilot-runner',
    generatedAt: new Date().toISOString(),
    capabilityId: receipt.capabilityId,
    status: failed > 0 ? 'blocked' : warnings > 0 ? 'attention' : 'ready',
    summary: {
      ok: failed === 0,
      passed,
      warnings,
      failed,
    },
    dryRun,
    receipt,
    run,
    checks,
    nextRecommendedStage: {
      stage: '62',
      title: 'Validation And Resume Loop',
      reason:
        'After the approved runner, the next step is to validate post-repair readiness and resume the original request only when the capability is ready.',
    },
  };
}

function buildChecks(
  receipt: CapabilityReceipt,
  run: CapabilityRepairRunResult,
  dryRun: boolean,
): CapabilityAutopilotRunnerCheck[] {
  return [
    check(
      'capability-autopilot-runner:approval',
      'permission approved before runner',
      run.approved && run.permissionStatus === 'approved' || run.permissionStatus === 'not_required' ? 'pass' : 'fail',
      'The runner can only pass the gate when required permissions are approved or not required.',
      [`permissionStatus=${run.permissionStatus}`, `approved=${String(run.approved)}`],
    ),
    check(
      'capability-autopilot-runner:dry-run-default',
      'safe dry-run by default',
      dryRun && run.dryRun ? 'pass' : 'warn',
      dryRun ? 'The gate runs in dry-run and does not execute real commands.'
        : 'Apply mode was explicitly requested; confirm evidence before release.',
      [`dryRun=${String(run.dryRun)}`],
    ),
    check(
      'capability-autopilot-runner:step-results',
      'steps registered',
      run.steps.length === (receipt.repairPlan?.steps.length || 0) ? 'pass' : 'fail',
      'Each repair plan step needs to appear in the runner result.',
      [`planSteps=${String(receipt.repairPlan?.steps.length || 0)}`, `runSteps=${String(run.steps.length)}`],
    ),
    check(
      'capability-autopilot-runner:no-hidden-command',
      'no hidden real command',
      dryRun && run.steps.every((step) => step.status !== 'succeeded' || !step.command) ? 'pass' : 'fail',
      'In dry-run, executable commands should stay as dry_run, never as executed.',
      run.steps.map((step) => `${step.stepId}:${step.status}`),
    ),
    check(
      'capability-autopilot-runner:status',
      'accepted final status',
      ['dry_run', 'completed', 'partial'].includes(run.status) ? 'pass' : 'fail',
      'The approved runner needs to finish as dry_run/completed/partial, without blocked or failed.',
      [`status=${run.status}`],
    ),
  ];
}

function check(
  id: string,
  title: string,
  status: CapabilityAutopilotRunnerCheck['status'],
  reason: string,
  evidence: string[] = [],
): CapabilityAutopilotRunnerCheck {
  return {
    id,
    title,
    status,
    reason,
    evidence,
  };
}

function renderReport(snapshot: CapabilityAutopilotRunnerSnapshot): string {
  const lines: string[] = [];
  lines.push('[capability-autopilot-runner] Approved Repair Runner');
  lines.push(`status: ${snapshot.status}`);
  lines.push(`ok: ${snapshot.summary.ok ? 'yes' : 'no'} | pass=${snapshot.summary.passed} warn=${snapshot.summary.warnings} fail=${snapshot.summary.failed}`);
  lines.push(`capability: ${snapshot.capabilityId}`);
  lines.push(`run: ${snapshot.run.status} | permission=${snapshot.run.permissionStatus} | dryRun=${snapshot.run.dryRun}`);
  lines.push('');
  for (const item of snapshot.checks) {
    lines.push(`[${item.status}] ${item.title}`);
    lines.push(`  ${item.reason}`);
    for (const evidence of item.evidence) {
      lines.push(`  - ${evidence}`);
    }
  }
  lines.push('');
  lines.push(`recommended next step: ${snapshot.nextRecommendedStage.phase} - ${snapshot.nextRecommendedStage.title}`);
  lines.push(snapshot.nextRecommendedStage.reason);
  return lines.join('\n');
}
