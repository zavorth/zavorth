import fs from 'node:fs';
import path from 'node:path';

import {
  ZAVORTH_FINAL_ADAPTER_DOMAIN_DECOMMISSION_PACK_RUNTIME_ID,
  createZavorthFinalAdapterDomainDecommissionPackFixture,
  createZavorthFinalAdapterDomainDecommissionSource,
  evaluateZavorthAdapterDecommissionStaticGuard,
  normalizeZavorthFinalAdapterDomainDecommissionPack,
} from '../../../src/runtime/external-agents/index.js';
import type {
  ZavorthAdapterDecommissionStaticGuardFile,
  ZavorthFinalAdapterDomainDecommissionSource,
  ZavorthFinalAdapterDomainId,
} from '../../../src/runtime/external-agents/index.js';

const DOC = 'docs/243-wave-5-final-adapter-domain-decommission-pack.md';
const GO_NO_GO_DOC = 'docs/117-external-agent-full-absorption-go-no-go.md';
const PAUSE_DOC = 'docs/159-external-executor-secret-provisioning-pause.md';
const PRIOR_DOC = 'docs/242-wave-4f-tool-command-execution-absorption-pack.md';
const BOUNDARY = 'src/runtime/external-agents/ZavorthFinalAdapterDomainDecommissionPack.ts';
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

const ABSORBED_DOMAINS: ZavorthFinalAdapterDomainId[] = [
  'capability-plugin-registry',
  'dashboard-command-center',
  'provider-metadata-execution',
  'channel-transport-message-send',
  'session-history-metadata-content',
  'config-secretref-state',
  'tool-command-execution',
];

