import {
  type RuntimeAdapterCapabilityInventorySnapshot,
  type RuntimeAdapterSkillManifest,
} from './RuntimeAdapterCapabilityProvider.js';
import {
  RuntimeAdapterSidecarAdapter,
} from './RuntimeAdapterSidecarAdapter.js';
import {
  normalizeRuntimeAdapterGatewayProtocolFrame,
  type RuntimeAdapterGatewayProtocolFrame,
  type RuntimeAdapterGatewayProtocolFrameKind,
  type RuntimeAdapterGatewayProtocolNormalizationResult,
  type RuntimeAdapterGatewayProtocolStructuredError,
} from './RuntimeAdapterGatewayProtocolBoundary.js';
import {
  normalizeRuntimeAdapterGatewayHandshake,
  type RuntimeAdapterGatewayHandshakeEvidence,
  type RuntimeAdapterGatewayHandshakeNormalization,
} from './RuntimeAdapterGatewayHandshakeBoundary.js';
import {
  normalizeRuntimeAdapterGatewayEventStream,
  type RuntimeAdapterGatewayEventStreamEvent,
  type RuntimeAdapterGatewayEventStreamNormalization,
} from './RuntimeAdapterGatewayEventStreamBoundary.js';
import {
  normalizeRuntimeAdapterPluginManifestRegistry,
  type RuntimeAdapterPluginManifestRegistryNormalization,
} from './RuntimeAdapterPluginManifestRegistryBoundary.js';
import {
  normalizeRuntimeAdapterPluginRuntimeRegistry,
  type RuntimeAdapterPluginRuntimeRegistryNormalization,
  type RuntimeAdapterPluginRuntimeRegistryRecord,
} from './RuntimeAdapterPluginRuntimeRegistryBoundary.js';
import {
  type RuntimeAdapterCapabilityDescriptor,
  type RuntimeAdapterSessionDescriptor,
} from './contracts.js';







export const RUNTIME_ADAPTER_CANONICAL_FIXTURE_NOW = '2026-04-27T19:00:00.000Z';
export const RUNTIME_ADAPTER_CANONICAL_SOURCE_RUNTIME_NAME = 'ExternalExecutor';
export const RUNTIME_ADAPTER_CANONICAL_RUNTIME_ID = 'external-runtime-adapter-v1-fixture-runtime';

export type RuntimeAdapterCanonicalSourceEvidence = {
  sourceRuntimeName: typeof RUNTIME_ADAPTER_CANONICAL_SOURCE_RUNTIME_NAME;
  sourcePaths: string[];
  observedAt: string;
};

export type RuntimeAdapterCanonicalGatewayFrameKind = RuntimeAdapterGatewayProtocolFrameKind;

export type RuntimeAdapterCanonicalGatewayFrameFixture = Omit<RuntimeAdapterGatewayProtocolFrame, 'fixtureCase' | 'sourceEvidence'> & {
  fixtureCase:
    | 'valid-frame-message'
    | 'valid-event-message'
    | 'valid-response-diagnostic'
    | 'valid-error-frame'
    | 'invalid-frame-schema';
  sourceEvidence: RuntimeAdapterCanonicalSourceEvidence;
};

export type RuntimeAdapterCanonicalStructuredError = RuntimeAdapterGatewayProtocolStructuredError;
export type RuntimeAdapterCanonicalGatewayFrameNormalizationResult = RuntimeAdapterGatewayProtocolNormalizationResult;

export type RuntimeAdapterCanonicalHandshakeFixture = Omit<RuntimeAdapterGatewayHandshakeEvidence, 'fixtureCase' | 'sourceEvidence'> & {
  fixtureCase: 'connect-owner-with-token' | 'connect-scope-downgrade';
  sourceEvidence: RuntimeAdapterCanonicalSourceEvidence;
};

export type RuntimeAdapterCanonicalHandshakeNormalization = RuntimeAdapterGatewayHandshakeNormalization;

export type RuntimeAdapterCanonicalGatewayStreamEventFixture = Omit<RuntimeAdapterGatewayEventStreamEvent, 'fixtureCase' | 'sourceEvidence' | 'type'> & {
  fixtureCase: 'ordered-event-stream' | 'duplicate-event-stream';
  type: 'runtime.update' | 'session.message' | 'approval.requested' | 'artifact.ready';
  sourceEvidence: RuntimeAdapterCanonicalSourceEvidence;
};

export type RuntimeAdapterCanonicalGatewayEventStreamNormalization = RuntimeAdapterGatewayEventStreamNormalization;
export type RuntimeAdapterCanonicalPluginManifestRegistryImport = RuntimeAdapterPluginManifestRegistryNormalization;

