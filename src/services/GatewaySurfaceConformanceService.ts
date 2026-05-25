import {
  GATEWAY_SURFACE_CONTRACT_VERSION,
  type GatewaySurfaceCallbackContract,
  type GatewaySurfaceCapabilityMatrixEntry,
  type GatewaySurfaceConformanceFinding,
  type GatewaySurfaceConformanceReport,
  type GatewaySurfaceConformanceStatus,
  type GatewaySurfaceDescriptor,
  type GatewaySurfaceMutationPolicy,
} from '../contracts/GatewaySurfaceContract.js';

type GatewaySurfaceConformanceRuntime = {
  now?: () => Date;
};

export class GatewaySurfaceConformanceService {
  private readonly now: () => Date;

  constructor(runtime: GatewaySurfaceConformanceRuntime = {}) {
    this.now = runtime.now || (() => new Date());
  }

  public evaluate(descriptor: GatewaySurfaceDescriptor): GatewaySurfaceConformanceReport {
    const findings: GatewaySurfaceConformanceFinding[] = [];

    this.checkIdentity(descriptor, findings);
    this.checkRoles(descriptor, findings);
    this.checkCallbacks(descriptor.callbacks, findings);
    this.checkSecurityBoundary(descriptor, findings);
    this.checkNaturalFirstIngress(descriptor, findings);
    this.checkDegradedMode(descriptor, findings);

    const failed = findings.some((finding) => finding.status === 'failed');
    const warning = findings.some((finding) => finding.status === 'warning');
    const status: GatewaySurfaceConformanceStatus = failed ? 'failed' : warning ? 'warning' : 'passed';

    return {
      descriptorId: descriptor.id,
      label: descriptor.label,
      generatedAt: this.now().toISOString(),
      ok: !failed,
      status,
      findings,
      capabilityMatrix: descriptor.capabilities,
    };
  }

  public evaluateAll(descriptors: GatewaySurfaceDescriptor[]): GatewaySurfaceConformanceReport[] {
    return descriptors.map((descriptor) => this.evaluate(descriptor));
  }

  public buildCapabilityMatrix(descriptors: GatewaySurfaceDescriptor[]): GatewaySurfaceCapabilityMatrixEntry[] {
    return descriptors.map((descriptor) => ({
      id: descriptor.id,
      label: descriptor.label,
      channel: descriptor.channel,
      readiness: descriptor.readiness,
      implementationState: descriptor.implementationState,
      transport: descriptor.transport,
      configured: descriptor.configured,
      capabilities: descriptor.capabilities,
    }));
  }

  private checkIdentity(
    descriptor: GatewaySurfaceDescriptor,
    findings: GatewaySurfaceConformanceFinding[],
  ): void {
    if (descriptor.contractVersion !== GATEWAY_SURFACE_CONTRACT_VERSION) {
      findings.push(this.fail('contract-version', 'Versao do contrato de gateway surface divergente.'));
    }
    if (!this.text(descriptor.id) || !this.text(descriptor.label) || !this.text(descriptor.channel)) {
      findings.push(this.fail('identity-required', 'Gateway precisa declarar id, label e channel.'));
    }
    if (!this.text(descriptor.identity.linkedBy) || !this.text(descriptor.identity.verificationMethod)) {
      findings.push(this.fail('identity-hints', 'Gateway precisa declarar linkedBy e verificationMethod.'));
    }
  }

  private checkRoles(
    descriptor: GatewaySurfaceDescriptor,
    findings: GatewaySurfaceConformanceFinding[],
  ): void {
    const roles = descriptor.trust.roles || [];
    if (roles.length === 0) {
      findings.push(this.fail('roles-required', 'Gateway precisa declarar roles minimas.'));
      return;
    }

    if (!roles.some((role) => role.grants.includes('read'))) {
      findings.push(this.fail('roles-read', 'Pelo menos uma role precisa permitir leitura.'));
    }

    const hasMutableCapability =
      descriptor.capabilities.inbound
      || descriptor.capabilities.outbound
      || descriptor.capabilities.approvals
      || descriptor.capabilities.sessionSend;
    if (
      hasMutableCapability
      && !roles.some((role) => role.grants.some((grant) => ['send', 'approve', 'mutate', 'admin'].includes(grant)))
    ) {
      findings.push(this.fail('roles-mutation', 'Gateway mutavel precisa declarar role com grant de envio/aprovacao/mutacao.'));
    }
  }

