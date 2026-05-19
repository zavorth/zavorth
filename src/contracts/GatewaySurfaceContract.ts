import type {
  MessageChannel,
  PlatformImplementationState,
  PlatformReadiness,
  PlatformTransport,
} from './PlatformContract.js';
import type {
  NaturalFirstRuntimeEntrypoint,
} from './NaturalFirstAgentRuntimeContract.js';

export const GATEWAY_SURFACE_CONTRACT_VERSION = 'checkpoint-37.1';

export type GatewaySurfaceTrustMode =
  | 'owner-trusted'
  | 'tenant-scoped'
  | 'allowlist'
  | 'public-readonly'
  | 'disabled';

export type GatewaySurfaceRoleGrant =
  | 'read'
  | 'send'
  | 'approve'
  | 'mutate'
  | 'admin';

export type GatewaySurfaceRoleDescriptor = {
  id: string;
  label: string;
  grants: GatewaySurfaceRoleGrant[];
};

export type GatewaySurfaceCallbackKind =
  | 'command'
  | 'approval'
  | 'session'
  | 'delivery'
  | 'health'
  | 'webhook';

export type GatewaySurfaceCallbackTransport =
  | 'telegram-callback'
  | 'http'
  | 'websocket'
  | 'polling'
  | 'internal';

export type GatewaySurfaceBoundaryEnforcement =
  | 'none'
  | 'permission'
  | 'trust'
  | 'permission+trust'
  | 'read-only';

export type GatewaySurfaceCallbackContract = {
  kind: GatewaySurfaceCallbackKind;
  transport: GatewaySurfaceCallbackTransport;
  payloadShape: string;
  acknowledgement: 'sync' | 'async' | 'deferred';
  idempotencyKey: string | null;
  permissionBoundary: GatewaySurfaceBoundaryEnforcement;
};

export type GatewaySurfaceMutationKind =
  | 'task-dispatch'
  | 'approval-decision'
  | 'session-send'
  | 'session-spawn'
  | 'settings-write'
  | 'broadcast';

export type GatewaySurfaceMutationPolicy = {
  kind: GatewaySurfaceMutationKind;
  minRole: string;
  enforcement: GatewaySurfaceBoundaryEnforcement;
  auditEvent: string;
};

export type GatewaySurfaceCapabilityMatrix = {
  inbound: boolean;
  outbound: boolean;
  approvals: boolean;
  sessions: boolean;
  sessionSend: boolean;
  attachments: boolean;
  groupPolicy: boolean;
  realtime: boolean;
  degradedWithoutCredential: boolean;
};

export type GatewaySurfaceNaturalFirstIngressPolicy = {
  contractVersion: 'natural-first-agent-runtime/1';
  freeTextEntrypoint: NaturalFirstRuntimeEntrypoint;
  slashEntrypoint: NaturalFirstRuntimeEntrypoint;
  operatorCommandEntrypoint: NaturalFirstRuntimeEntrypoint;
  gatewayRequiredForFreeText: boolean;
  commandShortcutAllowed: boolean;
  llmDirectEntryAllowed: false;
  sourceFiles: string[];
};

export type GatewaySurfaceDescriptor = {
  contractVersion: typeof GATEWAY_SURFACE_CONTRACT_VERSION;
  id: string;
  label: string;
  channel: MessageChannel;
  readiness: PlatformReadiness;
  implementationState: PlatformImplementationState;
  transport: PlatformTransport;
  configured: boolean;
  identity: {
    linkedBy: string;
    verificationMethod: string;
  };
  trust: {
    mode: GatewaySurfaceTrustMode;
    failOpen: boolean;
    roles: GatewaySurfaceRoleDescriptor[];
  };
  callbacks: GatewaySurfaceCallbackContract[];
  securityBoundary: {
    authRequired: boolean;
    credentialMode: 'required' | 'optional' | 'none';
    credentialAbsentBehavior: 'disabled' | 'read-only' | 'local-only';
    mutations: GatewaySurfaceMutationPolicy[];
  };
  capabilities: GatewaySurfaceCapabilityMatrix;
  naturalFirstIngress: GatewaySurfaceNaturalFirstIngressPolicy;
  degradedMode: {
    supported: boolean;
    summary: string;
  };
  docs: {
    operatorGuide: string;
    setupCommand: string | null;
  };
};

export type GatewaySurfaceConformanceStatus = 'passed' | 'warning' | 'failed';

export type GatewaySurfaceConformanceFinding = {
  requirementId: string;
  status: GatewaySurfaceConformanceStatus;
  message: string;
};

export type GatewaySurfaceConformanceReport = {
  descriptorId: string;
  label: string;
  generatedAt: string;
  ok: boolean;
  status: GatewaySurfaceConformanceStatus;
  findings: GatewaySurfaceConformanceFinding[];
  capabilityMatrix: GatewaySurfaceCapabilityMatrix;
};

export type GatewaySurfaceCapabilityMatrixEntry = {
  id: string;
  label: string;
  channel: MessageChannel;
  readiness: PlatformReadiness;
  implementationState: PlatformImplementationState;
  transport: PlatformTransport;
  configured: boolean;
  capabilities: GatewaySurfaceCapabilityMatrix;
};
