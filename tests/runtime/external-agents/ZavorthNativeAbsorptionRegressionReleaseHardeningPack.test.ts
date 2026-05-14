import fs from 'node:fs';
import path from 'node:path';

import {
  buildCommandCenterNativeFirstRuntimeProjection,
} from '../../../src/ai-gateway/app/(dashboard)/control/command-center/projections/index.js';
import {
  createZavorthNativeAbsorptionRegressionReleaseHardeningPackFixture,
  evaluateZavorthAdapterDecommissionStaticGuard,
} from '../../../src/runtime/external-agents/index.js';
import type {
  ZavorthAdapterDecommissionStaticGuardFile,
  ZavorthNativeAbsorptionRegressionSurfaceId,
} from '../../../src/runtime/external-agents/index.js';

const DOC = 'docs/208-wave-3-native-absorption-regression-release-hardening-pack.md';
const GO_NO_GO_DOC = 'docs/117-external-agent-full-absorption-go-no-go.md';
const PAUSE_DOC = 'docs/159-external-executor-secret-provisioning-pause.md';
const PRIOR_DOC = 'docs/207-wave-3-partial-adapter-decommission-implementation-pack.md';
const BOUNDARY = 'src/runtime/external-agents/ZavorthNativeAbsorptionRegressionReleaseHardeningPack.ts';
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