  private checkCallbacks(
    callbacks: GatewaySurfaceCallbackContract[],
    findings: GatewaySurfaceConformanceFinding[],
  ): void {
    if (callbacks.length === 0) {
      findings.push(this.fail('callbacks-required', 'Gateway precisa declarar callbacks ou health endpoint.'));
      return;
    }

    for (const callback of callbacks) {
      const label = `${callback.kind}:${callback.transport}`;
      if (!this.text(callback.payloadShape)) {
        findings.push(this.fail('callback-payload', `Callback ${label} nao declara payloadShape.`));
      }
      if (this.isMutatingCallback(callback) && callback.permissionBoundary === 'none') {
        findings.push(this.fail('callback-boundary', `Callback mutavel ${label} nao pode bypassar permission/trust plane.`));
      }
      if (this.isMutatingCallback(callback) && !this.text(callback.idempotencyKey)) {
        findings.push(this.warn('callback-idempotency', `Callback mutavel ${label} deveria declarar idempotencyKey.`));
      }
    }
  }

  private checkSecurityBoundary(
    descriptor: GatewaySurfaceDescriptor,
    findings: GatewaySurfaceConformanceFinding[],
  ): void {
    if (descriptor.trust.failOpen) {
      findings.push(this.fail('trust-fail-open', 'Gateway nao pode ser fail-open por padrao.'));
    }

    const mutatingCapability =
      descriptor.capabilities.inbound
      || descriptor.capabilities.approvals
      || descriptor.capabilities.sessionSend
      || descriptor.capabilities.outbound;
    if (mutatingCapability && descriptor.securityBoundary.mutations.length === 0) {
      findings.push(this.fail('mutation-policies-required', 'Gateway mutavel precisa declarar politicas de mutacao.'));
    }

    for (const mutation of descriptor.securityBoundary.mutations) {
      this.checkMutationPolicy(mutation, findings);
    }
  }

  private checkNaturalFirstIngress(
    descriptor: GatewaySurfaceDescriptor,
    findings: GatewaySurfaceConformanceFinding[],
  ): void {
    const policy = descriptor.naturalFirstIngress;
    if (!policy) {
      findings.push(this.fail('natural-first-ingress-required', 'Gateway precisa declarar politica Natural First para texto livre.'));
      return;
    }
    if (policy.contractVersion !== 'natural-first-agent-runtime/1') {
      findings.push(this.fail('natural-first-contract-version', 'Politica Natural First usa versao de contrato invalida.'));
    }
    if (policy.freeTextEntrypoint !== 'zavorth-agent-gateway' || !policy.gatewayRequiredForFreeText) {
      findings.push(this.fail('natural-first-free-text-gateway', 'Texto livre precisa entrar pelo ZavorthAgentGateway.'));
    }
    if (policy.slashEntrypoint !== 'command-router-shortcut') {
      findings.push(this.fail('natural-first-slash-shortcut', 'Slash command deve permanecer atalho do command router.'));
    }
    if (policy.operatorCommandEntrypoint !== 'command-router-shortcut' || !policy.commandShortcutAllowed) {
      findings.push(this.fail('natural-first-operator-shortcut', 'Comando operador explicito deve declarar atalho de command router.'));
    }
    if (policy.llmDirectEntryAllowed !== false) {
      findings.push(this.fail('natural-first-no-direct-llm', 'Superficie nao pode declarar LLM como entrada direta para texto livre.'));
    }
    if (!Array.isArray(policy.sourceFiles) || policy.sourceFiles.length === 0) {
      findings.push(this.warn('natural-first-source-files', 'Politica Natural First deveria apontar arquivos fonte da entrada real.'));
    }
  }

  private checkMutationPolicy(
    mutation: GatewaySurfaceMutationPolicy,
    findings: GatewaySurfaceConformanceFinding[],
  ): void {
    if (!this.text(mutation.minRole) || !this.text(mutation.auditEvent)) {
      findings.push(this.fail('mutation-policy-shape', `Mutacao ${mutation.kind} precisa declarar minRole e auditEvent.`));
    }
    if (mutation.enforcement === 'none') {
      findings.push(this.fail('mutation-policy-boundary', `Mutacao ${mutation.kind} nao pode usar enforcement none.`));
    }
  }

