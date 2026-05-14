import fs from 'node:fs';
import path from 'node:path';

import {
  ZAVORTH_FINAL_ZAVORTH_ONLY_ABSORPTION_HARDENING_REPORT_RUNTIME_ID,
  createZavorthFinalZavorthOnlyAbsorptionHardeningReportFixture,
  createZavorthFinalZavorthOnlyAbsorptionSource,
  evaluateZavorthAdapterDecommissionStaticGuard,
  normalizeZavorthFinalZavorthOnlyAbsorptionHardeningReport,
} from '../../../src/runtime/external-agents/index.js';
import type {
  ZavorthAdapterDecommissionStaticGuardFile,
  ZavorthFinalZavorthOnlyAbsorptionSource,
  ZavorthFinalAbsorptionClassification,
} from '../../../src/runtime/external-agents/index.js';

const DOC = 'docs/244-final-zavorth-only-absorption-hardening-and-report.md';
const GO_NO_GO_DOC = 'docs/117-external-agent-full-absorption-go-no-go.md';
const PAUSE_DOC = 'docs/159-external-executor-secret-provisioning-pause.md';
const PRIOR_DOC = 'docs/243-wave-5-final-adapter-domain-decommission-pack.md';
const BOUNDARY = 'src/runtime/external-agents/ZavorthFinalZavorthOnlyAbsorptionHardeningReport.ts';
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

const REQUIRED_CLASSIFICATIONS: ZavorthFinalAbsorptionClassification[] = [
  'absorbed-native',
  'zavorth-owned-execution',
  'refresh-fallback-only',
  'optional-future-adapter',
  'blocked-explicitly-out-of-scope',
];

