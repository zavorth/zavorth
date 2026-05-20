import {
  type ExternalAgentCapabilityInventorySnapshot,
  type ExternalAgentSkillManifest,
} from './ExternalAgentCapabilityProvider.js';
import {
  ExternalAgentSidecarAdapter,
} from './ExternalAgentSidecarAdapter.js';
import {
  normalizeExternalAgentGatewayProtocolFrame,
  type ExternalAgentGatewayProtocolFrame,
  type ExternalAgentGatewayProtocolFrameKind,
  type ExternalAgentGatewayProtocolNormalizationResult,
  type ExternalAgentGatewayProtocolStructuredError,
} from './ExternalAgentGatewayProtocolBoundary.js';
import {
  normalizeExternalAgentGatewayHandshake,
  type ExternalAgentGatewayHandshakeEvidence,
  type ExternalAgentGatewayHandshakeNormalization,
} from './ExternalAgentGatewayHandshakeBoundary.js';
import {
  normalizeExternalAgentGatewayEventStream,
  type ExternalAgentGatewayEventStreamEvent,
  type ExternalAgentGatewayEventStreamNormalization,
} from './ExternalAgentGatewayEventStreamBoundary.js';
import {
  normalizeExternalAgentPluginManifestRegistry,
  type ExternalAgentPluginManifestRegistryNormalization,
} from './ExternalAgentPluginManifestRegistryBoundary.js';
import {
  normalizeExternalAgentPluginRuntimeRegistry,
  type ExternalAgentPluginRuntimeRegistryNormalization,
  type ExternalAgentPluginRuntimeRegistryRecord,
} from './ExternalAgentPluginRuntimeRegistryBoundary.js';
import {
  type ExternalAgentCapabilityDescriptor,
  type ExternalAgentSessionDescriptor,
} from './contracts.js';

export const EXTERNAL_AGENT_CANONICAL_FIXTURE_NOW = '2026-04-27T19:00:00.000Z';
export const EXTERNAL_AGENT_CANONICAL_SOURCE_RUNTIME_NAME = 'ExternalExecutor';
export const EXTERNAL_AGENT_CANONICAL_RUNTIME_ID = 'external-external-agent-v1-fixture-runtime';

export type ExternalAgentCanonicalSourceEvidence = {
  sourceRuntimeName: typeof EXTERNAL_AGENT_CANONICAL_SOURCE_RUNTIME_NAME;
  sourcePaths: string[];
  observedAt: string;
};

export type ExternalAgentCanonicalGatewayFrameKind = ExternalAgentGatewayProtocolFrameKind;

export type ExternalAgentCanonicalGatewayFrameFixture = Omit<ExternalAgentGatewayProtocolFrame, 'fixtureCase' | 'sourceEvidence'> & {
  fixtureCase:
    | 'valid-frame-message'
    | 'valid-event-message'
    | 'valid-response-diagnostic'
    | 'valid-error-frame'
    | 'invalid-frame-schema';
  sourceEvidence: ExternalAgentCanonicalSourceEvidence;
};

export type ExternalAgentCanonicalStructuredError = ExternalAgentGatewayProtocolStructuredError;
export type ExternalAgentCanonicalGatewayFrameNormalizationResult = ExternalAgentGatewayProtocolNormalizationResult;

export type ExternalAgentCanonicalHandshakeFixture = Omit<ExternalAgentGatewayHandshakeEvidence, 'fixtureCase' | 'sourceEvidence'> & {
  fixtureCase: 'connect-owner-with-token' | 'connect-scope-downgrade';
  sourceEvidence: ExternalAgentCanonicalSourceEvidence;
};

export type ExternalAgentCanonicalHandshakeNormalization = ExternalAgentGatewayHandshakeNormalization;

export type ExternalAgentCanonicalGatewayStreamEventFixture = Omit<ExternalAgentGatewayEventStreamEvent, 'fixtureCase' | 'sourceEvidence' | 'type'> & {
  fixtureCase: 'ordered-event-stream' | 'duplicate-event-stream';
  type: 'runtime.update' | 'session.message' | 'approval.requested' | 'artifact.ready';
  sourceEvidence: ExternalAgentCanonicalSourceEvidence;
};

export type ExternalAgentCanonicalGatewayEventStreamNormalization = ExternalAgentGatewayEventStreamNormalization;
export type ExternalAgentCanonicalPluginManifestRegistryImport = ExternalAgentPluginManifestRegistryNormalization;

