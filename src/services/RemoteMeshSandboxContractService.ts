import type {
  EphemeralSandboxSession,
  RemoteAction,
  RemoteActionPolicyDecision,
  RemoteExecutionReceipt,
  RemoteMeshApprovalMode,
  RemoteMeshJson,
  RemoteMeshRiskTier,
  RemoteMeshSandboxContractSnapshot,
  RemoteMeshSideEffect,
  RemoteMeshTransportKind,
  RemoteNode,
  RemoteNotebookTool,
} from '../contracts/RemoteMeshSandboxContract.js';
import { ZAVORTH_REMOTE_MESH_SANDBOX_R1_CONTRACT_VERSION } from '../contracts/RemoteMeshSandboxContract.js';

type RemoteMeshSandboxContractRuntime = {
  now?: () => Date;
};

type BuildActionInput = {
  id: string;
  traceId?: string;
  requestedBy?: RemoteAction['requestedBy'];
  naturalLanguageIntent: string;
  targetNodeId: string;
  toolId: string;
  params?: Record<string, RemoteMeshJson>;
  timeoutMs?: number;
};

type BuildSessionInput = {
  id: string;
  nodeId: string;
  actionId?: string | null;
  ttlMs?: number;
  baseImageRef?: string;
  maxMemoryMb?: number;
  guiAllowed?: boolean;
  wakeLockAllowed?: boolean;
};

const DANGEROUS_PARAM_PATTERNS = [
  /rm\s+-rf/i,
  /\bsudo\b/i,
  /\bmkfs\b/i,
  /\bdd\s+if=/i,
  /curl\s+[^|]+\|\s*(?:bash|sh)/i,
  /\bchmod\s+-R\s+777\b/i,
  /:\s*\(\)\s*\{\s*:\s*\|\s*:\s*&\s*\}/,
];

export class RemoteMeshSandboxContractService {
  private readonly now: () => Date;

  constructor(runtime: RemoteMeshSandboxContractRuntime = {}) {
    this.now = runtime.now || (() => new Date());
  }

  public buildSnapshot(): RemoteMeshSandboxContractSnapshot {
    const nodes = this.buildDefaultNodes();
    const tools = this.buildDefaultTools();
    const sampleActions = [
      this.buildAction({
        id: 'remote-action:logs:sample',
        naturalLanguageIntent: 'Show the last 120 lines from the main project container.',
        targetNodeId: 'remote-node:notebook:primary',
        toolId: 'notebook.docker.logs',
        params: { project: 'zavorth', lines: 120 },
      }),
      this.buildAction({
        id: 'remote-action:start:sample',
        naturalLanguageIntent: 'Start the main project container and return logs.',
        targetNodeId: 'remote-node:notebook:primary',
        toolId: 'notebook.docker.start_project',
        params: { project: 'zavorth', returnLogs: true, lines: 120 },
      }),
      this.buildAction({
        id: 'remote-action:sandbox:sample',
        naturalLanguageIntent: 'Create a short-lived Python sandbox on the phone.',
        targetNodeId: 'remote-node:mobile:sandbox',
        toolId: 'mobile.sandbox.create',
        params: { profile: 'python-light', ttlMs: 900000 },
      }),
    ];
    const policyDecisions = sampleActions.map((action) => this.decideAction(action, { nodes, tools }));
    const sandboxSessions = [
      this.buildEphemeralSandboxSession({
        id: 'sandbox-session:sample-python-light',
        nodeId: 'remote-node:mobile:sandbox',
        actionId: sampleActions[2]?.id || null,
      }),
    ];
    const receipts = [
      ...policyDecisions.map((decision) => this.buildReceipt({
        decision,
        action: sampleActions.find((action) => action.id === decision.actionId) || null,
        session: null,
        nodes,
      })),
      this.buildReceipt({
        decision: null,
        action: sampleActions[2] || null,
        session: sandboxSessions[0] || null,
        nodes,
      }),
    ];

    return {
      generatedAt: this.now().toISOString(),
      contractVersion: ZAVORTH_REMOTE_MESH_SANDBOX_R1_CONTRACT_VERSION,
      phase: 'R1',
      status: this.hasUnsafeTool(tools) ? 'attention' : 'contract-ready',
      summary: {
        nodes: nodes.length,
        tools: tools.length,
        sampleActions: sampleActions.length,
        policyDecisions: policyDecisions.length,
        sandboxSessions: sandboxSessions.length,
        receipts: receipts.length,
        remoteExecutionPerformed: false,
        freeformShellAllowed: false,
        unauthenticatedMcpAllowed: false,
        secretValuesSerialized: false,
      },
      nodes,
      tools,
      sampleActions,
      policyDecisions,
      sandboxSessions,
      receipts,
      commands: {
        check: 'npm run remote-mesh:sandbox:contracts --silent',
        focusedTests: 'npx jest tests/services/RemoteMeshSandboxContractService.test.ts --runInBand',
        typecheck: 'npm run runtime:check --silent',
        nextAction: 'Remote policy engine and tool allowlist',
      },
    };
  }