export type RuntimeAdapterCanonicalRuntimeRegistryRecord = Omit<RuntimeAdapterPluginRuntimeRegistryRecord, 'fixtureCase' | 'sourceEvidence'> & {
  fixtureCase: 'runtime-dangerous-tool' | 'runtime-http-route-metadata';
  sourceEvidence: RuntimeAdapterCanonicalSourceEvidence;
};

export type RuntimeAdapterCanonicalRuntimeRegistryImport = RuntimeAdapterPluginRuntimeRegistryNormalization;

const CANONICAL_SOURCE_EVIDENCE: RuntimeAdapterCanonicalSourceEvidence = {
  sourceRuntimeName: RUNTIME_ADAPTER_CANONICAL_SOURCE_RUNTIME_NAME,
  sourcePaths: ['src/gateway/protocol/index.ts'],
  observedAt: RUNTIME_ADAPTER_CANONICAL_FIXTURE_NOW,
};

const CANONICAL_SESSION: RuntimeAdapterSessionDescriptor = {
  id: 'runtime-adapter-v1-source-session',
  userId: 'runtime-adapter-v1-source-user',
  channel: 'api',
  title: 'Track 1 source session evidence',
  workspace: 'C:/workspace/zavorth-runtime-adapter-v1',
  lastEventAt: RUNTIME_ADAPTER_CANONICAL_FIXTURE_NOW,
};

function createCanonicalFixtureAdapter(input: {
  capabilities?: RuntimeAdapterCapabilityDescriptor[];
  sessions?: RuntimeAdapterSessionDescriptor[];
} = {}): RuntimeAdapterSidecarAdapter {
  return new RuntimeAdapterSidecarAdapter({
    descriptor: {
      id: RUNTIME_ADAPTER_CANONICAL_RUNTIME_ID,
      label: 'External Track 1 fixture runtime',
      adapterKind: 'sidecar',
      runtimeKind: 'runtime-adapter-runtime',
      transport: 'fixture',
      version: 'runtime-adapter-v1-fixture',
      diagnostics: {
        sourceRuntimeName: RUNTIME_ADAPTER_CANONICAL_SOURCE_RUNTIME_NAME,
        sourceRuntimeVersion: 'frozen-baseline-310d2db',
        notes: [
          'Track 1 deterministic fixture only.',
          'Source protocol evidence remains quarantined.',
        ],
      },
    },
    capabilities: input.capabilities || [],
    sessions: input.sessions || [CANONICAL_SESSION],
    now: () => new Date(RUNTIME_ADAPTER_CANONICAL_FIXTURE_NOW),
  });
}

function sourceEvidence(paths: string[]): RuntimeAdapterCanonicalSourceEvidence {
  return {
    sourceRuntimeName: RUNTIME_ADAPTER_CANONICAL_SOURCE_RUNTIME_NAME,
    sourcePaths: paths,
    observedAt: RUNTIME_ADAPTER_CANONICAL_FIXTURE_NOW,
  };
}

export function createCanonicalGatewayProtocolFrameFixtures(): RuntimeAdapterCanonicalGatewayFrameFixture[] {
  return [
    {
      fixtureCase: 'valid-frame-message',
      frameKind: 'request',
      id: 'runtime-adapter-v1-frame-request-1',
      sessionId: CANONICAL_SESSION.id,
      method: 'chat.send',
      sequence: 1,
      idempotencyKey: 'runtime-adapter-v1-frame-request-1',
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
      id: 'runtime-adapter-v1-frame-event-1',
      sessionId: CANONICAL_SESSION.id,
      event: 'session.message',
      sequence: 2,
      idempotencyKey: 'runtime-adapter-v1-frame-event-1',
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
      id: 'runtime-adapter-v1-frame-response-1',
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
      id: 'runtime-adapter-v1-frame-error-1',
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
      id: 'runtime-adapter-v1-frame-invalid-1',
      sourceEvidence: CANONICAL_SOURCE_EVIDENCE,
    },
  ];
}

export function normalizeCanonicalGatewayProtocolFrame(
  frame: RuntimeAdapterCanonicalGatewayFrameFixture,
): RuntimeAdapterCanonicalGatewayFrameNormalizationResult {
  return normalizeRuntimeAdapterGatewayProtocolFrame(frame, {
    runtimeId: RUNTIME_ADAPTER_CANONICAL_RUNTIME_ID,
    observedAt: RUNTIME_ADAPTER_CANONICAL_FIXTURE_NOW,
    session: CANONICAL_SESSION,
    defaultUserId: CANONICAL_SESSION.userId,
    sourceRuntimeVersion: 'frozen-baseline-310d2db',
  });
}

