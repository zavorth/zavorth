import fs from 'node:fs';
import path from 'node:path';

import {
  buildCommandCenterNativeFirstRuntimeProjection,
} from '../../../src/ai-gateway/app/(dashboard)/control/command-center/projections/index.js';
import {
  createZavorthPartialAdapterDecommissionImplementationPackFixture,
  evaluateZavorthAdapterDecommissionStaticGuard,
} from '../../../src/runtime/external-agents/index.js';
import type {
  ZavorthAdapterDecommissionStaticGuardFile,
} from '../../../src/runtime/external-agents/index.js';

const DOC = 'docs/207-wave-3-partial-adapter-decommission-implementation-pack.md';
const GO_NO_GO_DOC = 'docs/117-external-agent-full-absorption-go-no-go.md';
const PAUSE_DOC = 'docs/159-external-executor-secret-provisioning-pause.md';
const READINESS_DOC = 'docs/206-wave-3-adapter-decommission-readiness-pack.md';
const BOUNDARY = 'src/runtime/external-agents/ZavorthPartialAdapterDecommissionImplementationPack.ts';
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

const SAFE_CANDIDATES = [
  'command-center-runtime-projection-default-route',
  'controlled-dry-run-action-planner-default-route',
  'command-http-policy-preflight-default-route',
  'command-http-observability-projection-default-route',
];