export type ExternalAgentCanonicalRuntimeRegistryRecord = Omit<ExternalAgentPluginRuntimeRegistryRecord, 'fixtureCase' | 'sourceEvidence'> & {
  fixtureCase: 'runtime-dangerous-tool' | 'runtime-http-route-metadata';
  sourceEvidence: ExternalAgentCanonicalSourceEvidence;
};

export type ExternalAgentCanonicalRuntimeRegistryImport = ExternalAgentPluginRuntimeRegistryNormalization;

const CANONICAL_SOURCE_EVIDENCE: ExternalAgentCanonicalSourceEvidence = {
  sourceRuntimeName: EXTERNAL_AGENT_CANONICAL_SOURCE_RUNTIME_NAME,
  sourcePaths: ['src/gateway/protocol/index.ts'],
  observedAt: EXTERNAL_AGENT_CANONICAL_FIXTURE_NOW,
};

const CANONICAL_SESSION: ExternalAgentSessionDescriptor = {
  id: 'external-agent-v1-source-session',
  userId: 'external-agent-v1-source-user',
  channel: 'api',
  title: 'Track 1 source session evidence',
  workspace: 'C:/workspace/zavorth-external-agent-v1',
  lastEventAt: EXTERNAL_AGENT_CANONICAL_FIXTURE_NOW,
};

function createCanonicalFixtureAdapter(input: {
  capabilities?: ExternalAgentCapabilityDescriptor[];
  sessions?: ExternalAgentSessionDescriptor[];
} = {}): ExternalAgentSidecarAdapter {
  return new ExternalAgentSidecarAdapter({
    descriptor: {
      id: EXTERNAL_AGENT_CANONICAL_RUNTIME_ID,
      label: 'External Track 1 fixture runtime',
      adapterKind: 'sidecar',
      runtimeKind: 'external-agent-runtime',
      transport: 'fixture',
      version: 'external-agent-v1-fixture',
      diagnostics: {
        sourceRuntimeName: EXTERNAL_AGENT_CANONICAL_SOURCE_RUNTIME_NAME,
        sourceRuntimeVersion: 'frozen-baseline-310d2db',
        notes: [
          'Track 1 deterministic fixture only.',
          'Source protocol evidence remains quarantined.',
        ],
      },
    },
    capabilities: input.capabilities || [],
    sessions: input.sessions || [CANONICAL_SESSION],
    now: () => new Date(EXTERNAL_AGENT_CANONICAL_FIXTURE_NOW),
  });
}

function sourceEvidence(paths: string[]): ExternalAgentCanonicalSourceEvidence {
  return {
    sourceRuntimeName: EXTERNAL_AGENT_CANONICAL_SOURCE_RUNTIME_NAME,
    sourcePaths: paths,
    observedAt: EXTERNAL_AGENT_CANONICAL_FIXTURE_NOW,
  };
}

export function createCanonicalGatewayProtocolFrameFixtures(): ExternalAgentCanonicalGatewayFrameFixture[] {
  return [
    {
      fixtureCase: 'valid-frame-message',
      frameKind: 'request',
      id: 'external-agent-v1-frame-request-1',
      sessionId: CANONICAL_SESSION.id,
      method: 'chat.send',
      sequence: 1,
      idempotencyKey: 'external-agent-v1-frame-request-1',
      actor: {
        id: CANONICAL_SESSION.userId,
        role: 'user',
      },
      payload: {
        text: 'route this gateway request through Zavorth contracts',
        channel: 'api',
        workspace: CANONICAL_SESSION.workspace,
        requestedTools: ['read_file'],
      },
      sourceEvidence: CANONICAL_SOURCE_EVIDENCE,
    },
    {
      fixtureCase: 'valid-event-message',
      frameKind: 'event',
      id: 'external-agent-v1-frame-event-1',
      sessionId: CANONICAL_SESSION.id,
      event: 'session.message',
      sequence: 2,
      idempotencyKey: 'external-agent-v1-frame-event-1',
      actor: {
        id: CANONICAL_SESSION.userId,
        role: 'user',
      },
      payload: {
        text: 'normalize this event stream message',
        channel: 'api',
        workspace: CANONICAL_SESSION.workspace,
      },
      sourceEvidence: CANONICAL_SOURCE_EVIDENCE,
    },
    {
      fixtureCase: 'valid-response-diagnostic',
      frameKind: 'response',
      id: 'external-agent-v1-frame-response-1',
      sessionId: CANONICAL_SESSION.id,
      method: 'gateway.health',
      status: 'ok',
      payload: {
        text: 'response frame observed as diagnostic evidence',
      },
      sourceEvidence: CANONICAL_SOURCE_EVIDENCE,
    },
    {
      fixtureCase: 'valid-error-frame',
      frameKind: 'error',
      id: 'external-agent-v1-frame-error-1',
      sessionId: CANONICAL_SESSION.id,
      status: 'error',
      payload: {
        errorCode: 'source.invalid_scope',
        errorMessage: 'Source scope is not accepted by Zavorth trust policy.',
      },
      sourceEvidence: CANONICAL_SOURCE_EVIDENCE,
    },
    {
      fixtureCase: 'invalid-frame-schema',
      frameKind: 'unknown',
      id: 'external-agent-v1-frame-invalid-1',
      sourceEvidence: CANONICAL_SOURCE_EVIDENCE,
    },
  ];
}

