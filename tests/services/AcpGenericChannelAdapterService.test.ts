import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { AcpGenericChannelAdapterService } from '../../src/services/AcpGenericChannelAdapterService.js';
import { AcpGenericChannelAdapter } from '../../src/gateway/channels/adapters/AcpGenericChannelAdapter.js';
import { GatewayEventBus } from '../../src/gateway/events/GatewayEventBus.js';

const fixedNow = () => new Date('2026-05-31T12:00:00.000Z');

describe('AcpGenericChannelAdapterService', () => {
  let root: string;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-acp-generic-channel-'));
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('normalizes ACP-compatible messages into Zavorth-native inbound contracts', () => {
    const service = createService(root);
    const receipt = service.ingest({
      kind: 'message',
      id: 'frame-1',
      idempotencyKey: 'idem-1',
      runtimeId: 'external-runtime',
      sessionId: 'source-session',
      actor: { id: 'operator', role: 'user' },
      payload: {
        text: 'route this through Zavorth',
        channel: 'api',
        workspace: root,
      },
      source: {
        runtimeName: 'Any ACP-compatible runtime',
        runtimeVersion: '1.0.0',
      },
    });

    expect(receipt.status).toBe('accepted');
    expect(receipt.adapter.protocolFamily).toBe('acp-compatible');
    expect(receipt.normalization.nativeContract).toBe('NormalizedInboundMessage');
    expect(receipt.normalization.reachesExecutor).toBe(true);
    expect(receipt.message).toEqual(expect.objectContaining({
      text: 'route this through Zavorth',
      sessionId: 'external:source-session',
      channel: 'api',
    }));
    expect(receipt.safety).toEqual(expect.objectContaining({
      sourceRuntimeAuthority: false,
      toolExecutionPerformed: false,
      diskMutationPerformed: false,
      gatewayNormalizationOnly: true,
    }));
    expect(JSON.stringify(receipt).toLowerCase()).not.toContain('openclaw');
    expect(fs.existsSync(path.join(root, 'data/runtime/acp-generic-channel-adapter-last.json'))).toBe(true);
  });

  it('turns unsafe ACP tool requests into approval receipts without dispatching them', () => {
    const service = createService(root);
    const receipt = service.ingest({
      kind: 'tool_request',
      id: 'tool-frame-1',
      idempotencyKey: 'tool-idem-1',
      sessionId: 'tool-session',
      tool: {
        name: 'Write',
        arguments: {
          file: 'src/app.ts',
          content: 'API_KEY=super-secret-value',
        },
      },
      payload: {
        text: 'please write a file',
        requestedTools: ['Write'],
      },
    });

    expect(receipt.status).toBe('approval_required');
    expect(receipt.message).toBeNull();
    expect(receipt.normalization.reachesExecutor).toBe(false);
    expect(receipt.approvals).toHaveLength(1);
    expect(receipt.approvals[0]).toEqual(expect.objectContaining({
      title: 'ACP tool request: Write',
      status: 'pending',
      action: expect.objectContaining({
        requestedToolNames: ['Write'],
      }),
    }));
    expect(receipt.toolPolicy?.summary.approvalRequired).toBe(1);
    expect(JSON.stringify(receipt)).not.toContain('super-secret-value');
  });

  it('deduplicates idempotency keys before reaching the gateway or executor', () => {
    const service = createService(root);
    const first = service.ingest({
      kind: 'message',
      id: 'frame-dup-a',
      idempotencyKey: 'same-key',
      sessionId: 's1',
      payload: { text: 'first' },
    });
    const second = service.ingest({
      kind: 'message',
      id: 'frame-dup-b',
      idempotencyKey: 'same-key',
      sessionId: 's1',
      payload: { text: 'second' },
    });

    expect(first.status).toBe('accepted');
    expect(second.status).toBe('duplicate');
    expect(second.normalization.duplicateOf).toBe(first.id);
    expect(second.normalization.reachesExecutor).toBe(false);
    expect(service.buildSnapshot().summary.duplicates).toBe(1);
  });

  it('records handshakes as Zavorth trust evidence and downgrades oversized scopes', () => {
    const service = createService(root);
    const receipt = service.ingest({
      kind: 'handshake',
      id: 'handshake-1',
      runtimeId: 'runtime-1',
      sessionId: 's1',
      handshake: {
        clientId: 'client-1',
        role: 'node',
        scopes: ['gateway:read', 'tools:execute', 'files:write'],
        tokenPresent: true,
      },
      source: {
        runtimeName: 'ACP host',
        paths: ['src/gateway/protocol/index.ts'],
      },
    });

    expect(receipt.status).toBe('diagnostic');
    expect(receipt.handshake?.trust).toEqual(expect.objectContaining({
      authority: 'zavorth',
      sourceTokenAuthority: false,
      tokenEvidence: 'present-redacted',
      downgradedScopes: ['tools:execute', 'files:write'],
    }));
    expect(receipt.normalization.reachesExecutor).toBe(false);
  });

  it('can be mounted as a gateway channel adapter and emit canonical gateway events', async () => {
    const service = createService(root);
    const eventBus = new GatewayEventBus();
    const events: unknown[] = [];
    const wsEvents: unknown[] = [];
    eventBus.subscribe('acp_generic_channel_frame', (event) => {
      events.push(event);
    });
    eventBus.subscribe('public_ws', (event) => {
      wsEvents.push(event);
    });
    const adapter = new AcpGenericChannelAdapter(eventBus, service);

    await adapter.initialize();
    await adapter.onMessageReceived({
      kind: 'message',
      id: 'gateway-frame-1',
      sessionId: 'gateway-session',
      payload: { text: 'hello gateway' },
    });

    expect(events).toHaveLength(2);
    expect(events[1]).toEqual(expect.objectContaining({
      type: 'acp_generic_channel_frame',
      channelId: 'acp-generic',
      status: 'accepted',
      sessionId: 'gateway-session',
      reachesExecutor: true,
    }));
    expect(adapter.getLastReceipt()).toEqual(expect.objectContaining({
      status: 'accepted',
    }));
    expect(wsEvents).toEqual([
      expect.objectContaining({
        type: 'public_ws',
        payload: expect.objectContaining({
          type: 'event',
          payload: expect.objectContaining({
            topic: 'im_message',
            data: expect.objectContaining({
              normalizedInboundMessage: expect.objectContaining({
                text: 'hello gateway',
                sessionId: 'external:gateway-session',
              }),
            }),
          }),
        }),
      }),
    ]);
  });
});

function createService(root: string): AcpGenericChannelAdapterService {
  return new AcpGenericChannelAdapterService({
    now: fixedNow,
    projectRoot: root,
  });
}
