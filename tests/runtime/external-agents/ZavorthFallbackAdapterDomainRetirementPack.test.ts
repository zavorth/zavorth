import fs from 'node:fs';
import path from 'node:path';

import {
  ZAVORTH_FALLBACK_ADAPTER_DOMAIN_RETIREMENT_PACK_RUNTIME_ID,
  createZavorthFallbackAdapterDomainRetirementPackFixture,
  createZavorthFallbackAdapterDomainRetirementSource,
  evaluateZavorthFallbackAdapterDomainRetirementStaticGuard,
  normalizeZavorthFallbackAdapterDomainRetirementPack,
} from '../../../src/runtime/external-agents/index.js';
import type {
  ZavorthFallbackAdapterDomainRetirementDomainId,
  ZavorthFallbackAdapterDomainRetirementSource,
  ZavorthFallbackAdapterDomainRetirementStaticGuardFile,
} from '../../../src/runtime/external-agents/index.js';

const DOC = 'docs/253-post-absorption-fallback-adapter-retirement-domain-pack.md';
const PRIOR_DOC = 'docs/251-post-absorption-parallel-hardening-pack.md';
const FINAL_DECOMMISSION_DOC = 'docs/243-wave-5-final-adapter-domain-decommission-pack.md';
const BOUNDARY = 'src/runtime/external-agents/ZavorthFallbackAdapterDomainRetirementPack.ts';
const INDEX = 'src/runtime/external-agents/index.ts';
const FINAL_DECOMMISSION_BOUNDARY = 'src/runtime/external-agents/ZavorthFinalAdapterDomainDecommissionPack.ts';
const COMMAND_CENTER_PROJECTION =
  'src/ai-gateway/app/(dashboard)/control/command-center/projections/commandCenterRuntimeProjection.ts';
const POLICY_PREFLIGHT_BOUNDARY =
  'src/runtime/external-agents/ExternalAgentCommandHttpPolicyPreflightBoundary.ts';
const OBSERVABILITY_PROJECTION_BOUNDARY =
  'src/runtime/external-agents/ExternalAgentCommandHttpObservabilityProjectionBoundary.ts';
const REFRESH_RECONCILIATION_BOUNDARY =
  'src/runtime/external-agents/ZavorthNativeRegistryRefreshReconciliation.ts';
const FIXTURE_ADAPTER =
  'src/runtime/external-agents/FixtureExternalAgentAdapter.ts';

const RAW_GATEWAY_TOKEN_ASSIGNMENT_PATTERN = new RegExp(
  'EXTERNAL_EXECUTOR_GATEWAY_TOKEN' + '=(?!present-redacted|<redacted-local-secret>)[^\\s`]+',
);

const RETIRED_DOMAINS: ZavorthFallbackAdapterDomainRetirementDomainId[] = [
  'capability-plugin-registry',
  'dashboard-command-center',
  'provider-metadata-execution',
  'session-history-metadata-content',
  'config-secretref-state',
  'tool-command-execution',
];

