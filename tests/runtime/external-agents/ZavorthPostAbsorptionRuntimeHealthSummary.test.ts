import fs from 'node:fs';
import path from 'node:path';

import {
  createZavorthPostAbsorptionRuntimeHealthSummaryFixture,
  createZavorthPostAbsorptionRuntimeHealthSource,
  normalizeZavorthPostAbsorptionRuntimeHealthSummary,
  ZAVORTH_POST_ABSORPTION_RUNTIME_HEALTH_SUMMARY_RUNTIME_ID,
} from '../../../src/runtime/external-agents/index.js';
import type {
  ZavorthPostAbsorptionRuntimeHealthSource,
  ZavorthPostAbsorptionRuntimeHealthStatus,
} from '../../../src/runtime/external-agents/index.js';

const DOC = 'docs/256-post-absorption-release-monitoring-observability-polish-pack.md';
const FINAL_REPORT = 'docs/244-final-zavorth-only-absorption-hardening-and-report.md';
const DOCS_CLEANUP = 'docs/248-post-absorption-release-docs-install-cleanup.md';
const RC_REPORT = 'docs/249-post-absorption-release-candidate-report.md';
const HANDOFF = 'docs/250-post-absorption-final-release-notes-and-handoff.md';
const PARALLEL_HARDENING = 'docs/251-post-absorption-parallel-hardening-pack.md';
const LIMITED_SEND = 'docs/255-post-absorption-limited-production-message-send-expansion-pack.md';
const BOUNDARY = 'src/runtime/external-agents/ZavorthPostAbsorptionRuntimeHealthSummary.ts';
const INDEX = 'src/runtime/external-agents/index.ts';

const RAW_GATEWAY_TOKEN_ASSIGNMENT_PATTERN = new RegExp(
  'EXTERNAL_EXECUTOR_GATEWAY_TOKEN' + '=(?!present-redacted|<redacted-local-secret>)[^\\s`]+',
);

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
}

function statusFor(overrides: Partial<ZavorthPostAbsorptionRuntimeHealthSource>): ZavorthPostAbsorptionRuntimeHealthStatus {
  return createZavorthPostAbsorptionRuntimeHealthSummaryFixture(overrides).normalization.status;
}