function read(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

function assertNoRawSecretOrContent(serialized: string): void {
  expect(serialized).not.toMatch(RAW_GATEWAY_TOKEN_ASSIGNMENT_PATTERN);
  expect(serialized).not.toMatch(/(^|[^A-Za-z])sk-[A-Za-z0-9_-]{8,}/);
  expect(serialized).not.toMatch(/ghp_[A-Za-z0-9_]{8,}/);
  expect(serialized).not.toMatch(/xox[baprs]-[A-Za-z0-9-]{8,}/);
  expect(serialized).not.toContain('synthetic-raw-credential-sentinel-that-must-not-appear');
  expect(serialized).not.toContain('<redacted-local-secret>');
  expect(serialized).not.toContain('raw user message body that must never migrate');
  expect(serialized).not.toContain('unredacted private message fixture');
  expect(serialized).not.toContain('attachment binary fixture that must never migrate');
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

describe('Wave 5 final adapter domain decommission pack', () => {
  let source: ZavorthFinalAdapterDomainDecommissionSource;
  let pack: ReturnType<typeof createZavorthFinalAdapterDomainDecommissionPackFixture>;

  beforeAll(() => {
    const guardFiles = staticGuardFiles();
    source = createZavorthFinalAdapterDomainDecommissionSource(guardFiles);
    pack = createZavorthFinalAdapterDomainDecommissionPackFixture(guardFiles);
  });

  it('documents 243 as the final adapter domain decommission pack', () => {
    const content = read(DOC);

    expect(content).toContain('Status: `final-adapter-domain-decommission-ready`');
    expect(content).toContain('ZavorthFinalAdapterDomainDecommissionPack.ts');
    expect(content).toContain('ZavorthFinalAdapterDomainDecommissionPack/v1');
    expect(content).toContain('ZavorthFinalAdapterDomainInventoryRow/v1');
    expect(content).toContain('ZavorthFinalAdapterDomainImplementationRow/v1');
    expect(content).toContain('ZavorthFinalAdapterDomainReport/v1');
    expect(content).toContain('finalAdapterDomainDecommissionPackCreated=true');
    expect(content).toContain('absorbedDomainsAdapterDefaultRemoved=true');
    expect(content).toContain('adapterDefaultPathForAbsorbedDomains=false');
    expect(content).toContain('adapterGlobalStillAvailableIfRefreshNeeded=true');
    expect(content).toContain('adapterRemovalGlobalAllowed=false');
    expect(content).toContain('runtimeExternalExecutorRequiredForAbsorbedDomains=false');
    expect(content).toContain('publicExternalExecutorIdentityLeak=false');
    expect(content).toContain('Do not advance to the final Zavorth-only hardening/report pack');
    assertNoRawSecretOrContent(content);
  });

  it('updates tracking docs and the 242 handoff for 243', () => {
    expect(read(GO_NO_GO_DOC)).toContain(DOC);
    expect(read(PAUSE_DOC)).toContain('`243` opens Wave 5');
    expect(read(PRIOR_DOC)).toContain('Final Adapter Domain Decommission Follow-Up');
    expect(read(PRIOR_DOC)).toContain(DOC);
    expect(read(PRIOR_DOC)).toContain('Do not advance beyond `243`');
  });

  it('exports the final adapter domain decommission boundary and contracts', () => {
    const boundary = read(BOUNDARY);
    const index = read(INDEX);

    expect(boundary).toContain('ZavorthFinalAdapterDomainDecommissionPack/v1');
    expect(boundary).toContain('ZavorthFinalAdapterDomainInventoryRow/v1');
    expect(boundary).toContain('ZavorthFinalAdapterDomainImplementationRow/v1');
    expect(boundary).toContain('ZavorthFinalAdapterDomainReport/v1');
    expect(index).toContain("from './ZavorthFinalAdapterDomainDecommissionPack.js'");
    expect(index).toContain('ZAVORTH_FINAL_ADAPTER_DOMAIN_DECOMMISSION_PACK_RUNTIME_ID');
  });

  it('removes adapter default paths for absorbed domains while preserving Zavorth-owned defaults', () => {
    expect(pack.normalization.decision).toBe('final-adapter-domain-decommission-ready');
    expect(pack.normalization.domainInventory).toHaveLength(8);
    expect(pack.defaultAdapterRemovedForAbsorbedDomains()).toBe(true);
    ABSORBED_DOMAINS.forEach((domainId) => {
      expect(pack.domain(domainId)).toEqual(expect.objectContaining({
        absorbedDomain: true,
        defaultAdapterRemoved: true,
        adapterDefaultPathForDomain: false,
        adapterCalledForDefaultPath: false,
        runtimeExternalExecutorRequiredForDomain: false,
        publicExternalExecutorIdentityLeak: false,
        rawSecretSerialized: false,
      }));
    });
  });

  it('keeps refresh and fallback explicit without removing the global adapter', () => {
    expect(pack.domain('refresh-reconciliation')).toEqual(expect.objectContaining({
      classification: 'refresh-only',
      absorbedDomain: false,
      defaultAdapterRemoved: true,
      refreshOnly: true,
      stillRequired: true,
      defaultPath: 'explicit-refresh',
      allowlistRoles: ['refresh-source', 'reconciliation-source', 'live-probe-read-only', 'optional-plugin-future'],
    }));
    expect(pack.domain('channel-transport-message-send')).toEqual(expect.objectContaining({
      classification: 'adapter-fallback-only',
      adapterFallbackOnly: true,
      allowlistRoles: ['degraded-fallback-explicit'],
    }));
    expect(pack.normalization.decommissionReport.adapterGlobalShouldStillExist).toBe(true);
    expect(pack.normalization.executionGate.adapterGlobalStillAvailableIfRefreshNeeded).toBe(true);
    expect(pack.normalization.executionGate.adapterRemovalGlobalAllowed).toBe(false);
  });

  it('records domain implementation rows for removal/isolation without deleting required refresh boundaries', () => {
    pack.normalization.implementationRows.forEach((row) => {
      expect('actualFileDeleted' in row).toBe(false);
      expect(row.adapterGlobalStillAvailableIfRefreshNeeded).toBe(true);
      expect(row.adapterRemovalGlobalAllowed).toBe(false);
      expect(row.defaultAdapterPathRemoved).toBe(true);
      expect(row.runtimeExternalExecutorRequiredForAbsorbedDomain).toBe(false);
      expect(row.publicSurfaceZavorthNative).toBe(true);
      expect(row.rawSecretSerialized).toBe(false);
    });
    expect(fs.existsSync(path.join(process.cwd(), LIVE_PROBE_BOUNDARY))).toBe(true);
    expect(fs.existsSync(path.join(process.cwd(), REFRESH_RECONCILIATION_BOUNDARY))).toBe(true);
    expect(fs.existsSync(path.join(process.cwd(), FIXTURE_ADAPTER))).toBe(true);
  });

  it('keeps Command Center, registries, session/content, message, provider, and tool paths preserved', () => {
    expect(pack.normalization.regression).toEqual({
      nativeContract: 'ZavorthFinalAdapterDomainRegression/v1',
      commandCenterPathPreserved: true,
      nativeRegistriesPathPreserved: true,
      sessionContentPathPreserved: true,
      messageSendControlledPathPreserved: true,
      providerExecutionControlledPathPreserved: true,
      toolCommandControlledPathPreserved: true,
      explicitRefreshFallbackPreserved: true,
      runtimeExternalExecutorRequiredForAbsorbedDomains: false,
      publicExternalExecutorIdentityLeak: false,
      rawSecretSerialized: false,
    });
    expect(pack.normalization.executionGate).toEqual({
      finalAdapterDomainDecommissionPackCreated: true,
      absorbedDomainsAdapterDefaultRemoved: true,
      adapterDefaultPathForAbsorbedDomains: false,
      adapterGlobalStillAvailableIfRefreshNeeded: true,
      adapterRemovalGlobalAllowed: false,
      runtimeExternalExecutorRequiredForAbsorbedDomains: false,
      publicExternalExecutorIdentityLeak: false,
      messageSendControlledPathPreserved: true,
      providerExecutionControlledPathPreserved: true,
      toolCommandControlledPathPreserved: true,
      rawSecretSerialized: false,
      sourceModuleCopied: false,
    });
  });

  it('reinforces static guard and catches default adapter regressions while allowing refresh/fallback allowlists', () => {
    const regression = evaluateZavorthAdapterDecommissionStaticGuard([
      {
        path: 'src/runtime/external-agents/regressionDefaultConsumer.ts',
        defaultConsumer: true,
        content: [
          "import { FixtureExternalAgentAdapter } from './FixtureExternalAgentAdapter';",
          'const regression = {',
          '  adapterCalledForDefaultPath: true,',
          '  externalExecutorLiveCalledForDefaultPath: true,',
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

  it('reports removed, fallback-only, refresh-only, still-required, and blocked remaining surfaces', () => {
    expect(pack.normalization.decommissionReport).toEqual(expect.objectContaining({
      removedOrIsolatedDomains: expect.arrayContaining(ABSORBED_DOMAINS),
      refreshOnlyDomains: ['refresh-reconciliation'],
      fallbackOnlyDomains: ['channel-transport-message-send'],
      stillRequiredDomains: ['refresh-reconciliation'],
      recommendation: 'adapter-global-remains-refresh-fallback-optional-plugin-candidate',
      adapterGlobalShouldStillExist: true,
      optionalPluginFutureCandidate: true,
      rawSecretSerialized: false,
    }));
    expect(pack.normalization.decommissionReport.remainingBlockedSurfaces).toEqual(expect.arrayContaining([
      'unrestricted-production-message-send',
      'paid-provider-execution',
      'side-effect-provider-execution',
      'dangerous-tool-command-execution',
      'raw-state-migration',
      'raw-history-sqlite-import',
    ]));
    expect(pack.normalization.decommissionReport.remainingRefreshFallbackSurfaces).toEqual(expect.arrayContaining([
      'authenticated-read-only-health-probe',
      'real-capability-snapshot-refresh',
      'live-read-only-bridge-reconciliation',
      'fixture-adapter-contract-fallback',
    ]));
  });

  it('blocks attempts to remove global adapter, break refresh, call live default paths, execute, migrate, copy source, expose public identity, or serialize raw secrets', () => {
    const blockedCases: Array<keyof ZavorthFinalAdapterDomainDecommissionSource> = [
      'adapterRemovalAttempted',
      'refreshReconciliationBroken',
      'stillRequiredDomainRemoved',
      'externalExecutorLiveCalledForDefaultPath',
      'newExecutionAttempted',
      'newMigrationAttempted',
      'sourceModuleCopyAttempted',
      'publicExternalExecutorIdentityExposed',
      'rawSecretSerialized',
    ];

    blockedCases.forEach((key) => {
      const unsafeSource = { ...source, [key]: true } as unknown as ZavorthFinalAdapterDomainDecommissionSource;
      const normalization = normalizeZavorthFinalAdapterDomainDecommissionPack({
        generatedAt: '2026-05-01T14:01:00.000Z',
        runtimeId: ZAVORTH_FINAL_ADAPTER_DOMAIN_DECOMMISSION_PACK_RUNTIME_ID,
        source: unsafeSource,
      });

      expect(normalization.decision).toBe('blocked');
      expect(normalization.status).toBe('blocked');
      expect(normalization.executionGate.adapterRemovalGlobalAllowed).toBe(false);
      expect(normalization.executionGate.rawSecretSerialized).toBe(false);
    });
  });

  it('keeps serialized output redacted and free of raw content or secrets', () => {
    const serialized = JSON.stringify(pack.normalization);

    expect(pack.normalization.redaction).toEqual({
      rawSecretSerialized: false,
      rawContentSerialized: false,
      publicSourceIdentityExposed: false,
      provenanceInternalOnly: true,
      serializedOutputContainsSensitiveFixture: false,
    });
    expect(pack.normalization.nextGateRecommended).toBe('final-zavorth-only-absorption-hardening-and-report');
    assertNoRawSecretOrContent(serialized);
  });
});
