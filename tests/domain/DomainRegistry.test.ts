import { DomainRegistry } from '../../src/domain/DomainRegistry.js';
import { ArtifactsFacade } from '../../src/domain/artifacts/ArtifactsFacade.js';
import { ChannelsFacade } from '../../src/domain/channels/ChannelsFacade.js';
import { ExecutionFacade } from '../../src/domain/execution/ExecutionFacade.js';
import { GatewayFacade } from '../../src/domain/gateway/GatewayFacade.js';
import { MemoryFacade } from '../../src/domain/memory/MemoryFacade.js';
import { NodesFacade } from '../../src/domain/nodes/NodesFacade.js';
import { OpsFacade } from '../../src/domain/ops/OpsFacade.js';
import { PlatformFacade } from '../../src/domain/platform/PlatformFacade.js';
import { ProvidersFacade } from '../../src/domain/providers/ProvidersFacade.js';
import { SecurityFacade } from '../../src/domain/security/SecurityFacade.js';
import { SessionsFacade } from '../../src/domain/sessions/SessionsFacade.js';
import { TransportsFacade } from '../../src/domain/transports/TransportsFacade.js';

describe('DomainRegistry', () => {
  it('initializes all architectural domains and exposes summaries without a global singleton dependency', async () => {
    const registry = new DomainRegistry({
      gatewayFacade: new GatewayFacade({
        gatewayRuntime: {
          buildCoreSnapshot: () => ({
            lifecycle: { state: 'channel_ready', uptime: 42 },
            channels: { total: 2, ids: ['cli', 'web'] },
            sessions: { total: 3 },
          }),
        },
      }),
      executionFacade: new ExecutionFacade({
        continuityLinked: true,
        approvalLinked: true,
      }),
      sessionsFacade: new SessionsFacade({
        sessionPlaneService: {
          buildStatusSummaryFast: () => ({
            generatedAt: new Date().toISOString(),
            summary: { sessions: 3, historyItems: 5, sendReady: true, spawnReady: true },
            narrative: {
              headline: 'Sessions headline',
              operatorSummary: 'Session plane pronto.',
            },
          }),
        } as any,
      }),
      memoryFacade: new MemoryFacade({
        memoryPlaneService: {
          buildSnapshotFast: () => ({
            summary: {
              persistedMemories: 2,
              relevantMemories: 3,
              artifacts: 1,
              workflowRuns: 1,
              timelineEvents: 4,
            },
            narrative: {
              headline: 'Memory headline',
              operatorSummary: 'Memory plane pronto.',
            },
          }),
        } as any,
      }),
      artifactsFacade: new ArtifactsFacade({
        memoryPlaneService: {
          buildSnapshotFast: () => ({
            artifacts: {
              recent: [
                {
                  id: 'artifact-1',
                  key: 'artifact-1',
                  name: 'report.md',
                  kind: 'report',
                  summary: 'Relatorio recente',
                  path: null,
                  url: null,
                },
              ],
              reusableCount: 1,
              kinds: ['report'],
              latestLabel: 'report.md',
            },
          }),
        } as any,
        artifactPipelineService: {
          normalizeArtifacts: () => [
            {
              id: 'artifact-1',
              key: 'artifact-1',
              type: 'file',
              kind: 'report',
              name: 'report.md',
              source: 'memory-plane',
              path: null,
              url: null,
              mimeType: 'text/markdown',
              summary: 'Relatorio recente',
              description: null,
              previewText: null,
              sizeBytes: null,
              exists: false,
              deliveryChannel: 'none',
              createdAt: new Date().toISOString(),
            },
          ],
          buildManifest: () => ({
            total: 1,
            photos: 0,
            documents: 0,
            links: 0,
            missing_local_files: 0,
            generated_at: new Date().toISOString(),
            by_kind: { report: 1 },
            by_delivery_channel: { photo: 0, document: 0, link: 0, none: 1 },
            primary_artifact_key: 'artifact-1',
            primary_artifact_name: 'report.md',
            local_paths: [],
            remote_urls: [],
            package_mode: 'single',
          }),
        } as any,
      }),
      platformFacade: new PlatformFacade({
        platformRegistryService: {
          buildStatusSummarySnapshot: () => ({
            generatedAt: new Date().toISOString(),
            summary: {
              total: 7,
              plugins: 2,
              skills: 3,
              mcps: 2,
              collections: 1,
              recipes: 1,
            },
            catalogSync: { summary: 'Catalog sync pronto.' },
            narrative: {
              headline: 'Platform headline',
              operatorSummary: 'Platform plane pronto.',
            },
          }),
        } as any,
      }),
      channelsFacade: new ChannelsFacade({
        channelMeshService: {
          buildSnapshot: () => ({
            generatedAt: new Date().toISOString(),
            summary: {
              total: 3,
              ready: 1,
              partial: 1,
              planned: 1,
              disabled: 0,
              configured: 2,
              sessionSendReady: 1,
            },
            narrative: {
              headline: 'Channels headline',
              operatorSummary: 'Channel mesh pronto.',
            },
          }),
        } as any,
      }),
      nodesFacade: new NodesFacade({
        nodeMeshService: {
          buildSnapshot: () => ({
            summary: {
              total: 1,
              paired: 1,
              online: 1,
              invokable: 1,
              queued: 0,
              capabilities: 2,
            },
            selected: { nextAction: 'Node pronto.' },
            narrative: {
              headline: 'Nodes headline',
              operatorSummary: 'Node mesh pronto.',
            },
          }),
        } as any,
      }),
      transportsFacade: new TransportsFacade({
        remoteTransportService: {
          buildSnapshot: () => ({
            summary: {
              total: 2,
              ready: 1,
              partial: 1,
              attentionRequired: 0,
              pendingWork: 0,
            },
            selected: { operatorSummary: 'Transport pronto.' },
            narrative: {
              headline: 'Transports headline',
              operatorSummary: 'Remote transports prontos.',
            },
          }),
        } as any,
      }),
      securityFacade: new SecurityFacade({
        securityMeshService: {
          buildSnapshot: () => ({
            summary: {
              totalModes: 4,
              coreReady: 2,
              extensionsReady: 2,
              gvisorActive: true,
              firecrackerReady: true,
              neverDowngrade: true,
            },
            posture: { label: 'Zero Trust Ready' },
            narrative: {
              operatorSummary: 'Security mesh pronto.',
              trustBoundary: 'Trust boundary clara.',
            },
          }),
        } as any,
      }),
      opsFacade: new OpsFacade({
        operationsHealthService: {
          readSnapshotFast: () => ({
            sidecars: {
              AIGateway: { enabled: true, ready: true },
              ZavorthTerminal: { enabled: false, ready: false },
            },
            errors: { recent: [] },
            nodeMeshSmoke: { status: 'passed' },
            channels: {
              telegram: { enabled: true, configured: true },
              discordBridge: { enabled: true, started: true },
              whatsapp: { enabled: false, ready: false, configured: false },
              slack: { enabled: false, ready: false, configured: false },
            },
            security: { needsAttention: false },
            storage: { freePercent: 80 },
            publish: { available: false, publishedAt: null },
            remoteTransportDoctor: { summary: 'Remote doctor ok.' },
          }),
        } as any,
      }),
      providersFacade: new ProvidersFacade({
        providerControlPlaneService: {
          listProviders: () => [
            { ready: true },
            { ready: false },
          ],
          listProfiles: () => [{ label: 'Coding' }, { label: 'Research' }],
          getCurrentConversationalProvider: () => 'openai',
          getCurrentConversationalModel: () => 'gpt-5.4',
        } as any,
      }),
    });

    const before = registry.buildSummarySnapshot();
    expect(before.summary).toEqual(
      expect.objectContaining({
        total: 12,
        initialized: 0,
        pending: 12,
      }),
    );
    expect(before.summary.total).toBe(12);
    expect(before.summary.initialized).toBe(0);

    await registry.initializeAll();

    const after = registry.buildSnapshot();
    expect(after.summary).toEqual(
      expect.objectContaining({
        total: 12,
        initialized: 12,
        pending: 0,
      }),
    );
    expect(after.domains.gateway.metrics.channels).toBe(2);
    expect(after.domains.execution.metrics.decisionPipelineReady).toBe(true);
    expect(after.domains.sessions.metrics.sendReady).toBe(true);
    expect(after.domains.memory.metrics.artifacts).toBe(1);
    expect(after.domains.artifacts.metrics.total).toBe(1);
    expect(after.domains.platform.metrics.plugins).toBe(2);
    expect(after.domains.channels.metrics.remoteReady).toBe(1);
    expect(after.domains.nodes.metrics.online).toBe(1);
    expect(after.domains.transports.metrics.ready).toBe(1);
    expect(after.domains.security.metrics.neverDowngrade).toBe(true);
    expect(after.domains.ops.metrics.readySidecars).toBe(1);
    expect(after.domains.providers.metrics.currentProvider).toBe('openai');
  });
});
