import { ExternalAgentSidecarAdapter } from './ExternalAgentSidecarAdapter.js';
import type {
  ExternalAgentApprovalEnvelope,
  ExternalAgentArtifactEnvelope,
  ExternalAgentCapabilityDescriptor,
  ExternalAgentChannelDescriptor,
  ExternalAgentEventEnvelope,
  ExternalAgentSessionDescriptor,
} from './contracts.js';

const FIXTURE_NOW = '2026-04-27T16:00:00.000Z';

export const FIXTURE_EXTERNAL_AGENT_CAPABILITIES: ExternalAgentCapabilityDescriptor[] = [
  {
    id: 'workspace-reader',
    label: 'Workspace reader capability',
    kind: 'tool',
    summary: 'Read-only workspace inventory supplied by a sidecar runtime.',
    risk: 'safe',
    trustState: 'trusted',
    toolNames: ['read_file'],
    inventoryEvidence: {
      sourceRuntimeName: 'Fixture External Runtime',
      sourceCapabilityName: 'WorkspaceReader',
      rawKind: 'tool',
      observedAt: FIXTURE_NOW,
    },
  },
  {
    id: 'summary-helper',
    label: 'Summary helper capability',
    kind: 'skill',
    summary: 'Imported summarization helper that still requires confirmation.',
    risk: 'attention',
    trustState: 'safe',
    toolNames: ['external.summary'],
    requiresApproval: true,
    inventoryEvidence: {
      sourceRuntimeName: 'Fixture External Runtime',
      sourceCapabilityName: 'SummaryHelper',
      rawKind: 'skill',
      observedAt: FIXTURE_NOW,
    },
  },
  {
    id: 'remote-shell-draft',
    label: 'Remote shell draft capability',
    kind: 'tool',
    summary: 'Dangerous external draft kept quarantined until reviewed.',
    risk: 'danger',
    trustState: 'quarantined',
    toolNames: ['shell.exec'],
    inventoryEvidence: {
      sourceRuntimeName: 'Fixture External Runtime',
      sourceCapabilityName: 'RemoteShell',
      rawKind: 'worker-tool',
      observedAt: FIXTURE_NOW,
      notes: ['Quarantined fixture proves imported tools are not trusted by default.'],
    },
  },
];

const FIXTURE_CHANNELS: ExternalAgentChannelDescriptor[] = [
  {
    id: 'fixture-sidecar-inbox',
    label: 'Fixture sidecar inbox',
    channel: 'api',
    status: 'available',
    inbound: true,
    outbound: false,
    replyBoundary: 'zavorth-reply-port-only',
  },
];

const FIXTURE_SESSIONS: ExternalAgentSessionDescriptor[] = [
  {
    id: 'foreign-session-1',
    userId: 'external-user-1',
    channel: 'api',
    title: 'Foreign session fixture',
    workspace: 'C:/workspace/zavorth-fixture',
    lastEventAt: FIXTURE_NOW,
  },
];

const FIXTURE_EVENTS: ExternalAgentEventEnvelope[] = [
  {
    id: 'foreign-event-1',
    runtimeId: 'external-sidecar-fixture',
    sessionId: 'foreign-session-1',
    kind: 'message',
    occurredAt: FIXTURE_NOW,
    actor: {
      id: 'external-user-1',
      role: 'user',
    },
    payload: {
      text: 'summarize a session external usando o runtime Zavorth',
      channel: 'api',
      workspace: 'C:/workspace/zavorth-fixture',
      requestedTools: ['read_file', 'shell.exec'],
      rawType: 'fixture.message',
      data: {
        fixture: true,
      },
    },
    diagnostics: {
      sourceRuntimeName: 'Fixture External Runtime',
      sourceRuntimeVersion: 'fixture-0.1',
    },
  },
];

const FIXTURE_APPROVALS: ExternalAgentApprovalEnvelope[] = [
  {
    id: 'foreign-approval-1',
    runtimeId: 'external-sidecar-fixture',
    sessionId: 'foreign-session-1',
    eventId: 'foreign-event-1',
    requestedAt: FIXTURE_NOW,
    title: 'Confirm external shell request',
    reason: 'A dangerous external tool request must be re-approved by Zavorth policy.',
    risk: 'danger',
    status: 'pending',
    action: {
      kind: 'tool',
      label: 'Remote shell draft',
      requestedToolNames: ['shell.exec'],
    },
    diagnostics: {
      sourceRuntimeName: 'Fixture External Runtime',
      sourceRuntimeVersion: 'fixture-0.1',
    },
  },
];

const FIXTURE_ARTIFACTS: ExternalAgentArtifactEnvelope[] = [
  {
    id: 'foreign-artifact-1',
    runtimeId: 'external-sidecar-fixture',
    sessionId: 'foreign-session-1',
    eventId: 'foreign-event-1',
    createdAt: FIXTURE_NOW,
    title: 'External session handoff',
    kind: 'handoff',
    status: 'ready',
    summary: 'Fixture handoff proves artifact normalization without importing runtime files.',
    uri: null,
    diagnostics: {
      sourceRuntimeName: 'Fixture External Runtime',
      sourceRuntimeVersion: 'fixture-0.1',
    },
  },
];

export class FixtureExternalAgentAdapter extends ExternalAgentSidecarAdapter {
  constructor() {
    super({
      descriptor: {
        id: 'external-sidecar-fixture',
        label: 'External sidecar fixture',
        adapterKind: 'sidecar',
        runtimeKind: 'external-agent-runtime',
        transport: 'fixture',
        version: 'fixture-0.1',
        diagnostics: {
          sourceRuntimeName: 'Fixture External Runtime',
          sourceRuntimeVersion: 'fixture-0.1',
          notes: ['Fixture only; Plan 111 real runtime inventory starts later.'],
        },
      },
      capabilities: FIXTURE_EXTERNAL_AGENT_CAPABILITIES,
      channels: FIXTURE_CHANNELS,
      sessions: FIXTURE_SESSIONS,
      approvals: FIXTURE_APPROVALS,
      artifacts: FIXTURE_ARTIFACTS,
      testEvents: FIXTURE_EVENTS,
      now: () => new Date(FIXTURE_NOW),
    });
  }
}
