import fs from 'node:fs';
import path from 'node:path';

import {
  buildDashboardCommandCenterViewModel,
} from '../../../src/ai-gateway/app/(dashboard)/control/command-center/adapters/index.js';
import {
  buildCommandCenterNativeFirstRuntimeProjection,
} from '../../../src/ai-gateway/app/(dashboard)/control/command-center/projections/index.js';
import {
  createZavorthPartialAdapterRemovalImplementationPackFixture,
  evaluateZavorthPartialAdapterRemovalStaticGuard,
} from '../../../src/runtime/external-agents/index.js';
import type {
  ZavorthNativeRegistryParitySurfaceId,
  ZavorthPartialAdapterRemovalStaticGuardFile,
} from '../../../src/runtime/external-agents/index.js';

const DOC = 'docs/203-wave-3-partial-adapter-removal-implementation-pack.md';
const GO_NO_GO_DOC = 'docs/117-external-agent-full-absorption-go-no-go.md';
const PAUSE_DOC = 'docs/159-external-executor-secret-provisioning-pause.md';
const REFRESH_COMMIT_DOC = 'docs/202-wave-3-native-refresh-commit-pack.md';
const BOUNDARY = 'src/runtime/external-agents/ZavorthPartialAdapterRemovalImplementationPack.ts';
const INDEX = 'src/runtime/external-agents/index.ts';
const COMMAND_CENTER_PROJECTION =
  'src/ai-gateway/app/(dashboard)/control/command-center/projections/commandCenterRuntimeProjection.ts';
const CONSOLIDATION_BOUNDARY = 'src/runtime/external-agents/ZavorthNativeAbsorptionConsolidationPack.ts';
const PRODUCTION_RESTORE_BOUNDARY =
  'src/runtime/external-agents/ZavorthNativeRegistryProductionRestoreLoadCommandCenter.ts';
const REFRESH_RECONCILIATION_BOUNDARY =
  'src/runtime/external-agents/ZavorthNativeRegistryRefreshReconciliation.ts';
const RAW_GATEWAY_TOKEN_ASSIGNMENT_PATTERN = new RegExp(
  'EXTERNAL_EXECUTOR_GATEWAY_TOKEN' + '=(?!present-redacted|<redacted-local-secret>)[^\\s`]+',
);

const NATIVE_READY_SURFACES: ZavorthNativeRegistryParitySurfaceId[] = [
  'capability-lookup-classify',
  'dashboard-render-view-lookup',
  'provider-channel-transport-metadata-lookup',
  'session-history-metadata-lookup',
  'config-secretref-state-metadata-lookup',
];

