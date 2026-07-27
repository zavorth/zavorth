#!/usr/bin/env node
import { requireAutopilotCapabilityId } from '../src/services/CapabilityAutopilotSelection.js';
import { CapabilityAutopilotReceiptService } from '../src/services/CapabilityAutopilotReceiptService.js';
import { CapabilityAutopilotSurfaceUxService } from '../src/services/CapabilityAutopilotSurfaceUxService.js';
import type {
  CapabilityAutopilotAudience,
  CapabilityAutopilotSurface,
  CapabilitySurfaceUxPayload,
} from '../src/contracts/CapabilityAutopilotContract.js';

type CapabilityAutopilotSurfacesCheck = {
  id: string;
  status: 'pass' | 'warn' | 'fail';
  title: string;
  reason: string;
  evidence: string[];
};

type CapabilityAutopilotSurfacesSnapshot = {
  stage: '63';
  surface: 'capability-autopilot-surfaces';
  generatedAt: string;
  capabilityId: string;
  status: 'ready' | 'attention' | 'blocked';
  summary: {
    ok: boolean;
    passed: number;
    warnings: number;
    failed: number;
  };
  payloads: CapabilitySurfaceUxPayload[];
  checks: CapabilityAutopilotSurfacesCheck[];
  nextRecommendedStage: {
    stage: '64';
    title: string;
    reason: string;
  };
};

const argv = process.argv.slice(2);
const asJson = argv.includes('--json');
const requirePass = argv.includes('--require-pass') || argv.includes('--gate');
const capabilityId = (() => { try { return requireAutopilotCapabilityId(typeof argv !== 'undefined' ? argv : process.argv.slice(2)); } catch (error) { process.stderr.write('[' + 'capability-autopilot-surfaces' + '] ' + (error instanceof Error ? error.message : String(error)) + '\n'); process.exit(1); return ''; } })();
const audience = (readArg('--audience=') || (asJson ? 'technical_operator' : 'everyday_user')) as CapabilityAutopilotAudience;
const surfaces = readSurfaces();

