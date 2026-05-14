import fs from 'node:fs';
import path from 'node:path';

import {
  buildDashboardCommandCenterViewModel,
} from '../../../src/ai-gateway/app/(dashboard)/control/command-center/adapters/index.js';
import {
  buildCommandCenterNativeFirstRuntimeProjection,
} from '../../../src/ai-gateway/app/(dashboard)/control/command-center/projections/index.js';
import {
  createZavorthNativeAbsorptionPublicSurfaceHardeningPackFixture,
  evaluateZavorthNativeAbsorptionPublicSurfaceGuard,
} from '../../../src/runtime/external-agents/index.js';
import type {
  ZavorthNativeAbsorptionPublicSurface,
  ZavorthNativeAbsorptionPublicSurfaceKind,
} from '../../../src/runtime/external-agents/index.js';

const DOC = 'docs/204-wave-3-native-absorption-public-surface-hardening-pack.md';
const GO_NO_GO_DOC = 'docs/117-external-agent-full-absorption-go-no-go.md';
const PAUSE_DOC = 'docs/159-external-executor-secret-provisioning-pause.md';
const PARTIAL_REMOVAL_DOC = 'docs/203-wave-3-partial-adapter-removal-implementation-pack.md';
const PHASE_10_DOC = 'docs/116-external-agent-public-product-hardening.md';
const BOUNDARY = 'src/runtime/external-agents/ZavorthNativeAbsorptionPublicSurfaceHardeningPack.ts';
const INDEX = 'src/runtime/external-agents/index.ts';
const COMMAND_CENTER_INDEX = 'src/ai-gateway/app/(dashboard)/control/command-center/index.ts';
const COMMAND_CENTER_PROJECTION_INDEX = 'src/ai-gateway/app/(dashboard)/control/command-center/projections/index.ts';
const COMMAND_CENTER_CONTRACTS_INDEX = 'src/ai-gateway/app/(dashboard)/control/command-center/contracts/index.ts';
const COMMAND_CENTER_ADAPTERS_INDEX = 'src/ai-gateway/app/(dashboard)/control/command-center/adapters/index.ts';
const REFRESH_RECONCILIATION_BOUNDARY =
  'src/runtime/external-agents/ZavorthNativeRegistryRefreshReconciliation.ts';
const RAW_GATEWAY_TOKEN_ASSIGNMENT_PATTERN = new RegExp(
  'EXTERNAL_EXECUTOR_GATEWAY_TOKEN' + '=(?!present-redacted|<redacted-local-secret>)[^\\s`]+',
);

const ALLOWLISTED_KINDS: ZavorthNativeAbsorptionPublicSurfaceKind[] = [
  'internal-absorption-doc',
  'internal-external-agent-test',
  'internal-provenance',
  'technical-adapter-refresh-boundary',
];