describe('Post-absorption runtime health summary and monitoring polish', () => {
  let source: ZavorthPostAbsorptionRuntimeHealthSource;
  let summary: ReturnType<typeof createZavorthPostAbsorptionRuntimeHealthSummaryFixture>;

  beforeAll(() => {
    source = createZavorthPostAbsorptionRuntimeHealthSource();
    summary = createZavorthPostAbsorptionRuntimeHealthSummaryFixture();
  });

  it('documents 256 as the release monitoring and observability polish pack', () => {
    const content = read(DOC);

    expect(content).toContain('Status: `release-monitoring-observability-polish-ready`');
    expect(content).toContain('ZavorthPostAbsorptionRuntimeHealthSummary.ts');
    expect(content).toContain('ZavorthPostAbsorptionRuntimeHealthSummary/v1');
    expect(content).toContain('ZavorthPostAbsorptionDomainHealth/v1');
    expect(content).toContain('ZavorthPostAbsorptionObservabilitySignal/v1');
    expect(content).toContain('ZavorthPostAbsorptionLightAlert/v1');
    expect(content).toContain('releaseMonitoringObservabilityPolishPackCreated=true');
    expect(content).toContain('postAbsorptionRuntimeHealthSummaryCreated=true');
    expect(content).toContain('defaultRuntimeZavorthOwned=true');
    expect(content).toContain('externalExecutorLiveRequiredForHealthSummary=false');
    expect(content).toContain('adapterDefaultPathForAbsorbedDomains=false');
    expect(content).toContain('messageActuallySent=false');
    expect(content).toContain('Do not advance to `257`');
    assertNoRawSecretOrContent(content);
  });

  it('uses final reports, release docs, operations handoff, and limited send evidence', () => {
    const doc = read(DOC);

    [FINAL_REPORT, DOCS_CLEANUP, RC_REPORT, HANDOFF, PARALLEL_HARDENING, LIMITED_SEND].forEach((evidence) => {
      expect(doc).toContain(evidence);
    });
    expect(read(FINAL_REPORT)).toContain('defaultRuntimeZavorthOwned=true');
    expect(read(RC_REPORT)).toContain('release candidate: go');
    expect(read(HANDOFF)).toContain('Operator Handoff');
    expect(read(LIMITED_SEND)).toContain('unrestrictedProductionSendAllowed=false');
  });

  it('exports the runtime health boundary and contracts', () => {
    const boundary = read(BOUNDARY);
    const index = read(INDEX);

    expect(boundary).toContain('ZavorthPostAbsorptionRuntimeHealthSummary/v1');
    expect(boundary).toContain('ZavorthPostAbsorptionDomainHealth/v1');
    expect(boundary).toContain('ZavorthPostAbsorptionObservabilitySignal/v1');
    expect(boundary).toContain('ZavorthPostAbsorptionLightAlert/v1');
    expect(index).toContain("from './ZavorthPostAbsorptionRuntimeHealthSummary.js'");
    expect(index).toContain('ZAVORTH_POST_ABSORPTION_RUNTIME_HEALTH_SUMMARY_RUNTIME_ID');
  });

  it('represents absorbed domains and explicit fallback/refresh status without source adapter live requirements', () => {
    expect(summary.normalization.status).toBe('healthy');
    expect(summary.normalization.domainHealth.length).toBeGreaterThanOrEqual(10);
    expect(summary.normalization.domainHealth).toEqual(expect.arrayContaining([
      expect.objectContaining({
        domainId: 'capability-plugin-registry',
        absorbedOrOwned: true,
        fallbackRefreshStatus: 'none',
        defaultRuntimeZavorthOwned: true,
        externalExecutorLiveRequiredForHealth: false,
      }),
      expect.objectContaining({
        domainId: 'channel-transport-message-send',
        fallbackRefreshStatus: 'explicit-fallback',
        adapterDefaultPathForDomain: false,
      }),
      expect.objectContaining({
        domainId: 'refresh-reconciliation',
        fallbackRefreshStatus: 'explicit-refresh',
        adapterDefaultPathForDomain: false,
      }),
      expect.objectContaining({
        domainId: 'optional-future-adapter',
        fallbackRefreshStatus: 'optional-future',
      }),
    ]));
    summary.normalization.domainHealth.forEach((domain) => {
      expect(domain.externalExecutorLiveRequiredForHealth).toBe(false);
      expect(domain.adapterDefaultPathForDomain).toBe(false);
      expect(domain.rawSecretSerialized).toBe(false);
    });
  });

  it('maps all observability inventory signals with redacted receipts and no live source requirement', () => {
    expect(summary.normalization.observabilityInventory.map((signal) => signal.signalId)).toEqual([
      'native-registry-health',
      'production-loaded-registry-status',
      'refresh-reconciliation-status',
      'message-send-receipts',
      'provider-tool-command-receipts',
      'migration-import-disabled-status',
      'adapter-fallback-status',
      'redaction-public-surface-scan-status',
    ]);
    summary.normalization.observabilityInventory.forEach((signal) => {
      expect(signal.externalExecutorLiveRequiredForSignal).toBe(false);
      expect(signal.receiptRedacted).toBe(true);
      expect(signal.rawSecretSerialized).toBe(false);
      expect(signal.evidenceDocs.length).toBeGreaterThan(0);
    });
    expect(summary.signal('migration-import-disabled-status')?.status).toBe('healthy');
    expect(summary.signal('adapter-fallback-status')?.status).toBe('healthy');
  });

  it('classifies degraded, blocked, and needs-operator-action health states correctly', () => {
    expect(statusFor({ failedRefreshReconciliationDetected: true })).toBe('degraded');
    expect(statusFor({ shardRegressionDetected: true })).toBe('degraded');
    expect(statusFor({ missingSecretRefDetected: true })).toBe('needs-operator-action');
    expect(statusFor({ adapterFallbackUnexpectedlyInvoked: true })).toBe('needs-operator-action');
    expect(statusFor({ blockedProductionSendAttemptDetected: true })).toBe('needs-operator-action');
    expect(statusFor({ registryLoadFailureDetected: true })).toBe('blocked');
    expect(statusFor({ redactionScanPassed: false })).toBe('blocked');
    expect(statusFor({ publicSurfaceScanPassed: false })).toBe('blocked');
  });

  it('models lightweight alerts without external monitoring integration', () => {
    const alerting = createZavorthPostAbsorptionRuntimeHealthSummaryFixture({
      adapterFallbackUnexpectedlyInvoked: true,
      blockedProductionSendAttemptDetected: true,
      missingSecretRefDetected: true,
      failedRefreshReconciliationDetected: true,
      shardRegressionDetected: true,
    });

    expect(alerting.alert('fallback-adapter-invoked-unexpectedly')).toEqual(expect.objectContaining({
      status: 'active',
      severity: 'operator-action',
      modeled: true,
      externalIntegrationCreated: false,
    }));
    expect(alerting.alert('blocked-production-send-attempt')?.status).toBe('active');
    expect(alerting.alert('missing-secretref')?.status).toBe('active');
    expect(alerting.alert('failed-refresh-reconciliation')?.severity).toBe('warning');
    expect(alerting.alert('shard-regression')?.severity).toBe('warning');
    alerting.normalization.alerts.forEach((alert) => {
      expect(alert.rawSecretSerialized).toBe(false);
      expect(alert.externalIntegrationCreated).toBe(false);
    });
  });

  it('records operator diagnostics and release polish gaps without unsharded full-suite default', () => {
    expect(summary.normalization.operatorDiagnostics).toEqual({
      nativeContract: 'ZavorthPostAbsorptionOperatorDiagnostics/v1',
      commands: [
        'npm run runtime:check --silent',
        'npm run test:external-agents:shard -- N/16 --testTimeout=30000',
        'npx jest tests/ai-gateway/control --runInBand',
        'redaction scan',
        'public surface scan',
        'process/listener cleanup',
      ],
      aiGatewayControlPolicy: 'run-only-if-dashboard-control-touched',
      fullExternalAgentsSuitePolicy: 'do-not-run-unsharded-by-default',
      diagnosticsRedacted: true,
      rawSecretSerialized: false,
    });
    expect(summary.normalization.monitoringPolishReport.remainingGaps).toEqual(expect.arrayContaining([
      'external-agents heavy shard timing should continue to be tracked by shard',
      'optional raw history importer remains design-only and disabled by default',
      'limited production send remains policy-only unless explicitly flagged later',
    ]));
  });

  it('keeps exact execution guarantees and blocks prohibited runtime changes', () => {
    expect(summary.normalization.executionGate).toEqual({
      releaseMonitoringObservabilityPolishPackCreated: true,
      postAbsorptionRuntimeHealthSummaryCreated: true,
      defaultRuntimeZavorthOwned: true,
      externalExecutorLiveRequiredForHealthSummary: false,
      adapterDefaultPathForAbsorbedDomains: false,
      rawSecretSerialized: false,
      messageActuallySent: false,
      providerActuallyExecuted: false,
      toolCommandActuallyExecuted: false,
      rawMigrationPerformed: false,
      adapterRemovalGlobalAllowed: false,
    });

    const blockedCases: Array<keyof ZavorthPostAbsorptionRuntimeHealthSource> = [
      'externalExecutorLiveCalledForHealthDefault',
      'messageSendAttempted',
      'providerExecutionAttempted',
      'toolCommandExecutionAttempted',
      'rawMigrationAttempted',
      'adapterRemovalAttempted',
      'externalHeavyMonitoringIntegrationAttempted',
      'publicExternalExecutorIdentityExposed',
      'rawSecretSerialized',
    ];

    blockedCases.forEach((key) => {
      const normalization = normalizeZavorthPostAbsorptionRuntimeHealthSummary({
        generatedAt: '2026-05-01T22:01:00.000Z',
        runtimeId: ZAVORTH_POST_ABSORPTION_RUNTIME_HEALTH_SUMMARY_RUNTIME_ID,
        source: { ...source, [key]: true } as unknown as ZavorthPostAbsorptionRuntimeHealthSource,
      });

      expect(normalization.status).toBe('blocked');
      expect(normalization.executionGate.messageActuallySent).toBe(false);
      expect(normalization.executionGate.providerActuallyExecuted).toBe(false);
      expect(normalization.executionGate.toolCommandActuallyExecuted).toBe(false);
      expect(normalization.executionGate.rawMigrationPerformed).toBe(false);
      expect(normalization.executionGate.adapterRemovalGlobalAllowed).toBe(false);
      expect(normalization.executionGate.rawSecretSerialized).toBe(false);
    });
  });

  it('keeps diagnostics, receipts, and serialized output redacted', () => {
    const serialized = JSON.stringify(summary.normalization);

    expect(summary.normalization.redaction).toEqual({
      rawSecretSerialized: false,
      rawContentSerialized: false,
      publicSourceIdentityExposed: false,
      diagnosticsRedacted: true,
      receiptsRedacted: true,
      serializedOutputContainsSensitiveFixture: false,
    });
    expect(summary.normalization.nextGateRecommended).toBe('post-absorption-final-maintenance-backlog-and-roadmap-pack');
    assertNoRawSecretOrContent(serialized);
  });
});