  public buildDefaultNodes(): RemoteNode[] {
    return [
      {
        id: 'remote-node:mobile:command',
        label: 'Mobile command node',
        role: 'mobile-command-node',
        platform: 'android-termux',
        trust: 'operator-owned',
        transports: [
          {
            kind: 'tailscale',
            endpointLabel: 'mobile-tailnet-node',
            authenticated: true,
            scoped: true,
            exposedPorts: [],
            notes: ['Underlay only; not an authorization decision.'],
          },
        ],
        capabilities: ['chat-control', 'readiness-probe', 'sandbox-orchestration'],
        authorityBoundary: this.safeAuthorityBoundary(),
        evidence: ['R1 contract role for the phone as command/orchestration node.'],
      },
      {
        id: 'remote-node:notebook:primary',
        label: 'Primary notebook executor',
        role: 'primary-notebook-executor',
        platform: 'windows',
        trust: 'trusted',
        transports: [
          {
            kind: 'tailscale-ssh',
            endpointLabel: 'notebook:22',
            authenticated: true,
            scoped: true,
            exposedPorts: [22],
            notes: ['Operator-paired access; actions still require Zavorth policy decisions.'],
          },
          {
            kind: 'mcp-http',
            endpointLabel: 'notebook:mcp',
            authenticated: true,
            scoped: true,
            exposedPorts: [],
            notes: ['Tool API only; no generic shell capability.'],
          },
        ],
        capabilities: ['project-status', 'docker-project-control', 'git-status', 'project-file-read'],
        authorityBoundary: this.safeAuthorityBoundary(),
        evidence: ['R1 contract role for heavier notebook execution through scoped tools.'],
      },
      {
        id: 'remote-node:mobile:sandbox',
        label: 'Mobile ephemeral sandbox',
        role: 'ephemeral-mobile-sandbox',
        platform: 'android-termux',
        trust: 'paired',
        transports: [
          {
            kind: 'termux-proot',
            endpointLabel: 'termux:proot-distro',
            authenticated: true,
            scoped: true,
            exposedPorts: [],
            notes: ['Operational isolation only; not a strong security boundary.'],
          },
        ],
        capabilities: ['python-light', 'bash-light', 'git-light', 'node-light'],
        authorityBoundary: this.safeAuthorityBoundary(),
        evidence: ['R1 contract role for short-lived PRoot sessions on the mobile node.'],
      },
    ];
  }

