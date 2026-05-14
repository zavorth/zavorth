import fs from 'node:fs';
import path from 'node:path';

import {
  createFirstGovernedReadOnlyGatewayActionFixtureSource,
  normalizeFirstGovernedReadOnlyGatewayActionFixture,
} from '../../../src/runtime/external-agents/index.js';

const DOC = 'docs/176-wave-2-first-governed-read-only-gateway-action.md';
const BOUNDARY = 'src/runtime/external-agents/ExternalAgentFirstGovernedReadOnlyGatewayAction.ts';
const INDEX = 'src/runtime/external-agents/index.ts';

function read(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

describe('first governed read-only gateway action', () => {
  it('documents 176 as the first real governed read-only gateway action', () => {
    const content = read(DOC);

    expect(content).toContain('Status: governed-read-only-gateway-action-ok');
    expect(content).toContain('docs/175-wave-2-controlled-dry-run-action-planner.md -> controlled-dry-run-action-planner-ready');
    expect(content).toContain('gateway.status');
    expect(content).toContain('Status exit code | `0`');
    expect(content).toContain('Final cleanup listener count | `0`');
    expect(content).toContain('Final cleanup process count | `0`');
    expect(content).toContain('readOnlyGatewayCallActuallyPerformed: true');
    expect(content).toContain('externalGatewayStatusCalled: true');
    expect(content).toContain('messageActuallySent: false');
    expect(content).not.toMatch(/EXTERNAL_EXECUTOR_GATEWAY_TOKEN=(?!present-redacted|<redacted-local-secret>)[^\s`]+/);
    expect(content).not.toMatch(/(^|[^A-Za-z])sk-[A-Za-z0-9_-]{8,}/);
  });

  it('exports the governed read-only gateway action boundary', () => {
    const boundary = read(BOUNDARY);
    const index = read(INDEX);

    expect(boundary).toContain('ZavorthFirstGovernedReadOnlyGatewayAction/v1');
    expect(boundary).toContain('ZavorthExternalActionDispatchPlan/v1');
    expect(boundary).toContain('ZavorthExternalActionReceipt/v1');
    expect(boundary).toContain('normalizeFirstGovernedReadOnlyGatewayAction');
    expect(index).toContain("from './ExternalAgentFirstGovernedReadOnlyGatewayAction.js'");
    expect(index).toContain('ZavorthFirstGovernedReadOnlyGatewayActionNormalization');
  });

  it('proves gateway.status intent passed policy preflight through the dry-run planner', () => {
    const source = createFirstGovernedReadOnlyGatewayActionFixtureSource();
    const normalized = normalizeFirstGovernedReadOnlyGatewayActionFixture();

    expect(source.dryRunPlanner.decision).toBe('controlled-dry-run-action-planner-ready');
    expect(source.preflight.intentPassedPolicyPreflight).toBe(true);
    expect(source.preflight.plannerGeneratedReadOnlyPlan).toBe(true);
    expect(normalized.intent.actionKind).toBe('gateway-method-call');
    expect(normalized.policyPreflight.classification).toBe('read-only-allowed');
    expect(normalized.policyPreflight.policyAuthority).toBe('zavorth-policy-preflight');
    expect(normalized.policyPreflight.sourceCapabilityAuthority).toBe(false);
    expect(normalized.policyPreflight.sourceApprovalHintAuthority).toBe(false);
  });

  it('creates an executable dispatch plan only for the read-only gateway method', () => {
    const normalized = normalizeFirstGovernedReadOnlyGatewayActionFixture();

    expect(normalized.dispatchPlan).toEqual(expect.objectContaining({
      nativeContract: 'ZavorthExternalActionDispatchPlan/v1',
      method: 'gateway.status',
      planState: 'governed-read-only-executable',
      executorEntrypoint: 'AgentRunService',
      directExternalInvocationAllowed: false,
      sourceCapabilityInputOnly: true,
      sourceAuthorityGranted: false,
      readOnlyGatewayMethodOnly: true,
      mutableGatewayMethodAllowed: false,
      dispatchLimitedToZavorthGovernedPath: true,
      externalAdapterInvoked: false,
    }));
  });

  it('records a real redacted audit receipt for the read-only gateway status call', () => {
    const normalized = normalizeFirstGovernedReadOnlyGatewayActionFixture();

    expect(normalized).toEqual(expect.objectContaining({
      nativeContract: 'ZavorthFirstGovernedReadOnlyGatewayAction/v1',
      decision: 'governed-read-only-gateway-action-ok',
      method: 'gateway.status',
    }));
    expect(normalized.receipt).toEqual(expect.objectContaining({
      nativeContract: 'ZavorthExternalActionReceipt/v1',
      method: 'gateway.status',
      status: 'real-read-only-success',
      realReceipt: true,
      redacted: true,
      readOnly: true,
      readOnlyGatewayCallActuallyPerformed: true,
      externalGatewayStatusCalled: true,
      externalGatewayHealthCalled: false,
      exitCode: 0,
      timeout: false,
      cleanupConfirmed: true,
    }));
    expect(normalized.receipt.stdoutPreviewRedacted).toContain('token and sensitive fields redacted');
    expect(normalized.receipt.stderrPreviewRedacted).toBe('');
  });

  it('represents cleanup, including forked child cleanup, as successful only after final zero counts', () => {
    const normalized = normalizeFirstGovernedReadOnlyGatewayActionFixture();

    expect(normalized.cleanup).toEqual({
      firstPassListenerCount: 2,
      firstPassProcessCount: 1,
      finalListenerCount: 0,
      finalProcessCount: 0,
      processStartedByGateOnly: true,
    });
    expect(normalized.receipt.cleanupConfirmed).toBe(true);
  });

  it('keeps all non-gateway actions and mutation authorities false', () => {
    const normalized = normalizeFirstGovernedReadOnlyGatewayActionFixture();

    expect(normalized.executionGate).toEqual({
      executionAuthority: 'zavorth-governed-read-only-gateway-action',
      readOnlyGatewayCallActuallyPerformed: true,
      externalGatewayStatusCalled: true,
      externalGatewayHealthCalled: false,
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
    expect(normalized.receipt).toEqual(expect.objectContaining({
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
    }));
  });

  it('serializes no raw token or sensitive credential value', () => {
    const normalized = normalizeFirstGovernedReadOnlyGatewayActionFixture();
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