function read(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

function surface(
  id: string,
  label: string,
  pathLabel: string,
  kind: ZavorthNativeAbsorptionPublicSurfaceKind,
  content: string,
): ZavorthNativeAbsorptionPublicSurface {
  return {
    nativeContract: 'ZavorthNativeAbsorptionPublicSurface/v1',
    id,
    label,
    path: pathLabel,
    kind,
    content,
  };
}

function publicApiExportContent(): string {
  return [
    COMMAND_CENTER_INDEX,
    COMMAND_CENTER_PROJECTION_INDEX,
    COMMAND_CENTER_CONTRACTS_INDEX,
    COMMAND_CENTER_ADAPTERS_INDEX,
  ].map(read).join('\n');
}

function commandCenterPublicSurfaces(): ZavorthNativeAbsorptionPublicSurface[] {
  const result = buildCommandCenterNativeFirstRuntimeProjection();
  const viewModel = buildDashboardCommandCenterViewModel(result.adapterInput);
  const receiptLogSamples = [
    {
      id: 'native-registry-lookup-ready',
      label: 'Zavorth native registry lookup ready',
      sourceLabel: 'external-source-redacted',
      message: 'Zavorth-native registry lookup served without default adapter.',
    },
    {
      id: 'command-center-native-render-ready',
      label: 'Zavorth Command Center native render ready',
      sourceLabel: 'external-source-redacted',
      message: 'Command Center rendered Zavorth-native views with redacted provenance.',
    },
  ];

  return [
    surface(
      'command-center-dashboard',
      'Command Center dashboard',
      'command-center:view-model',
      'command-center-dashboard',
      JSON.stringify(viewModel),
    ),
    surface(
      'runtime-projection',
      'Command Center runtime projection',
      'command-center:runtime-projection',
      'runtime-projection',
      JSON.stringify(result.projection),
    ),
    surface(
      'command-center-public-api-exports',
      'Command Center public API exports',
      'src/ai-gateway/app/(dashboard)/control/command-center/index.ts',
      'public-api-export',
      publicApiExportContent(),
    ),
    surface(
      'user-facing-receipts-logs',
      'User-facing receipts and logs',
      'command-center:user-facing-receipts-logs',
      'user-facing-receipt-log',
      JSON.stringify(receiptLogSamples),
    ),
    surface(
      'view-model-labels',
      'Command Center view model labels',
      'command-center:view-model-labels',
      'view-model-label',
      JSON.stringify({
        adapterSource: viewModel.adapterSource,
        runtime: viewModel.runtime,
        modelProfile: viewModel.modelProfile,
        health: viewModel.health,
        identity: viewModel.identity,
        sectors: viewModel.sectors,
      }),
    ),
    surface(
      'capability-labels',
      'Capability labels',
      'command-center:capability-labels',
      'capability-label',
      JSON.stringify(viewModel.toolExposure.tools),
    ),
    surface(
      'provider-channel-transport-labels',
      'Provider/channel/transport labels',
      'command-center:integration-labels',
      'provider-channel-transport-label',
      JSON.stringify(viewModel.integrations),
    ),
    surface(
      'public-hardening-internal-doc',
      'Native absorption public hardening doc',
      DOC,
      'internal-absorption-doc',
      read(DOC),
    ),
    surface(
      'phase-10-internal-doc',
      'Phase 10 public product hardening doc',
      PHASE_10_DOC,
      'internal-absorption-doc',
      read(PHASE_10_DOC),
    ),
    surface(
      'refresh-reconciliation-technical-boundary',
      'Refresh reconciliation technical boundary',
      REFRESH_RECONCILIATION_BOUNDARY,
      'technical-adapter-refresh-boundary',
      read(REFRESH_RECONCILIATION_BOUNDARY),
    ),
    surface(
      'internal-external-agent-test-allowlist',
      'Internal external-agent test allowlist fixture',
      'tests/runtime/external-agents/internal-external-executor-allowlist-fixture.test.ts',
      'internal-external-agent-test',
      'Internal test mentions ExternalExecutor as source evidence only.',
    ),
    surface(
      'internal-provenance-allowlist',
      'Internal redacted provenance allowlist fixture',
      'provenance:internal-redacted',
      'internal-provenance',
      'Internal provenance may retain ExternalExecutor evidence while public labels use external-source-redacted.',
    ),
  ];
}

describe('Wave 3 native absorption public surface hardening pack', () => {
  let cachedSurfaces: ZavorthNativeAbsorptionPublicSurface[];
  let cachedPack: ReturnType<typeof createZavorthNativeAbsorptionPublicSurfaceHardeningPackFixture>;
  let cachedProjection: ReturnType<typeof buildCommandCenterNativeFirstRuntimeProjection>;
  let cachedViewModel: ReturnType<typeof buildDashboardCommandCenterViewModel>;

  beforeAll(() => {
    cachedProjection = buildCommandCenterNativeFirstRuntimeProjection();
    cachedViewModel = buildDashboardCommandCenterViewModel(cachedProjection.adapterInput);
    cachedSurfaces = commandCenterPublicSurfaces();
    cachedPack = createZavorthNativeAbsorptionPublicSurfaceHardeningPackFixture(cachedSurfaces);
  });

  it('documents 204 as one native absorption public surface hardening pack', () => {
    const content = read(DOC);

    expect(content).toContain('Status: native-absorption-public-surface-hardened');
    expect(content).toContain('ZavorthNativeAbsorptionPublicSurfaceHardeningPack.ts');
    expect(content).toContain('ZavorthNativeAbsorptionPublicSurfaceHardeningPack/v1');
    expect(content).toContain('ZavorthNativeAbsorptionPublicSurfaceGuard/v1');
    expect(content).toContain('ZavorthNativeAbsorptionReceiptLogHardening/v1');
    expect(content).toContain('publicSurfaceHardened=true');
    expect(content).toContain('publicExternalExecutorIdentityLeak=false');
    expect(content).toContain('nativeReadySurfacesZavorthNamed=true');
    expect(content).toContain('commandCenterPublicIdentityZavorthNative=true');
    expect(content).toContain('runtimeExternalExecutorRequiredForPublicRender=false');
    expect(content).toContain('Native registry consumer expansion follow-up:');
    expect(content).toContain('docs/205-wave-3-native-registry-consumer-expansion-pack.md');
    expect(content).toContain('Do not advance beyond the native registry consumer expansion pack');
    expect(content).not.toMatch(RAW_GATEWAY_TOKEN_ASSIGNMENT_PATTERN);
  });

  it('updates tracking docs and the previous partial adapter removal pack for 204', () => {
    expect(read(GO_NO_GO_DOC)).toContain('docs/204-wave-3-native-absorption-public-surface-hardening-pack.md');
    expect(read(PAUSE_DOC)).toContain('`204` is the native absorption public surface hardening pack');
    expect(read(PARTIAL_REMOVAL_DOC)).toContain(
      'Public surface hardening follow-up:\n`docs/204-wave-3-native-absorption-public-surface-hardening-pack.md`',
    );
    expect(read(PARTIAL_REMOVAL_DOC)).toContain('Do not advance beyond the public surface hardening pack');
  });

  it('exports the public surface hardening boundary and contracts', () => {
    const boundary = read(BOUNDARY);
    const index = read(INDEX);

    expect(boundary).toContain('ZavorthNativeAbsorptionPublicSurfaceHardeningPack/v1');
    expect(boundary).toContain('ZavorthNativeAbsorptionPublicSurfaceGuard/v1');
    expect(boundary).toContain('ZavorthNativeAbsorptionPublicNamingRule/v1');
    expect(index).toContain("from './ZavorthNativeAbsorptionPublicSurfaceHardeningPack.js'");
    expect(index).toContain('ZavorthNativeAbsorptionPublicSurfaceHardeningNormalization');
  });

  it('passes public surface guard with prohibited surfaces clean and internal exceptions allowlisted', () => {
    const pack = cachedPack;

    expect(pack.normalization.decision).toBe('native-absorption-public-surface-hardened');
    expect(pack.normalization.publicSurfaceGuard).toEqual(expect.objectContaining({
      passed: true,
      publicExternalExecutorIdentityLeak: false,
      internalProvenanceAllowed: true,
      missingPublicKinds: [],
      rawSecretSerialized: false,
    }));
    expect(pack.prohibitedFindings()).toHaveLength(0);
    expect(pack.allowlistedFindings().length).toBeGreaterThan(0);
    pack.publicInventory().forEach((row) => {
      expect(row.allowlistedException).toBe(false);
      expect(row.sourceIdentityAllowed).toBe(false);
      expect(row.rawSecretSerialized).toBe(false);
    });
  });

  it('fails the static guard when a prohibited public surface exposes ExternalExecutor identity', () => {
    const report = evaluateZavorthNativeAbsorptionPublicSurfaceGuard([
      surface(
        'bad-dashboard-label',
        'Bad dashboard label',
        'command-center:bad-public-label',
        'command-center-dashboard',
        'Render ExternalExecutor dashboard as public product identity.',
      ),
      ...cachedSurfaces.filter((entry) => entry.kind !== 'command-center-dashboard'),
    ]);

    expect(report.passed).toBe(false);
    expect(report.prohibitedFindings).toEqual(expect.arrayContaining([
      expect.objectContaining({
        surfaceId: 'bad-dashboard-label',
        kind: 'command-center-dashboard',
        term: 'ExternalExecutor',
        allowlisted: false,
      }),
    ]));
  });

  it('keeps Command Center and view model labels Zavorth-native', () => {
    const serializedViewModel = JSON.stringify(cachedViewModel);
    const serializedProjection = JSON.stringify(cachedProjection.projection);

    expect(cachedViewModel.adapterSource.label).toBe('Zavorth Native Registry Projection');
    expect(cachedViewModel.identity.agentName).toBe('Zavorth');
    expect(cachedProjection.policy.commandCenterDefaultAdapterCall).toBe(false);
    expect(cachedProjection.policy.externalSourceRequiredForCommandCenterRender).toBe(false);
    expect(cachedProjection.nativeRegistryConsumer.adapterFallbackExplicitOnly).toBe(true);
    expect(serializedViewModel).not.toContain('ExternalExecutor');
    expect(serializedViewModel).not.toContain('external-executor');
    expect(serializedProjection).not.toContain('ExternalExecutor');
    expect(serializedProjection).not.toContain('external-executor');
  });

  it('hardens user-facing receipts and logs while preserving redacted internal provenance', () => {
    const pack = cachedPack;
    const hardening = pack.normalization.receiptLogHardening;
    const serializedPublicReceiptsAndLogs = JSON.stringify([
      hardening.publicReceiptSamples,
      hardening.publicLogSamples,
    ]);

    expect(hardening.receiptsPubliclyRedacted).toBe(true);
    expect(hardening.logsPubliclyRedacted).toBe(true);
    hardening.publicReceiptSamples.forEach((sample) => {
      expect(sample.sourceLabel).toBe('external-source-redacted');
      expect(sample.sourceIdentityPublic).toBe(false);
      expect(sample.rawSecretSerialized).toBe(false);
    });
    hardening.publicLogSamples.forEach((sample) => {
      expect(sample.source).toMatch(/^zavorth-/);
      expect(sample.sourceIdentityPublic).toBe(false);
      expect(sample.rawSecretSerialized).toBe(false);
    });
    expect(hardening.internalProvenanceReceipt).toEqual(expect.objectContaining({
      sourceLabel: 'external-source-redacted',
      evidenceMode: 'internal-redacted-provenance',
      publicIdentity: 'Zavorth',
      sourceIdentityPublic: false,
      rawSecretSerialized: false,
    }));
    expect(serializedPublicReceiptsAndLogs).not.toContain('ExternalExecutor');
    expect(serializedPublicReceiptsAndLogs).not.toContain('external-executor');
    expect(serializedPublicReceiptsAndLogs).not.toMatch(RAW_GATEWAY_TOKEN_ASSIGNMENT_PATTERN);
  });

  it('keeps native-ready lookup/render without adapter default and does not grant forbidden authority', () => {
    const pack = cachedPack;
    const serialized = JSON.stringify(pack.normalization);

    expect(pack.normalization.sourceReadiness.partialAdapterRemoval).toBe('partial-adapter-removal-implemented');
    expect(pack.normalization.commandCenterHardening).toEqual({
      nativeContract: 'ZavorthNativeAbsorptionCommandCenterPublicHardening/v1',
      commandCenterPublicIdentityZavorthNative: true,
      publicLabelsZavorthNative: true,
      degradedUnavailableOperational: true,
      adapterDefaultPathForNativeReadySurfaces: false,
      runtimeExternalExecutorRequiredForPublicRender: false,
      rawSecretSerialized: false,
    });
    expect(pack.normalization.executionGate).toEqual({
      publicSurfaceHardened: true,
      publicExternalExecutorIdentityLeak: false,
      internalProvenanceAllowed: true,
      nativeReadySurfacesZavorthNamed: true,
      commandCenterPublicIdentityZavorthNative: true,
      adapterDefaultPathForNativeReadySurfaces: false,
      adapterRemovalGlobalAllowed: false,
      runtimeExternalExecutorRequiredForPublicRender: false,
      messageActuallySent: false,
      providerActuallyExecuted: false,
      commandActuallyExecuted: false,
      toolActuallyExecuted: false,
      stateMigrated: false,
      sourceModuleCopied: false,
      rawSecretSerialized: false,
    });
    expect(serialized).not.toMatch(RAW_GATEWAY_TOKEN_ASSIGNMENT_PATTERN);
    expect(serialized).not.toMatch(/(^|[^A-Za-z])sk-[A-Za-z0-9_-]{8,}/);
    expect(serialized).not.toMatch(/ghp_[A-Za-z0-9_]{8,}/);
    expect(serialized).not.toMatch(/xox[baprs]-[A-Za-z0-9-]{8,}/);
  });

  it('keeps all prohibited public surfaces free of ExternalExecutor/external-executor terms', () => {
    const prohibitedPublicSurfaces = cachedSurfaces
      .filter((entry) => !ALLOWLISTED_KINDS.includes(entry.kind));

    expect(prohibitedPublicSurfaces.length).toBeGreaterThan(0);
    prohibitedPublicSurfaces.forEach((entry) => {
      expect(entry.content).not.toContain('ExternalExecutor');
      expect(entry.content).not.toContain('external-executor');
      expect(entry.content).not.toMatch(RAW_GATEWAY_TOKEN_ASSIGNMENT_PATTERN);
    });
  });
});
