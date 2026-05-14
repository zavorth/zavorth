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

export const EXTERNAL_AGENT_WAVE1_FIXTURE_NOW = '2026-04-27T19:00:00.000Z';
export const EXTERNAL_AGENT_WAVE1_SOURCE_RUNTIME_NAME = 'ExternalExecutor';
export const EXTERNAL_AGENT_WAVE1_RUNTIME_ID = 'external-wave1-fixture-runtime';

export type ExternalAgentWave1SourceEvidence = {
  sourceRuntimeName: typeof EXTERNAL_AGENT_WAVE1_SOURCE_RUNTIME_NAME;
  sourcePaths: string[];
  observedAt: string;
};

export type ExternalAgentWave1GatewayFrameKind = ExternalAgentGatewayProtocolFrameKind;

export type ExternalAgentWave1GatewayFrameFixture = Omit<ExternalAgentGatewayProtocolFrame, 'fixtureCase' | 'sourceEvidence'> & {
  fixtureCase:
    | 'valid-frame-message'
    | 'valid-event-message'
    | 'valid-response-diagnostic'
    | 'valid-error-frame'
    | 'invalid-frame-schema';
  sourceEvidence: ExternalAgentWave1SourceEvidence;
};

export type ExternalAgentWave1StructuredError = ExternalAgentGatewayProtocolStructuredError;
export type ExternalAgentWave1GatewayFrameNormalizationResult = ExternalAgentGatewayProtocolNormalizationResult;

export type ExternalAgentWave1HandshakeFixture = Omit<ExternalAgentGatewayHandshakeEvidence, 'fixtureCase' | 'sourceEvidence'> & {
  fixtureCase: 'connect-owner-with-token' | 'connect-scope-downgrade';
  sourceEvidence: ExternalAgentWave1SourceEvidence;
};

export type ExternalAgentWave1HandshakeNormalization = ExternalAgentGatewayHandshakeNormalization;

export type ExternalAgentWave1GatewayStreamEventFixture = Omit<ExternalAgentGatewayEventStreamEvent, 'fixtureCase' | 'sourceEvidence' | 'type'> & {
  fixtureCase: 'ordered-event-stream' | 'duplicate-event-stream';
  type: 'runtime.update' | 'session.message' | 'approval.requested' | 'artifact.ready';
  sourceEvidence: ExternalAgentWave1SourceEvidence;
};

export type ExternalAgentWave1GatewayEventStreamNormalization = ExternalAgentGatewayEventStreamNormalization;
export type ExternalAgentWave1PluginManifestRegistryImport = ExternalAgentPluginManifestRegistryNormalization;

export type ExternalAgentWave1RuntimeRegistryRecord = Omit<ExternalAgentPluginRuntimeRegistryRecord, 'fixtureCase' | 'sourceEvidence'> & {
  fixtureCase: 'runtime-dangerous-tool' | 'runtime-http-route-metadata';
  sourceEvidence: ExternalAgentWave1SourceEvidence;
};

export type ExternalAgentWave1RuntimeRegistryImport = ExternalAgentPluginRuntimeRegistryNormalization;

const WAVE1_SOURCE_EVIDENCE: ExternalAgentWave1SourceEvidence = {
  sourceRuntimeName: EXTERNAL_AGENT_WAVE1_SOURCE_RUNTIME_NAME,
  sourcePaths: ['src/gateway/protocol/index.ts'],
  observedAt: EXTERNAL_AGENT_WAVE1_FIXTURE_NOW,
};

const WAVE1_SESSION: ExternalAgentSessionDescriptor = {
  id: 'wave1-source-session',
  userId: 'wave1-source-user',
  channel: 'api',
  title: 'Wave 1 source session evidence',
  workspace: 'C:/workspace/zavorth-wave1',
  lastEventAt: EXTERNAL_AGENT_WAVE1_FIXTURE_NOW,
};