  private checkDegradedMode(
    descriptor: GatewaySurfaceDescriptor,
    findings: GatewaySurfaceConformanceFinding[],
  ): void {
    if (
      descriptor.securityBoundary.credentialMode !== 'none'
      && !['disabled', 'read-only', 'local-only'].includes(descriptor.securityBoundary.credentialAbsentBehavior)
    ) {
      findings.push(this.fail('credential-degradation', 'Ausencia de credencial precisa degradar sem fail-open.'));
    }

    if (!descriptor.configured && !descriptor.degradedMode.supported) {
      findings.push(this.fail('degraded-mode-required', 'Gateway sem credencial ativa precisa declarar degradedMode.'));
    }
  }

  private isMutatingCallback(callback: GatewaySurfaceCallbackContract): boolean {
    return ['command', 'approval', 'session', 'webhook'].includes(callback.kind);
  }

  private fail(requirementId: string, message: string): GatewaySurfaceConformanceFinding {
    return { requirementId, status: 'failed', message };
  }

  private warn(requirementId: string, message: string): GatewaySurfaceConformanceFinding {
    return { requirementId, status: 'warning', message };
  }

  private text(value: unknown): string {
    return String(value || '').trim();
  }
}

export function buildDefaultGatewaySurfaceDescriptors(): GatewaySurfaceDescriptor[] {
  return [
    buildTelegramGatewaySurfaceDescriptor(),
    buildWebGatewaySurfaceDescriptor(),
    buildCliGatewaySurfaceDescriptor(),
    buildApiGatewaySurfaceDescriptor(),
  ];
}

export function buildTelegramGatewaySurfaceDescriptor(): GatewaySurfaceDescriptor {
  return {
    contractVersion: GATEWAY_SURFACE_CONTRACT_VERSION,
    id: 'telegram',
    label: 'Telegram Bot Gateway',
    channel: 'telegram',
    readiness: 'ready',
    implementationState: 'full',
    transport: 'native',
    configured: true,
    identity: {
      linkedBy: 'telegram:user_id/chat_id/thread_id',
      verificationMethod: 'bot token + channel policy identifiers',
    },
    trust: {
      mode: 'allowlist',
      failOpen: false,
      roles: [
        { id: 'owner', label: 'Owner', grants: ['read', 'send', 'approve', 'mutate', 'admin'] },
        { id: 'operator', label: 'Operator', grants: ['read', 'send', 'approve', 'mutate'] },
        { id: 'viewer', label: 'Viewer', grants: ['read'] },
      ],
    },
    callbacks: [
      {
        kind: 'command',
        transport: 'polling',
        payloadShape: 'Telegram message/update with command_type and command_args',
        acknowledgement: 'async',
        idempotencyKey: 'update_id',
        permissionBoundary: 'permission+trust',
      },
      {
        kind: 'approval',
        transport: 'telegram-callback',
        payloadShape: 'callback_query.data approval action and task/permission reference',
        acknowledgement: 'async',
        idempotencyKey: 'callback_query.id',
        permissionBoundary: 'permission+trust',
      },
      {
        kind: 'health',
        transport: 'internal',
        payloadShape: 'bot runtime status snapshot',
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
          auditEvent: 'telegram.task.dispatch',
        },
        {
          kind: 'approval-decision',
          minRole: 'operator',
          enforcement: 'permission+trust',
          auditEvent: 'telegram.approval.decision',
        },
        {
          kind: 'broadcast',
          minRole: 'owner',
          enforcement: 'trust',
          auditEvent: 'telegram.broadcast',
        },
      ],
    },
    capabilities: {
      inbound: true,
      outbound: true,
      approvals: true,
      sessions: true,
      sessionSend: true,
      attachments: true,
      groupPolicy: true,
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
      sourceFiles: [
        'src/telegram/bot-gateway/support/BotGatewayMessageProcessing.ts',
        'src/telegram/controllers/TelegramConversationController.ts',
      ],
    },
    degradedMode: {
      supported: true,
      summary: 'Sem bot token, a surface fica desabilitada e mantem contratos/documentacao disponiveis.',
    },
    docs: {
      operatorGuide: 'docs/channel-mesh.md',
      setupCommand: 'npm run setup:channels',
    },
  };
}

