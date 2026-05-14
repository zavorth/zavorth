import fs from 'node:fs';
import path from 'node:path';

import {
  createGovernedReadOnlyCapabilityRefreshDegradedFixtureSource,
  normalizeGovernedReadOnlyCapabilityRefresh,
  normalizeGovernedReadOnlyCapabilityRefreshFixture,
} from '../../../src/runtime/external-agents/index.js';

const DOC = 'docs/177-wave-2-governed-read-only-capability-refresh.md';
const BOUNDARY = 'src/runtime/external-agents/ExternalAgentGovernedReadOnlyCapabilityRefresh.ts';
const INDEX = 'src/runtime/external-agents/index.ts';

function read(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

describe('governed read-only capability refresh', () => {
  it('documents 177 as a governed read-only capability refresh', () => {
    const content = read(DOC);

    expect(content).toContain('Status: governed-read-only-capability-refresh-ok');
    expect(content).toContain('docs/176-wave-2-first-governed-read-only-gateway-action.md -> governed-read-only-gateway-action-ok');
    expect(content).toContain('gateway.status');
    expect(content).toContain('gateway.probe');
    expect(content).toContain('Status exit code | `0`');
    expect(content).toContain('Probe exit code | `0`');
    expect(content).toContain('Cleanup final listener count | `0`');
    expect(content).toContain('readOnlyCapabilityRefreshActuallyPerformed: true');
    expect(content).toContain('messageActuallySent: false');
    expect(content).not.toMatch(/EXTERNAL_EXECUTOR_GATEWAY_TOKEN=(?!present-redacted|<redacted-local-secret>)[^\s`]+/);
    expect(content).not.toMatch(/(^|[^A-Za-z])sk-[A-Za-z0-9_-]{8,}/);
  });

  it('exports the capability refresh normalizer and contracts', () => {
    const boundary = read(BOUNDARY);
    const index = read(INDEX);

    expect(boundary).toContain('ZavorthGovernedReadOnlyCapabilityRefresh/v1');
    expect(boundary).toContain('ZavorthGovernedReadOnlyCapabilityRefreshSnapshot/v1');
    expect(boundary).toContain('ZavorthCommandCenterCapabilityProjectionUpdate/v1');
    expect(boundary).toContain('normalizeGovernedReadOnlyCapabilityRefresh');
    expect(index).toContain("from './ExternalAgentGovernedReadOnlyCapabilityRefresh.js'");
    expect(index).toContain('ZavorthGovernedReadOnlyCapabilityRefreshNormalization');
  });

  it('runs gateway refresh intent through policy/preflight and the governed dispatch plan', () => {
    const normalized = normalizeGovernedReadOnlyCapabilityRefreshFixture();

    expect(normalized.intent.actionKind).toBe('gateway-method-call');
    expect(normalized.policyPreflight.classification).toBe('read-only-allowed');
    expect(normalized.policyPreflight.policyAuthority).toBe('zavorth-policy-preflight');
    expect(normalized.policyPreflight.sourceCapabilityAuthority).toBe(false);
    expect(normalized.dispatchPlan).toEqual(expect.objectContaining({
      nativeContract: 'ZavorthExternalActionDispatchPlan/v1',
      planState: 'governed-read-only-capability-refresh-executable',
      executorEntrypoint: 'AgentRunService',
      directExternalInvocationAllowed: false,
      readOnlyCapabilityRefreshOnly: true,
      mutableGatewayMethodAllowed: false,
      sourceCapabilityInputOnly: true,
      sourceAuthorityGranted: false,
      externalAdapterInvoked: false,
    }));
  });

  it('normalizes status/probe evidence into a Zavorth-owned capability snapshot', () => {
    const normalized = normalizeGovernedReadOnlyCapabilityRefreshFixture();

    expect(normalized).toEqual(expect.objectContaining({
      nativeContract: 'ZavorthGovernedReadOnlyCapabilityRefresh/v1',
      decision: 'governed-read-only-capability-refresh-ok',
    }));
    expect(normalized.capabilitySnapshot).toEqual(expect.objectContaining({
      nativeContract: 'ZavorthGovernedReadOnlyCapabilityRefreshSnapshot/v1',
      normalizedBy: 'zavorth-governed-read-only-capability-refresh',
      sourceSnapshotReplaced: false,
      readOnly: true,
      executionAuthority: false,
    }));
    expect(normalized.capabilitySnapshot.rows.map((row) => row.rowKind).sort()).toEqual([
      'channel-capabilities',
      'command-http-capabilities',
      'gateway-method-capabilities',
      'plugin-capabilities',
      'provider-capabilities',
      'session-history-capabilities',
      'worker-node-capabilities',
    ]);
    expect(normalized.capabilitySnapshot.rows.find((row) => row.rowKind === 'gateway-method-capabilities')).toEqual(expect.objectContaining({
      availability: 'available',
      importClassification: 'approval-required',
      policy: 'approval-required',
      sourceCapabilityAuthority: false,
    }));
  });

  it('creates a read-only Command Center projection update in memory only', () => {
    const normalized = normalizeGovernedReadOnlyCapabilityRefreshFixture();

    expect(normalized.projectionUpdate).toEqual(expect.objectContaining({
      nativeContract: 'ZavorthCommandCenterCapabilityProjectionUpdate/v1',
      inMemoryOnly: true,
      writeBackAllowed: false,
      migrationAllowed: false,
    }));
    expect(normalized.projectionUpdate.rows).toHaveLength(7);
    normalized.projectionUpdate.rows.forEach((row) => {
      expect(row.commandCenterConsumable).toBe(true);
      expect(row.readOnly).toBe(true);
      expect(row.sourceAuthorityGranted).toBe(false);
    });
  });

  it('records real redacted receipt evidence with durations and cleanup', () => {
    const normalized = normalizeGovernedReadOnlyCapabilityRefreshFixture();

    expect(normalized.receipt).toEqual(expect.objectContaining({
      nativeContract: 'ZavorthExternalActionReceipt/v1',
      status: 'real-read-only-capability-refresh-success',
      realReceipt: true,
      redacted: true,
      readOnly: true,
      readOnlyCapabilityRefreshActuallyPerformed: true,
      statusDurationMs: 127228,
      probeDurationMs: 30322,
      cleanupConfirmed: true,
      rawSecretSerialized: false,
    }));
    expect(normalized.receipt.commandEvidence.map((command) => [command.method, command.exitCode])).toEqual([
      ['gateway.status', 0],
      ['gateway.probe', 0],
    ]);
  });

  it('represents refresh failures as degraded receipts, not crashes', () => {
    const normalized = normalizeGovernedReadOnlyCapabilityRefresh({
      source: createGovernedReadOnlyCapabilityRefreshDegradedFixtureSource(),
      generatedAt: '2026-04-28T23:45:00.000Z',
      runtimeId: 'external-agent-governed-read-only-capability-refresh-degraded',
      idPrefix: 'external-agent-governed-read-only-capability-refresh-degraded',
    });

    expect(normalized.decision).toBe('governed-read-only-capability-refresh-degraded');
    expect(normalized.receipt.status).toBe('real-read-only-capability-refresh-degraded');
    expect(normalized.receipt.degradedReason).toBe('capability-refresh-read-only-call-degraded');
    expect(normalized.projectionUpdate.rows.find((row) => row.rowKind === 'gateway-method-capabilities')?.status).toBe('degraded');
    expect(normalized.receipt.messageActuallySent).toBe(false);
    expect(normalized.receipt.providerActuallyExecuted).toBe(false);
  });

  it('keeps cleanup final counts at zero and all mutation authorities false', () => {
    const normalized = normalizeGovernedReadOnlyCapabilityRefreshFixture();

    expect(normalized.cleanup).toEqual({
      finalListenerCount: 0,
      finalProcessCount: 0,
      processStartedByGateOnly: true,
    });
    expect(normalized.executionGate).toEqual({
      executionAuthority: 'zavorth-governed-read-only-capability-refresh',
      readOnlyCapabilityRefreshActuallyPerformed: true,
      messageActuallySent: false,
      providerActuallyExecuted: false,
      commandActuallyExecuted: false,
      toolActuallyExecuted: false,
      gatewayMutationActuallyCalled: false,
      sessionMutationActuallyPerformed: false,
      sourceAuthorityGranted: false,
      externalAdapterInvoked: false,
      sourceModuleCopied: false,
      nativeReplacementAuthorized: false,
      rawSecretSerialized: false,
    });
  });

  it('serializes no raw token or source authority', () => {
    const normalized = normalizeGovernedReadOnlyCapabilityRefreshFixture();
    const serialized = JSON.stringify(normalized);

    expect(serialized).not.toMatch(/EXTERNAL_EXECUTOR_GATEWAY_TOKEN=(?!present-redacted|<redacted-local-secret>)[^\s`"]+/);
    expect(serialized).not.toMatch(/bearer\s+[A-Za-z0-9._-]{8,}/i);
    expect(serialized).not.toMatch(/(^|[^A-Za-z])sk-[A-Za-z0-9_-]{8,}/);
    expect(normalized.redaction).toEqual({
      rawSecretSerialized: false,
      commandArgTokenUsed: false,
      urlOverrideUsed: false,
      stdoutRedacted: true,
      stderrRedacted: true,
      serializedOutputContainsRawSecret: false,
    });
  });
});
