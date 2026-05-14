import fs from 'node:fs';
import path from 'node:path';

import {
  createZavorthAdapterDecommissionReadinessPackFixture,
  evaluateZavorthAdapterDecommissionStaticGuard,
} from '../../../src/runtime/external-agents/index.js';
import type {
  ZavorthAdapterDecommissionDisposition,
  ZavorthAdapterDecommissionStaticGuardFile,
  ZavorthAdapterUsageClassification,
} from '../../../src/runtime/external-agents/index.js';

const DOC = 'docs/206-wave-3-adapter-decommission-readiness-pack.md';
const GO_NO_GO_DOC = 'docs/117-external-agent-full-absorption-go-no-go.md';
const PAUSE_DOC = 'docs/159-external-executor-secret-provisioning-pause.md';
const CONSUMER_EXPANSION_DOC = 'docs/205-wave-3-native-registry-consumer-expansion-pack.md';
const BOUNDARY = 'src/runtime/external-agents/ZavorthAdapterDecommissionReadinessPack.ts';
const INDEX = 'src/runtime/external-agents/index.ts';
const COMMAND_CENTER_PROJECTION =
  'src/ai-gateway/app/(dashboard)/control/command-center/projections/commandCenterRuntimeProjection.ts';
const CONTROLLED_DRY_RUN_PLANNER =
  'src/runtime/external-agents/ExternalAgentControlledDryRunActionPlanner.ts';
const POLICY_PREFLIGHT_BOUNDARY =
  'src/runtime/external-agents/ExternalAgentCommandHttpPolicyPreflightBoundary.ts';
const OBSERVABILITY_PROJECTION_BOUNDARY =
  'src/runtime/external-agents/ExternalAgentCommandHttpObservabilityProjectionBoundary.ts';
const REFRESH_RECONCILIATION_BOUNDARY =
  'src/runtime/external-agents/ZavorthNativeRegistryRefreshReconciliation.ts';
const REFRESH_COMMIT_PACK =
  'src/runtime/external-agents/ZavorthNativeRefreshCommitPack.ts';
const LIVE_PROBE_BOUNDARY =
  'src/runtime/external-agents/ExternalAgentExternalExecutorLiveReadOnlyProbe.ts';
const FIXTURE_ADAPTER =
  'src/runtime/external-agents/FixtureExternalAgentAdapter.ts';
const RAW_GATEWAY_TOKEN_ASSIGNMENT_PATTERN = new RegExp(
  'EXTERNAL_EXECUTOR_GATEWAY_TOKEN' + '=(?!present-redacted|<redacted-local-secret>)[^\\s`]+',
);

const REQUIRED_CLASSIFICATIONS: ZavorthAdapterUsageClassification[] = [
  'adapter-required',
  'fallback-explicit',
  'refresh-reconciliation-allowed',
  'safe-removal-candidate',
];

const REQUIRED_DISPOSITIONS: ZavorthAdapterDecommissionDisposition[] = [
  'can-remove-now',
  'isolate-behind-refresh-boundary',
  'keep-required',
  'blocked',
  'unknown-needs-audit',
];

