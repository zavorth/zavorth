#!/usr/bin/env node
import {
  CapabilityAutopilotPermissionService,
  type CapabilityAutopilotPermissionMapping,
} from '../src/services/CapabilityAutopilotPermissionService.js';
import { CapabilityAutopilotReceiptService } from '../src/services/CapabilityAutopilotReceiptService.js';
import type {
  CapabilityReceipt,
  CapabilityRepairPlan,
} from '../src/contracts/CapabilityAutopilotContract.js';

type CapabilityAutopilotGateCheck = {
  id: string;
  status: 'pass' | 'warn' | 'fail';
  title: string;
  reason: string;
  evidence: string[];
};

type CapabilityAutopilotGateSnapshot = {
  stage: '60';
  surface: 'capability-autopilot';
  generatedAt: string;
  capabilityId: string;
  status: 'ready' | 'attention' | 'blocked';
  summary: {
    ok: boolean;
    passed: number;
    warnings: number;
    failed: number;
  };
  receipt: CapabilityReceipt;
  permissionMappings: CapabilityAutopilotPermissionMapping[];
  checks: CapabilityAutopilotGateCheck[];
  nextRecommendedStage: {
    stage: '61';
    title: string;
    reason: string;
  };
};

const argv = process.argv.slice(2);
const asJson = argv.includes('--json');
const requirePass = argv.includes('--require-pass') || argv.includes('--gate');
const capabilityId = readArg('--capability=') || 'executor-gemini-cli';