export function normalizeCanonicalGatewayProtocolFrame(
  frame: ExternalAgentCanonicalGatewayFrameFixture,
): ExternalAgentCanonicalGatewayFrameNormalizationResult {
  return normalizeExternalAgentGatewayProtocolFrame(frame, {
    runtimeId: EXTERNAL_AGENT_CANONICAL_RUNTIME_ID,
    observedAt: EXTERNAL_AGENT_CANONICAL_FIXTURE_NOW,
    session: CANONICAL_SESSION,
    defaultUserId: CANONICAL_SESSION.userId,
    sourceRuntimeVersion: 'frozen-baseline-310d2db',
  });
}

export function createCanonicalHandshakeFixtures(): ExternalAgentCanonicalHandshakeFixture[] {
  return [
    {
      fixtureCase: 'connect-owner-with-token',
      clientId: 'external-agent-v1-owner-client',
      sourceRole: 'owner',
      sourceScopes: ['gateway:read', 'sessions:read'],
      sourceToken: 'source-secret-token-never-authoritative',
      sourceEvidence: sourceEvidence([
        'src/gateway/protocol/index.ts',
        'src/gateway/connection-auth.ts',
        'src/gateway/client-bootstrap.ts',
      ]),
    },
    {
      fixtureCase: 'connect-scope-downgrade',
      clientId: 'external-agent-v1-over-scoped-client',
      sourceRole: 'node',
      sourceScopes: ['gateway:read', 'tools:execute', 'files:write', 'workers:launch'],
      sourceToken: 'source-over-scoped-token-never-authoritative',
      sourceEvidence: sourceEvidence([
        'src/gateway/protocol/index.ts',
        'src/gateway/connection-auth.ts',
        'src/gateway/client-bootstrap.ts',
      ]),
    },
  ];
}

export function normalizeCanonicalGatewayHandshake(
  fixture: ExternalAgentCanonicalHandshakeFixture,
): ExternalAgentCanonicalHandshakeNormalization {
  return normalizeExternalAgentGatewayHandshake(fixture, {
    descriptorIdPrefix: 'external-external-agent-v1-handshake',
    label: 'External gateway handshake evidence',
    transport: 'fixture',
    observedAt: EXTERNAL_AGENT_CANONICAL_FIXTURE_NOW,
    sourceRuntimeVersion: 'frozen-baseline-310d2db',
  });
}

export function createCanonicalGatewayEventStreamFixtures(): ExternalAgentCanonicalGatewayStreamEventFixture[] {
  const evidence = sourceEvidence([
    'src/gateway/protocol/index.ts',
    'src/gateway/events.ts',
    'src/gateway/*event*',
  ]);
  return [
    {
      fixtureCase: 'ordered-event-stream',
      id: 'external-agent-v1-stream-event-2',
      idempotencyKey: 'external-agent-v1-stream-key-2',
      sequence: 2,
      sessionId: CANONICAL_SESSION.id,
      type: 'session.message',
      text: 'second source event arrives after ordering',
      sourceEvidence: evidence,
    },
    {
      fixtureCase: 'ordered-event-stream',
      id: 'external-agent-v1-stream-event-1',
      idempotencyKey: 'external-agent-v1-stream-key-1',
      sequence: 1,
      sessionId: CANONICAL_SESSION.id,
      type: 'runtime.update',
      text: 'first source event establishes runtime state',
      sourceEvidence: evidence,
    },
    {
      fixtureCase: 'duplicate-event-stream',
      id: 'external-agent-v1-stream-event-2-duplicate',
      idempotencyKey: 'external-agent-v1-stream-key-2',
      sequence: 3,
      sessionId: CANONICAL_SESSION.id,
      type: 'session.message',
      text: 'duplicate source event should not duplicate projection state',
      sourceEvidence: evidence,
    },
  ];
}