  public buildDefaultTools(): RemoteNotebookTool[] {
    return [
      this.tool({
        id: 'notebook.status',
        displayName: 'Notebook status',
        transport: 'mcp-http',
        risk: 'level-0-readonly',
        sideEffects: ['none'],
        approval: 'not-required',
        parameters: [],
        commandTemplateId: null,
        mcpToolName: 'notebook.get_status',
        rollback: false,
        stdoutHashRequired: false,
      }),
      this.tool({
        id: 'notebook.docker.logs',
        displayName: 'Notebook Docker logs',
        transport: 'mcp-http',
        risk: 'level-0-readonly',
        sideEffects: ['filesystem-read'],
        approval: 'not-required',
        parameters: [
          { name: 'project', type: 'enum', required: true, description: 'Allowed project key.', allowedValues: ['zavorth', 'principal', 'estudos'] },
          { name: 'lines', type: 'number', required: false, description: 'Maximum log lines.', min: 1, max: 300 },
        ],
        commandTemplateId: 'notebook.docker.logs.v1',
        mcpToolName: 'notebook.docker.logs',
        rollback: false,
        stdoutHashRequired: true,
      }),
      this.tool({
        id: 'notebook.docker.start_project',
        displayName: 'Start notebook project container',
        transport: 'mcp-http',
        risk: 'level-1-reversible',
        sideEffects: ['container-start', 'process-start', 'network-call'],
        approval: 'not-required',
        parameters: [
          { name: 'project', type: 'enum', required: true, description: 'Allowed project key.', allowedValues: ['zavorth', 'principal', 'estudos'] },
          { name: 'returnLogs', type: 'boolean', required: false, description: 'Return bounded logs after startup.' },
          { name: 'lines', type: 'number', required: false, description: 'Maximum log lines.', min: 1, max: 300 },
        ],
        commandTemplateId: 'notebook.docker.start_project.v1',
        mcpToolName: 'notebook.docker.start_project',
        rollback: true,
        rollbackStrategy: 'notebook.docker.stop_project',
        stdoutHashRequired: true,
      }),
      this.tool({
        id: 'notebook.git.pull',
        displayName: 'Pull project repository',
        transport: 'mcp-http',
        risk: 'level-2-persistent',
        sideEffects: ['filesystem-write', 'network-call'],
        approval: 'explicit-approval',
        parameters: [
          { name: 'project', type: 'enum', required: true, description: 'Allowed project key.', allowedValues: ['zavorth', 'principal', 'estudos'] },
          { name: 'branch', type: 'string', required: false, description: 'Branch name to pull.' },
        ],
        commandTemplateId: 'notebook.git.pull.v1',
        mcpToolName: 'notebook.git.pull',
        rollback: false,
        stdoutHashRequired: true,
      }),
      this.tool({
        id: 'mobile.sandbox.create',
        displayName: 'Create mobile sandbox session',
        targetRole: 'ephemeral-mobile-sandbox',
        transport: 'termux-proot',
        risk: 'level-1-reversible',
        sideEffects: ['sandbox-create', 'process-start'],
        approval: 'conversation-preview',
        parameters: [
          { name: 'profile', type: 'enum', required: true, description: 'Sandbox profile.', allowedValues: ['python-light', 'node-light', 'bash-light'] },
          { name: 'ttlMs', type: 'number', required: false, description: 'Session time to live.', min: 60000, max: 3600000 },
        ],
        commandTemplateId: 'mobile.sandbox.create.v1',
        mcpToolName: null,
        rollback: true,
        rollbackStrategy: 'mobile.sandbox.destroy',
        stdoutHashRequired: false,
      }),
      this.tool({
        id: 'mobile.sandbox.destroy',
        displayName: 'Destroy mobile sandbox session',
        targetRole: 'ephemeral-mobile-sandbox',
        transport: 'termux-proot',
        risk: 'level-1-reversible',
        sideEffects: ['sandbox-destroy', 'process-stop'],
        approval: 'not-required',
        parameters: [
          { name: 'sessionId', type: 'string', required: true, description: 'Sandbox session id.' },
        ],
        commandTemplateId: 'mobile.sandbox.destroy.v1',
        mcpToolName: null,
        rollback: false,
        stdoutHashRequired: false,
      }),
    ];
  }

  public buildAction(input: BuildActionInput): RemoteAction {
    const tool = this.buildDefaultTools().find((candidate) => candidate.id === input.toolId);
    const risk = tool?.risk || 'level-4-prohibited';
    const approval = tool?.approval || 'blocked';
    const params = input.params || {};

    return {
      id: input.id,
      traceId: input.traceId || `${input.id}:trace`,
      requestedAt: this.now().toISOString(),
      requestedBy: input.requestedBy || 'operator',
      naturalLanguageIntent: input.naturalLanguageIntent,
      targetNodeId: input.targetNodeId,
      toolId: input.toolId,
      params: this.redactParams(params),
      risk,
      approval,
      expectedSideEffects: tool?.sideEffects || [],
      timeoutMs: input.timeoutMs || 120000,
      idempotencyKey: `${input.id}:${input.targetNodeId}:${input.toolId}`,
      preview: {
        humanSummary: this.buildHumanSummary(input.naturalLanguageIntent, input.toolId, params),
        commandTemplateId: tool?.commandTemplateId || null,
        rawCommand: null,
      },
    };
  }

