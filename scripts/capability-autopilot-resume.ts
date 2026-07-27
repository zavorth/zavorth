#!/usr/bin/env node
import { requireAutopilotCapabilityId } from '../src/services/CapabilityAutopilotSelection.js';
import { CapabilityAutopilotReceiptService } from '../src/services/CapabilityAutopilotReceiptService.js';
import { CapabilityAutopilotValidationResumeService } from '../src/services/CapabilityAutopilotValidationResumeService.js';
import type {
  CapabilityReceipt,
  CapabilityAutopilotAudience,
  CapabilityAutopilotSurface,
} from '../src/contracts/CapabilityAutopilotContract.js';
import type { PermissionRequest } from '../src/contracts/PermissionRequest.js';

type CapabilityAutopilotResumeCheck = {
  id: string;
  status: 'pass' | 'warn' | 'fail';
  title: string;
  reason: string;
  evidence: string[];
};

type CapabilityAutopilotResumeSnapshot = {
  stage: '62';
  surface: 'capability-autopilot-resume';
  generatedAt: string;
  capabilityId: string;
  status: 'ready' | 'attention' | 'blocked';
  summary: {
    ok: boolean;
    passed: number;
    warnings: number;
    failed: number;
  };
  initialReceipt: CapabilityReceipt;
  result: Awaited<ReturnType<CapabilityAutopilotValidationResumeService['validateForResume']>>;
  checks: CapabilityAutopilotResumeCheck[];
  nextRecommendedStage: {
    stage: '63';
    title: string;
    reason: string;
  };
};

const argv = process.argv.slice(2);
const asJson = argv.includes('--json');
const requirePass = argv.includes('--require-pass') || argv.includes('--gate');
const capabilityId = (() => { try { return requireAutopilotCapabilityId(typeof argv !== 'undefined' ? argv : process.argv.slice(2)); } catch (error) { process.stderr.write('[' + 'capability-autopilot-resume' + '] ' + (error instanceof Error ? error.message : String(error)) + '\n'); process.exit(1); return ''; } })();
const surface = (readArg('--surface=') || 'cli') as CapabilityAutopilotSurface;
const audience = (asJson ? 'technical_operator' : 'everyday_user') as CapabilityAutopilotAudience;

main().catch((error) => {
  process.stderr.write(`[capability-autopilot-resume] failure: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});

async function main(): Promise<void> {
  const receiptService = new CapabilityAutopilotReceiptService();
  const initialReceipt = await receiptService.buildCapabilityReceipt(capabilityId, {
    surface,
    audience,
  });
  const resumeService = new CapabilityAutopilotValidationResumeService();
  const result = await resumeService.validateForResume({
    capabilityId,
    previousReceipt: initialReceipt,
    permissions: buildFixtureApprovals(initialReceipt),
    surface,
    audience,
  });
  const snapshot = buildSnapshot(initialReceipt, result);

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
    permission_id: `gate-62-fixture-${index + 1}`,
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
    requested_by: receipt.resumeIntent?.userId || 'gate-62-gate',
    decided_by: 'gate-62-gate',
    decision_note: 'Local fixture of Runtime gateway2 gate; does not persist in ledger.',
    metadata: {
      capability_autopilot: true,
      stage: 'capability-autopilot-validation-resume',
      requirement_id: requirement.id,
      fixture: true,
    },
  }));
}

function buildSnapshot(
  initialReceipt: CapabilityReceipt,
  result: Awaited<ReturnType<CapabilityAutopilotValidationResumeService['validateForResume']>>,
): CapabilityAutopilotResumeSnapshot {
  const checks = buildChecks(initialReceipt, result);
  const failed = checks.filter((check) => check.status === 'fail').length;
  const warnings = checks.filter((check) => check.status === 'warn').length;
  const passed = checks.filter((check) => check.status === 'pass').length;

  return {
    stage: '62',
    surface: 'capability-autopilot-resume',
    generatedAt: new Date().toISOString(),
    capabilityId: initialReceipt.capabilityId,
    status: failed > 0 ? 'blocked' : warnings > 0 ? 'attention' : 'ready',
    summary: {
      ok: failed === 0,
      passed,
      warnings,
      failed,
    },
    initialReceipt,
    result,
    checks,
    nextRecommendedStage: {
      stage: '63',
      title: 'Cross-Surface Capability UX',
      reason:
        'After validating resume safely, the next step is to expose the same receipt and state across CLI, web, chat and messaging.',
    },
  };
}

function buildChecks(
  initialReceipt: CapabilityReceipt,
  result: Awaited<ReturnType<CapabilityAutopilotValidationResumeService['validateForResume']>>,
): CapabilityAutopilotResumeCheck[] {
  const readinessReady = Boolean(result.readiness?.ready && result.readiness.safeToRun);
  return [
    check(
      'capability-autopilot-resume:permission-gate',
      'permission gate before revalidation',
      ['approved', 'not_required'].includes(result.permissionStatus) ? 'pass' : 'fail',
      'Resume can only recalculate readiness when required permissions are approved or not required.',
      [`permissionStatus=${result.permissionStatus}`, `permissions=${String(result.permissions.length)}`],
    ),
    check(
      'capability-autopilot-resume:readiness-recomputed',
      'readiness recalculated',
      result.readiness ? 'pass' : 'fail',
      'After the permission gate, the validation/resume gate recalculates readiness before resuming.',
      [`readiness=${result.readiness?.status || '<absent>'}`, `safeToRun=${String(result.readiness?.safeToRun ?? '<absent>')}`],
    ),
    check(
      'capability-autopilot-resume:no-false-resume',
      'no false resume',
      readinessReady || result.status !== 'ready_to_resume' ? 'pass' : 'fail',
      'If readiness still fails, Zavorth should return to diagnosis/planning instead of resuming the request.',
      [`ready=${String(readinessReady)}`, `status=${result.status}`],
    ),
    check(
      'capability-autopilot-resume:validation-result',
      'coherent validation result',
      result.validation.success === readinessReady ? 'pass' : 'fail',
      'Validation success must reflect readiness.ready && safeToRun.',
      [`validation=${String(result.validation.success)}`, `ready=${String(readinessReady)}`],
    ),
    check(
      'capability-autopilot-resume:receipt',
      'final auditable receipt',
      Boolean(result.receipt.timeline.length) ? 'pass' : 'fail',
      'The decision to resume or return to repair needs to generate a receipt with timeline.',
      [
        `initialStage=${initialReceipt.stage}`,
        `finalStage=${result.receipt.stage}`,
        `timeline=${String(result.receipt.timeline.length)}`,
      ],
    ),
  ];
}

function check(
  id: string,
  title: string,
  status: CapabilityAutopilotResumeCheck['status'],
  reason: string,
  evidence: string[] = [],
): CapabilityAutopilotResumeCheck {
  return {
    id,
    title,
    status,
    reason,
    evidence,
  };
}

function renderReport(snapshot: CapabilityAutopilotResumeSnapshot): string {
  const lines: string[] = [];
  lines.push('[capability-autopilot-resume] Validation And Resume Loop');
  lines.push(`status: ${snapshot.status}`);
  lines.push(`ok: ${snapshot.summary.ok ? 'yes' : 'no'} | pass=${snapshot.summary.passed} warn=${snapshot.summary.warnings} fail=${snapshot.summary.failed}`);
  lines.push(`capability: ${snapshot.capabilityId}`);
  lines.push(`resume: ${snapshot.result.status} | permission=${snapshot.result.permissionStatus} | validation=${snapshot.result.validation.success}`);
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