export function normalizeCanonicalGatewayEventStream(
  events: ExternalAgentCanonicalGatewayStreamEventFixture[],
): ExternalAgentCanonicalGatewayEventStreamNormalization {
  return normalizeExternalAgentGatewayEventStream(events, {
    runtimeId: EXTERNAL_AGENT_CANONICAL_RUNTIME_ID,
    observedAt: EXTERNAL_AGENT_CANONICAL_FIXTURE_NOW,
    defaultActorId: 'external-agent-v1-source-system',
    defaultChannel: 'api',
    sourceRuntimeVersion: 'frozen-baseline-310d2db',
  });
}

export const CANONICAL_PLUGIN_MANIFEST_FIXTURES: ExternalAgentSkillManifest[] = [
  {
    id: 'safe-provider-manifest',
    name: 'SafeProviderManifest',
    title: 'Safe provider manifest',
    description: 'Provider manifest imported as Zavorth capability metadata.',
    tools: ['provider.search'],
    risk: 'safe',
    trustState: 'safe',
    enabled: true,
    available: true,
    observedAt: EXTERNAL_AGENT_CANONICAL_FIXTURE_NOW,
    sourceRuntimeName: EXTERNAL_AGENT_CANONICAL_SOURCE_RUNTIME_NAME,
    sourceCapabilityName: 'extensions/search/manifest',
    sourceManifestPath: 'extensions/search/manifest.json',
  },
  {
    id: 'disabled-provider-manifest',
    name: 'DisabledProviderManifest',
    title: 'Disabled provider manifest',
    description: 'Disabled provider manifest must not be exposed to tool policy.',
    tools: ['provider.disabled'],
    risk: 'attention',
    trustState: 'safe',
    enabled: false,
    available: false,
    observedAt: EXTERNAL_AGENT_CANONICAL_FIXTURE_NOW,
    sourceRuntimeName: EXTERNAL_AGENT_CANONICAL_SOURCE_RUNTIME_NAME,
    sourceCapabilityName: 'extensions/disabled/manifest',
    sourceManifestPath: 'extensions/disabled/manifest.json',
  },
];

export async function buildCanonicalPluginManifestRegistryImport(): Promise<ExternalAgentCanonicalPluginManifestRegistryImport> {
  return normalizeExternalAgentPluginManifestRegistry({
    adapter: createCanonicalFixtureAdapter(),
    manifests: CANONICAL_PLUGIN_MANIFEST_FIXTURES,
    now: () => new Date(EXTERNAL_AGENT_CANONICAL_FIXTURE_NOW),
  });
}

export async function buildCanonicalPluginManifestRegistryInventory(): Promise<ExternalAgentCapabilityInventorySnapshot> {
  const manifestImport = await buildCanonicalPluginManifestRegistryImport();
  return manifestImport.inventory;
}

export const CANONICAL_PLUGIN_RUNTIME_REGISTRY_FIXTURES: ExternalAgentCanonicalRuntimeRegistryRecord[] = [
  {
    fixtureCase: 'runtime-dangerous-tool',
    id: 'runtime-dangerous-tool',
    label: 'Runtime dangerous tool',
    kind: 'tool',
    tools: ['workspace.delete'],
    risk: 'danger',
    trustState: 'quarantined',
    sourceEvidence: sourceEvidence([
      'src/plugins/registry-types.ts',
      'src/plugins/loader.ts',
      'src/plugins/bundled-capability-runtime.ts',
    ]),
  },
  {
    fixtureCase: 'runtime-http-route-metadata',
    id: 'runtime-http-route-metadata',
    label: 'Runtime HTTP route metadata',
    kind: 'http-route',
    route: '/plugins/source/diagnostics',
    risk: 'attention',
    trustState: 'safe',
    sourceEvidence: sourceEvidence([
      'src/plugins/registry-types.ts',
      'src/plugins/http-registry.ts',
    ]),
  },
];

export async function buildCanonicalPluginRuntimeRegistryImport(
  records: ExternalAgentCanonicalRuntimeRegistryRecord[] = CANONICAL_PLUGIN_RUNTIME_REGISTRY_FIXTURES,
): Promise<ExternalAgentCanonicalRuntimeRegistryImport> {
  return normalizeExternalAgentPluginRuntimeRegistry({
    records,
    createAdapter: (capabilities) => createCanonicalFixtureAdapter({ capabilities }),
    now: () => new Date(EXTERNAL_AGENT_CANONICAL_FIXTURE_NOW),
  });
}