function createWave1FixtureAdapter(input: {
  capabilities?: ExternalAgentCapabilityDescriptor[];
  sessions?: ExternalAgentSessionDescriptor[];
} = {}): ExternalAgentSidecarAdapter {
  return new ExternalAgentSidecarAdapter({
    descriptor: {
      id: EXTERNAL_AGENT_WAVE1_RUNTIME_ID,
      label: 'External Wave 1 fixture runtime',
      adapterKind: 'sidecar',
      runtimeKind: 'external-agent-runtime',
      transport: 'fixture',
      version: 'wave1-fixture',
      diagnostics: {
        sourceRuntimeName: EXTERNAL_AGENT_WAVE1_SOURCE_RUNTIME_NAME,
        sourceRuntimeVersion: 'frozen-baseline-310d2db',
        notes: [
          'Wave 1 deterministic fixture only.',
          'Source protocol evidence remains quarantined.',
        ],
      },
    },
    capabilities: input.capabilities || [],
    sessions: input.sessions || [WAVE1_SESSION],
    now: () => new Date(EXTERNAL_AGENT_WAVE1_FIXTURE_NOW),
  });
}

function sourceEvidence(paths: string[]): ExternalAgentWave1SourceEvidence {
  return {
    sourceRuntimeName: EXTERNAL_AGENT_WAVE1_SOURCE_RUNTIME_NAME,
    sourcePaths: paths,
    observedAt: EXTERNAL_AGENT_WAVE1_FIXTURE_NOW,
  };
}

export function createWave1GatewayProtocolFrameFixtures(): ExternalAgentWave1GatewayFrameFixture[] {
  return [
    {
      fixtureCase: 'valid-frame-message',
      frameKind: 'request',
      id: 'wave1-frame-request-1',
      sessionId: WAVE1_SESSION.id,
      method: 'chat.send',
      sequence: 1,
      idempotencyKey: 'wave1-frame-request-1',
      actor: {
        id: WAVE1_SESSION.userId,
        role: 'user',
      },
      payload: {
        text: 'route this gateway request through Zavorth contracts',
        channel: 'api',
        workspace: WAVE1_SESSION.workspace,
        requestedTools: ['read_file'],
      },
      sourceEvidence: WAVE1_SOURCE_EVIDENCE,
    },
    {
      fixtureCase: 'valid-event-message',
      frameKind: 'event',
      id: 'wave1-frame-event-1',
      sessionId: WAVE1_SESSION.id,
      event: 'session.message',
      sequence: 2,
      idempotencyKey: 'wave1-frame-event-1',
      actor: {
        id: WAVE1_SESSION.userId,
        role: 'user',
      },
      payload: {
        text: 'normalize this event stream message',
        channel: 'api',
        workspace: WAVE1_SESSION.workspace,
      },
      sourceEvidence: WAVE1_SOURCE_EVIDENCE,
    },
    {
      fixtureCase: 'valid-response-diagnostic',
      frameKind: 'response',
      id: 'wave1-frame-response-1',
      sessionId: WAVE1_SESSION.id,
      method: 'gateway.health',
      status: 'ok',
      payload: {
        text: 'response frame observed as diagnostic evidence',
      },
      sourceEvidence: WAVE1_SOURCE_EVIDENCE,
    },
    {
      fixtureCase: 'valid-error-frame',
      frameKind: 'error',
      id: 'wave1-frame-error-1',
      sessionId: WAVE1_SESSION.id,
      status: 'error',
      payload: {
        errorCode: 'source.invalid_scope',
        errorMessage: 'Source scope is not accepted by Zavorth trust policy.',
      },
      sourceEvidence: WAVE1_SOURCE_EVIDENCE,
    },
    {
      fixtureCase: 'invalid-frame-schema',
      frameKind: 'unknown',
      id: 'wave1-frame-invalid-1',
      sourceEvidence: WAVE1_SOURCE_EVIDENCE,
    },
  ];
}

export function normalizeWave1GatewayProtocolFrame(
  frame: ExternalAgentWave1GatewayFrameFixture,
): ExternalAgentWave1GatewayFrameNormalizationResult {
  return normalizeExternalAgentGatewayProtocolFrame(frame, {
    runtimeId: EXTERNAL_AGENT_WAVE1_RUNTIME_ID,
    observedAt: EXTERNAL_AGENT_WAVE1_FIXTURE_NOW,
    session: WAVE1_SESSION,
    defaultUserId: WAVE1_SESSION.userId,
    sourceRuntimeVersion: 'frozen-baseline-310d2db',
  });
}