export function createCanonicalHandshakeFixtures(): RuntimeAdapterCanonicalHandshakeFixture[] {
  return [
    {
      fixtureCase: 'connect-owner-with-token',
      clientId: 'runtime-adapter-v1-owner-client',
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
      clientId: 'runtime-adapter-v1-over-scoped-client',
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
  fixture: RuntimeAdapterCanonicalHandshakeFixture,
): RuntimeAdapterCanonicalHandshakeNormalization {
  return normalizeRuntimeAdapterGatewayHandshake(fixture, {
    descriptorIdPrefix: 'external-runtime-adapter-v1-handshake',
    label: 'External gateway handshake evidence',
    transport: 'fixture',
    observedAt: RUNTIME_ADAPTER_CANONICAL_FIXTURE_NOW,
    sourceRuntimeVersion: 'frozen-baseline-310d2db',
  });
}

export function createCanonicalGatewayEventStreamFixtures(): RuntimeAdapterCanonicalGatewayStreamEventFixture[] {
  const evidence = sourceEvidence([
    'src/gateway/protocol/index.ts',
    'src/gateway/events.ts',
    'src/gateway/*event*',
  ]);
  return [
    {
      fixtureCase: 'ordered-event-stream',
      id: 'runtime-adapter-v1-stream-event-2',
      idempotencyKey: 'runtime-adapter-v1-stream-key-2',
      sequence: 2,
      sessionId: CANONICAL_SESSION.id,
      type: 'session.message',
      text: 'second source event arrives after ordering',
      sourceEvidence: evidence,
    },
    {
      fixtureCase: 'ordered-event-stream',
      id: 'runtime-adapter-v1-stream-event-1',
      idempotencyKey: 'runtime-adapter-v1-stream-key-1',
      sequence: 1,
      sessionId: CANONICAL_SESSION.id,
      type: 'runtime.update',
      text: 'first source event establishes runtime state',
      sourceEvidence: evidence,
    },
    {
      fixtureCase: 'duplicate-event-stream',
      id: 'runtime-adapter-v1-stream-event-2-duplicate',
      idempotencyKey: 'runtime-adapter-v1-stream-key-2',
      sequence: 3,
      sessionId: CANONICAL_SESSION.id,
      type: 'session.message',
      text: 'duplicate source event should not duplicate projection state',
      sourceEvidence: evidence,
    },
  ];
}

export function normalizeCanonicalGatewayEventStream(
  events: RuntimeAdapterCanonicalGatewayStreamEventFixture[],
): RuntimeAdapterCanonicalGatewayEventStreamNormalization {
  return normalizeRuntimeAdapterGatewayEventStream(events, {
    runtimeId: RUNTIME_ADAPTER_CANONICAL_RUNTIME_ID,
    observedAt: RUNTIME_ADAPTER_CANONICAL_FIXTURE_NOW,
    defaultActorId: 'runtime-adapter-v1-source-system',
    defaultChannel: 'api',
    sourceRuntimeVersion: 'frozen-baseline-310d2db',
  });
}

export const CANONICAL_PLUGIN_MANIFEST_FIXTURES: RuntimeAdapterSkillManifest[] = [
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
    observedAt: RUNTIME_ADAPTER_CANONICAL_FIXTURE_NOW,
    sourceRuntimeName: RUNTIME_ADAPTER_CANONICAL_SOURCE_RUNTIME_NAME,
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
    observedAt: RUNTIME_ADAPTER_CANONICAL_FIXTURE_NOW,
    sourceRuntimeName: RUNTIME_ADAPTER_CANONICAL_SOURCE_RUNTIME_NAME,
    sourceCapabilityName: 'extensions/disabled/manifest',
    sourceManifestPath: 'extensions/disabled/manifest.json',
  },
];

export async function buildCanonicalPluginManifestRegistryImport(): Promise<RuntimeAdapterCanonicalPluginManifestRegistryImport> {
  return normalizeRuntimeAdapterPluginManifestRegistry({
    adapter: createCanonicalFixtureAdapter(),
    manifests: CANONICAL_PLUGIN_MANIFEST_FIXTURES,
    now: () => new Date(RUNTIME_ADAPTER_CANONICAL_FIXTURE_NOW),
  });
}

export async function buildCanonicalPluginManifestRegistryInventory(): Promise<RuntimeAdapterCapabilityInventorySnapshot> {
  const manifestImport = await buildCanonicalPluginManifestRegistryImport();
  return manifestImport.inventory;
}

export const CANONICAL_PLUGIN_RUNTIME_REGISTRY_FIXTURES: RuntimeAdapterCanonicalRuntimeRegistryRecord[] = [
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
  records: RuntimeAdapterCanonicalRuntimeRegistryRecord[] = CANONICAL_PLUGIN_RUNTIME_REGISTRY_FIXTURES,
): Promise<RuntimeAdapterCanonicalRuntimeRegistryImport> {
  return normalizeRuntimeAdapterPluginRuntimeRegistry({
    records,
    createAdapter: (capabilities) => createCanonicalFixtureAdapter({ capabilities }),
    now: () => new Date(RUNTIME_ADAPTER_CANONICAL_FIXTURE_NOW),
  });
}