main().catch((error) => {
  process.stderr.write(`[capability-autopilot] falha: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});

async function main(): Promise<void> {
  const receiptService = new CapabilityAutopilotReceiptService();
  const receipt = await receiptService.buildCapabilityReceipt(capabilityId, {
    surface: 'cli',
    audience: asJson ? 'technical_operator' : 'everyday_user',
  });
  const permissionMappings = buildPermissionMappings(receipt.repairPlan);
  const snapshot = buildSnapshot(receipt, permissionMappings);

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

function buildPermissionMappings(
  repairPlan: CapabilityRepairPlan | null | undefined,
): CapabilityAutopilotPermissionMapping[] {
  if (!repairPlan) {
    return [];
  }

  const permissionService = new CapabilityAutopilotPermissionService();
  return repairPlan.permissionRequirements.map((requirement) =>
    permissionService.mapRequirement(
      requirement,
      repairPlan,
      repairPlan.resumeIntent?.workspace || null,
    ),
  );
}

function buildSnapshot(
  receipt: CapabilityReceipt,
  mappings: CapabilityAutopilotPermissionMapping[],
): CapabilityAutopilotGateSnapshot {
  const checks = buildChecks(receipt, mappings);
  const failed = checks.filter((check) => check.status === 'fail').length;
  const warnings = checks.filter((check) => check.status === 'warn').length;
  const passed = checks.filter((check) => check.status === 'pass').length;

  return {
    stage: '60',
    surface: 'capability-autopilot',
    generatedAt: new Date().toISOString(),
    capabilityId: receipt.capabilityId,
    status: failed > 0 ? 'blocked' : warnings > 0 ? 'attention' : 'ready',
    summary: {
      ok: failed === 0,
      passed,
      warnings,
      failed,
    },
    receipt,
    permissionMappings: mappings,
    checks,
    nextRecommendedStage: {
      stage: '61',
      title: 'Capability Autopilot Approved Repair Runner',
      reason:
        'Depois do preflight, diagnostico, plano, receipt e mapeamento de permissao, o proximo passo e executar reparos somente apos aprovacao explicita.',
    },
  };
}

function buildChecks(
  receipt: CapabilityReceipt,
  mappings: CapabilityAutopilotPermissionMapping[],
): CapabilityAutopilotGateCheck[] {
  const repairPlan = receipt.repairPlan || null;
  const checks: CapabilityAutopilotGateCheck[] = [];

  checks.push(check(
    'capability-autopilot:descriptor',
    'capability reconhecida',
    receipt.capabilityId !== 'unknown' ? 'pass' : 'fail',
    receipt.capabilityId !== 'unknown'
      ? 'O autopilot conseguiu resolver a capability solicitada.'
      : 'O autopilot precisa receber uma capability conhecida.',
    [`capability=${receipt.capabilityId}`, `label=${receipt.capabilityLabel}`],
  ));

  checks.push(check(
    'capability-autopilot:readiness',
    'readiness gerado',
    receipt.readiness ? 'pass' : 'fail',
    receipt.readiness
      ? 'O preflight produziu snapshot de readiness sem executar reparo.'
      : 'O preflight precisa produzir readiness antes de diagnosticar.',
    [
      `status=${receipt.readiness?.status || '<ausente>'}`,
      `safeToRun=${String(receipt.readiness?.safeToRun ?? '<ausente>')}`,
    ],
  ));

  checks.push(check(
    'capability-autopilot:diagnosis',
    'diagnostico classificado',
    receipt.diagnosis ? 'pass' : 'fail',
    receipt.diagnosis
      ? 'O readiness foi traduzido em causa operacional e narrativa.'
      : 'O autopilot precisa diagnosticar readiness antes de propor reparo.',
    [
      `failure=${receipt.diagnosis?.failureKind || '<ausente>'}`,
      `confidence=${String(receipt.diagnosis?.confidence ?? '<ausente>')}`,
    ],
  ));

  checks.push(check(
    'capability-autopilot:repair-plan',
    'plano preview-first',
    repairPlan ? 'pass' : 'fail',
    repairPlan
      ? 'O autopilot gerou plano de reparo em modo declarativo.'
      : 'O autopilot precisa gerar repair plan antes de pedir permissao.',
    [
      `status=${repairPlan?.status || '<ausente>'}`,
      `steps=${String(repairPlan?.steps.length ?? 0)}`,
      `permissions=${String(repairPlan?.permissionRequirements.length ?? 0)}`,
    ],
  ));

  const executableSteps = repairPlan?.steps.filter((step) => Boolean(step.command)) || [];
  checks.push(check(
    'capability-autopilot:preview-only',
    'sem comando invisivel',
    executableSteps.length === 0 ? 'pass' : 'fail',
    executableSteps.length === 0
      ? 'A etapa 60 so propõe plano/receipt; nenhum comando de reparo fica armado para execucao.'
      : 'Repair steps desta etapa nao devem carregar comandos executaveis.',
    executableSteps.map((step) => step.id),
  ));

  const approvalRequired = repairPlan?.status === 'approval_required';
  const hasPermissionRequirements = Boolean(repairPlan?.permissionRequirements.length);
  checks.push(check(
    'capability-autopilot:permission-mapping',
    'permissao contextual mapeada',
    approvalRequired === hasPermissionRequirements && mappings.length === (repairPlan?.permissionRequirements.length || 0)
      ? 'pass'
      : 'fail',
    approvalRequired
      ? 'Planos que exigem aprovacao carregam requirements mapeados para o ledger existente.'
      : 'Planos sem aprovacao obrigatoria nao criam pedido de permissao artificial.',
    [
      `approvalRequired=${String(approvalRequired)}`,
      `requirements=${String(repairPlan?.permissionRequirements.length || 0)}`,
      `mappings=${String(mappings.length)}`,
    ],
  ));

  checks.push(check(
    'capability-autopilot:receipt',
    'receipt auditavel',
    receipt.metadata?.readOnly === true && Boolean(receipt.timeline.length) ? 'pass' : 'fail',
    receipt.metadata?.readOnly === true
      ? 'O receipt preserva trilha auditavel e declara modo read-only.'
      : 'O receipt precisa ser auditavel e read-only nesta etapa.',
    [
      `stage=${receipt.stage}`,
      `timeline=${String(receipt.timeline.length)}`,
      `readOnly=${String(receipt.metadata?.readOnly ?? false)}`,
    ],
  ));

  return checks;
}

function check(
  id: string,
  title: string,
  status: CapabilityAutopilotGateCheck['status'],
  reason: string,
  evidence: string[] = [],
): CapabilityAutopilotGateCheck {
  return {
    id,
    title,
    status,
    reason,
    evidence,
  };
}

function renderReport(snapshot: CapabilityAutopilotGateSnapshot): string {
  const lines: string[] = [];
  lines.push('[capability-autopilot] Etapa 60 - Capability Autopilot Preflight');
  lines.push(`status: ${snapshot.status}`);
  lines.push(`ok: ${snapshot.summary.ok ? 'yes' : 'no'} | pass=${snapshot.summary.passed} warn=${snapshot.summary.warnings} fail=${snapshot.summary.failed}`);
  lines.push(`capability: ${snapshot.capabilityId}`);
  lines.push(`stage: ${snapshot.receipt.stage}`);
  lines.push(snapshot.receipt.headline);
  lines.push('');
  for (const item of snapshot.checks) {
    lines.push(`[${item.status}] ${item.title}`);
    lines.push(`  ${item.reason}`);
    for (const evidence of item.evidence) {
      lines.push(`  - ${evidence}`);
    }
  }
  lines.push('');
  lines.push(`proximo passo recomendada: ${snapshot.nextRecommendedStage.phase} - ${snapshot.nextRecommendedStage.title}`);
  lines.push(snapshot.nextRecommendedStage.reason);
  return lines.join('\n');
}
