#!/usr/bin/env node
import {
  CapabilityAutopilotProviderExpansionService,
  type CapabilityProviderExpansionSnapshot,
  type CapabilityProviderExpansionTarget,
} from '../src/services/CapabilityAutopilotProviderExpansionService.js';

type CapabilityAutopilotProvidersCheck = {
  id: string;
  status: 'pass' | 'warn' | 'fail';
  title: string;
  reason: string;
  evidence: string[];
};

type CapabilityAutopilotProvidersSnapshot = CapabilityProviderExpansionSnapshot & {
  stage: '65';
  status: 'ready' | 'attention' | 'blocked';
  summary: {
    ok: boolean;
    passed: number;
    warnings: number;
    failed: number;
  };
  checks: CapabilityAutopilotProvidersCheck[];
  nextRecommendedStage: {
    stage: '66';
    title: string;
    reason: string;
  };
};

const argv = process.argv.slice(2);
const asJson = argv.includes('--json');
const requirePass = argv.includes('--require-pass') || argv.includes('--gate');

main().catch((error) => {
  process.stderr.write(`[capability-autopilot-providers] failure: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});

async function main(): Promise<void> {
  const service = new CapabilityAutopilotProviderExpansionService();
  const expansion = await service.buildExpansionSnapshot({
    targets: readTargets(),
    surface: 'cli',
    audience: asJson ? 'technical_operator' : 'everyday_user',
  });
  const snapshot = buildSnapshot(expansion);

  if (asJson) {
    process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
  } else {
    process.stdout.write(`${renderReport(snapshot)}\n`);
  }

  if (requirePass && !snapshot.summary.ok) {
    process.exitCode = 1;
  }
}

function readTargets(): CapabilityProviderExpansionTarget[] | undefined {
  const raw = readArg('--targets=');
  if (!raw) {
    return undefined;
  }

  return raw
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((id) => ({
      id,
      kind: id.startsWith('executor-') || id.startsWith('command-') || id.startsWith('route-') ? 'capability' as const
        : 'integration' as const,
      required: true,
    }));
}

function readArg(prefix: string): string | null {
  const found = argv.find((arg) => arg.startsWith(prefix));
  const value = found ? found.slice(prefix.length).trim() : '';
  return value || null;
}

function buildSnapshot(
  expansion: CapabilityProviderExpansionSnapshot,
): CapabilityAutopilotProvidersSnapshot {
  const checks = buildChecks(expansion);
  const failed = checks.filter((check) => check.status === 'fail').length;
  const warnings = checks.filter((check) => check.status === 'warn').length;
  const passed = checks.filter((check) => check.status === 'pass').length;

  return {
    ...expansion,
    stage: '65',
    status: failed > 0 ? 'blocked' : warnings > 0 ? 'attention' : 'ready',
    summary: {
      ok: failed === 0,
      passed,
      warnings,
      failed,
    },
    checks,
    nextRecommendedStage: {
      stage: '66',
      title: 'v1.1 Release Decision Gate',
      reason:
        'After provider expansion and explicit fallbacks, the next step is to decide if Capability Autopilot enters v1.1, stays behind a flag or returns to backlog.',
    },
  };
}

function buildChecks(
  expansion: CapabilityProviderExpansionSnapshot,
): CapabilityAutopilotProvidersCheck[] {
  const entriesById = new Map(expansion.entries.map((entry) => [entry.id, entry]));
  const mandatoryIds = [
    'executor-gemini-cli',
    'executor-external-executor',
    'gemini',
    'openai',
    'openrouter',
    'ollama',
    'telegram',
    'slack',
  ];
  const missingMandatory = mandatoryIds.filter((id) => !entriesById.has(id));
  const incompleteRequired = expansion.entries.filter((entry) =>
    entry.metadata.required === true &&
    (!entry.descriptorFound || (entry.kind === 'integration' && !entry.manifestFound))
  );
  const fallbackEntries = expansion.entries.filter((entry) => entry.fallbackCount > 0);

  return [
    check(
      'capability-autopilot-providers:mandatory-targets',
      'mandatory targets',
      missingMandatory.length === 0 ? 'pass' : 'fail',
      'The matrix needs to cover main executors and providers of the v1.1 cycle.',
      [
        `covered=${expansion.entries.length}`,
        ...missingMandatory.map((id) => `missing=${id}`),
      ],
    ),
    check(
      'capability-autopilot-providers:required-coverage',
      'required coverage',
      incompleteRequired.length === 0 &&
        expansion.coverage.coveredRequiredTargets === expansion.coverage.requiredTargets ? 'pass' : 'fail',
      'Every required target needs to resolve descriptor and, if integration, manifest.',
      [
        `required=${expansion.coverage.requiredTargets}`,
        `covered=${expansion.coverage.coveredRequiredTargets}`,
        ...incompleteRequired.map((entry) => `${entry.id}:descriptor=${entry.descriptorFound}:manifest=${entry.manifestFound}`),
      ],
    ),
    check(
      'capability-autopilot-providers:surface-variety',
      'surface variety',
      expansion.coverage.remoteProviders > 0 &&
        expansion.coverage.localRuntimes > 0 &&
        expansion.coverage.channels > 0 &&
        expansion.coverage.capabilityTargets > 0 ? 'pass' : 'fail',
      'The provider expansion gate needs to prove remote providers, local runtimes, channels and executors in the same contract.',
      [
        `remoteProviders=${expansion.coverage.remoteProviders}`,
        `localRuntimes=${expansion.coverage.localRuntimes}`,
        `channels=${expansion.coverage.channels}`,
        `capabilities=${expansion.coverage.capabilityTargets}`,
      ],
    ),
    check(
      'capability-autopilot-providers:readiness-degradation',
      'safe degradation',
      expansion.entries.every((entry) => entry.readinessStatus && entry.summary) ? 'pass' : 'fail',
      'Missing or unconfigured provider should become readiness/issue, not an opaque gate failure.',
      expansion.entries.map((entry) => `${entry.id}:${entry.readinessStatus}`),
    ),
    check(
      'capability-autopilot-providers:fallback-contract',
      'explicit fallback',
      expansion.entries.every((entry) => entry.explicitFallbackRequired && entry.autoFallbackExecuted === false) ? 'pass' : 'fail',
      'Fallbacks are listed for user choice; no fallback is executed automatically.',
      fallbackEntries.map((entry) => `${entry.id}:fallbacks=${entry.fallbackCount}:selectable=${entry.selectableFallbackCount}`),
    ),
    check(
      'capability-autopilot-providers:adapters',
      'provider adapters',
      expansion.adapters.executionGatewayRunner === 'available' &&
        expansion.adapters.fallbackSelection === 'available' &&
        expansion.adapters.autoFallbackExecuted === false ? 'pass' : 'fail',
      'The expansion is linked to the governed runner and the explicit fallback menu.',
      [
        `executionGatewayRunner=${expansion.adapters.executionGatewayRunner}`,
        `fallbackSelection=${expansion.adapters.fallbackSelection}`,
        `autoFallbackExecuted=${String(expansion.adapters.autoFallbackExecuted)}`,
      ],
    ),
  ];
}

function check(
  id: string,
  title: string,
  status: CapabilityAutopilotProvidersCheck['status'],
  reason: string,
  evidence: string[] = [],
): CapabilityAutopilotProvidersCheck {
  return {
    id,
    title,
    status,
    reason,
    evidence,
  };
}

function renderReport(snapshot: CapabilityAutopilotProvidersSnapshot): string {
  const lines: string[] = [];
  lines.push('[capability-autopilot-providers] Provider And Integration Expansion');
  lines.push(`status: ${snapshot.status}`);
  lines.push(`ok: ${snapshot.summary.ok ? 'yes' : 'no'} | pass=${snapshot.summary.passed} warn=${snapshot.summary.warnings} fail=${snapshot.summary.failed}`);
  lines.push(`targets: ${snapshot.entries.length}`);
  lines.push(`coverage: required=${snapshot.coverage.coveredRequiredTargets}/${snapshot.coverage.requiredTargets}; providers=${snapshot.coverage.remoteProviders}; local=${snapshot.coverage.localRuntimes}; channels=${snapshot.coverage.channels}`);
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