export function buildWebGatewaySurfaceDescriptor(): GatewaySurfaceDescriptor {
  return {
    contractVersion: GATEWAY_SURFACE_CONTRACT_VERSION,
    id: 'web-control',
    label: 'Web Dashboard Gateway',
    channel: 'web',
    readiness: 'ready',
    implementationState: 'full',
    transport: 'local',
    configured: true,
    identity: {
      linkedBy: 'web session id + runtime user id',
      verificationMethod: 'loopback/auth token + host identity when configured',
    },
    trust: {
      mode: 'owner-trusted',
      failOpen: false,
      roles: [
        { id: 'owner', label: 'Owner', grants: ['read', 'send', 'approve', 'mutate', 'admin'] },
        { id: 'operator', label: 'Operator', grants: ['read', 'send', 'approve', 'mutate'] },
        { id: 'viewer', label: 'Viewer', grants: ['read'] },
      ],
    },
    callbacks: [
      {
        kind: 'command',
        transport: 'http',
        payloadShape: 'POST /api/web/gateway/sessions/send body',
        acknowledgement: 'async',
        idempotencyKey: 'sessionId + clientRequestId',
        permissionBoundary: 'permission+trust',
      },
      {
        kind: 'session',
        transport: 'websocket',
        payloadShape: 'gateway control socket event',
        acknowledgement: 'async',
        idempotencyKey: 'eventId',
        permissionBoundary: 'permission+trust',
      },
      {
        kind: 'health',
        transport: 'http',
        payloadShape: 'GET /healthz and runtime manifest',
        acknowledgement: 'sync',
        idempotencyKey: null,
        permissionBoundary: 'read-only',
      },
    ],
    securityBoundary: {
      authRequired: true,
      credentialMode: 'optional',
      credentialAbsentBehavior: 'local-only',
      mutations: [
        {
          kind: 'task-dispatch',
          minRole: 'operator',
          enforcement: 'permission+trust',
          auditEvent: 'web.task.dispatch',
        },
        {
          kind: 'session-send',
          minRole: 'operator',
          enforcement: 'permission+trust',
          auditEvent: 'web.session.send',
        },
        {
          kind: 'settings-write',
          minRole: 'owner',
          enforcement: 'trust',
          auditEvent: 'web.settings.write',
        },
      ],
    },
    capabilities: {
      inbound: true,
      outbound: true,
      approvals: true,
      sessions: true,
      sessionSend: true,
      attachments: true,
      groupPolicy: false,
      realtime: true,
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
      sourceFiles: [
        'src/services/WebAppConversationService.ts',
        'src/domain/surface/presentation/web-app/WebAppRuntimeInteractionRouteService.ts',
        'assets/dashboard/scripts/runtime-bridge.js',
      ],
    },
    degradedMode: {
      supported: true,
      summary: 'Sem token remoto, a surface permanece local/loopback e nao vira acesso publico.',
    },
    docs: {
      operatorGuide: 'docs/web-dashboard.md',
      setupCommand: 'npm run ops:start',
    },
  };
}