function read(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

function staticGuardFiles(): ZavorthPartialAdapterRemovalStaticGuardFile[] {
  return [
    {
      path: COMMAND_CENTER_PROJECTION,
      content: read(COMMAND_CENTER_PROJECTION),
      defaultConsumer: true,
    },
    {
      path: CONSOLIDATION_BOUNDARY,
      content: read(CONSOLIDATION_BOUNDARY),
      defaultConsumer: true,
    },
    {
      path: PRODUCTION_RESTORE_BOUNDARY,
      content: read(PRODUCTION_RESTORE_BOUNDARY),
      defaultConsumer: true,
    },
    {
      path: REFRESH_RECONCILIATION_BOUNDARY,
      content: read(REFRESH_RECONCILIATION_BOUNDARY),
      defaultConsumer: false,
    },
  ];
}

describe('Wave 3 partial adapter removal implementation pack', () => {
  let pack: ReturnType<typeof createZavorthPartialAdapterRemovalImplementationPackFixture>;
  let commandCenterProjection: ReturnType<typeof buildCommandCenterNativeFirstRuntimeProjection>;
  let commandCenterViewModel: ReturnType<typeof buildDashboardCommandCenterViewModel>;

  beforeAll(() => {
    const guardFiles = staticGuardFiles();
    pack = createZavorthPartialAdapterRemovalImplementationPackFixture(guardFiles);
    commandCenterProjection = buildCommandCenterNativeFirstRuntimeProjection();
    commandCenterViewModel = buildDashboardCommandCenterViewModel(commandCenterProjection.adapterInput);
  });

  it('documents 203 as a single partial adapter removal implementation pack', () => {
    const content = read(DOC);

    expect(content).toContain('Status: partial-adapter-removal-implemented');
    expect(content).toContain('ZavorthPartialAdapterRemovalImplementationPack.ts');
    expect(content).toContain('ZavorthPartialAdapterRemovalImplementationPack/v1');
    expect(content).toContain('ZavorthPartialAdapterRemovalSurfaceEnforcement/v1');
    expect(content).toContain('ZavorthPartialAdapterRemovalStaticGuard/v1');
    expect(content).toContain('partialAdapterRemovalImplemented=true');
    expect(content).toContain('adapterDefaultPathForNativeReadySurfaces=false');
    expect(content).toContain('commandCenterDefaultAdapterCall=false');
    expect(content).toContain('nativeRegistryLookupDefault=true');
    expect(content).toContain('runtimeExternalExecutorRequiredForNativeReadyLookup=false');
    expect(content).toContain('runtimeExternalExecutorRequiredForCommandCenterRender=false');
    expect(content).toContain('adapterRefreshAllowed=true');
    expect(content).toContain('adapterRemovalGlobalAllowed=false');
    expect(content).toContain('Public surface hardening follow-up:');
    expect(content).toContain('docs/204-wave-3-native-absorption-public-surface-hardening-pack.md');
    expect(content).toContain('Do not advance beyond the public surface hardening pack');
    expect(content).not.toMatch(RAW_GATEWAY_TOKEN_ASSIGNMENT_PATTERN);
  });

  it('updates tracking docs and the previous refresh commit pack for 203', () => {
    expect(read(GO_NO_GO_DOC)).toContain('docs/203-wave-3-partial-adapter-removal-implementation-pack.md');
    expect(read(PAUSE_DOC)).toContain('`203` is the first partial adapter removal implementation pack');
    expect(read(REFRESH_COMMIT_DOC)).toContain(
      'partial adapter removal implementation follow-up: docs/203-wave-3-partial-adapter-removal-implementation-pack.md',
    );
    expect(read(REFRESH_COMMIT_DOC)).toContain('advance beyond the partial adapter removal implementation pack');
  });

  it('exports the partial adapter removal boundary and contracts', () => {
    const boundary = read(BOUNDARY);
    const index = read(INDEX);

    expect(boundary).toContain('ZavorthPartialAdapterRemovalImplementationPack/v1');
    expect(boundary).toContain('ZavorthPartialAdapterRemovalStaticGuard/v1');
    expect(boundary).toContain('ZavorthPartialAdapterRemovalAdapterRoleNarrowing/v1');
    expect(index).toContain("from './ZavorthPartialAdapterRemovalImplementationPack.js'");
    expect(index).toContain('ZavorthPartialAdapterRemovalImplementationNormalization');
  });

  it('enforces native registry default paths for every native-ready surface', () => {
    expect(pack.normalization.decision).toBe('partial-adapter-removal-implemented');
    expect(pack.nativeReadyEnforcement()).toHaveLength(NATIVE_READY_SURFACES.length);
    NATIVE_READY_SURFACES.forEach((surfaceId) => {
      expect(pack.lookupEnforcement(surfaceId)).toEqual(expect.objectContaining({
        surfaceId,
        defaultLookupPath: 'native-registry',
        defaultRenderPath: 'native-registry',
        adapterBypassedForDefaultLookup: true,
        adapterBypassedForDefaultRender: true,
        adapterDefaultPathForNativeReadySurfaces: false,
        commandCenterDefaultAdapterCall: false,
        nativeRegistryLookupDefault: true,
        fallbackRequiresExplicitMode: true,
        runtimeExternalExecutorRequiredForNativeReadyLookup: false,
        runtimeExternalExecutorRequiredForCommandCenterRender: false,
        executionAuthority: false,
        rawSecretSerialized: false,
      }));
    });
  });

  it('keeps Command Center on the Zavorth-native registry path without public source identity', () => {
    const serializedViewModel = JSON.stringify(commandCenterViewModel);

    expect(commandCenterProjection.policy.commandCenterDefaultAdapterCall).toBe(false);
    expect(commandCenterProjection.policy.externalSourceRequiredForCommandCenterRender).toBe(false);
    expect(commandCenterProjection.policy.externalSourceRequiredForCommandCenterLookup).toBe(false);
    expect(commandCenterProjection.nativeRegistryConsumer.adapterFallbackExplicitOnly).toBe(true);
    expect(commandCenterViewModel.adapterSource).toEqual(expect.objectContaining({
      label: 'Zavorth Native Registry Projection',
    }));
    expect(serializedViewModel).not.toContain('ExternalExecutor');
    expect(serializedViewModel).not.toContain('external-executor');
    expect(serializedViewModel).not.toMatch(RAW_GATEWAY_TOKEN_ASSIGNMENT_PATTERN);
  });

  it('narrows the adapter role to explicit refresh, reconciliation, or degraded fallback only', () => {
    expect(pack.adapterRoles()).toEqual([
      'refresh-source',
      'reconciliation-source',
      'degraded-fallback-explicit',
    ]);
    expect(pack.normalization.adapterRoleNarrowing).toEqual(expect.objectContaining({
      adapterRefreshAllowed: true,
      adapterRemovalGlobalAllowed: false,
      adapterDefaultPathForNativeReadySurfaces: false,
    }));
    expect(pack.normalization.adapterRoleNarrowing.prohibitedRoles).toEqual([
      'default-lookup-provider',
      'default-render-provider',
      'source-authority',
      'execution-provider',
    ]);
  });

  it('passes static guard for actual default consumers and catches default adapter regressions', () => {
    const regression = evaluateZavorthPartialAdapterRemovalStaticGuard([
      {
        path: 'src/ai-gateway/app/(dashboard)/control/command-center/projections/regression.ts',
        defaultConsumer: true,
        content: [
          "import { FixtureExternalAgentAdapter } from './FixtureExternalAgentAdapter';",
          'const regression = {',
          '  adapterCalledForDefaultLookup: true,',
          "  source: 'external-executor-live-adapter',",
          "  label: 'ExternalExecutor Adapter',",
          '};',
        ].join('\n'),
      },
    ]);

    expect(pack.normalization.staticGuard.passed).toBe(true);
    expect(pack.normalization.staticGuard.findings).toHaveLength(0);
    expect(regression.passed).toBe(false);
    expect(regression.findings.map((finding) => finding.pattern)).toEqual(expect.arrayContaining([
      'FixtureExternalAgentAdapter default import',
      'default adapter call true',
      'public external-executor source',
      'public ExternalExecutor label',
    ]));
  });

  it('keeps refresh/reconciliation references isolated from native-ready default consumers', () => {
    const cleanupByConsumer = new Map(
      pack.normalization.consumerCleanup.map((consumer) => [consumer.consumerId, consumer]),
    );

    expect(cleanupByConsumer.get('command-center-runtime-projection')).toEqual(expect.objectContaining({
      nativeReadyConsumer: true,
      defaultAdapterImportRemovedOrIsolated: true,
      fallbackAdapterExplicitOnly: true,
      externalExecutorAdapterImportInDefaultPath: false,
      publicExternalExecutorIdentityExposed: false,
    }));
    expect(cleanupByConsumer.get('refresh-reconciliation')).toEqual(expect.objectContaining({
      nativeReadyConsumer: false,
      defaultAdapterImportRemovedOrIsolated: true,
      fallbackAdapterExplicitOnly: true,
      externalExecutorAdapterImportInDefaultPath: false,
    }));
    expect(pack.normalization.sourceReadiness).toEqual(expect.objectContaining({
      partialAdapterDeprecation: 'partial-adapter-deprecation-ready',
      consolidation: 'native-absorption-consolidation-ready',
    }));
  });

  it('does not grant execution, external mutation, state migration, source copy, or raw secret serialization', () => {
    const serialized = JSON.stringify(pack.normalization);

    expect(pack.normalization.executionGate).toEqual({
      partialAdapterRemovalImplemented: true,
      adapterDefaultPathForNativeReadySurfaces: false,
      commandCenterDefaultAdapterCall: false,
      nativeRegistryLookupDefault: true,
      runtimeExternalExecutorRequiredForNativeReadyLookup: false,
      runtimeExternalExecutorRequiredForCommandCenterRender: false,
      adapterRefreshAllowed: true,
      adapterRemovalGlobalAllowed: false,
      messageActuallySent: false,
      providerActuallyExecuted: false,
      commandActuallyExecuted: false,
      toolActuallyExecuted: false,
      externalMutationActuallyPerformed: false,
      stateMigrated: false,
      sourceModuleCopied: false,
      rawSecretSerialized: false,
    });
    expect(pack.normalization.redaction).toEqual({
      rawSecretSerialized: false,
      rawMessageContentSerialized: false,
      sourceIdentityPublic: false,
      sourceStructuresPublic: false,
      provenanceInternalOnly: true,
      serializedOutputContainsSensitiveFixture: false,
    });
    expect(serialized).not.toMatch(RAW_GATEWAY_TOKEN_ASSIGNMENT_PATTERN);
    expect(serialized).not.toMatch(/(^|[^A-Za-z])sk-[A-Za-z0-9_-]{8,}/);
    expect(serialized).not.toMatch(/ghp_[A-Za-z0-9_]{8,}/);
    expect(serialized).not.toMatch(/xox[baprs]-[A-Za-z0-9-]{8,}/);
  });
});