main().catch((error) => {
  process.stderr.write(`[capability-autopilot-surfaces] failure: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});

async function main(): Promise<void> {
  const receiptService = new CapabilityAutopilotReceiptService();
  const receipt = await receiptService.buildCapabilityReceipt(capabilityId, {
    surface: 'cli',
    audience,
  });
  const uxService = new CapabilityAutopilotSurfaceUxService();
  const payloads = uxService.buildPayloads(receipt, surfaces, audience);
  const snapshot = buildSnapshot(payloads);

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

function readSurfaces(): CapabilityAutopilotSurface[] {
  const inline = readArg('--surfaces=');
  const values = inline
    ? inline.split(',').map((entry) => entry.trim()).filter(Boolean)
    : ['cli', 'web', 'chat', 'telegram', 'api'];
  return values as CapabilityAutopilotSurface[];
}

function buildSnapshot(payloads: CapabilitySurfaceUxPayload[]): CapabilityAutopilotSurfacesSnapshot {
  const checks = buildChecks(payloads);
  const failed = checks.filter((check) => check.status === 'fail').length;
  const warnings = checks.filter((check) => check.status === 'warn').length;
  const passed = checks.filter((check) => check.status === 'pass').length;
  const first = payloads[0];

  return {
    stage: '63',
    surface: 'capability-autopilot-surfaces',
    generatedAt: new Date().toISOString(),
    capabilityId: first?.capabilityId || '<absent>',
    status: failed > 0 ? 'blocked' : warnings > 0 ? 'attention' : 'ready',
    summary: {
      ok: failed === 0,
      passed,
      warnings,
      failed,
    },
    payloads,
    checks,
    nextRecommendedStage: {
      stage: '64',
      title: 'Capability Memory And Replay Learning',
      reason:
        'After standardizing the cross-surface experience, the next step is to store learnings per workspace/capability without sensitive payload.',
    },
  };
}

function buildChecks(payloads: CapabilitySurfaceUxPayload[]): CapabilityAutopilotSurfacesCheck[] {
  const surfaces = new Set(payloads.map((payload) => payload.surface));
  const stageSet = new Set(payloads.map((payload) => payload.stage));
  const capabilitySet = new Set(payloads.map((payload) => payload.capabilityId));
  const permissionCounts = new Set(payloads.map((payload) => payload.metadata?.permissionCount));
  const expectedSurfaces = ['cli', 'web', 'chat', 'telegram', 'api'];
  const missingSurfaces = expectedSurfaces.filter((surface) => !surfaces.has(surface as CapabilityAutopilotSurface));
  const permissionPayloads = payloads.filter((payload) => payload.stage === 'permission');

  return [
    check(
      'capability-autopilot-surfaces:coverage',
      'mandatory surfaces',
      missingSurfaces.length === 0 ? 'pass' : 'fail',
      'The gate needs to generate payload for CLI, web, chat, Telegram and API.',
      [`surfaces=${Array.from(surfaces).join(',')}`, ...missingSurfaces.map((surface) => `missing=${surface}`)],
    ),
    check(
      'capability-autopilot-surfaces:canonical-decision',
      'same canonical decision',
      stageSet.size === 1 && capabilitySet.size === 1 && permissionCounts.size === 1 ? 'pass' : 'fail',
      'All surfaces need to preserve capability, stage and permission count from the same receipt.',
      [
        `stages=${Array.from(stageSet).join(',')}`,
        `capabilities=${Array.from(capabilitySet).join(',')}`,
        `permissionCounts=${Array.from(permissionCounts).join(',')}`,
      ],
    ),
    check(
      'capability-autopilot-surfaces:approval-actions',
      'approval/rejection actions',
      permissionPayloads.every((payload) =>
        payload.actions.some((action) => action.kind === 'approve_permission') &&
        payload.actions.some((action) => action.kind === 'reject_permission')
      ) ? 'pass' : 'fail',
      'When the stage is permission, every surface needs to expose approve and reject.',
      permissionPayloads.map((payload) => `${payload.surface}:${payload.actions.map((action) => action.kind).join('|')}`),
    ),
    check(
      'capability-autopilot-surfaces:explicit-actions',
      'no implicit action',
      payloads.every((payload) => payload.actions.every((action) => action.requiresExplicitUserAction)) ? 'pass' : 'fail',
      'Cross-surface actions are explicit commands/routes/callbacks, not hidden automation.',
      payloads.map((payload) => `${payload.surface}:actions=${payload.actions.length}`),
    ),
    check(
      'capability-autopilot-surfaces:compact-copy',
      'compact copy in messaging',
      payloads
        .filter((payload) => payload.surface === 'telegram' || payload.surface === 'mobile')
        .every((payload) => payload.body.length <= 420) ? 'pass' : 'fail',
      'Compact surfaces need to fit in short messages.',
      payloads
        .filter((payload) => payload.surface === 'telegram' || payload.surface === 'mobile')
        .map((payload) => `${payload.surface}:body=${payload.body.length}`),
    ),
  ];
}

function check(
  id: string,
  title: string,
  status: CapabilityAutopilotSurfacesCheck['status'],
  reason: string,
  evidence: string[] = [],
): CapabilityAutopilotSurfacesCheck {
  return {
    id,
    title,
    status,
    reason,
    evidence,
  };
}

function renderReport(snapshot: CapabilityAutopilotSurfacesSnapshot): string {
  const lines: string[] = [];
  lines.push('[capability-autopilot-surfaces] Cross-Surface Capability UX');
  lines.push(`status: ${snapshot.status}`);
  lines.push(`ok: ${snapshot.summary.ok ? 'yes' : 'no'} | pass=${snapshot.summary.passed} warn=${snapshot.summary.warnings} fail=${snapshot.summary.failed}`);
  lines.push(`capability: ${snapshot.capabilityId}`);
  lines.push(`surfaces: ${snapshot.payloads.map((payload) => payload.surface).join(', ')}`);
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
