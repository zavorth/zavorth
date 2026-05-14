import fs from 'node:fs';
import path from 'node:path';

import {
  normalizeExternalAgentCommandHttpInvocationEnvelopes,
  type ExternalAgentCommandHttpInvocationExecutionGate,
  type ExternalAgentCommandHttpInvocationSourceRecord,
} from '../../../src/runtime/external-agents/index.js';

const SLICE_DOC = 'docs/145-wave-1-command-http-invocation-envelope-boundary-slice.md';
const TEST_DESIGN_DOC = 'docs/144-wave-1-command-http-executable-runtime-test-design.md';
const BOUNDARY_FILE = 'src/runtime/external-agents/ExternalAgentCommandHttpInvocationEnvelopeBoundary.ts';
const INDEX_FILE = 'src/runtime/external-agents/index.ts';
const GENERATED_AT = '2026-04-28T12:00:00.000Z';
const RUNTIME_ID = 'external-wave1-command-http-invocation-envelope-runtime';

function read(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

function executionGate(): ExternalAgentCommandHttpInvocationExecutionGate {
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

function sourceRecords(): ExternalAgentCommandHttpInvocationSourceRecord[] {
  return [
    {
      fixtureCase: 'external-command-intent',
      intentKind: 'command',
      publicInvocationIdSeed: 'command-session-list',
      sourceIntentId: 'external-executor.command.sessions.list',
      targetBoundaryId: 'zavorth-command:wave1-command-descriptors-1-safe-action',
      targetBoundaryContract: 'ZavorthCommandDescriptor/v1',
      sourceMetadataKeys: ['sourceCommandId', 'sourceAliases'],
      risk: 'safe',
      requestedTools: ['sessions.list'],
    },
    {
      fixtureCase: 'external-http-route-intent',
      intentKind: 'http-route',
      publicInvocationIdSeed: 'http-route-session-read',
      sourceIntentId: 'GET /external-executor/api/sessions/:sessionId',
      targetBoundaryId: 'zavorth-http-route:wave1-http-route-surfaces-1-session-read-metadata',
      targetBoundaryContract: 'ZavorthHttpRouteSurface/v1',
      sourceMetadataKeys: ['sourceHttpMethod', 'sourceHttpRoutePath'],
      risk: 'safe',
      requestedTools: ['sessions.read'],
    },
    {
      fixtureCase: 'external-gateway-method-intent',
      intentKind: 'gateway-method',
      publicInvocationIdSeed: 'gateway-session-list',
      sourceIntentId: 'external-executor.gateway.sessions.list',
      targetBoundaryId: 'zavorth-gateway-method:wave1-gateway-method-surfaces-1-session-list-metadata',
      targetBoundaryContract: 'ZavorthGatewayMethodSurface/v1',
      sourceMetadataKeys: ['sourceGatewayMethodName', 'sourceRequestFields'],
      risk: 'safe',
      requestedTools: ['sessions.list'],
    },
    {
      fixtureCase: 'external-service-action-intent',
      intentKind: 'service-action',
      publicInvocationIdSeed: 'service-notification-hook',
      sourceIntentId: 'external-executor.service.notifications:on-session-event',
      targetBoundaryId: 'zavorth-service:wave1-service-surfaces-1-notification-hook-descriptor',
      targetBoundaryContract: 'ZavorthServiceSurface/v1',
      sourceMetadataKeys: ['sourceServiceId', 'sourceServiceHook'],
      risk: 'attention',
      requestedTools: ['notifications.describe'],
    },
  ];
}

describe('Wave 1 command/http invocation envelope boundary slice', () => {
  it('records command-http-invocation-envelope as the only selected executable-runtime implementation slice', () => {
    const content = read(SLICE_DOC);

    expect(content).toContain('Status: wave-1-command-http-invocation-envelope-boundary-ready');
    expect(content).toContain('command-http-invocation-envelope');
    expect(content).toContain('docs/143-wave-0-command-http-executable-runtime-matrix.md');
    expect(content).toContain(TEST_DESIGN_DOC);
    expect(content).toContain('This slice does not authorize a real sidecar');
    expect(content).not.toContain('command-http-policy-preflight selected');
    expect(content).not.toContain('source command execution authorized');
  });

  it('documents the Zavorth-owned boundary and public export', () => {
    const content = read(SLICE_DOC);
    const boundary = read(BOUNDARY_FILE);
    const index = read(INDEX_FILE);

    expect(content).toContain('ExternalAgentCommandHttpInvocationEnvelopeBoundary.ts');
    expect(content).toContain('src/runtime/external-agents/index.ts');
    expect(boundary).toContain('normalizeExternalAgentCommandHttpInvocationEnvelopes');
    expect(boundary).toContain("nativeContract: 'ZavorthCommandHttpInvocationEnvelopeBoundary/v1'");
    expect(boundary).toContain('executionAuthority: false');
    expect(boundary).toContain('sourceHandlerLoaded: false');
    expect(boundary).toContain('sourceRuntimeConnected: false');
    expect(index).toContain("from './ExternalAgentCommandHttpInvocationEnvelopeBoundary.js'");
  });

  it('normalizes command/http intents into Zavorth-owned invocation envelopes without source side effects', () => {
    const normalization = normalizeExternalAgentCommandHttpInvocationEnvelopes({
      records: sourceRecords(),
      generatedAt: GENERATED_AT,
      runtimeId: RUNTIME_ID,
      idPrefix: 'zavorth-invocation:wave1-command-http',
      executionGate: executionGate(),
    });

    expect(normalization).toEqual(expect.objectContaining({
      nativeContract: 'ZavorthCommandHttpInvocationEnvelopeBoundary/v1',
      generatedAt: GENERATED_AT,
      runtimeId: RUNTIME_ID,
      sourceIdsStoredAsEvidenceOnly: true,
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
    expect(normalization.envelopes.map((envelope) => envelope.intentKind)).toEqual([
      'command',
      'http-route',
      'gateway-method',
      'service-action',
    ]);
    expect(normalization.envelopes).toEqual([
      expect.objectContaining({
        id: 'zavorth-invocation:wave1-command-http-1-command-session-list',
        target: expect.objectContaining({
          boundaryContract: 'ZavorthCommandDescriptor/v1',
          boundaryIdAuthority: 'zavorth-closed-boundary',
        }),
      }),
      expect.objectContaining({
        id: 'zavorth-invocation:wave1-command-http-2-http-route-session-read',
        target: expect.objectContaining({
          boundaryContract: 'ZavorthHttpRouteSurface/v1',
        }),
      }),
      expect.objectContaining({
        id: 'zavorth-invocation:wave1-command-http-3-gateway-session-list',
        target: expect.objectContaining({
          boundaryContract: 'ZavorthGatewayMethodSurface/v1',
        }),
      }),
      expect.objectContaining({
        id: 'zavorth-invocation:wave1-command-http-4-service-notification-hook',
        target: expect.objectContaining({
          boundaryContract: 'ZavorthServiceSurface/v1',
        }),
      }),
    ]);
    normalization.envelopes.forEach((envelope) => {
      expect(envelope.executionPolicy).toEqual({
        authority: 'zavorth-invocation-envelope',
        executionAuthority: false,
        sourceHandlerLoadAllowed: false,
        sourceRuntimeConnectionAllowed: false,
        sideEffectsAllowed: false,
      });
      expect(envelope.sourceHandlerLoaded).toBe(false);
      expect(envelope.sourceRuntimeConnected).toBe(false);
      expect(envelope.executionAuthority).toBe(false);
      expect(envelope.sideEffectsBlocked).toBe(true);
      expect(envelope.sourceCommandExecuted).toBe(false);
      expect(envelope.sourceCliProcessSpawned).toBe(false);
      expect(envelope.sourceHttpRouteRegistered).toBe(false);
      expect(envelope.sourceGatewayMethodDispatched).toBe(false);
      expect(envelope.sourceServiceLaunched).toBe(false);
      expect(envelope.sourceToolExecuted).toBe(false);
      expect(envelope.sourceEvidence).toEqual(expect.objectContaining({
        sourceIntentIdStoredAsEvidenceOnly: true,
        sourceMetadataStoredAsEvidenceOnly: true,
      }));
    });
    expect(JSON.stringify(normalization)).not.toContain('ExternalExecutor');
    expect(JSON.stringify(normalization)).not.toContain('external-executor');
    expect(JSON.stringify(normalization)).not.toContain('/external-executor/api');
  });

  it('keeps live integration blocked and names policy preflight as the next narrow row', () => {
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
    expect(content).toContain('docs/146-wave-1-command-http-policy-preflight-boundary-slice.md');
    expect(content).toContain('command-http-policy-preflight');
    expect(content).toContain('Live source runtime integration remains blocked');
  });
});
