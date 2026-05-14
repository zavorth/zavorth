import fs from 'node:fs';
import path from 'node:path';

import {
  normalizeExternalAgentCommandHttpPolicyPreflight,
  type ExternalAgentCommandHttpPolicyPreflightExecutionGate,
  type ExternalAgentCommandHttpPolicyPreflightSourceRecord,
} from '../../../src/runtime/external-agents/index.js';

const SLICE_DOC = 'docs/146-wave-1-command-http-policy-preflight-boundary-slice.md';
const INVOCATION_SLICE_DOC = 'docs/145-wave-1-command-http-invocation-envelope-boundary-slice.md';
const BOUNDARY_FILE = 'src/runtime/external-agents/ExternalAgentCommandHttpPolicyPreflightBoundary.ts';
const INDEX_FILE = 'src/runtime/external-agents/index.ts';
const GENERATED_AT = '2026-04-28T12:00:00.000Z';
const RUNTIME_ID = 'external-wave1-command-http-policy-preflight-runtime';

function read(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

function executionGate(): ExternalAgentCommandHttpPolicyPreflightExecutionGate {
  return {
    sourceCommandsExecuted: false,
    sourceCliProcessesSpawned: false,
    sourceHttpRoutesRegistered: false,
    sourceGatewayMethodsDispatched: false,
    sourceServicesLaunched: false,
    sourceToolsExecuted: false,
    sourceSetupCommandsExecuted: false,
    sourceQaRunnersExecuted: false,
    sourceHandlerLoaded: false,
    sourceRuntimeConnected: false,
    sourceModulesCopied: false,
    sourceStateMigrated: false,
    sourceCredentialsMigrated: false,
    executionAuthority: false,
    realAdapterCreated: false,
  };
}

function sourceRecords(): ExternalAgentCommandHttpPolicyPreflightSourceRecord[] {
  return [
    {
      fixtureCase: 'policy-preflight-safe-metadata',
      publicPreflightIdSeed: 'safe-session-list',
      invocationEnvelopeId: 'zavorth-invocation:wave1-command-http-1-command-session-list',
      intentKind: 'command',
      risk: 'safe',
      requestedTools: ['sessions.list'],
      policyInput: {
        requestedTools: ['sessions.list'],
        allowedTools: ['sessions.list'],
      },
      sourceApprovalHints: [],
      sourceRiskLabels: ['safe'],
      sourceAuthScopeHints: ['sessions:read'],
    },
    {
      fixtureCase: 'policy-preflight-approval-required',
      publicPreflightIdSeed: 'approval-network-fetch',
      invocationEnvelopeId: 'zavorth-invocation:wave1-command-http-2-http-route-session-read',
      intentKind: 'http-route',
      risk: 'attention',
      requestedTools: ['network_fetch'],
      policyInput: {
        requestedTools: ['network_fetch'],
        requireApprovalFor: ['network_fetch'],
      },
      sourceApprovalHints: ['preapproved-by-source-policy'],
      sourceRiskLabels: ['network'],
      sourceAuthScopeHints: ['network:egress'],
    },
    {
      fixtureCase: 'policy-preflight-blocked-invocation',
      publicPreflightIdSeed: 'blocked-workspace-delete',
      invocationEnvelopeId: 'zavorth-invocation:wave1-command-http-3-gateway-workspace-delete',
      intentKind: 'gateway-method',
      risk: 'danger',
      requestedTools: ['workspace.delete'],
      policyInput: {
        requestedTools: ['workspace.delete'],
        blockedTools: ['workspace.delete'],
        blockedToolReason: 'source-policy-hints-advisory-not-authority',
      },
      sourceApprovalHints: ['source-owner-approval-required'],
      sourceRiskLabels: ['dangerous'],
      sourceAuthScopeHints: ['workspace:admin'],
    },
  ];
}

describe('Wave 1 command/http policy preflight boundary slice', () => {
  it('records command-http-policy-preflight as the only selected executable-runtime implementation slice', () => {
    const content = read(SLICE_DOC);

    expect(content).toContain('Status: wave-1-command-http-policy-preflight-boundary-ready');
    expect(content).toContain('command-http-policy-preflight');
    expect(content).toContain('docs/143-wave-0-command-http-executable-runtime-matrix.md');
    expect(content).toContain('docs/144-wave-1-command-http-executable-runtime-test-design.md');
    expect(content).toContain(INVOCATION_SLICE_DOC);
    expect(content).toContain('This slice does not authorize a real sidecar');
    expect(content).not.toContain('command-http-observability-projection selected');
    expect(content).not.toContain('source command execution authorized');
  });

  it('documents the Zavorth-owned boundary and public export', () => {
    const content = read(SLICE_DOC);
    const boundary = read(BOUNDARY_FILE);
    const index = read(INDEX_FILE);

    expect(content).toContain('ExternalAgentCommandHttpPolicyPreflightBoundary.ts');
    expect(content).toContain('src/runtime/external-agents/index.ts');
    expect(boundary).toContain('normalizeExternalAgentCommandHttpPolicyPreflight');
    expect(boundary).toContain("nativeContract: 'ZavorthCommandHttpPolicyPreflightBoundary/v1'");
    expect(boundary).toContain('executionAuthority: false');
    expect(boundary).toContain('sourceHandlerLoaded: false');
    expect(boundary).toContain('sourceRuntimeConnected: false');
    expect(index).toContain("from './ExternalAgentCommandHttpPolicyPreflightBoundary.js'");
  });

  it('decides allowed, approval_required, and blocked without executing the invocation', () => {
    const normalization = normalizeExternalAgentCommandHttpPolicyPreflight({
      records: sourceRecords(),
      generatedAt: GENERATED_AT,
      runtimeId: RUNTIME_ID,
      idPrefix: 'zavorth-preflight:wave1-command-http',
      executionGate: executionGate(),
    });

    expect(normalization).toEqual(expect.objectContaining({
      nativeContract: 'ZavorthCommandHttpPolicyPreflightBoundary/v1',
      generatedAt: GENERATED_AT,
      runtimeId: RUNTIME_ID,
      allowedInvocations: ['zavorth-invocation:wave1-command-http-1-command-session-list'],
      approvalRequiredInvocations: ['zavorth-invocation:wave1-command-http-2-http-route-session-read'],
      blockedInvocations: ['zavorth-invocation:wave1-command-http-3-gateway-workspace-delete'],
      sourceApprovalHintsStoredAsEvidenceOnly: true,
      sourceRiskLabelsStoredAsEvidenceOnly: true,
      sourceAuthScopeHintsStoredAsEvidenceOnly: true,
      sourceApprovalHintsGrantAuthority: false,
      sourcePolicyAuthority: false,
      sourceHandlersLoaded: false,
      sourceRuntimeConnected: false,
      sourceCommandsExecuted: false,
      sourceCliProcessesSpawned: false,
      sourceHttpRoutesRegistered: false,
      sourceGatewayMethodsDispatched: false,
      sourceServicesLaunched: false,
      sourceToolsExecuted: false,
      executionAuthority: false,
      sideEffectsBlocked: true,
      executionGate: expect.objectContaining({
        sourceCommandsExecuted: false,
        sourceCliProcessesSpawned: false,
        sourceHttpRoutesRegistered: false,
        sourceGatewayMethodsDispatched: false,
        sourceServicesLaunched: false,
        sourceToolsExecuted: false,
        sourceHandlerLoaded: false,
        sourceRuntimeConnected: false,
        executionAuthority: false,
        realAdapterCreated: false,
      }),
    }));
    expect(normalization.preflights.map((preflight) => preflight.decision)).toEqual([
      'allowed',
      'approval_required',
      'blocked',
    ]);
    expect(normalization.preflights).toEqual([
      expect.objectContaining({
        id: 'zavorth-preflight:wave1-command-http-1-safe-session-list',
        decision: 'allowed',
        approvalRequired: false,
        blocked: false,
      }),
      expect.objectContaining({
        id: 'zavorth-preflight:wave1-command-http-2-approval-network-fetch',
        decision: 'approval_required',
        approvalRequired: true,
        blocked: false,
      }),
      expect.objectContaining({
        id: 'zavorth-preflight:wave1-command-http-3-blocked-workspace-delete',
        decision: 'blocked',
        approvalRequired: false,
        blocked: true,
        blockedReasonId: 'source-policy-hints-advisory-not-authority',
      }),
    ]);
    normalization.preflights.forEach((preflight) => {
      expect(preflight.policyEvaluation).toEqual({
        authority: 'zavorth-policy-preflight',
        executionAuthority: false,
        sourceApprovalHintAuthority: false,
        sourceRiskLabelAuthority: false,
        sourceAuthScopeAuthority: false,
        sourcePolicyAppliedDirectly: false,
      });
      expect(preflight.sourceApprovalHintsGrantAuthority).toBe(false);
      expect(preflight.sourceRiskLabelsGrantAuthority).toBe(false);
      expect(preflight.sourcePolicyAuthority).toBe(false);
      expect(preflight.sourceHandlerLoaded).toBe(false);
      expect(preflight.sourceRuntimeConnected).toBe(false);
      expect(preflight.executionAuthority).toBe(false);
      expect(preflight.sideEffectsBlocked).toBe(true);
      expect(preflight.sourceCommandExecuted).toBe(false);
      expect(preflight.sourceCliProcessSpawned).toBe(false);
      expect(preflight.sourceHttpRouteRegistered).toBe(false);
      expect(preflight.sourceGatewayMethodDispatched).toBe(false);
      expect(preflight.sourceServiceLaunched).toBe(false);
      expect(preflight.sourceToolExecuted).toBe(false);
    });
    expect(JSON.stringify(normalization)).not.toContain('preapproved-by-source-policy');
    expect(JSON.stringify(normalization)).not.toContain('source-owner-approval-required');
    expect(JSON.stringify(normalization)).not.toContain('network:egress');
    expect(JSON.stringify(normalization)).not.toContain('workspace:admin');
    expect(JSON.stringify(normalization)).not.toContain('dangerous');
  });

  it('keeps live integration blocked and names observability projection as the next narrow row', () => {
    const content = read(SLICE_DOC);

    expect(content).toContain('source command execution');
    expect(content).toContain('source handler load');
    expect(content).toContain('source CLI spawn');
    expect(content).toContain('source HTTP route registration');
    expect(content).toContain('source gateway method dispatch');
    expect(content).toContain('source service launch');
    expect(content).toContain('executionAuthority: false');
    expect(content).toContain('sourceHandlerLoaded: false');
    expect(content).toContain('sourceRuntimeConnected: false');
    expect(content).toContain('docs/147-wave-1-command-http-observability-projection-boundary-slice.md');
    expect(content).toContain('command-http-observability-projection');
    expect(content).toContain('Live source runtime integration remains blocked');
  });
});
