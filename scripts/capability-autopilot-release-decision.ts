#!/usr/bin/env node
import {
  CapabilityAutopilotReleaseDecisionService,
  type CapabilityAutopilotReleaseDecisionSnapshot,
  type CapabilityAutopilotReleaseGateEvidence,
} from '../src/services/CapabilityAutopilotReleaseDecisionService.js';

type CapabilityAutopilotReleaseDecisionCheck = {
  id: string;
  status: 'pass' | 'warn' | 'fail';
  title: string;
  reason: string;
  evidence: string[];
};

type CapabilityAutopilotReleaseDecisionGateSnapshot = CapabilityAutopilotReleaseDecisionSnapshot & {
  stage: '66';
  surface: 'capability-autopilot-release-decision';
  gateStatus: 'ready' | 'attention' | 'blocked';
  gateSummary: {
    ok: boolean;
    passed: number;
    warnings: number;
    failed: number;
  };
  checks: CapabilityAutopilotReleaseDecisionCheck[];
  cycleClosed: boolean;
};

const argv = process.argv.slice(2);
const asJson = argv.includes('--json');
const requirePass = argv.includes('--require-pass') || argv.includes('--gate');
const allowDefaultOn = argv.includes('--allow-default-on');
const failPhase = readArg('--fail-stage=') as CapabilityAutopilotReleaseGateEvidence['phase'] | null;
const omitPhase = readArg('--omit-stage=') as CapabilityAutopilotReleaseGateEvidence['phase'] | null;

main().catch((error) => {
  process.stderr.write(`[capability-autopilot-release-decision] failure: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});

async function main(): Promise<void> {
  const service = new CapabilityAutopilotReleaseDecisionService();
  const evidence = buildEvidence(service);
  const decision = service.buildDecision({
    evidence,
    allowDefaultOn,
  });
  const snapshot = buildSnapshot(decision);

  if (asJson) {
    process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
  } else {
    process.stdout.write(`${renderReport(snapshot)}\n`);
  }

  if (requirePass && !snapshot.gateSummary.ok) {
    process.exitCode = 1;
  }
}

function readArg(prefix: string): string | null {
  const found = argv.find((arg) => arg.startsWith(prefix));
  const value = found ? found.slice(prefix.length).trim() : '';
  return value || null;
}

function buildEvidence(
  service: CapabilityAutopilotReleaseDecisionService,
): CapabilityAutopilotReleaseGateEvidence[] {
  return service.defaultEvidence()
    .filter((entry) => entry.stage !== omitPhase)
    .map((entry) =>
      entry.stage === failPhase
        ? {
            ...entry,
            passed: false,
            risk: 'high',
            summary: `${entry.summary} (forced failure fixture)`,
          }
        : entry,
    );
}

function buildSnapshot(
  decision: CapabilityAutopilotReleaseDecisionSnapshot,
): CapabilityAutopilotReleaseDecisionGateSnapshot {
  const checks = buildChecks(decision);
  const failed = checks.filter((check) => check.status === 'fail').length;
  const warnings = checks.filter((check) => check.status === 'warn').length;
  const passed = checks.filter((check) => check.status === 'pass').length;
  const ok = failed === 0 && decision.decision === 'ship_v1_1_flagged';

  return {
    ...decision,
    stage: '66',
    surface: 'capability-autopilot-release-decision',
    gateStatus: failed > 0 ? 'blocked' : warnings > 0 ? 'attention' : 'ready',
    gateSummary: {
      ok,
      passed,
      warnings,
      failed,
    },
    checks,
    cycleClosed: ok,
  };
}

function buildChecks(
  decision: CapabilityAutopilotReleaseDecisionSnapshot,
): CapabilityAutopilotReleaseDecisionCheck[] {
  return [
    check(
      'capability-autopilot-release:all-phases',
      'preflight/provider gates with evidence',
      decision.missingPhases.length === 0 && decision.failedPhases.length === 0 ? 'pass' : 'fail',
      'The v1.1 decision requires evidence from all preflight and provider gates.',
      [
        `passed=${decision.passedPhases.join(',')}`,
        `missing=${decision.missingPhases.join(',') || '<none>'}`,
        `failed=${decision.failedPhases.join(',') || '<none>'}`,
      ],
    ),
    check(
      'capability-autopilot-release:flagged',
      'ship behind flag',
      decision.decision === 'ship_v1_1_flagged' &&
        decision.featureFlag.name === 'ZAVORTH_CAPABILITY_AUTOPILOT' &&
        decision.featureFlag.defaultEnabled === false ? 'pass' : 'fail',
      'Capability Autopilot is too powerful to ship default-on without pilots; v1.1 should ship behind a flag.',
      [
        `decision=${decision.decision}`,
        `flag=${decision.featureFlag.name}`,
        `defaultEnabled=${String(decision.featureFlag.defaultEnabled)}`,
      ],
    ),
    check(
      'capability-autopilot-release:risk',
      'accepted risk',
      decision.riskPosture === 'medium' && decision.releaseChannel === 'alpha' ? 'pass' : 'fail',
      'The expected posture for v1.1 is alpha/flagged: gates pass, but repair/fallback still require supervision.',
      [
        `risk=${decision.riskPosture}`,
        `channel=${decision.releaseChannel}`,
      ],
    ),
    check(
      'capability-autopilot-release:guardrails',
      'complete guardrails',
      decision.guardrails.length >= 6 &&
        decision.guardrails.some((entry) => entry.includes('Preflight')) &&
        decision.guardrails.some((entry) => entry.includes('Fallback')) &&
        decision.guardrails.some((entry) => entry.includes('Memory/replay')) ? 'pass' : 'fail',
      'Release decision needs to carry the essential guardrails of the 60-65 cycle.',
      decision.guardrails,
    ),
    check(
      'capability-autopilot-release:rollback',
      'simple rollback',
      decision.rollbackPlan.some((entry) => entry.includes('ZAVORTH_CAPABILITY_AUTOPILOT')) ? 'pass' : 'fail',
      'Rollback needs to be disabling the flag, without reverting the v1.0.0 baseline.',
      decision.rollbackPlan,
    ),
  ];
}

function check(
  id: string,
  title: string,
  status: CapabilityAutopilotReleaseDecisionCheck['status'],
  reason: string,
  evidence: string[] = [],
): CapabilityAutopilotReleaseDecisionCheck {
  return {
    id,
    title,
    status,
    reason,
    evidence,
  };
}

function renderReport(snapshot: CapabilityAutopilotReleaseDecisionGateSnapshot): string {
  const lines: string[] = [];
  lines.push('[capability-autopilot-release-decision] v1.1 Release Decision Gate');
  lines.push(`status: ${snapshot.gateStatus}`);
  lines.push(`ok: ${snapshot.gateSummary.ok ? 'yes' : 'no'} | pass=${snapshot.gateSummary.passed} warn=${snapshot.gateSummary.warnings} fail=${snapshot.gateSummary.failed}`);
  lines.push(`decision: ${snapshot.decision}`);
  lines.push(`flag: ${snapshot.featureFlag.name} default=${String(snapshot.featureFlag.defaultEnabled)}`);
  lines.push(snapshot.summary);
  lines.push('');
  for (const item of snapshot.checks) {
    lines.push(`[${item.status}] ${item.title}`);
    lines.push(`  ${item.reason}`);
    for (const evidence of item.evidence) {
      lines.push(`  - ${evidence}`);
    }
  }
  lines.push('');
  lines.push(`cycle closed: ${snapshot.cycleClosed ? 'yes' : 'no'}`);
  return lines.join('\n');
}
