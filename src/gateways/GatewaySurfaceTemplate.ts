import {
  GATEWAY_SURFACE_CONTRACT_VERSION,
  type GatewaySurfaceDescriptor,
  type GatewaySurfaceRoleDescriptor,
} from '../contracts/GatewaySurfaceContract.js';
import type { MessageChannel, PlatformTransport } from '../contracts/PlatformContract.js';

export type GatewaySurfaceTemplateInput = {
  id: string;
  label: string;
  channel: MessageChannel;
  transport?: PlatformTransport;
  setupCommand?: string | null;
  operatorGuide?: string;
  roles?: GatewaySurfaceRoleDescriptor[];
};

export function createGatewaySurfaceTemplate(input: GatewaySurfaceTemplateInput): GatewaySurfaceDescriptor {
  const defaultRoles: GatewaySurfaceRoleDescriptor[] = [
    { id: 'owner', label: 'Owner', grants: ['read', 'send', 'approve', 'mutate', 'admin'] },
    { id: 'operator', label: 'Operator', grants: ['read', 'send', 'approve', 'mutate'] },
    { id: 'viewer', label: 'Viewer', grants: ['read'] },
  ];
  const roles: GatewaySurfaceRoleDescriptor[] = input.roles && input.roles.length > 0
    ? input.roles
    : defaultRoles;

  return {
    contractVersion: GATEWAY_SURFACE_CONTRACT_VERSION,
    id: input.id,
    label: input.label,
    channel: input.channel,
    readiness: 'planned',
    implementationState: 'planned',
    transport: input.transport || 'planned',
    configured: false,
    identity: {
      linkedBy: `${input.channel}:external_identity`,
      verificationMethod: 'explicit credential check + channel policy',
    },
    trust: {
      mode: 'allowlist',
      failOpen: false,
      roles,
    },
    callbacks: [
      {
        kind: 'command',
        transport: 'internal',
        payloadShape: 'normalized surface command envelope',
        acknowledgement: 'async',
        idempotencyKey: 'surfaceEventId',
        permissionBoundary: 'permission+trust',
      },
      {
        kind: 'health',
        transport: 'internal',
        payloadShape: 'gateway status snapshot',
        acknowledgement: 'sync',
        idempotencyKey: null,
        permissionBoundary: 'read-only',
      },
    ],
    securityBoundary: {
      authRequired: true,
      credentialMode: 'required',
      credentialAbsentBehavior: 'disabled',
      mutations: [
        {
          kind: 'task-dispatch',
          minRole: 'operator',
          enforcement: 'permission+trust',
          auditEvent: `${input.id}.task.dispatch`,
        },
        {
          kind: 'approval-decision',
          minRole: 'operator',
          enforcement: 'permission+trust',
          auditEvent: `${input.id}.approval.decision`,
        },
      ],
    },
    capabilities: {
      inbound: true,
      outbound: true,
      approvals: true,
      sessions: true,
      sessionSend: true,
      attachments: false,
      groupPolicy: false,
      realtime: false,
      degradedWithoutCredential: true,
    },
    naturalFirstIngress: {
      contractVersion: 'natural-first-agent-runtime/1',
      freeTextEntrypoint: 'zavorth-agent-gateway',
      slashEntrypoint: 'command-router-shortcut',
      operatorCommandEntrypoint: 'command-router-shortcut',
      gatewayRequiredForFreeText: true,
      commandShortcutAllowed: true,
      llmDirectEntryAllowed: false,
      sourceFiles: ['src/gateways/GatewaySurfaceTemplate.ts'],
    },
    degradedMode: {
      supported: true,
      summary: 'Without a configured credential, the gateway remains disabled and does not accept mutations.',
    },
    docs: {
      operatorGuide: input.operatorGuide || 'docs/product-direction.md',
      setupCommand: input.setupCommand || null,
    },
  };
}