function read(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

function assertNoRawSecretOrContent(serialized: string): void {
  expect(serialized).not.toMatch(RAW_GATEWAY_TOKEN_ASSIGNMENT_PATTERN);
  expect(serialized).not.toMatch(/(^|[^A-Za-z])sk-[A-Za-z0-9_-]{8,}/);
  expect(serialized).not.toMatch(/ghp_[A-Za-z0-9_]{8,}/);
  expect(serialized).not.toMatch(/xox[baprs]-[A-Za-z0-9-]{8,}/);
  expect(serialized).not.toContain(['synthetic-raw-credential-sentinel', 'that-must-not-appear'].join('-'));
  expect(serialized).not.toContain('<redacted-local-secret>');
  expect(serialized).not.toContain(['raw user message body', 'that must never migrate'].join(' '));
  expect(serialized).not.toContain(['unredacted private', 'message fixture'].join(' '));
  expect(serialized).not.toContain(['attachment binary fixture', 'that must never migrate'].join(' '));
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

describe('Final Zavorth-only absorption hardening and report', () => {
  it('documents 244 as the final Zavorth-only hardening report', () => {
    const content = read(DOC);

    expect(content).toContain('Status: `final-zavorth-only-absorption-hardened`');
    expect(content).toContain('ZavorthFinalZavorthOnlyAbsorptionHardeningReport.ts');
    expect(content).toContain('ZavorthFinalZavorthOnlyAbsorptionHardeningReport/v1');
    expect(content).toContain('ZavorthFinalAbsorptionMatrixRow/v1');
    expect(content).toContain('ZavorthOnlyPublicHardening/v1');
    expect(content).toContain('ZavorthOnlyInstallRuntimeVerification/v1');
    expect(content).toContain('ZavorthOnlySecurityRedactionAudit/v1');
    expect(content).toContain('ZavorthOnlyFinalReport/v1');
    expect(content).toContain('finalZavorthOnlyAbsorptionHardeningComplete=true');
    expect(content).toContain('defaultRuntimeZavorthOwned=true');
    expect(content).toContain('externalExecutorNotRequiredForAbsorbedDomains=true');
    expect(content).toContain('publicExternalExecutorIdentityLeak=false');
    expect(content).toContain('adapterDefaultPathForAbsorbedDomains=false');
    expect(content).toContain('rawSecretSerialized=false');
    expect(content).toContain('rawContentLeak=false');
    assertNoRawSecretOrContent(content);
  });

  it('updates tracking docs and the 243 handoff for 244', () => {
    expect(read(GO_NO_GO_DOC)).toContain(DOC);
    expect(read(PAUSE_DOC)).toContain('`244` closes the absorption track');
    expect(read(PRIOR_DOC)).toContain('Final Zavorth-Only Follow-Up');
    expect(read(PRIOR_DOC)).toContain(DOC);
    expect(read(PRIOR_DOC).replace(/\s+/g, ' ')).toContain('It does not reintroduce ExternalExecutor as a default runtime');
  });

  it('exports the final Zavorth-only boundary and contracts', () => {
    const boundary = read(BOUNDARY);
    const index = read(INDEX);

    expect(boundary).toContain('ZavorthFinalZavorthOnlyAbsorptionHardeningReport/v1');
    expect(boundary).toContain('ZavorthFinalAbsorptionMatrixRow/v1');
    expect(boundary).toContain('ZavorthOnlyInstallRuntimeVerification/v1');
    expect(boundary).toContain('ZavorthOnlyFinalReport/v1');
    expect(index).toContain("from './ZavorthFinalZavorthOnlyAbsorptionHardeningReport.js'");
    expect(index).toContain('ZAVORTH_FINAL_ZAVORTH_ONLY_ABSORPTION_HARDENING_REPORT_RUNTIME_ID');
  });

  it('builds a complete final absorption matrix with evidence by wave and gate', () => {
    const report = createZavorthFinalZavorthOnlyAbsorptionHardeningReportFixture(staticGuardFiles());

    expect(report.normalization.decision).toBe('final-zavorth-only-absorption-hardened');
    expect(report.normalization.finalAbsorptionMatrix).toHaveLength(10);
    REQUIRED_CLASSIFICATIONS.forEach((classification) => {
      expect(report.domainsByClassification(classification).length).toBeGreaterThan(0);
    });
    report.normalization.finalAbsorptionMatrix.forEach((row) => {
      expect(row.evidenceDocs.length).toBeGreaterThan(0);
      expect(row.adapterDefaultPathForDomain).toBe(false);
      expect(row.externalExecutorNotRequiredForDomain).toBe(true);
      expect(row.publicExternalExecutorIdentityLeak).toBe(false);
      expect(row.rawSecretSerialized).toBe(false);
      expect(row.rawContentLeak).toBe(false);
      expect(row.sourceModuleCopied).toBe(false);
    });
    expect(report.defaultRuntimeIsZavorthOwned()).toBe(true);
  });

  it('keeps public product surfaces Zavorth-native with internal-only provenance', () => {
    const report = createZavorthFinalZavorthOnlyAbsorptionHardeningReportFixture(staticGuardFiles());

    expect(report.normalization.publicHardening).toEqual({
      nativeContract: 'ZavorthOnlyPublicHardening/v1',
      docsApiDashboardLogsViewModelsZavorthNative: true,
      externalExecutorAllowedOnlyInInternalAuditDocs: true,
      publicExternalExecutorIdentityAllowed: false,
      publicExternalExecutorIdentityLeak: false,
      receiptsLogsViewModelsRedacted: true,
      provenanceInternalOnly: true,
      allowlistedInternalSurfaces: [
        'internal-absorption-docs',
        'runtime/external-agents tests',
        'refresh-reconciliation-boundary',
        'redacted-provenance-metadata',
      ],
      rawSecretSerialized: false,
      rawContentLeak: false,
    });
    expect(report.normalization.staticGuard.passed).toBe(true);
  });

  it('verifies install/runtime defaults are Zavorth-owned and adapter is not default', () => {
    const report = createZavorthFinalZavorthOnlyAbsorptionHardeningReportFixture(staticGuardFiles());

    expect(report.normalization.installRuntimeVerification).toEqual({
      nativeContract: 'ZavorthOnlyInstallRuntimeVerification/v1',
      defaultRuntimeZavorthOwned: true,
      commandCenterDefaultZavorthOwned: true,
      nativeRegistryLookupDefault: true,
      messageSendControlledPathZavorthOwned: true,
      providerExecutionControlledPathZavorthOwned: true,
      toolCommandControlledPathZavorthOwned: true,
      adapterDefaultPathForAbsorbedDomains: false,
      externalExecutorNotRequiredForAbsorbedDomains: true,
      externalExecutorRequiredForInstallOfAbsorbedDomains: false,
      refreshFallbackExplicitOnly: true,
      adapterGlobalStillAvailableForExplicitRefreshFallback: true,
    });
    expect(report.normalization.executionGate).toEqual({
      finalZavorthOnlyAbsorptionHardeningComplete: true,
      defaultRuntimeZavorthOwned: true,
      externalExecutorNotRequiredForAbsorbedDomains: true,
      publicExternalExecutorIdentityLeak: false,
      adapterDefaultPathForAbsorbedDomains: false,
      rawSecretSerialized: false,
      rawContentLeak: false,
      sourceModuleCopied: false,
    });
  });

  it('records security, redaction, and regression suite policy without requiring the known long full suite', () => {
    const report = createZavorthFinalZavorthOnlyAbsorptionHardeningReportFixture(staticGuardFiles());

    expect(report.normalization.securityRedactionAudit).toEqual({
      nativeContract: 'ZavorthOnlySecurityRedactionAudit/v1',
      redactionScanRequired: true,
      secretRefsMetadataOnly: true,
      receiptsLogsRedacted: true,
      redactedOrDerivedContentOnly: true,
      rawSecretSerialized: false,
      rawContentLeak: false,
      publicSourceIdentityExposed: false,
      serializedOutputContainsSensitiveFixture: false,
    });
    expect(report.normalization.regressionSuitePlan).toEqual(expect.objectContaining({
      nativeContract: 'ZavorthOnlyRegressionSuitePlan/v1',
      focusedTest: 'tests/runtime/external-agents/ZavorthFinalZavorthOnlyAbsorptionHardeningReport.test.ts',
      runtimeCheck: 'npm run runtime:check --silent',
      aiGatewayControlPolicy: 'run-only-if-dashboard-control-touched',
      fullExternalAgentsSuitePolicy: 'optional-skipped-known-timeout-todo',
      fullExternalAgentsSuiteBlocking: false,
    }));
    expect(report.normalization.regressionSuitePlan.representativeSuites).toEqual(expect.arrayContaining([
      'tests/runtime/external-agents/ZavorthFinalAdapterDomainDecommissionPack.test.ts',
      'tests/runtime/external-agents/ZavorthWave4DMessageSendExpansionAndAuditPack.test.ts',
      'tests/runtime/external-agents/ZavorthWave4EProviderExecutionAbsorptionPack.test.ts',
      'tests/runtime/external-agents/ZavorthWave4FToolCommandExecutionAbsorptionPack.test.ts',
      'tests/runtime/external-agents/ZavorthNativeAbsorptionRegressionReleaseHardeningPack.test.ts',
    ]));
  });

  it('records absorbed domains, fallback-only, optional adapter, blocked decisions, risks, and next steps', () => {
    const report = createZavorthFinalZavorthOnlyAbsorptionHardeningReportFixture(staticGuardFiles());

    expect(report.normalization.finalReport).toEqual(expect.objectContaining({
      nativeContract: 'ZavorthOnlyFinalReport/v1',
      absorbedNative: expect.arrayContaining([
        'capability-plugin-registry',
        'dashboard-command-center',
        'session-history-metadata-content',
        'config-secretref-state',
      ]),
      zavorthOwnedExecution: expect.arrayContaining([
        'channel-transport-message-send',
        'provider-metadata-execution',
        'tool-command-execution',
      ]),
      refreshFallbackOnly: ['refresh-reconciliation'],
      optionalFutureAdapter: ['optional-future-adapter'],
      defaultRuntimeZavorthOwned: true,
      adapterDefaultPathForAbsorbedDomains: false,
      externalExecutorNotRequiredForAbsorbedDomains: true,
      publicExternalExecutorIdentityLeak: false,
      rawSecretSerialized: false,
      rawContentLeak: false,
    }));
    expect(report.normalization.finalReport.blockedOrOutOfScope).toEqual(expect.arrayContaining([
      'unrestricted-production-message-send',
      'paid-provider-execution',
      'side-effect-provider-execution',
      'dangerous-tool-command-execution',
      'raw-history-sqlite-import',
      'raw-secret-migration',
      'raw-workspace-log-cache-import',
    ]));
    expect(report.normalization.finalReport.remainingRisks.length).toBeGreaterThan(0);
    expect(report.normalization.finalReport.nextSteps).toEqual(expect.arrayContaining([
      'keep adapter as explicit refresh/fallback only',
      'consider optional-plugin packaging after refresh parity replacement',
    ]));
  });

  it('catches public/default adapter regressions through the static guard', () => {
    const regression = evaluateZavorthAdapterDecommissionStaticGuard([
      {
        path: 'src/runtime/external-agents/publicRegression.ts',
        defaultConsumer: true,
        content: [
          "import { FixtureExternalAgentAdapter } from './FixtureExternalAgentAdapter';",
          'const regression = {',
          '  adapterCalledForDefaultPath: true,',
          '  externalExecutorLiveCalledForDefaultPath: true,',
          "  source: 'external-executor-default-runtime',",
          "  label: 'ExternalExecutor Runtime',",
          '};',
        ].join('\n'),
      },
    ]);

    expect(regression.passed).toBe(false);
    expect(regression.findings.map((finding) => finding.pattern)).toEqual(expect.arrayContaining([
      'FixtureExternalAgentAdapter default import',
      'default adapter call true',
      'live source runtime default path true',
      'public external-executor source',
      'public ExternalExecutor label',
    ]));
  });

  it('blocks reintroducing ExternalExecutor runtime defaults, public identity, raw data, source copy, new execution, migration, or global adapter removal', () => {
    const source = createZavorthFinalZavorthOnlyAbsorptionSource(staticGuardFiles());
    const blockedCases: Array<keyof ZavorthFinalZavorthOnlyAbsorptionSource> = [
      'defaultRuntimeExternalExecutorReintroduced',
      'adapterDefaultPathReintroduced',
      'publicExternalExecutorIdentityExposed',
      'rawSecretSerialized',
      'rawContentLeak',
      'sourceModuleCopyAttempted',
      'newExecutionAttempted',
      'newStateMigrationAttempted',
      'globalAdapterRemovalAttempted',
    ];

    blockedCases.forEach((key) => {
      const unsafeSource = { ...source, [key]: true } as unknown as ZavorthFinalZavorthOnlyAbsorptionSource;
      const normalization = normalizeZavorthFinalZavorthOnlyAbsorptionHardeningReport({
        generatedAt: '2026-05-01T15:01:00.000Z',
        runtimeId: ZAVORTH_FINAL_ZAVORTH_ONLY_ABSORPTION_HARDENING_REPORT_RUNTIME_ID,
        source: unsafeSource,
      });

      expect(normalization.decision).toBe('blocked');
      expect(normalization.status).toBe('blocked');
      expect(normalization.executionGate.adapterDefaultPathForAbsorbedDomains).toBe(false);
      expect(normalization.executionGate.rawSecretSerialized).toBe(false);
      expect(normalization.executionGate.rawContentLeak).toBe(false);
      expect(normalization.executionGate.sourceModuleCopied).toBe(false);
    });
  });

  it('keeps serialized output redacted and free of raw content or secrets', () => {
    const report = createZavorthFinalZavorthOnlyAbsorptionHardeningReportFixture(staticGuardFiles());
    const serialized = JSON.stringify(report.normalization);

    expect(report.normalization.redaction).toEqual({
      rawSecretSerialized: false,
      rawContentLeak: false,
      publicSourceIdentityExposed: false,
      provenanceInternalOnly: true,
      serializedOutputContainsSensitiveFixture: false,
    });
    assertNoRawSecretOrContent(serialized);
  });
});