export function buildCliGatewaySurfaceDescriptor(): GatewaySurfaceDescriptor {
  return {
    contractVersion: GATEWAY_SURFACE_CONTRACT_VERSION,
    id: 'cli',
    label: 'CLI Gateway',
    channel: 'cli',
    readiness: 'ready',
    implementationState: 'full',
    transport: 'local',
    configured: true,
    identity: {
      linkedBy: 'local operator account + workspace cwd',
      verificationMethod: 'local process identity + explicit command invocation',
    },
    trust: {
      mode: 'owner-trusted',
      failOpen: false,
      roles: [
        { id: 'owner', label: 'Owner', grants: ['read', 'send', 'approve', 'mutate', 'admin'] },
        { id: 'operator', label: 'Operator', grants: ['read', 'send', 'approve', 'mutate'] },
        { id: 'viewer', label: 'Viewer', grants: ['read'] },
      ],
    },
    callbacks: [
      {
        kind: 'command',
        transport: 'internal',
        payloadShape: 'zavorth chat/command argv normalized into UniversalAgentRequest',
        acknowledgement: 'sync',
        idempotencyKey: 'requestId',
        permissionBoundary: 'permission+trust',
      },
      {
        kind: 'approval',
        transport: 'internal',
        payloadShape: 'zavorth approve/reject command with approval id',
        acknowledgement: 'sync',
        idempotencyKey: 'approvalId + decision',
        permissionBoundary: 'permission+trust',
      },
      {
        kind: 'health',
        transport: 'internal',
        payloadShape: 'CLI runtime status snapshot',
        acknowledgement: 'sync',
        idempotencyKey: null,
        permissionBoundary: 'read-only',
      },
    ],
    securityBoundary: {
      authRequired: true,
      credentialMode: 'none',
      credentialAbsentBehavior: 'local-only',
      mutations: [
        {
          kind: 'task-dispatch',
          minRole: 'operator',
          enforcement: 'permission+trust',
          auditEvent: 'cli.task.dispatch',
        },
        {
          kind: 'approval-decision',
          minRole: 'operator',
          enforcement: 'permission+trust',
          auditEvent: 'cli.approval.decision',
        },
      ],
    },
    capabilities: {
      inbound: true,
      outbound: true,
      approvals: true,
      sessions: true,
      sessionSend: true,
      attachments: true,
      groupPolicy: false,
      realtime: false,
      degradedWithoutCredential: false,
    },
    naturalFirstIngress: {
      contractVersion: 'natural-first-agent-runtime/1',
      freeTextEntrypoint: 'zavorth-agent-gateway',
      slashEntrypoint: 'command-router-shortcut',
      operatorCommandEntrypoint: 'command-router-shortcut',
      gatewayRequiredForFreeText: true,
      commandShortcutAllowed: true,
      llmDirectEntryAllowed: false,
      sourceFiles: [
        'src/cli/ZavorthCliFlowHelpers.ts',
        'src/cli/ZavorthCliCommandHelpers.ts',
      ],
    },
    degradedMode: {
      supported: true,
      summary: 'CLI permanece local e nao aceita mutacao sem passar pelo command/gateway contract.',
    },
    docs: {
      operatorGuide: 'docs/gateway-cli.md',
      setupCommand: 'npm run cli:fast -- chat',
    },
  };
}

export function buildApiGatewaySurfaceDescriptor(): GatewaySurfaceDescriptor {
  return {
    contractVersion: GATEWAY_SURFACE_CONTRACT_VERSION,
    id: 'api',
    label: 'Nexus Agent API Gateway',
    channel: 'api',
    readiness: 'ready',
    implementationState: 'full',
    transport: 'local',
    configured: true,
    identity: {
      linkedBy: 'api key or loopback runtime identity + session header',
      verificationMethod: 'API key policy + local runtime auth when configured',
    },
    trust: {
      mode: 'tenant-scoped',
      failOpen: false,
      roles: [
        { id: 'owner', label: 'Owner', grants: ['read', 'send', 'approve', 'mutate', 'admin'] },
        { id: 'api-client', label: 'API Client', grants: ['read', 'send'] },
      ],
    },
    callbacks: [
      {
        kind: 'command',
        transport: 'http',
        payloadShape: 'POST /api/v2/nexus/execute body normalized into UniversalAgentRequest',
        acknowledgement: 'async',
        idempotencyKey: 'requestId or sessionId + body fingerprint',
        permissionBoundary: 'permission+trust',
      },
      {
        kind: 'session',
        transport: 'http',
        payloadShape: 'API session continuation envelope',
        acknowledgement: 'async',
        idempotencyKey: 'session header + request id',
        permissionBoundary: 'permission+trust',
      },
      {
        kind: 'health',
        transport: 'http',
        payloadShape: 'API health and model/runtime status',
        acknowledgement: 'sync',
        idempotencyKey: null,
        permissionBoundary: 'read-only',
      },
    ],
    securityBoundary: {
      authRequired: true,
      credentialMode: 'optional',
      credentialAbsentBehavior: 'local-only',
      mutations: [
        {
          kind: 'task-dispatch',
          minRole: 'api-client',
          enforcement: 'permission+trust',
          auditEvent: 'api.task.dispatch',
        },
        {
          kind: 'session-send',
          minRole: 'api-client',
          enforcement: 'permission+trust',
          auditEvent: 'api.session.send',
        },
      ],
    },
    capabilities: {
      inbound: true,
      outbound: true,
      approvals: false,
      sessions: true,
      sessionSend: true,
      attachments: true,
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
      sourceFiles: [
        'src/services/DashboardEchoRouteService.ts',
        'src/services/NexusFacadeService.ts',
        'src/runtime/agent/ZavorthAgentGateway.ts',
      ],
    },
    degradedMode: {
      supported: true,
      summary: 'Sem auth/API key exigida, a API permanece local-only ou rejeita mutacoes conforme politica.',
    },
    docs: {
      operatorGuide: 'docs/product-direction.md',
      setupCommand: null,
    },
  };
}