  public decideAction(
    action: RemoteAction,
    catalog: {
      nodes?: RemoteNode[];
      tools?: RemoteNotebookTool[];
    } = {},
  ): RemoteActionPolicyDecision {
    const nodes = catalog.nodes || this.buildDefaultNodes();
    const tools = catalog.tools || this.buildDefaultTools();
    const node = nodes.find((candidate) => candidate.id === action.targetNodeId) || null;
    const tool = tools.find((candidate) => candidate.id === action.toolId) || null;
    const reasons: string[] = [];
    const blockedPatterns = this.findDangerousPatterns(action.params);

    if (!node) {
      reasons.push('Target node is unknown.');
    }

    if (!tool) {
      reasons.push('Requested tool is not in the R1 tool catalog.');
    }

    if (node && (node.trust === 'unpaired' || node.authorityBoundary.unauthenticatedMcpAllowed)) {
      reasons.push('Target node is not paired/trusted enough for remote execution.');
    }

    if (tool && (tool.freeformShellAllowed || tool.rawCommandAllowed || tool.sudoAllowed)) {
      reasons.push('Tool violates R1 authority boundaries.');
    }

    if (blockedPatterns.length > 0) {
      reasons.push('Action parameters contain dangerous shell-like patterns.');
    }

    let status: RemoteActionPolicyDecision['status'] = 'allowed';
    let approval: RemoteMeshApprovalMode = action.approval;
    let safeNextAction = 'Execute through the scoped adapter only after R2 policy engine wiring.';

    if (!node || !tool) {
      status = 'needs-clarification';
      approval = 'conversation-preview';
      safeNextAction = 'Ask the operator to choose a known node and a known scoped tool.';
    } else if (this.isProhibited(action.risk) || reasons.length > 0) {
      status = 'denied';
      approval = 'blocked';
      safeNextAction = 'Do not execute; replace the request with a scoped approved tool.';
    } else if (this.requiresApproval(action.risk, tool.approval)) {
      status = 'requires-approval';
      approval = tool.approval === 'not-required' ? 'explicit-approval' : tool.approval;
      safeNextAction = 'Show preview, target node, side effects, rollback notes, and ask for operator approval.';
    }

    return {
      id: `${action.id}:policy`,
      actionId: action.id,
      status,
      risk: action.risk,
      approval,
      reasons: reasons.length > 0 ? reasons : ['R1 contract decision created without executing the action.'],
      safeNextAction,
      sanitizedParams: this.redactParams(action.params),
      blockedPatterns,
      policy: {
        promptCannotExecuteShell: true,
        freeformShellDenied: true,
        unauthenticatedMcpDenied: true,
        sudoDenied: true,
        receiptRequired: true,
        rollbackRequiredWhenAvailable: true,
      },
    };
  }

  public buildEphemeralSandboxSession(input: BuildSessionInput): EphemeralSandboxSession {
    const ttlMs = Math.min(Math.max(input.ttlMs || 900000, 60000), 3600000);

    return {
      id: input.id,
      nodeId: input.nodeId,
      createdForActionId: input.actionId ?? null,
      status: 'planned',
      runtime: 'termux-proot',
      baseImageRef: input.baseImageRef || 'zavorth/proot/python-light:base',
      ttlMs,
      workspaceMount: {
        hostPathLabel: 'zavorth-managed-workspace',
        sandboxPath: '/workspace',
        readOnly: false,
        allowPersonalStorageAccess: false,
      },
      network: {
        enabled: false,
        allowedHosts: [],
      },
      resources: {
        maxMemoryMb: input.maxMemoryMb || 1024,
        maxRuntimeMs: ttlMs,
        guiAllowed: input.guiAllowed === true,
        wakeLockAllowed: input.wakeLockAllowed === true,
      },
      cleanup: {
        destroyOnCompletion: true,
        removeProcesses: true,
        removeTempFiles: true,
        releaseWakeLock: true,
        receiptRequired: true,
      },
      securityNotes: {
        prootIsSecurityBoundary: false,
        isolationStrength: 'operational-lightweight',
        untrustedInternetCodeAllowed: false,
      },
    };
  }

  public buildReceipt(input: {
    decision: RemoteActionPolicyDecision | null;
    action: RemoteAction | null;
    session: EphemeralSandboxSession | null;
    nodes?: RemoteNode[];
  }): RemoteExecutionReceipt {
    const decision = input.decision;
    const action = input.action;
    const session = input.session;
    const nodeId = session?.nodeId || action?.targetNodeId || 'remote-node:unknown';
    const toolId = action?.toolId || null;
    const adapter = this.resolveAdapter(toolId, session);
    const status = decision
      ? decision.status === 'allowed'
        ? 'allowed'
        : decision.status === 'requires-approval'
          ? 'approval-required'
          : decision.status === 'denied'
            ? 'blocked'
            : 'planned'
      : 'planned';

    return {
      id: `remote-receipt:${action?.id || session?.id || 'contract'}`,
      actionId: action?.id || null,
      decisionId: decision?.id || null,
      sessionId: session?.id || null,
      nodeId,
      toolId,
      adapter,
      status,
      generatedAt: this.now().toISOString(),
      approvedBy: decision?.status === 'allowed' ? 'policy' : 'not-approved',
      commandTemplateId: action?.preview.commandTemplateId || null,
      rawCommandSerialized: false,
      stdoutHash: null,
      stderrHash: null,
      paramsRedacted: this.redactParams(action?.params || {}),
      noSecretsSerialized: true,
      mutationPerformed: false,
      cleanupRequired: Boolean(session),
      cleanupCompleted: false,
    };
  }