const REQUIRED_SURFACES: ZavorthNativeAbsorptionRegressionSurfaceId[] = [
  'capability-registry',
  'dashboard-command-center',
  'integrations-providers-channels-transports',
  'session-history-metadata',
  'config-secretref-state-metadata',
  'planner-policy-observability-consumers',
  'storage-restore',
  'refresh-reconciliation',
  'action-dispatch',
  'message-send',
  'provider-execution',
  'command-tool-execution',
  'migration-import',
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

describe('Wave 3 native absorption regression release hardening pack', () => {
  it('documents 208 as a single regression release hardening pack', () => {
    const content = read(DOC);

    expect(content).toContain('Status: native-absorption-regression-release-hardened');
    expect(content).toContain('ZavorthNativeAbsorptionRegressionReleaseHardeningPack.ts');
    expect(content).toContain('ZavorthNativeAbsorptionRegressionReleaseHardeningPack/v1');
    expect(content).toContain('ZavorthNativeAbsorptionRegressionSurfaceRow/v1');
    expect(content).toContain('ZavorthNativeAbsorptionReleaseDecommissionReport/v1');
    expect(content).toContain('wave3RegressionReleaseHardeningComplete=true');
    expect(content).toContain('nativeFirstSurfacesRegressionChecked=true');
    expect(content).toContain('partialAdapterDecommissionRegressionChecked=true');
    expect(content).toContain('productionLoadedNativeFirstReady=true');
    expect(content).toContain('adapterRemovalGlobalAllowed=false');
    expect(content).toContain('Wave 4A controlled metadata/config/registry migration plan follow-up:');
    expect(content).toContain('docs/209-wave-4a-controlled-metadata-config-registry-migration-plan.md');
    expect(content).toContain('Do not advance beyond the Wave 4A migration plan');
    expect(content).not.toMatch(RAW_GATEWAY_TOKEN_ASSIGNMENT_PATTERN);
  });

  it('updates tracking docs and the previous decommission implementation pack for 208', () => {
    expect(read(GO_NO_GO_DOC)).toContain('docs/208-wave-3-native-absorption-regression-release-hardening-pack.md');
    expect(read(PAUSE_DOC)).toContain('`208` is the native absorption regression/release hardening pack');
    expect(read(PRIOR_DOC)).toContain('Native absorption regression release hardening follow-up:');
    expect(read(PRIOR_DOC)).toContain('docs/208-wave-3-native-absorption-regression-release-hardening-pack.md');
    expect(read(PRIOR_DOC)).toContain('Do not advance beyond the regression/release hardening pack');
  });

  it('exports the regression release hardening boundary and contracts', () => {
    const boundary = read(BOUNDARY);
    const index = read(INDEX);

    expect(boundary).toContain('ZavorthNativeAbsorptionRegressionReleaseHardeningPack/v1');
    expect(boundary).toContain('ZavorthNativeAbsorptionRegressionSurfaceRow/v1');
    expect(boundary).toContain('ZavorthNativeAbsorptionStorageRestoreHardening/v1');
    expect(index).toContain("from './ZavorthNativeAbsorptionRegressionReleaseHardeningPack.js'");
    expect(index).toContain('ZavorthNativeAbsorptionRegressionReleaseNormalization');
  });

  it('checks every release surface and keeps adapter-required or blocked surfaces explicit', () => {
    const pack = createZavorthNativeAbsorptionRegressionReleaseHardeningPackFixture(staticGuardFiles());

    expect(pack.normalization.decision).toBe('native-absorption-regression-release-hardened');
    expect(pack.normalization.regressionMatrix.map((row) => row.surfaceId)).toEqual(expect.arrayContaining(REQUIRED_SURFACES));
    expect(pack.nativeFirstSurfaces().map((row) => row.surfaceId)).toEqual(expect.arrayContaining([
      'capability-registry',
      'dashboard-command-center',
      'integrations-providers-channels-transports',
      'session-history-metadata',
      'config-secretref-state-metadata',
      'planner-policy-observability-consumers',
      'storage-restore',
    ]));
    expect(pack.adapterRequiredOrBlockedSurfaces().map((row) => row.surfaceId)).toEqual(expect.arrayContaining([
      'refresh-reconciliation',
      'action-dispatch',
      'message-send',
      'provider-execution',
      'command-tool-execution',
      'migration-import',
    ]));
    pack.normalization.regressionMatrix.forEach((row) => {
      expect(row.regressionChecked).toBe(true);
      expect(row.adapterDefaultPath).toBe(false);
      expect(row.publicExternalExecutorIdentityLeak).toBe(false);
      expect(row.receiptsLogsRedacted).toBe(true);
      expect(row.rawSecretSerialized).toBe(false);
    });
  });

  it('preserves native-first runtime path and Command Center render independence', () => {
    const pack = createZavorthNativeAbsorptionRegressionReleaseHardeningPackFixture(staticGuardFiles());
    const commandCenter = buildCommandCenterNativeFirstRuntimeProjection();

    expect(pack.lookupSurface('dashboard-command-center')).toEqual(expect.objectContaining({
      classification: 'native-first-refreshable',
      nativeFirstDefault: true,
      productionLoadedDefault: true,
      inMemoryFallback: true,
      runtimeExternalExecutorRequiredForNativeReadyConsumers: false,
    }));
    expect(pack.lookupSurface('planner-policy-observability-consumers')).toEqual(expect.objectContaining({
      nativeFirstDefault: true,
      adapterDefaultPath: false,
    }));
    expect(pack.normalization.nativeFirstRuntimeHardening).toEqual({
      nativeContract: 'ZavorthNativeAbsorptionNativeFirstRuntimeHardening/v1',
      productionLoadedNativeFirstReady: true,
      inMemoryNativeRegistryFallbackReady: true,
      adapterRefreshExplicitOnly: true,
      adapterFailureDoesNotBreakLookupRender: true,
      commandCenterNativeFirst: true,
      plannerPolicyObservabilityNativeFirst: true,
      adapterDefaultPathForNativeReadySurfaces: false,
      runtimeExternalExecutorRequiredForNativeReadyConsumers: false,
      rawSecretSerialized: false,
    });
    expect(commandCenter.policy.commandCenterDefaultAdapterCall).toBe(false);
    expect(commandCenter.policy.externalSourceRequiredForCommandCenterRender).toBe(false);
    expect(commandCenter.policy.externalSourceRequiredForCommandCenterLookup).toBe(false);
  });

  it('hardens public/product surfaces and keeps static guards active', () => {
    const pack = createZavorthNativeAbsorptionRegressionReleaseHardeningPackFixture(staticGuardFiles());
    const regression = evaluateZavorthAdapterDecommissionStaticGuard([
      {
        path: 'src/runtime/external-agents/defaultSurfaceRegression.ts',
        defaultConsumer: true,
        content: [
          "import { FixtureExternalAgentAdapter } from './FixtureExternalAgentAdapter';",
          'export const regression = {',
          '  adapterCalledForDefaultPath: true,',
          "  publicLabel: 'ExternalExecutor Adapter',",
          "  source: 'external-executor-live-adapter',",
          '};',
        ].join('\n'),
      },
    ]);

    expect(pack.normalization.publicProductHardening).toEqual({
      nativeContract: 'ZavorthNativeAbsorptionPublicProductHardening/v1',
      publicSurfaceHardened: true,
      commandCenterPublicIdentityZavorthNative: true,
      publicExternalExecutorIdentityLeak: false,
      internalProvenanceAllowed: true,
      receiptsLogsViewModelsRedacted: true,
      staticAllowlistRequiredForTechnicalProvenance: true,
      rawSecretSerialized: false,
    });
    expect(pack.normalization.staticGuard.passed).toBe(true);
    expect(regression.passed).toBe(false);
    expect(regression.findings.map((finding) => finding.pattern)).toEqual(expect.arrayContaining([
      'FixtureExternalAgentAdapter default import',
      'default adapter call true',
      'public ExternalExecutor label',
      'public external-executor source',
    ]));
  });

  it('keeps storage/restore controlled and secret-free', () => {
    const pack = createZavorthNativeAbsorptionRegressionReleaseHardeningPackFixture(staticGuardFiles());

    expect(pack.lookupSurface('storage-restore')).toEqual(expect.objectContaining({
      storageRestoreChecked: true,
      productionLoadedDefault: true,
      adapterDefaultPath: false,
      rawSecretSerialized: false,
    }));
    expect(pack.normalization.storageRestoreHardening).toEqual({
      nativeContract: 'ZavorthNativeAbsorptionStorageRestoreHardening/v1',
      persistenceRestoreChecksumValidated: true,
      redactionEnvelopeRequired: true,
      idempotencyValidated: true,
      rollbackMetadataValidated: true,
      controlledProductionNamespaceOnly: true,
      snapshotSecretFree: true,
      persistentWritePerformedByThisPack: false,
      runtimeExternalExecutorRequiredForStorageRestore: false,
      rawSecretSerialized: false,
    });
  });

  it('reports decommission state and keeps release side effects blocked', () => {
    const pack = createZavorthNativeAbsorptionRegressionReleaseHardeningPackFixture(staticGuardFiles());
    const serialized = JSON.stringify(pack.normalization);

    expect(pack.normalization.decommissionReport).toEqual({
      nativeContract: 'ZavorthNativeAbsorptionReleaseDecommissionReport/v1',
      removedOrIsolatedBy207: [
        'command-center-runtime-projection-default-route',
        'controlled-dry-run-action-planner-default-route',
        'command-http-policy-preflight-default-route',
        'command-http-observability-projection-default-route',
      ],
      adapterRequiredStillExplicit: [
        'external-executor-live-read-only-probe',
        'external-executor-authenticated-health-probe',
        'external-executor-real-capability-snapshot',
        'external-executor-live-read-only-bridge',
        'approved-mutation-execution-harness',
        'native-registry-refresh-reconciliation',
      ],
      blockedStillExplicit: [
        'action-dispatch',
        'message-send',
        'provider-execution',
        'command-tool-execution',
        'migration-import',
      ],
      nextCandidatesPostWave3: [
        'fixture-external-agent-adapter',
        'public-legacy-doc-api-name-cleanup',
        'refresh-boundary-wrapper-hardening',
      ],
      adapterGlobalStillAvailable: true,
      adapterRemovalGlobalAllowed: false,
      rawSecretSerialized: false,
    });
    expect(pack.normalization.executionGate).toEqual({
      wave3RegressionReleaseHardeningComplete: true,
      nativeFirstSurfacesRegressionChecked: true,
      partialAdapterDecommissionRegressionChecked: true,
      publicSurfaceHardened: true,
      productionLoadedNativeFirstReady: true,
      adapterGlobalStillAvailable: true,
      adapterRemovalGlobalAllowed: false,
      runtimeExternalExecutorRequiredForNativeReadyConsumers: false,
      adapterDefaultPathForNativeReadySurfaces: false,
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