const PRESERVED_REQUIRED = [
  'external-executor-live-read-only-probe',
  'external-executor-authenticated-health-probe',
  'external-executor-real-capability-snapshot',
  'external-executor-live-read-only-bridge',
  'approved-mutation-execution-harness',
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

describe('Wave 3 partial adapter decommission implementation pack', () => {
  it('documents 207 as a single partial adapter decommission implementation pack', () => {
    const content = read(DOC);

    expect(content).toContain('Status: partial-adapter-decommission-implemented');
    expect(content).toContain('ZavorthPartialAdapterDecommissionImplementationPack.ts');
    expect(content).toContain('ZavorthPartialAdapterDecommissionImplementationPack/v1');
    expect(content).toContain('ZavorthPartialAdapterDecommissionImplementationRow/v1');
    expect(content).toContain('ZavorthPartialAdapterDecommissionConsumerRewire/v1');
    expect(content).toContain('partialAdapterDecommissionImplemented=true');
    expect(content).toContain('adapterGlobalStillAvailable=true');
    expect(content).toContain('adapterRequiredSurfacesPreserved=true');
    expect(content).toContain('adapterRemovalGlobalAllowed=false');
    expect(content).toContain('Native absorption regression release hardening follow-up:');
    expect(content).toContain('docs/208-wave-3-native-absorption-regression-release-hardening-pack.md');
    expect(content).toContain('Do not advance beyond the regression/release hardening pack');
    expect(content).not.toMatch(RAW_GATEWAY_TOKEN_ASSIGNMENT_PATTERN);
  });

  it('updates tracking docs and the previous readiness pack for 207', () => {
    expect(read(GO_NO_GO_DOC)).toContain('docs/207-wave-3-partial-adapter-decommission-implementation-pack.md');
    expect(read(PAUSE_DOC)).toContain('`207` is the partial adapter decommission implementation pack');
    expect(read(READINESS_DOC)).toContain('Partial adapter decommission implementation follow-up:');
    expect(read(READINESS_DOC)).toContain('docs/207-wave-3-partial-adapter-decommission-implementation-pack.md');
    expect(read(READINESS_DOC)).toContain('Do not advance beyond the partial adapter decommission implementation pack');
  });

  it('exports the partial adapter decommission boundary and contracts', () => {
    const boundary = read(BOUNDARY);
    const index = read(INDEX);

    expect(boundary).toContain('ZavorthPartialAdapterDecommissionImplementationPack/v1');
    expect(boundary).toContain('ZavorthPartialAdapterDecommissionImplementationRow/v1');
    expect(boundary).toContain('ZavorthPartialAdapterDecommissionReport/v1');
    expect(index).toContain("from './ZavorthPartialAdapterDecommissionImplementationPack.js'");
    expect(index).toContain('ZavorthPartialAdapterDecommissionImplementationNormalization');
  });

  it('implements 206 safe removal candidates as removed-or-isolated without deleting files', () => {
    const pack = createZavorthPartialAdapterDecommissionImplementationPackFixture(staticGuardFiles());

    expect(pack.normalization.decision).toBe('partial-adapter-decommission-implemented');
    expect(pack.removedOrIsolatedRows().map((row) => row.usageId)).toEqual(expect.arrayContaining(SAFE_CANDIDATES));
    SAFE_CANDIDATES.forEach((usageId) => {
      expect(pack.lookupImplementation(usageId)).toEqual(expect.objectContaining({
        safeRemovalCandidateFrom206: true,
        implementationAction: 'default-legacy-route-removed-or-isolated',
        implementationStatus: 'isolated',
        defaultLegacyUsageRemovedOrIsolated: true,
        actualFileDeleted: false,
        adapterDefaultPathForNativeReadySurfaces: false,
        runtimeExternalExecutorRequiredForNativeReadyConsumers: false,
      }));
    });
  });

  it('preserves adapter-required, refresh, fallback, and blocked surfaces', () => {
    const pack = createZavorthPartialAdapterDecommissionImplementationPackFixture(staticGuardFiles());

    expect(pack.preservedAdapterRequiredRows().map((row) => row.usageId)).toEqual(expect.arrayContaining(PRESERVED_REQUIRED));
    expect(pack.lookupImplementation('native-registry-refresh-reconciliation')).toEqual(expect.objectContaining({
      implementationAction: 'preserved-behind-explicit-refresh',
      implementationStatus: 'preserved',
      refreshBoundaryPreserved: true,
      adapterRefreshAllowed: true,
    }));
    expect(pack.lookupImplementation('fixture-external-agent-adapter')).toEqual(expect.objectContaining({
      implementationAction: 'preserved-for-audit',
      implementationStatus: 'preserved',
      fallbackExplicitOnly: true,
      adapterGlobalStillAvailable: true,
    }));
    expect(pack.lookupImplementation('approved-mutation-execution-harness')).toEqual(expect.objectContaining({
      implementationAction: 'preserved-blocked',
      implementationStatus: 'blocked',
      adapterRequiredSurfacePreserved: true,
    }));
  });

  it('keeps Command Center, planner, policy, and observability native-first by default', () => {
    const pack = createZavorthPartialAdapterDecommissionImplementationPackFixture(staticGuardFiles());
    const commandCenter = buildCommandCenterNativeFirstRuntimeProjection();

    expect(pack.normalization.consumerRewiring).toHaveLength(4);
    pack.normalization.consumerRewiring.forEach((consumer) => {
      expect(consumer.defaultPath).toBe('native-registry');
      expect(consumer.adapterAllowedModes).toEqual(['explicit-refresh', 'reconciliation', 'degraded-fallback']);
      expect(consumer.defaultAdapterUsageRemovedOrIsolated).toBe(true);
      expect(consumer.adapterCalledForDefaultPath).toBe(false);
      expect(consumer.runtimeExternalExecutorRequiredForDefaultPath).toBe(false);
      expect(consumer.publicExternalExecutorIdentityExposed).toBe(false);
    });
    expect(commandCenter.policy.commandCenterDefaultAdapterCall).toBe(false);
    expect(commandCenter.policy.externalSourceRequiredForCommandCenterRender).toBe(false);
    expect(commandCenter.policy.externalSourceRequiredForCommandCenterLookup).toBe(false);
  });

  it('reinforces static guard and catches default adapter regressions while allowing explicit refresh/fallback', () => {
    const pack = createZavorthPartialAdapterDecommissionImplementationPackFixture(staticGuardFiles());
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
    expect(pack.normalization.staticGuard.allowlistedPaths.map((entry) => entry.role)).toEqual(expect.arrayContaining([
      'reconciliation-source',
      'refresh-source',
      'live-probe-read-only',
      'adapter-contract-fixture',
    ]));
    expect(regression.passed).toBe(false);
    expect(regression.findings.map((finding) => finding.pattern)).toEqual(expect.arrayContaining([
      'FixtureExternalAgentAdapter default import',
      'default adapter call true',
      'live source runtime default path true',
      'public external-executor source',
      'public ExternalExecutor label',
    ]));
  });

  it('preserves adapter global availability and regression hardening', () => {
    const pack = createZavorthPartialAdapterDecommissionImplementationPackFixture(staticGuardFiles());

    expect(fs.existsSync(path.join(process.cwd(), FIXTURE_ADAPTER))).toBe(true);
    expect(fs.existsSync(path.join(process.cwd(), LIVE_PROBE_BOUNDARY))).toBe(true);
    expect(fs.existsSync(path.join(process.cwd(), REFRESH_RECONCILIATION_BOUNDARY))).toBe(true);
    expect(pack.normalization.adapterGlobalAvailability).toEqual({
      nativeContract: 'ZavorthPartialAdapterDecommissionAdapterGlobalAvailability/v1',
      globalAdapterStillAvailable: true,
      fixtureAdapterPath: 'src/runtime/external-agents/FixtureExternalAgentAdapter.ts',
      liveProbePath: 'src/runtime/external-agents/ExternalAgentExternalExecutorLiveReadOnlyProbe.ts',
      refreshReconciliationPath: 'src/runtime/external-agents/ZavorthNativeRegistryRefreshReconciliation.ts',
      adapterRequiredSurfacesPreserved: true,
      adapterRemovalGlobalAllowed: false,
      rawSecretSerialized: false,
    });
    expect(pack.normalization.regressionHardening).toEqual({
      nativeContract: 'ZavorthPartialAdapterDecommissionRegressionHardening/v1',
      publicSurfaceZavorthNative: true,
      productionLoadedNativeRegistryFallbackPreserved: true,
      inMemoryNativeRegistryFallbackPreserved: true,
      refreshCommitControlledPathPreserved: true,
      staticGuardReinforced: true,
      adapterGlobalStillAvailable: true,
      rawSecretSerialized: false,
    });
  });

  it('reports decommission results and does not grant execution, migration, source copy, or raw secret serialization', () => {
    const pack = createZavorthPartialAdapterDecommissionImplementationPackFixture(staticGuardFiles());
    const serialized = JSON.stringify(pack.normalization);

    expect(pack.normalization.decommissionReport).toEqual(expect.objectContaining({
      removedOrIsolatedUsageIds: expect.arrayContaining(SAFE_CANDIDATES),
      adapterRequiredPreservedUsageIds: expect.arrayContaining(PRESERVED_REQUIRED),
      refreshReconciliationPreservedUsageIds: expect.arrayContaining([
        'native-registry-refresh-reconciliation',
        'native-refresh-commit-pack',
      ]),
      adapterRemovalGlobalAllowed: false,
      rawSecretSerialized: false,
    }));
    expect(pack.normalization.decommissionReport.nextCandidates).toEqual([
      'fixture-external-agent-adapter',
      'public-legacy-doc-api-name-cleanup',
      'refresh-boundary-wrapper-hardening',
    ]);
    expect(pack.normalization.executionGate).toEqual({
      partialAdapterDecommissionImplemented: true,
      adapterGlobalStillAvailable: true,
      adapterRemovalGlobalAllowed: false,
      adapterDefaultPathForNativeReadySurfaces: false,
      runtimeExternalExecutorRequiredForNativeReadyConsumers: false,
      adapterRefreshAllowed: true,
      adapterRequiredSurfacesPreserved: true,
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
