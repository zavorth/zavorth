import type {
  ExternalAgentApprovalEnvelope,
  ExternalAgentArtifactEnvelope,
  ExternalAgentCapabilityDescriptor,
  ExternalAgentChannelDescriptor,
  ExternalAgentEventEnvelope,
  ExternalAgentHealthSnapshot,
  ExternalAgentOutboundActionEnvelope,
  ExternalAgentSessionDescriptor,
} from '../contracts.js';
import type {
  QuarantinedExternalExecutorSidecarClient,
} from './QuarantinedExternalExecutorSidecarAdapter.js';

const FIXTURE_NOW = '2026-04-27T17:00:00.000Z';
const RUNTIME_ID = 'external-runtime:primary-sidecar';

const sourceDiagnostics = {
  sourceRuntimeName: 'ExternalExecutor',
  sourceRuntimeVersion: 'frozen-310d2db3124126331b412df68ddd9ca14556b728',
};

export class FixtureExternalExecutorSidecarClient implements QuarantinedExternalExecutorSidecarClient {
  public readonly dispatchedActions: ExternalAgentOutboundActionEnvelope[] = [];

  public async getHealth(): Promise<ExternalAgentHealthSnapshot> {
    return {
      runtimeId: RUNTIME_ID,
      status: 'ready',
      generatedAt: FIXTURE_NOW,
      capabilities: {
        total: 3,
        trusted: 1,
        safe: 1,
        quarantined: 1,
      },
      approvals: {
        total: 1,
        pending: 1,
      },
      artifacts: {
        total: 1,
        ready: 1,
      },
      channels: await this.listChannels(),
      diagnostics: sourceDiagnostics,
    };
  }

  public async listCapabilities(): Promise<ExternalAgentCapabilityDescriptor[]> {
    return [
      {
        id: 'source-channel-catalog',
        label: 'Source channel catalog',
        kind: 'channel',
        summary: 'Read-only channel catalog observed through the sidecar boundary.',
        risk: 'safe',
        trustState: 'trusted',
        toolNames: ['channels.list'],
        inventoryEvidence: {
          sourceRuntimeName: 'ExternalExecutor',
          sourceCapabilityName: 'channels.status',
          rawKind: 'gateway-method',
          observedAt: FIXTURE_NOW,
        },
      },
      {
        id: 'source-skill-catalog',
        label: 'Source skill catalog',
        kind: 'skill',
        summary: 'Skill list can be observed but execution remains policy-gated.',
        risk: 'attention',
        trustState: 'safe',
        toolNames: ['skills.list'],
        requiresApproval: true,
        inventoryEvidence: {
          sourceRuntimeName: 'ExternalExecutor',
          sourceCapabilityName: 'skills.list',
          rawKind: 'gateway-method',
          observedAt: FIXTURE_NOW,
        },
      },
      {
        id: 'source-tool-exec',
        label: 'Source tool execution',
        kind: 'tool',
        summary: 'Execution-capable source tool kept quarantined until Connector registry policy import.',
        risk: 'danger',
        trustState: 'quarantined',
        toolNames: ['shell.exec'],
        inventoryEvidence: {
          sourceRuntimeName: 'ExternalExecutor',
          sourceCapabilityName: 'exec',
          rawKind: 'tool',
          observedAt: FIXTURE_NOW,
        },
      },
    ];
  }

  public async listChannels(): Promise<ExternalAgentChannelDescriptor[]> {
    return [
      {
        id: 'external-channel:source-inbox',
        label: 'Source inbox',
        channel: 'api',
        status: 'available',
        inbound: true,
        outbound: false,
        replyBoundary: 'zavorth-reply-port-only',
      },
    ];
  }

  public async listSessions(): Promise<ExternalAgentSessionDescriptor[]> {
    return [
      {
        id: 'source-session-1',
        userId: 'source-user-1',
        channel: 'api',
        title: 'Source runtime session fixture',
        workspace: '<repo>',
        lastEventAt: FIXTURE_NOW,
      },
    ];
  }

  public async listApprovalEnvelopes(): Promise<ExternalAgentApprovalEnvelope[]> {
    return [
      {
        id: 'source-approval-1',
        runtimeId: RUNTIME_ID,
        sessionId: 'source-session-1',
        requestedAt: FIXTURE_NOW,
        title: 'Approve source skill catalog action',
        reason: 'Attention-level source action must pass Zavorth approval before dispatch.',
        risk: 'attention',
        status: 'pending',
        action: {
          kind: 'tool',
          label: 'Source skill catalog',
          requestedToolNames: ['skills.list'],
        },
        diagnostics: sourceDiagnostics,
      },
    ];
  }

  public async listArtifactEnvelopes(): Promise<ExternalAgentArtifactEnvelope[]> {
    return [
      {
        id: 'source-artifact-1',
        runtimeId: RUNTIME_ID,
        sessionId: 'source-session-1',
        createdAt: FIXTURE_NOW,
        title: 'Source health handoff',
        kind: 'handoff',
        status: 'ready',
        summary: 'Read-only sidecar health handoff fixture.',
        uri: null,
        diagnostics: sourceDiagnostics,
      },
    ];
  }

  public async pullEvents(): Promise<ExternalAgentEventEnvelope[]> {
    return [
      {
        id: 'source-event-1',
        runtimeId: RUNTIME_ID,
        sessionId: 'source-session-1',
        kind: 'message',
        occurredAt: FIXTURE_NOW,
        actor: {
          id: 'source-user-1',
          role: 'user',
        },
        payload: {
          text: 'check sidecar health through the Zavorth gateway',
          channel: 'api',
          requestedTools: ['channels.list'],
          rawType: 'gateway.chat.message',
          data: {
            fixture: true,
            attachments: [
              {
                id: 'source-image-1',
                kind: 'image',
                title: 'Source image fixture',
                mimeType: 'image/png',
                sizeBytes: 2048,
                uri: 'source://attachment/source-image-1',
              },
              {
                id: 'source-log-1',
                kind: 'file',
                title: 'Source log fixture',
                mimeType: 'text/plain',
                sizeBytes: 512,
                uri: 'source://attachment/source-log-1',
              },
            ],
          },
        },
        diagnostics: sourceDiagnostics,
      },
    ];
  }

  public async dispatchControlledOutboundAction(action: ExternalAgentOutboundActionEnvelope): Promise<{
    receiptId: string;
    label: string;
    data?: Record<string, unknown>;
  }> {
    this.dispatchedActions.push(action);
    return {
      receiptId: `receipt:${action.id}`,
      label: action.dryRun ? 'Dry-run outbound action accepted' : 'Outbound action accepted',
      data: {
        kind: action.kind,
        dryRun: action.dryRun,
      },
    };
  }
}