export function createWave1HandshakeFixtures(): ExternalAgentWave1HandshakeFixture[] {
  return [
    {
      fixtureCase: 'connect-owner-with-token',
      clientId: 'wave1-owner-client',
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
      clientId: 'wave1-over-scoped-client',
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

export function normalizeWave1GatewayHandshake(
  fixture: ExternalAgentWave1HandshakeFixture,
): ExternalAgentWave1HandshakeNormalization {
  return normalizeExternalAgentGatewayHandshake(fixture, {
    descriptorIdPrefix: 'external-wave1-handshake',
    label: 'External gateway handshake evidence',
    transport: 'fixture',
    observedAt: EXTERNAL_AGENT_WAVE1_FIXTURE_NOW,
    sourceRuntimeVersion: 'frozen-baseline-310d2db',
  });
}

export function createWave1GatewayEventStreamFixtures(): ExternalAgentWave1GatewayStreamEventFixture[] {
  const evidence = sourceEvidence([
    'src/gateway/protocol/index.ts',
    'src/gateway/events.ts',
    'src/gateway/*event*',
  ]);
  return [
    {
      fixtureCase: 'ordered-event-stream',
      id: 'wave1-stream-event-2',
      idempotencyKey: 'wave1-stream-key-2',
      sequence: 2,
      sessionId: WAVE1_SESSION.id,
      type: 'session.message',
      text: 'second source event arrives after ordering',
      sourceEvidence: evidence,
    },
    {
      fixtureCase: 'ordered-event-stream',
      id: 'wave1-stream-event-1',
      idempotencyKey: 'wave1-stream-key-1',
      sequence: 1,
      sessionId: WAVE1_SESSION.id,
      type: 'runtime.update',
      text: 'first source event establishes runtime state',
      sourceEvidence: evidence,
    },
    {
      fixtureCase: 'duplicate-event-stream',
      id: 'wave1-stream-event-2-duplicate',
      idempotencyKey: 'wave1-stream-key-2',
      sequence: 3,
      sessionId: WAVE1_SESSION.id,
      type: 'session.message',
      text: 'duplicate source event should not duplicate projection state',
      sourceEvidence: evidence,
    },
  ];
}

export function normalizeWave1GatewayEventStream(
  events: ExternalAgentWave1GatewayStreamEventFixture[],
): ExternalAgentWave1GatewayEventStreamNormalization {
  return normalizeExternalAgentGatewayEventStream(events, {
    runtimeId: EXTERNAL_AGENT_WAVE1_RUNTIME_ID,
    observedAt: EXTERNAL_AGENT_WAVE1_FIXTURE_NOW,
    defaultActorId: 'wave1-source-system',
    defaultChannel: 'api',
    sourceRuntimeVersion: 'frozen-baseline-310d2db',
  });
}

export const WAVE1_PLUGIN_MANIFEST_FIXTURES: ExternalAgentSkillManifest[] = [
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
    observedAt: EXTERNAL_AGENT_WAVE1_FIXTURE_NOW,
    sourceRuntimeName: EXTERNAL_AGENT_WAVE1_SOURCE_RUNTIME_NAME,
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
    observedAt: EXTERNAL_AGENT_WAVE1_FIXTURE_NOW,
    sourceRuntimeName: EXTERNAL_AGENT_WAVE1_SOURCE_RUNTIME_NAME,
    sourceCapabilityName: 'extensions/disabled/manifest',
    sourceManifestPath: 'extensions/disabled/manifest.json',
  },
];

export async function buildWave1PluginManifestRegistryImport(): Promise<ExternalAgentWave1PluginManifestRegistryImport> {
  return normalizeExternalAgentPluginManifestRegistry({
    adapter: createWave1FixtureAdapter(),
    manifests: WAVE1_PLUGIN_MANIFEST_FIXTURES,
    now: () => new Date(EXTERNAL_AGENT_WAVE1_FIXTURE_NOW),
  });
}

export async function buildWave1PluginManifestRegistryInventory(): Promise<ExternalAgentCapabilityInventorySnapshot> {
  const manifestImport = await buildWave1PluginManifestRegistryImport();
  return manifestImport.inventory;
}

export const WAVE1_PLUGIN_RUNTIME_REGISTRY_FIXTURES: ExternalAgentWave1RuntimeRegistryRecord[] = [
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

export async function buildWave1PluginRuntimeRegistryImport(
  records: ExternalAgentWave1RuntimeRegistryRecord[] = WAVE1_PLUGIN_RUNTIME_REGISTRY_FIXTURES,
): Promise<ExternalAgentWave1RuntimeRegistryImport> {
  return normalizeExternalAgentPluginRuntimeRegistry({
    records,
    createAdapter: (capabilities) => createWave1FixtureAdapter({ capabilities }),
    now: () => new Date(EXTERNAL_AGENT_WAVE1_FIXTURE_NOW),
  });
}