function read(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

function assertNoRawSecretOrContent(serialized: string): void {
  expect(serialized).not.toMatch(RAW_GATEWAY_TOKEN_ASSIGNMENT_PATTERN);
  expect(serialized).not.toMatch(/(?<![A-Za-z])sk-[A-Za-z0-9_-]{20,}/);
  expect(serialized).not.toMatch(/ghp_[A-Za-z0-9_]{20,}/);
  expect(serialized).not.toMatch(/xox[baprs]-[A-Za-z0-9-]{20,}/);
  expect(serialized).not.toContain('synthetic-raw-credential-sentinel-that-must-not-appear');
  expect(serialized).not.toContain('<redacted-local-secret>');
  expect(serialized).not.toContain('raw user message body that must never migrate');
  expect(serialized).not.toContain('unredacted private message fixture');
}

function staticGuardFiles(): ZavorthFallbackAdapterDomainRetirementStaticGuardFile[] {
  return [
    {
      path: COMMAND_CENTER_PROJECTION,
      domainId: 'dashboard-command-center',
      content: read(COMMAND_CENTER_PROJECTION),
    },
    {
      path: POLICY_PREFLIGHT_BOUNDARY,
      domainId: 'tool-command-execution',
      content: read(POLICY_PREFLIGHT_BOUNDARY),
    },
    {
      path: OBSERVABILITY_PROJECTION_BOUNDARY,
      domainId: 'provider-metadata-execution',
      content: read(OBSERVABILITY_PROJECTION_BOUNDARY),
    },
    {
      path: REFRESH_RECONCILIATION_BOUNDARY,
      domainId: 'refresh-reconciliation',
      allowlistRole: 'reconciliation-source',
      content: read(REFRESH_RECONCILIATION_BOUNDARY),
    },
    {
      path: FIXTURE_ADAPTER,
      domainId: 'channel-transport-message-send',
      allowlistRole: 'degraded-fallback-explicit',
      content: read(FIXTURE_ADAPTER),
    },
  ];
}

describe('Post-absorption fallback adapter retirement domain pack', () => {
  let source: ZavorthFallbackAdapterDomainRetirementSource;
  let pack: ReturnType<typeof createZavorthFallbackAdapterDomainRetirementPackFixture>;

  beforeAll(() => {
    const guardFiles = staticGuardFiles();
    source = createZavorthFallbackAdapterDomainRetirementSource(guardFiles);
    pack = createZavorthFallbackAdapterDomainRetirementPackFixture(guardFiles);
  });

  it('documents 253 as the fallback adapter retirement domain pack', () => {
    const content = read(DOC);

    expect(content).toContain('Status: `fallback-adapter-domain-retirement-ready`');
    expect(content).toContain('ZavorthFallbackAdapterDomainRetirementPack.ts');
    expect(content).toContain('ZavorthFallbackAdapterDomainRetirementPack/v1');
    expect(content).toContain('ZavorthFallbackAdapterDomainRetirementMatrixRow/v1');
    expect(content).toContain('ZavorthFallbackAdapterDomainRetirementImplementationRow/v1');
    expect(content).toContain('ZavorthFallbackAdapterDomainRetirementStaticGuard/v1');
    expect(content).toContain('fallbackAdapterDomainRetirementPackCreated=true');
    expect(content).toContain('onlyCanRetireNextDomainsTouched=true');
    expect(content).toContain('adapterGlobalStillAvailable=true');
    expect(content).toContain('adapterRemovalGlobalAllowed=false');
    expect(content).toContain('retiredDomainsNoAdapterFallback=true');
    expect(content).toContain('blockedDomainsPreserved=true');
    expect(content).toContain('runtimeExternalExecutorRequiredForRetiredDomains=false');
    expect(content).toContain('publicExternalExecutorIdentityLeak=false');
    expect(content).toContain('Do not advance to `254`');
    assertNoRawSecretOrContent(content);
  });

  it('uses the 251 retirement matrix and the 243 final decommission evidence', () => {
    const doc = read(DOC);
    const prior = read(PRIOR_DOC);
    const finalDecommission = read(FINAL_DECOMMISSION_DOC);

    [
      'capability/plugin registry | `can-retire-next`',
      'dashboard/Command Center | `can-retire-next`',
      'session/history metadata/content | `can-retire-next`',
      'config/SecretRef/state metadata | `can-retire-next`',
      'provider metadata/execution | `can-retire-next`',
      'tool/command execution | `can-retire-next`',
      'channel/transport/message send | `keep-fallback-only`',
      'refresh/reconciliation | `keep-refresh-only`',
      'raw history/SQLite import | `blocked`',
    ].forEach((item) => expect(prior).toContain(item));
    expect(finalDecommission).toContain('Status: `final-adapter-domain-decommission-ready`');
    expect(doc).toContain(PRIOR_DOC);
    expect(doc).toContain(FINAL_DECOMMISSION_DOC);
  });

  it('exports the boundary and contracts from the runtime external-agents barrel', () => {
    const boundary = read(BOUNDARY);
    const index = read(INDEX);

    expect(boundary).toContain('ZavorthFallbackAdapterDomainRetirementPack/v1');
    expect(boundary).toContain('ZavorthFallbackAdapterDomainRetirementMatrixRow/v1');
    expect(boundary).toContain('ZavorthFallbackAdapterDomainRetirementReport/v1');
    expect(boundary).toContain('fallback-adapter-domain-retirement-ready');
    expect(index).toContain("from './ZavorthFallbackAdapterDomainRetirementPack.js'");
    expect(index).toContain('ZAVORTH_FALLBACK_ADAPTER_DOMAIN_RETIREMENT_PACK_RUNTIME_ID');
    expect(read(FINAL_DECOMMISSION_BOUNDARY)).toContain('ZavorthFinalAdapterDomainDecommissionPack/v1');
  });

  it('retires fallback adapter only for domains classified can-retire-next', () => {
    expect(pack.normalization.decision).toBe('fallback-adapter-domain-retirement-ready');
    expect(pack.onlyCanRetireNextDomainsTouched()).toBe(true);
    expect(pack.retiredDomains().map((row) => row.domainId).sort()).toEqual([...RETIRED_DOMAINS].sort());

    RETIRED_DOMAINS.forEach((domainId) => {
      expect(pack.domain(domainId)).toEqual(expect.objectContaining({
        classification: 'can-retire-next',
        selectedForRetirement: true,
        touchedByPack: true,
        fallbackAdapterRetired: true,
        fallbackAdapterPreserved: false,
        refreshAdapterPreserved: false,
        adapterGlobalStillAvailable: true,
        adapterRemovalGlobalAllowed: false,
        runtimeExternalExecutorRequiredForDomain: false,
        publicExternalExecutorIdentityLeak: false,
        rawSecretSerialized: false,
      }));
    });
  });

  it('preserves keep-fallback-only, keep-refresh-only, and blocked domains', () => {
    expect(pack.domain('channel-transport-message-send')).toEqual(expect.objectContaining({
      classification: 'keep-fallback-only',
      selectedForRetirement: false,
      touchedByPack: false,
      fallbackAdapterRetired: false,
      fallbackAdapterPreserved: true,
    }));
    expect(pack.domain('refresh-reconciliation')).toEqual(expect.objectContaining({
      classification: 'keep-refresh-only',
      selectedForRetirement: false,
      touchedByPack: false,
      refreshAdapterPreserved: true,
    }));
    ['unrestricted-production-send', 'raw-history-sqlite-import', 'optional-future-adapter'].forEach((domainId) => {
      expect(pack.domain(domainId as ZavorthFallbackAdapterDomainRetirementDomainId)).toEqual(expect.objectContaining({
        classification: 'blocked',
        selectedForRetirement: false,
        touchedByPack: false,
        blockedDomainPreserved: true,
      }));
    });
  });

  it('keeps the global adapter available while guaranteeing retired domains have no fallback', () => {
    pack.normalization.implementationRows.forEach((row) => {
      expect(row.actualFileDeleted).toBe(false);
      expect(row.adapterGlobalStillAvailable).toBe(true);
      expect(row.adapterRemovalGlobalAllowed).toBe(false);
      expect(row.rawSecretSerialized).toBe(false);
    });
    expect(pack.normalization.executionGate).toEqual({
      fallbackAdapterDomainRetirementPackCreated: true,
      onlyCanRetireNextDomainsTouched: true,
      adapterGlobalStillAvailable: true,
      adapterRemovalGlobalAllowed: false,
      retiredDomainsNoAdapterFallback: true,
      blockedDomainsPreserved: true,
      runtimeExternalExecutorRequiredForRetiredDomains: false,
      publicExternalExecutorIdentityLeak: false,
      messageActuallySent: false,
      providerActuallyExecuted: false,
      toolCommandActuallyExecuted: false,
      rawMigrationPerformed: false,
      rawSecretSerialized: false,
    });
    expect(fs.existsSync(path.join(process.cwd(), FIXTURE_ADAPTER))).toBe(true);
    expect(fs.existsSync(path.join(process.cwd(), REFRESH_RECONCILIATION_BOUNDARY))).toBe(true);
  });

  it('enforces a domain-specific static guard and allowlists preserved fallback/refresh domains', () => {
    const regression = evaluateZavorthFallbackAdapterDomainRetirementStaticGuard([
      {
        path: 'src/runtime/external-agents/regressionDashboardFallback.ts',
        domainId: 'dashboard-command-center',
        content: [
          "import { FixtureExternalAgentAdapter } from './FixtureExternalAgentAdapter';",
          'const fallbackAdapterAllowed = true;',
          "const role = 'degraded-fallback-explicit';",
        ].join('\n'),
      },
      {
        path: 'src/runtime/external-agents/channelFallbackStillAllowed.ts',
        domainId: 'channel-transport-message-send',
        allowlistRole: 'degraded-fallback-explicit',
        content: "const role = 'degraded-fallback-explicit';",
      },
    ], RETIRED_DOMAINS);

    expect(pack.normalization.staticGuard.passed).toBe(true);
    expect(pack.normalization.staticGuard.allowlistedPaths).toEqual(expect.arrayContaining([
      expect.objectContaining({
        domainId: 'channel-transport-message-send',
        role: 'degraded-fallback-explicit',
      }),
      expect.objectContaining({
        domainId: 'refresh-reconciliation',
        role: 'reconciliation-source',
      }),
    ]));
    expect(regression.passed).toBe(false);
    expect(regression.findings.map((finding) => finding.pattern)).toEqual(expect.arrayContaining([
      'FixtureExternalAgentAdapter fallback reference',
      'fallback adapter enabled',
      'degraded fallback role on retired domain',
    ]));
    expect(regression.findings.every((finding) => finding.domainId === 'dashboard-command-center')).toBe(true);
  });

  it('records no-safe-domain-retirement-target when the 251 matrix has no safe candidates', () => {
    const noCandidatePack = createZavorthFallbackAdapterDomainRetirementPackFixture([], []);

    expect(noCandidatePack.normalization.decision).toBe('no-safe-domain-retirement-target');
    expect(noCandidatePack.normalization.retirementReport.noSafeDomainRetirementTarget).toBe(true);
    expect(noCandidatePack.normalization.retirementReport.retiredDomains).toEqual([]);
    expect(noCandidatePack.normalization.executionGate.retiredDomainsNoAdapterFallback).toBe(true);
    expect(noCandidatePack.normalization.executionGate.adapterRemovalGlobalAllowed).toBe(false);
  });

  it('blocks attempts to touch non-retirable domains, remove the adapter, call live default paths, execute, migrate, copy source, expose public identity, or serialize secrets', () => {
    const blockedCases: Array<keyof ZavorthFallbackAdapterDomainRetirementSource> = [
      'adapterRemovalAttempted',
      'touchedNonCanRetireNextDomain',
      'keepRefreshOrFallbackDomainTouched',
      'blockedDomainTouched',
      'externalExecutorLiveCalledForDefaultPath',
      'messageSendAttempted',
      'providerExecutionAttempted',
      'toolCommandExecutionAttempted',
      'rawMigrationAttempted',
      'sourceModuleCopyAttempted',
      'publicExternalExecutorIdentityExposed',
      'rawSecretSerialized',
    ];

    blockedCases.forEach((key) => {
      const unsafeSource = { ...source, [key]: true } as unknown as ZavorthFallbackAdapterDomainRetirementSource;
      const normalization = normalizeZavorthFallbackAdapterDomainRetirementPack({
        generatedAt: '2026-05-01T19:01:00.000Z',
        runtimeId: ZAVORTH_FALLBACK_ADAPTER_DOMAIN_RETIREMENT_PACK_RUNTIME_ID,
        source: unsafeSource,
      });

      expect(normalization.decision).toBe('blocked');
      expect(normalization.executionGate.adapterRemovalGlobalAllowed).toBe(false);
      expect(normalization.executionGate.messageActuallySent).toBe(false);
      expect(normalization.executionGate.providerActuallyExecuted).toBe(false);
      expect(normalization.executionGate.toolCommandActuallyExecuted).toBe(false);
      expect(normalization.executionGate.rawMigrationPerformed).toBe(false);
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
    expect(pack.normalization.nextGateRecommended).toBe('post-absorption-final-optional-adapter-plugin-or-release-maintenance');
    assertNoRawSecretOrContent(serialized);
  });
});