  private tool(input: {
    id: string;
    displayName: string;
    targetRole?: RemoteNotebookTool['targetRole'];
    transport: RemoteMeshTransportKind;
    risk: RemoteMeshRiskTier;
    sideEffects: RemoteMeshSideEffect[];
    approval: RemoteMeshApprovalMode;
    parameters: RemoteNotebookTool['parameters'];
    commandTemplateId: string | null;
    mcpToolName: string | null;
    rollback: boolean;
    rollbackStrategy?: string;
    stdoutHashRequired: boolean;
  }): RemoteNotebookTool {
    return {
      id: input.id,
      displayName: input.displayName,
      targetRole: input.targetRole || 'primary-notebook-executor',
      transport: input.transport,
      risk: input.risk,
      sideEffects: input.sideEffects,
      approval: input.approval,
      parameters: input.parameters,
      commandTemplateId: input.commandTemplateId,
      mcpToolName: input.mcpToolName,
      freeformShellAllowed: false,
      rawCommandAllowed: false,
      sudoAllowed: false,
      rollback: {
        supported: input.rollback,
        strategy: input.rollbackStrategy || null,
      },
      audit: {
        receiptRequired: true,
        stdoutHashRequired: input.stdoutHashRequired,
        stderrHashRequired: input.stdoutHashRequired,
      },
    };
  }

  private safeAuthorityBoundary(): RemoteNode['authorityBoundary'] {
    return {
      dedicatedUserRequired: true,
      sudoAllowed: false,
      freeformShellAllowed: false,
      homeDirectoryWideAccessAllowed: false,
      unauthenticatedMcpAllowed: false,
    };
  }

  private buildHumanSummary(
    naturalLanguageIntent: string,
    toolId: string,
    params: Record<string, RemoteMeshJson>,
  ): string {
    const safeParams = Object.entries(this.redactParams(params))
      .map(([key, value]) => `${key}=${JSON.stringify(value)}`)
      .join(', ');
    return `${naturalLanguageIntent} Tool=${toolId}${safeParams ? ` Params=${safeParams}` : ''}.`;
  }

  private isProhibited(risk: RemoteMeshRiskTier): boolean {
    return risk === 'level-4-prohibited';
  }

  private requiresApproval(risk: RemoteMeshRiskTier, approval: RemoteMeshApprovalMode): boolean {
    return approval !== 'not-required'
      || risk === 'level-2-persistent'
      || risk === 'level-3-sensitive';
  }

  private findDangerousPatterns(params: Record<string, RemoteMeshJson>): string[] {
    const serialized = JSON.stringify(params);
    return DANGEROUS_PARAM_PATTERNS
      .filter((pattern) => pattern.test(serialized))
      .map((pattern) => pattern.source);
  }

  private redactParams(params: Record<string, RemoteMeshJson>): Record<string, RemoteMeshJson> {
    const redacted: Record<string, RemoteMeshJson> = {};
    for (const [key, value] of Object.entries(params)) {
      if (/token|secret|password|key/i.test(key)) {
        redacted[key] = '[redacted]';
        continue;
      }
      redacted[key] = this.redactJson(value);
    }
    return redacted;
  }

  private redactJson(value: RemoteMeshJson): RemoteMeshJson {
    if (typeof value === 'string') {
      return value
        .replace(/sk-[A-Za-z0-9_-]{12,}/g, 'sk-[redacted]')
        .replace(/xox[baprs]-[A-Za-z0-9-]{12,}/g, 'xox-[redacted]')
        .replace(/([?&](?:token|key|secret|password)=)[^&\s]+/gi, '$1[redacted]');
    }
    if (Array.isArray(value)) {
      return value.map((item) => this.redactJson(item));
    }
    if (value && typeof value === 'object') {
      const nested: Record<string, RemoteMeshJson> = {};
      for (const [key, nestedValue] of Object.entries(value)) {
        nested[key] = /token|secret|password|key/i.test(key) ? '[redacted]'
          : this.redactJson(nestedValue);
      }
      return nested;
    }
    return value;
  }

  private resolveAdapter(
    toolId: string | null,
    session: EphemeralSandboxSession | null,
  ): RemoteExecutionReceipt['adapter'] {
    if (session) {
      return 'termux-proot';
    }
    if (!toolId) {
      return 'policy-only';
    }
    const tool = this.buildDefaultTools().find((candidate) => candidate.id === toolId);
    return tool?.transport || 'policy-only';
  }

  private hasUnsafeTool(tools: RemoteNotebookTool[]): boolean {
    return tools.some((tool) => tool.freeformShellAllowed || tool.rawCommandAllowed || tool.sudoAllowed);
  }
}
