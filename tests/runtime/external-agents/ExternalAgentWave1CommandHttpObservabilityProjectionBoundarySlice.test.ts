import fs from 'node:fs';
import path from 'node:path';

import {
  normalizeExternalAgentCommandHttpObservabilityProjection,
  type ExternalAgentCommandHttpObservabilityProjectionExecutionGate,
  type ExternalAgentCommandHttpObservabilityProjectionSourceRecord,
} from '../../../src/runtime/external-agents/index.js';

const SLICE_DOC = 'docs/147-wave-1-command-http-observability-projection-boundary-slice.md';
const POLICY_PREFLIGHT_SLICE_DOC = 'docs/146-wave-1-command-http-policy-preflight-boundary-slice.md';
const BOUNDARY_FILE = 'src/runtime/external-agents/ExternalAgentCommandHttpObservabilityProjectionBoundary.ts';
const INDEX_FILE = 'src/runtime/external-agents/index.ts';
const GENERATED_AT = '2026-04-28T12:00:00.000Z';
const RUNTIME_ID = 'external-wave1-command-http-observability-projection-runtime';

function read(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

function executionGate(): ExternalAgentCommandHttpObservabilityProjectionExecutionGate {
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

function sourceRecords(): ExternalAgentCommandHttpObservabilityProjectionSourceRecord[] {
  return [
    {
      fixtureCase: 'observability-projection-proposed-invocation',
      publicProjectionIdSeed: 'proposed-session-list',
      invocationEnvelopeId: 'zavorth-invocation:wave1-command-http-1-command-session-list',
      policyPreflightId: 'zavorth-preflight:wave1-command-http-1-safe-session-list',
      intentKind: 'command',
      decision: 'allowed',
      requestedTools: ['sessions.list'],
      sourceRuntimeAvailable: true,
      sourceEvidenceHints: ['external-executor.command.sessions.list'],
    },
    {
      fixtureCase: 'observability-projection-approval-required',
      publicProjectionIdSeed: 'approval-network-fetch',
      invocationEnvelopeId: 'zavorth-invocation:wave1-command-http-2-http-route-session-read',
      policyPreflightId: 'zavorth-preflight:wave1-command-http-2-approval-network-fetch',
      intentKind: 'http-route',
      decision: 'approval_required',
      requestedTools: ['network_fetch'],
      sourceRuntimeAvailable: true,
      sourceEvidenceHints: ['GET /external-executor/api/sessions/:sessionId'],
    },
    {
      fixtureCase: 'observability-projection-blocked-action',
      publicProjectionIdSeed: 'blocked-workspace-delete',
      invocationEnvelopeId: 'zavorth-invocation:wave1-command-http-3-gateway-workspace-delete',
      policyPreflightId: 'zavorth-preflight:wave1-command-http-3-blocked-workspace-delete',
      intentKind: 'gateway-method',
      decision: 'blocked',
      requestedTools: ['workspace.delete'],
      sourceRuntimeAvailable: true,
      sourceEvidenceHints: ['external-executor.gateway.workspace.delete'],
    },
    {
      fixtureCase: 'observability-projection-unavailable-source-runtime',
      publicProjectionIdSeed: 'unavailable-service-action',
      invocationEnvelopeId: 'zavorth-invocation:wave1-command-http-4-service-notification-hook',
      policyPreflightId: 'zavorth-preflight:wave1-command-http-4-safe-notification-hook',
      intentKind: 'service-action',
      decision: 'allowed',
      requestedTools: ['notifications.describe'],
      sourceRuntimeAvailable: false,
      sourceEvidenceHints: ['ExternalExecutor service runtime offline'],
    },
  ];
}

describe('Wave 1 command/http observability projection boundary slice', () => {
  it('records command-http-observability-projection as the selected executable-runtime implementation slice', () => {
    const content = read(SLICE_DOC);

    expect(content).toContain('Status: wave-1-command-http-observability-projection-boundary-ready');
    expect(content).toContain('command-http-observability-projection');
    expect(content).toContain('docs/143-wave-0-command-http-executable-runtime-matrix.md');
    expect(content).toContain('docs/144-wave-1-command-http-executable-runtime-test-design.md');
    expect(content).toContain('docs/145-wave-1-command-http-invocation-envelope-boundary-slice.md');
    expect(content).toContain(POLICY_PREFLIGHT_SLICE_DOC);
    expect(content).toContain('This slice does not authorize a real sidecar');
    expect(content).not.toContain('real sidecar is authorized');
    expect(content).not.toContain('source command execution authorized');
  });

  it('documents the Zavorth-owned boundary and public export', () => {
    const content = read(SLICE_DOC);
    const boundary = read(BOUNDARY_FILE);
    const index = read(INDEX_FILE);

    expect(content).toContain('ExternalAgentCommandHttpObservabilityProjectionBoundary.ts');
    expect(content).toContain('src/runtime/external-agents/index.ts');
    expect(boundary).toContain('normalizeExternalAgentCommandHttpObservabilityProjection');
    expect(boundary).toContain("nativeContract: 'ZavorthCommandHttpObservabilityProjectionBoundary/v1'");
    expect(boundary).toContain('executableControlExposed: false');
    expect(boundary).toContain('sourceRuntimeConnected: false');
    expect(index).toContain("from './ExternalAgentCommandHttpObservabilityProjectionBoundary.js'");
  });

  it('projects proposed, approval-required, blocked, and unavailable rows without executable controls', () => {
    const normalization = normalizeExternalAgentCommandHttpObservabilityProjection({
      records: sourceRecords(),
      generatedAt: GENERATED_AT,
      runtimeId: RUNTIME_ID,
      idPrefix: 'zavorth-observability:wave1-command-http',
      executionGate: executionGate(),
    });

    expect(normalization).toEqual(expect.objectContaining({
      nativeContract: 'ZavorthCommandHttpObservabilityProjectionBoundary/v1',
      generatedAt: GENERATED_AT,
      runtimeId: RUNTIME_ID,
      proposedRows: ['zavorth-observability:wave1-command-http-1-proposed-session-list'],
      approvalRequiredRows: ['zavorth-observability:wave1-command-http-2-approval-network-fetch'],
      blockedRows: ['zavorth-observability:wave1-command-http-3-blocked-workspace-delete'],
      unavailableSourceRuntimeRows: ['zavorth-observability:wave1-command-http-4-unavailable-service-action'],
      sourceEvidenceStoredAsEvidenceOnly: true,
      sourceProjectionAuthority: false,
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
    expect(normalization.rows.map((row) => row.status)).toEqual([
      'proposed',
      'approval-required',
      'blocked-action',
      'unavailable-source-runtime',
    ]);
    expect(normalization.commandCenter).toEqual(expect.objectContaining({
      readOnly: true,
      executableActionsExposed: false,
      routeRegistrationExposed: false,
      gatewayDispatchExposed: false,
      serviceLaunchExposed: false,
      cliSpawnExposed: false,
      sourceToolExecutionExposed: false,
    }));
    expect(normalization.logs.map((log) => log.severity)).toEqual([
      'info',
      'warning',
      'danger',
      'warning',
    ]);

    normalization.rows.forEach((row) => {
      expect(row.commandCenter).toEqual(expect.objectContaining({
        readOnly: true,
        executableControlExposed: false,
        routeRegistrationControlExposed: false,
        gatewayDispatchControlExposed: false,
        serviceLaunchControlExposed: false,
        cliSpawnControlExposed: false,
        sourceToolExecutionControlExposed: false,
      }));
      expect(row.observability).toEqual({
        authority: 'zavorth-command-http-observability-projection',
        readOnly: true,
        sourceEvidenceStoredAsEvidenceOnly: true,
        sourceRuntimeStateStoredAsEvidenceOnly: true,
        sourceProjectionAuthority: false,
        executionAuthority: false,
      });
      expect(row.sourceEvidenceStoredAsEvidenceOnly).toBe(true);
      expect(row.sourceHandlerLoaded).toBe(false);
      expect(row.sourceRuntimeConnected).toBe(false);
      expect(row.executionAuthority).toBe(false);
      expect(row.sideEffectsBlocked).toBe(true);
      expect(row.sourceCommandExecuted).toBe(false);
      expect(row.sourceCliProcessSpawned).toBe(false);
      expect(row.sourceHttpRouteRegistered).toBe(false);
      expect(row.sourceGatewayMethodDispatched).toBe(false);
      expect(row.sourceServiceLaunched).toBe(false);
      expect(row.sourceToolExecuted).toBe(false);
    });
  });

  it('quarantines source evidence and keeps live integration blocked', () => {
    const content = read(SLICE_DOC);
    const normalization = normalizeExternalAgentCommandHttpObservabilityProjection({
      records: sourceRecords(),
      generatedAt: GENERATED_AT,
      runtimeId: RUNTIME_ID,
      idPrefix: 'zavorth-observability:wave1-command-http',
      executionGate: executionGate(),
    });

    expect(JSON.stringify(normalization)).not.toContain('ExternalExecutor');
    expect(JSON.stringify(normalization)).not.toContain('external-executor');
    expect(JSON.stringify(normalization)).not.toContain('/external-executor/api');
    expect(content).toContain('Command Center rows are read-only');
    expect(content).toContain('source handler load');
    expect(content).toContain('source CLI spawn');
    expect(content).toContain('source HTTP route registration');
    expect(content).toContain('source gateway method dispatch');
    expect(content).toContain('source service launch');
    expect(content).toContain('executionAuthority: false');
    expect(content).toContain('sourceHandlerLoaded: false');
    expect(content).toContain('sourceRuntimeConnected: false');
    expect(content).toContain('docs/148-wave-0-real-sidecar-adapter-gate.md');
    expect(content).toContain('Live source runtime integration remains blocked');
  });
});