function read(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

function staticGuardFiles(): ZavorthAdapterDecommissionStaticGuardFile[] {
  return [
    {
      path: COMMAND_CENTER_PROJECTION,
      content: read(COMMAND_CENTER_PROJECTION),
      defaultConsumer: true,
    },
    {
      path: CONTROLLED_DRY_RUN_PLANNER,
      content: read(CONTROLLED_DRY_RUN_PLANNER),
      defaultConsumer: true,
    },
    {
      path: POLICY_PREFLIGHT_BOUNDARY,
      content: read(POLICY_PREFLIGHT_BOUNDARY),
      defaultConsumer: true,
    },
    {
      path: OBSERVABILITY_PROJECTION_BOUNDARY,
      content: read(OBSERVABILITY_PROJECTION_BOUNDARY),
      defaultConsumer: true,
    },
    {
      path: REFRESH_RECONCILIATION_BOUNDARY,
      content: read(REFRESH_RECONCILIATION_BOUNDARY),
      defaultConsumer: false,
      allowlistRole: 'reconciliation-source',
    },
    {
      path: REFRESH_COMMIT_PACK,
      content: read(REFRESH_COMMIT_PACK),
      defaultConsumer: false,
      allowlistRole: 'refresh-source',
    },
    {
      path: LIVE_PROBE_BOUNDARY,
      content: read(LIVE_PROBE_BOUNDARY),
      defaultConsumer: false,
      allowlistRole: 'live-probe-read-only',
    },
    {
      path: FIXTURE_ADAPTER,
      content: read(FIXTURE_ADAPTER),
      defaultConsumer: false,
      allowlistRole: 'adapter-contract-fixture',
    },
  ];
}

describe('Wave 3 adapter decommission readiness pack', () => {
  it('documents 206 as a single adapter decommission readiness pack', () => {
    const content = read(DOC);

    expect(content).toContain('Status: adapter-decommission-readiness-ready');
    expect(content).toContain('ZavorthAdapterDecommissionReadinessPack.ts');
    expect(content).toContain('ZavorthAdapterDecommissionReadinessPack/v1');
    expect(content).toContain('ZavorthAdapterUsageInventoryRow/v1');
    expect(content).toContain('ZavorthAdapterDecommissionStaticGuard/v1');
    expect(content).toContain('adapterDecommissionReadinessPackCreated=true');
    expect(content).toContain('adapterUsageInventoryComplete=true');
    expect(content).toContain('defaultAdapterUsageViolationsDetected=false');
    expect(content).toContain('safeRemovalCandidatesListed=true');
    expect(content).toContain('adapterRemovalGlobalAllowed=false');
    expect(content).toContain('Partial adapter decommission implementation follow-up:');
    expect(content).toContain('docs/207-wave-3-partial-adapter-decommission-implementation-pack.md');
    expect(content).toContain('Do not advance beyond the partial adapter decommission implementation pack');
    expect(content).not.toMatch(RAW_GATEWAY_TOKEN_ASSIGNMENT_PATTERN);
  });

  it('updates tracking docs and the previous consumer expansion pack for 206', () => {
    expect(read(GO_NO_GO_DOC)).toContain('docs/206-wave-3-adapter-decommission-readiness-pack.md');
    expect(read(PAUSE_DOC)).toContain('`206` is the adapter decommission readiness pack');
    expect(read(CONSUMER_EXPANSION_DOC)).toContain('Adapter decommission readiness follow-up:');
    expect(read(CONSUMER_EXPANSION_DOC)).toContain('docs/206-wave-3-adapter-decommission-readiness-pack.md');
    expect(read(CONSUMER_EXPANSION_DOC)).toContain('Do not advance beyond the adapter decommission readiness pack');
  });

  it('exports the adapter decommission readiness boundary and contracts', () => {
    const boundary = read(BOUNDARY);
    const index = read(INDEX);

    expect(boundary).toContain('ZavorthAdapterDecommissionReadinessPack/v1');
    expect(boundary).toContain('ZavorthAdapterUsageInventoryRow/v1');
    expect(boundary).toContain('ZavorthAdapterDecommissionStaticGuard/v1');
    expect(index).toContain("from './ZavorthAdapterDecommissionReadinessPack.js'");
    expect(index).toContain('ZavorthAdapterDecommissionReadinessNormalization');
  });

  it('classifies every known adapter/bridge/live usage row for decommission readiness', () => {
    const pack = createZavorthAdapterDecommissionReadinessPackFixture(staticGuardFiles());
    const classifications = new Set(pack.normalization.usageInventory.map((row) => row.classification));
    const dispositions = new Set(pack.normalization.decommissionReadinessMatrix.map((row) => row.disposition));

    expect(pack.normalization.decision).toBe('adapter-decommission-readiness-ready');
    expect(pack.normalization.inventorySummary.adapterUsageInventoryComplete).toBe(true);
    expect(pack.normalization.usageInventory.length).toBeGreaterThanOrEqual(10);
    REQUIRED_CLASSIFICATIONS.forEach((classification) => {
      expect(classifications.has(classification)).toBe(true);
    });
    REQUIRED_DISPOSITIONS.forEach((disposition) => {
      expect(dispositions.has(disposition)).toBe(true);
      expect(pack.usagesByDisposition(disposition).length).toBeGreaterThan(0);
    });
    expect(pack.normalization.inventorySummary.legacyDefaultUsageViolations).toBe(0);
  });

  it('keeps native-ready consumers free from default adapter usage', () => {
    const pack = createZavorthAdapterDecommissionReadinessPackFixture(staticGuardFiles());
    const nativeReadyRows = pack.normalization.usageInventory.filter((row) => row.nativeReadySurface);

    expect(nativeReadyRows.length).toBeGreaterThanOrEqual(4);
    nativeReadyRows.forEach((row) => {
      expect(row.classification).toBe('safe-removal-candidate');
      expect(row.decommissionDisposition).toBe('can-remove-now');
      expect(row.defaultAdapterPath).toBe(false);
      expect(row.adapterCalledForDefaultPath).toBe(false);
      expect(row.externalExecutorLiveCalledForDefaultPath).toBe(false);
      expect(row.runtimeExternalExecutorRequiredForNativeReadyConsumers).toBe(false);
      expect(row.adapterRemovalGlobalAllowed).toBe(false);
    });
  });

  it('keeps refresh/fallback allowlist explicit and required/blocked surfaces visible', () => {
    const pack = createZavorthAdapterDecommissionReadinessPackFixture(staticGuardFiles());

    expect(pack.lookupUsage('native-registry-refresh-reconciliation')).toEqual(expect.objectContaining({
      classification: 'refresh-reconciliation-allowed',
      decommissionDisposition: 'isolate-behind-refresh-boundary',
      explicitAllowlist: true,
      allowlistRoles: ['refresh-source', 'reconciliation-source'],
      adapterRefreshAllowed: true,
    }));
    expect(pack.lookupUsage('fixture-external-agent-adapter')).toEqual(expect.objectContaining({
      classification: 'fallback-explicit',
      decommissionDisposition: 'unknown-needs-audit',
      explicitAllowlist: true,
      safeRemovalCandidate: false,
    }));
    expect(pack.adapterRequiredOrBlocked().map((row) => row.usageId)).toEqual(expect.arrayContaining([
      'external-executor-live-read-only-probe',
      'external-executor-authenticated-health-probe',
      'external-executor-real-capability-snapshot',
      'external-executor-live-read-only-bridge',
      'approved-mutation-execution-harness',
    ]));
  });

  it('lists safe removal candidates without authorizing global adapter removal', () => {
    const pack = createZavorthAdapterDecommissionReadinessPackFixture(staticGuardFiles());
    const matrixByDisposition = new Map(
      pack.normalization.decommissionReadinessMatrix.map((row) => [row.disposition, row]),
    );

    expect(pack.safeRemovalCandidates().length).toBeGreaterThanOrEqual(4);
    expect(matrixByDisposition.get('can-remove-now')).toEqual(expect.objectContaining({
      removalAuthorizedNow: false,
      rawSecretSerialized: false,
    }));
    pack.normalization.removalPlan.forEach((step) => {
      expect(step.currentPackAction).toBe('plan-only');
      expect(step.removalAuthorizedNow).toBe(false);
      expect(step.requiredFutureGate).toEqual(expect.any(String));
    });
    expect(pack.normalization.executionGate.adapterRemovalGlobalAllowed).toBe(false);
  });

  it('passes static guard for actual consumers and catches default adapter regressions', () => {
    const pack = createZavorthAdapterDecommissionReadinessPackFixture(staticGuardFiles());
    const regression = evaluateZavorthAdapterDecommissionStaticGuard([
      {
        path: 'src/runtime/external-agents/regressionDefaultConsumer.ts',
        defaultConsumer: true,
        content: [
          "import { FixtureExternalAgentAdapter } from './FixtureExternalAgentAdapter';",
          'const regression = {',
          '  adapterCalledForDefaultPath: true,',
          '  externalSourceLiveCalledForDefaultPath: true,',
          "  source: 'external-executor-live-adapter',",
          "  label: 'ExternalExecutor Adapter',",
          '};',
        ].join('\n'),
      },
    ]);

    expect(pack.normalization.staticGuard.passed).toBe(true);
    expect(pack.normalization.staticGuard.defaultAdapterUsageViolationsDetected).toBe(false);
    expect(pack.normalization.staticGuard.allowlistedPaths.map((entry) => entry.role)).toEqual(expect.arrayContaining([
      'reconciliation-source',
      'refresh-source',
      'live-probe-read-only',
      'adapter-contract-fixture',
    ]));
    expect(regression.passed).toBe(false);
    expect(regression.defaultAdapterUsageViolationsDetected).toBe(true);
    expect(regression.findings.map((finding) => finding.pattern)).toEqual(expect.arrayContaining([
      'FixtureExternalAgentAdapter default import',
      'default adapter call true',
      'live source runtime default path true',
      'public external-executor source',
      'public ExternalExecutor label',
    ]));
  });

  it('records risks and does not grant execution, migration, source copy, or raw secret serialization', () => {
    const pack = createZavorthAdapterDecommissionReadinessPackFixture(staticGuardFiles());
    const serialized = JSON.stringify(pack.normalization);

    expect(pack.normalization.riskReport).toEqual({
      nativeContract: 'ZavorthAdapterDecommissionRiskReport/v1',
      refreshStillNeedsExternalSource: true,
      actionDispatchStillBlocked: true,
      messageSendStillBlocked: true,
      providerExecutionStillBlocked: true,
      commandToolExecutionStillBlocked: true,
      migrationImportStillBlocked: true,
      liveProbeBoundaryStillRequired: true,
      globalAdapterRemovalRisk: 'blocked-until-full-parity-and-replacement',
      rawSecretSerialized: false,
    });
    expect(pack.normalization.executionGate).toEqual({
      adapterDecommissionReadinessPackCreated: true,
      adapterUsageInventoryComplete: true,
      defaultAdapterUsageViolationsDetected: false,
      safeRemovalCandidatesListed: true,
      adapterRemovalGlobalAllowed: false,
      runtimeExternalExecutorRequiredForNativeReadyConsumers: false,
      adapterRefreshAllowed: true,
      messageActuallySent: false,
      providerActuallyExecuted: false,
      commandActuallyExecuted: false,
      toolActuallyExecuted: false,
      externalMutationActuallyPerformed: false,
      stateMigrated: false,
      sourceModuleCopied: false,
      rawSecretSerialized: false,
    });
    expect(serialized).not.toMatch(RAW_GATEWAY_TOKEN_ASSIGNMENT_PATTERN);
    expect(serialized).not.toContain('<redacted-local-secret>');
  });
});
