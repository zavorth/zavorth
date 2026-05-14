import type {
  RemoteAction,
  RemoteExecutionReceipt,
  RemoteMeshApprovalMode,
  RemoteMeshJson,
  RemoteMeshRiskTier,
  RemoteMeshTransportKind,
  RemoteNode,
  RemoteNotebookTool,
  RemoteMeshToolParameter,
} from '../contracts/RemoteMeshSandboxContract.js';
import type {
  RemoteMeshCommandTemplate,
  RemoteMeshMcpBinding,
  RemoteMeshPolicyCatalog,
  RemoteMeshPolicyEvaluation,
  RemoteMeshPolicyEvaluationStatus,
  RemoteMeshPolicyRule,
  RemoteMeshPolicyViolation,
  RemoteMeshPolicyViolationCode,
  RemoteMeshSandboxPolicySnapshot,
} from '../contracts/RemoteMeshSandboxPolicyContract.js';
import { ZAVORTH_REMOTE_MESH_SANDBOX_R2_POLICY_VERSION } from '../contracts/RemoteMeshSandboxPolicyContract.js';
import { RemoteMeshSandboxContractService } from './RemoteMeshSandboxContractService.js';

type RemoteMeshSandboxPolicyRuntime = {
  now?: () => Date;
  contractService?: RemoteMeshSandboxContractService;
};

type PolicyContext = {
  nodes?: RemoteNode[];
  tools?: RemoteNotebookTool[];
  catalog?: RemoteMeshPolicyCatalog;
};

const RISK_RANK: Record<RemoteMeshRiskTier, number> = {
  'level-0-readonly': 0,
  'level-1-reversible': 1,
  'level-2-persistent': 2,
  'level-3-sensitive': 3,
  'level-4-prohibited': 4,
};

export class RemoteMeshSandboxPolicyService {
  private readonly now: () => Date;
  private readonly contracts: RemoteMeshSandboxContractService;

  constructor(runtime: RemoteMeshSandboxPolicyRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.contracts = runtime.contractService || new RemoteMeshSandboxContractService({ now: this.now });
  }

  public buildSnapshot(): RemoteMeshSandboxPolicySnapshot {
    const nodes = this.contracts.buildDefaultNodes();
    const tools = this.contracts.buildDefaultTools();
    const catalog = this.buildDefaultCatalog();
    const sampleActions = [
      this.contracts.buildAction({
        id: 'remote-policy:logs:allowed',
        naturalLanguageIntent: 'Show the last 120 lines from the Zavorth container.',
        targetNodeId: 'remote-node:notebook:primary',
        toolId: 'notebook.docker.logs',
        params: { project: 'zavorth', lines: 120 },
      }),
      this.contracts.buildAction({
        id: 'remote-policy:start:allowed',
        naturalLanguageIntent: 'Start the Zavorth project container and return logs.',
        targetNodeId: 'remote-node:notebook:primary',
        toolId: 'notebook.docker.start_project',
        params: { project: 'zavorth', returnLogs: true, lines: 120 },
      }),
      this.contracts.buildAction({
        id: 'remote-policy:pull:approval',
        naturalLanguageIntent: 'Pull main on the notebook.',
        targetNodeId: 'remote-node:notebook:primary',
        toolId: 'notebook.git.pull',
        params: { project: 'zavorth', branch: 'main' },
      }),
      this.contracts.buildAction({
        id: 'remote-policy:sandbox:approval',
        naturalLanguageIntent: 'Create a short-lived Python sandbox on the phone.',
        targetNodeId: 'remote-node:mobile:sandbox',
        toolId: 'mobile.sandbox.create',
        params: { profile: 'python-light', ttlMs: 900000 },
      }),
      this.contracts.buildAction({
        id: 'remote-policy:dangerous:denied',
        naturalLanguageIntent: 'Run arbitrary cleanup on the notebook.',
        targetNodeId: 'remote-node:notebook:primary',
        toolId: 'notebook.shell.run',
        params: { command: 'rm -rf ~/.ssh' },
      }),
    ];
    const evaluations = sampleActions.map((action) => this.evaluateAction(action, { nodes, tools, catalog }));
    const receipts = evaluations.map((evaluation) => evaluation.receipt);
    const denied = evaluations.filter((evaluation) => evaluation.status === 'denied').length;
    const needsClarification = evaluations.filter((evaluation) => evaluation.status === 'needs-clarification').length;

    return {
      generatedAt: this.now().toISOString(),
      contractVersion: ZAVORTH_REMOTE_MESH_SANDBOX_R2_POLICY_VERSION,
      phase: 'R2',
      status: this.catalogIsSafe(catalog) ? 'policy-ready' : 'blocked',
      summary: {
        nodes: nodes.length,
        tools: tools.length,
        rules: catalog.rules.length,
        commandTemplates: catalog.commandTemplates.length,
        mcpBindings: catalog.mcpBindings.length,
        evaluations: evaluations.length,
        allowed: evaluations.filter((evaluation) => evaluation.status === 'allowed').length,
        requiresApproval: evaluations.filter((evaluation) => evaluation.status === 'requires-approval').length,
        needsClarification,
        denied,
        receipts: receipts.length,
        remoteExecutionPerformed: false,
        freeformShellAllowed: false,
        rawCommandSerialized: false,
        unauthenticatedMcpAllowed: false,
        secretValuesSerialized: false,
      },
      nodes,
      tools,
      catalog,
      sampleActions,
      evaluations,
      receipts,
      commands: {
        check: 'npm run remote-mesh:sandbox:policy --silent',
        focusedTests: 'npx jest tests/services/RemoteMeshSandboxPolicyService.test.ts --runInBand',
        typecheck: 'npm run runtime:check --silent',
        nextPhase: 'R3 - Remote Adapter Dry-Run Bindings',
      },
    };
  }

  public buildDefaultCatalog(): RemoteMeshPolicyCatalog {
    const rules: RemoteMeshPolicyRule[] = [
      this.rule({
        toolId: 'notebook.status',
        targetRole: 'primary-notebook-executor',
        riskCeiling: 'level-0-readonly',
        approval: 'not-required',
        sideEffects: ['none'],
      }),
      this.rule({
        toolId: 'notebook.docker.logs',
        targetRole: 'primary-notebook-executor',
        riskCeiling: 'level-0-readonly',
        approval: 'not-required',
        sideEffects: ['filesystem-read'],
        commandTemplateRequired: true,
        mcpBindingRequired: true,
      }),
      this.rule({
        toolId: 'notebook.docker.start_project',
        targetRole: 'primary-notebook-executor',
        riskCeiling: 'level-1-reversible',
        approval: 'not-required',
        sideEffects: ['container-start', 'process-start', 'network-call'],
        commandTemplateRequired: true,
        mcpBindingRequired: true,
      }),
      this.rule({
        toolId: 'notebook.git.pull',
        targetRole: 'primary-notebook-executor',
        riskCeiling: 'level-2-persistent',
        approval: 'explicit-approval',
        sideEffects: ['filesystem-write', 'network-call'],
        commandTemplateRequired: true,
        mcpBindingRequired: true,
      }),
      this.rule({
        toolId: 'mobile.sandbox.create',
        targetRole: 'ephemeral-mobile-sandbox',
        allowedTransports: ['termux-proot'],
        allowedNodeTrust: ['paired', 'trusted', 'operator-owned'],
        riskCeiling: 'level-1-reversible',
        approval: 'conversation-preview',
        sideEffects: ['sandbox-create', 'process-start'],
        commandTemplateRequired: true,
        mcpBindingRequired: false,
      }),
      this.rule({
        toolId: 'mobile.sandbox.destroy',
        targetRole: 'ephemeral-mobile-sandbox',
        allowedTransports: ['termux-proot'],
        allowedNodeTrust: ['paired', 'trusted', 'operator-owned'],
        riskCeiling: 'level-1-reversible',
        approval: 'not-required',
        sideEffects: ['sandbox-destroy', 'process-stop'],
        commandTemplateRequired: true,
        mcpBindingRequired: false,
      }),
    ];

    return {
      rules,
      commandTemplates: [
        template('notebook.docker.logs.v1', 'notebook.docker.logs', 'mcp-tool', 'Read bounded Docker logs for {{project}} with max {{lines}} line(s).', ['project', 'lines']),
        template('notebook.docker.start_project.v1', 'notebook.docker.start_project', 'mcp-tool', 'Start allowed project {{project}} and optionally return bounded logs.', ['project', 'returnLogs', 'lines']),
        template('notebook.git.pull.v1', 'notebook.git.pull', 'mcp-tool', 'Pull branch {{branch}} for allowed project {{project}} after approval.', ['project', 'branch']),
        template('mobile.sandbox.create.v1', 'mobile.sandbox.create', 'termux-proot', 'Create {{profile}} sandbox with TTL {{ttlMs}} ms.', ['profile', 'ttlMs']),
        template('mobile.sandbox.destroy.v1', 'mobile.sandbox.destroy', 'termux-proot', 'Destroy sandbox session {{sessionId}} and collect cleanup receipt.', ['sessionId']),
      ],
      mcpBindings: [
        binding('notebook.status', 'notebook.get_status', []),
        binding('notebook.docker.logs', 'notebook.docker.logs', ['project:read', 'docker:logs']),
        binding('notebook.docker.start_project', 'notebook.docker.start_project', ['project:operate', 'docker:start', 'docker:logs']),
        binding('notebook.git.pull', 'notebook.git.pull', ['project:write', 'git:pull']),
      ],
      deniedToolPatterns: [
        'shell.run',
        'system.exec',
        'sudo.run',
        'docker.raw',
        'files.delete_anywhere',
      ],
      dangerousParamPatterns: [
        'rm\\s+-rf',
        '\\bsudo\\b',
        '\\bmkfs\\b',
        '\\bdd\\s+if=',
        'curl\\s+[^|]+\\|\\s*(?:bash|sh)',
        '\\bchmod\\s+-R\\s+777\\b',
        ':\\s*\\(\\)\\s*\\{\\s*:\\s*\\|\\s*:\\s*&\\s*\\}',
      ],
    };
  }

  public evaluateAction(
    action: RemoteAction,
    context: PolicyContext = {},
  ): RemoteMeshPolicyEvaluation {
    const nodes = context.nodes || this.contracts.buildDefaultNodes();
    const tools = context.tools || this.contracts.buildDefaultTools();
    const catalog = context.catalog || this.buildDefaultCatalog();
    const node = nodes.find((candidate) => candidate.id === action.targetNodeId) || null;
    const tool = tools.find((candidate) => candidate.id === action.toolId) || null;
    const rule = catalog.rules.find((candidate) => candidate.toolId === action.toolId) || null;
    const commandTemplate = tool?.commandTemplateId
      ? catalog.commandTemplates.find((candidate) => candidate.id === tool.commandTemplateId) || null
      : null;
    const mcpBinding = tool?.mcpToolName
      ? catalog.mcpBindings.find((candidate) => candidate.toolId === tool.id && candidate.mcpToolName === tool.mcpToolName) || null
      : null;
    const violations: RemoteMeshPolicyViolation[] = [];

    this.validateKnownSurfaces(action, node, tool, rule, catalog, violations);

    if (node && tool && rule) {
      this.validateNode(action, node, tool, rule, violations);
      this.validateTool(tool, rule, commandTemplate, mcpBinding, violations);
      this.validateParams(action, tool, rule, catalog, violations);
    }

    const blockerCount = violations.filter((violation) => violation.severity === 'blocker').length;
    const clarificationCount = violations.filter((violation) => violation.severity === 'clarification').length;
    const approvalCount = violations.filter((violation) => violation.severity === 'approval').length;
    const status: RemoteMeshPolicyEvaluationStatus = blockerCount > 0
      ? 'denied'
      : clarificationCount > 0
        ? 'needs-clarification'
        : approvalCount > 0 || this.requiresApproval(action, tool, rule)
          ? 'requires-approval'
          : 'allowed';
    const approval = this.resolveApproval(status, action, tool, rule);
    const sanitizedParams = this.redactParams(action.params);
    const preview = this.buildPreview(action, commandTemplate, sanitizedParams);
    const receipt = this.buildReceipt({
      action,
      status,
      approval,
      commandTemplateId: commandTemplate?.id || null,
      adapter: tool?.transport || null,
      sanitizedParams,
    });

    return {
      id: `${action.id}:r2-policy`,
      actionId: action.id,
      status,
      risk: action.risk,
      approval,
      targetNodeId: action.targetNodeId,
      toolId: action.toolId,
      effectiveTransport: tool?.transport || null,
      commandTemplateId: commandTemplate?.id || null,
      mcpToolName: mcpBinding?.mcpToolName || null,
      sanitizedParams,
      violations: this.withDefaultReason(violations, status),
      safeNextAction: this.safeNextAction(status),
      preview,
      receipt,
      policy: {
        promptCannotExecuteShell: true,
        schemaOnlyParameters: true,
        commandTemplatesOnly: true,
        scopedMcpToolsOnly: true,
        approvalBeforePersistentMutation: true,
        levelFourBlockedByDefault: true,
        noRemoteExecutionInPolicyEvaluation: true,
      },
    };
  }

  private validateKnownSurfaces(
    action: RemoteAction,
    node: RemoteNode | null,
    tool: RemoteNotebookTool | null,
    rule: RemoteMeshPolicyRule | null,
    catalog: RemoteMeshPolicyCatalog,
    violations: RemoteMeshPolicyViolation[],
  ): void {
    if (!node) {
      violations.push(violation('unknown-node', 'clarification', 'targetNodeId', 'Target node is not known by the remote mesh catalog.'));
    }

    if (!tool) {
      const deniedPattern = catalog.deniedToolPatterns.find((pattern) => action.toolId.includes(pattern));
      violations.push(violation(
        deniedPattern ? 'prohibited-action' : 'unknown-tool',
        deniedPattern ? 'blocker' : 'clarification',
        'toolId',
        deniedPattern
          ? `Tool ${action.toolId} matches denied tool pattern ${deniedPattern}.`
          : 'Requested tool is not known by the R2 allowlist.',
      ));
    }

    if (tool && !rule) {
      violations.push(violation('unknown-rule', 'blocker', 'toolId', `No policy rule exists for ${tool.id}.`));
    }
  }

  private validateNode(
    action: RemoteAction,
    node: RemoteNode,
    tool: RemoteNotebookTool,
    rule: RemoteMeshPolicyRule,
    violations: RemoteMeshPolicyViolation[],
  ): void {
    if (node.role !== rule.targetRole || tool.targetRole !== node.role) {
      violations.push(violation('node-role-mismatch', 'blocker', 'targetNodeId', `Tool ${action.toolId} cannot run on node role ${node.role}.`));
    }

    if (!rule.allowedNodeTrust.includes(node.trust)) {
      violations.push(violation('node-trust-not-allowed', 'blocker', 'targetNodeId', `Node trust ${node.trust} is not allowed for ${tool.id}.`));
    }

    if (!rule.allowedTransports.includes(tool.transport)) {
      violations.push(violation('transport-not-allowed', 'blocker', 'toolId', `Transport ${tool.transport} is not allowed for ${tool.id}.`));
    }

    const nodeTransport = node.transports.find((transport) => transport.kind === tool.transport);
    if (!nodeTransport || !nodeTransport.authenticated || !nodeTransport.scoped) {
      violations.push(violation('transport-not-authenticated', 'blocker', 'targetNodeId', `Node transport ${tool.transport} is not authenticated and scoped.`));
    }
  }

  private validateTool(
    tool: RemoteNotebookTool,
    rule: RemoteMeshPolicyRule,
    commandTemplate: RemoteMeshCommandTemplate | null,
    mcpBinding: RemoteMeshMcpBinding | null,
    violations: RemoteMeshPolicyViolation[],
  ): void {
    if (tool.freeformShellAllowed || tool.rawCommandAllowed || tool.sudoAllowed) {
      violations.push(violation('unsafe-tool-authority', 'blocker', 'toolId', `${tool.id} exposes unsafe authority.`));
    }

    if (RISK_RANK[tool.risk] > RISK_RANK[rule.riskCeiling]) {
      violations.push(violation('risk-above-rule', 'blocker', 'risk', `${tool.id} risk ${tool.risk} exceeds rule ceiling ${rule.riskCeiling}.`));
    }

    for (const sideEffect of tool.sideEffects) {
      if (!rule.allowedSideEffects.includes(sideEffect)) {
        violations.push(violation('prohibited-action', 'blocker', 'sideEffects', `${tool.id} side effect ${sideEffect} is not allowed by policy.`));
      }
    }

    if (rule.commandTemplateRequired && !commandTemplate) {
      violations.push(violation('missing-command-template', 'blocker', 'commandTemplateId', `${tool.id} requires a command template.`));
    }

    if (commandTemplate && (!commandTemplate.rawShellForbidden || !commandTemplate.shellEscapingRequired || commandTemplate.toolId !== tool.id)) {
      violations.push(violation('unsafe-command-template', 'blocker', 'commandTemplateId', `${commandTemplate.id} is not a safe template for ${tool.id}.`));
    }

    if (rule.mcpBindingRequired && !mcpBinding) {
      violations.push(violation('missing-mcp-binding', 'blocker', 'mcpToolName', `${tool.id} requires a scoped MCP binding.`));
    }

    if (mcpBinding && (!mcpBinding.requiresAuth || !mcpBinding.schemaLocked)) {
      violations.push(violation('unsafe-mcp-binding', 'blocker', 'mcpToolName', `${mcpBinding.mcpToolName} is not authenticated and schema locked.`));
    }
  }

  private validateParams(
    action: RemoteAction,
    tool: RemoteNotebookTool,
    rule: RemoteMeshPolicyRule,
    catalog: RemoteMeshPolicyCatalog,
    violations: RemoteMeshPolicyViolation[],
  ): void {
    const schema = new Map(tool.parameters.map((parameter) => [parameter.name, parameter]));

    for (const parameter of tool.parameters) {
      const value = action.params[parameter.name];
      if (parameter.required && value === undefined) {
        violations.push(violation('missing-required-parameter', 'clarification', parameter.name, `Missing required parameter ${parameter.name}.`));
        continue;
      }
      if (value !== undefined) {
        this.validateParamValue(parameter, value, violations);
      }
    }

    if (rule.parameterMode === 'schema-only') {
      for (const key of Object.keys(action.params)) {
        if (!schema.has(key)) {
          violations.push(violation('unknown-parameter', 'blocker', key, `Parameter ${key} is not declared in ${tool.id} schema.`));
        }
      }
    }

    const project = action.params.project;
    if (typeof project === 'string' && !rule.allowedProjects.includes(project)) {
      violations.push(violation('project-not-allowed', 'blocker', 'project', `Project ${project} is not in the allowlist.`));
    }

    if (action.timeoutMs > rule.maxTimeoutMs) {
      violations.push(violation('timeout-too-large', 'blocker', 'timeoutMs', `Timeout ${action.timeoutMs} exceeds ${rule.maxTimeoutMs}.`));
    }

    const serialized = JSON.stringify(action.params);
    for (const pattern of catalog.dangerousParamPatterns) {
      if (new RegExp(pattern, 'i').test(serialized)) {
        violations.push(violation('dangerous-pattern', 'blocker', 'params', `Action parameters match dangerous pattern ${pattern}.`));
      }
    }
  }

  private validateParamValue(
    parameter: RemoteMeshToolParameter,
    value: RemoteMeshJson,
    violations: RemoteMeshPolicyViolation[],
  ): void {
    if (parameter.type === 'enum') {
      if (typeof value !== 'string' || !parameter.allowedValues?.includes(value)) {
        violations.push(violation('parameter-value-not-allowed', 'blocker', parameter.name, `${parameter.name} must be one of ${(parameter.allowedValues || []).join(', ')}.`));
      }
      return;
    }

    if (parameter.type === 'number') {
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        violations.push(violation('invalid-parameter-type', 'blocker', parameter.name, `${parameter.name} must be a finite number.`));
        return;
      }
      if ((parameter.min !== undefined && value < parameter.min) || (parameter.max !== undefined && value > parameter.max)) {
        violations.push(violation('parameter-out-of-range', 'blocker', parameter.name, `${parameter.name} is outside the allowed range.`));
      }
      return;
    }

    if (parameter.type === 'boolean' && typeof value !== 'boolean') {
      violations.push(violation('invalid-parameter-type', 'blocker', parameter.name, `${parameter.name} must be boolean.`));
      return;
    }

    if (parameter.type === 'string' && typeof value !== 'string') {
      violations.push(violation('invalid-parameter-type', 'blocker', parameter.name, `${parameter.name} must be string.`));
      return;
    }

    if (parameter.type === 'object' && (value === null || typeof value !== 'object' || Array.isArray(value))) {
      violations.push(violation('invalid-parameter-type', 'blocker', parameter.name, `${parameter.name} must be object.`));
    }
  }

  private requiresApproval(
    action: RemoteAction,
    tool: RemoteNotebookTool | null,
    rule: RemoteMeshPolicyRule | null,
  ): boolean {
    const approval = rule?.approval || tool?.approval || action.approval;
    return approval !== 'not-required'
      || action.risk === 'level-2-persistent'
      || action.risk === 'level-3-sensitive';
  }

  private resolveApproval(
    status: RemoteMeshPolicyEvaluationStatus,
    action: RemoteAction,
    tool: RemoteNotebookTool | null,
    rule: RemoteMeshPolicyRule | null,
  ): RemoteMeshApprovalMode {
    if (status === 'denied') {
      return 'blocked';
    }
    if (status === 'needs-clarification') {
      return 'conversation-preview';
    }
    if (status === 'requires-approval') {
      return rule?.approval === 'not-required'
        ? 'explicit-approval'
        : rule?.approval || tool?.approval || action.approval;
    }
    return 'not-required';
  }

  private safeNextAction(status: RemoteMeshPolicyEvaluationStatus): string {
    switch (status) {
      case 'allowed':
        return 'Proceed only to a dry-run adapter binding or approved scoped executor; do not expose shell.';
      case 'requires-approval':
        return 'Show target, tool, params, side effects, rollback, and receipt plan before execution.';
      case 'needs-clarification':
        return 'Ask the operator to choose a known node/tool and provide missing schema parameters.';
      case 'denied':
        return 'Do not execute; replace with a scoped allowlisted tool and safe parameters.';
      default:
        return 'Hold execution.';
    }
  }

  private buildPreview(
    action: RemoteAction,
    template: RemoteMeshCommandTemplate | null,
    params: Record<string, RemoteMeshJson>,
  ): RemoteMeshPolicyEvaluation['preview'] {
    return {
      humanSummary: `${action.naturalLanguageIntent} Tool=${action.toolId} Params=${JSON.stringify(params)}.`,
      commandTemplatePreview: template?.previewTemplate || null,
      rawCommand: null,
    };
  }

  private buildReceipt(input: {
    action: RemoteAction;
    status: RemoteMeshPolicyEvaluationStatus;
    approval: RemoteMeshApprovalMode;
    commandTemplateId: string | null;
    adapter: RemoteMeshTransportKind | null;
    sanitizedParams: Record<string, RemoteMeshJson>;
  }): RemoteExecutionReceipt {
    return {
      id: `remote-policy-receipt:${input.action.id}`,
      actionId: input.action.id,
      decisionId: `${input.action.id}:r2-policy`,
      sessionId: null,
      nodeId: input.action.targetNodeId,
      toolId: input.action.toolId,
      adapter: input.adapter || 'policy-only',
      status: input.status === 'allowed'
        ? 'allowed'
        : input.status === 'requires-approval'
          ? 'approval-required'
          : input.status === 'denied'
            ? 'blocked'
            : 'planned',
      generatedAt: this.now().toISOString(),
      approvedBy: input.status === 'allowed' ? 'policy' : 'not-approved',
      commandTemplateId: input.commandTemplateId,
      rawCommandSerialized: false,
      stdoutHash: null,
      stderrHash: null,
      paramsRedacted: input.sanitizedParams,
      noSecretsSerialized: true,
      mutationPerformed: false,
      cleanupRequired: false,
      cleanupCompleted: false,
    };
  }

  private rule(input: {
    toolId: string;
    targetRole: RemoteMeshPolicyRule['targetRole'];
    allowedNodeTrust?: RemoteMeshPolicyRule['allowedNodeTrust'];
    allowedTransports?: RemoteMeshTransportKind[];
    riskCeiling: RemoteMeshRiskTier;
    approval: RemoteMeshApprovalMode;
    sideEffects: RemoteMeshPolicyRule['allowedSideEffects'];
    commandTemplateRequired?: boolean;
    mcpBindingRequired?: boolean;
  }): RemoteMeshPolicyRule {
    return {
      id: `remote-policy-rule:${input.toolId}`,
      toolId: input.toolId,
      targetRole: input.targetRole,
      allowedNodeTrust: input.allowedNodeTrust || ['trusted', 'operator-owned'],
      allowedTransports: input.allowedTransports || ['mcp-http', 'mcp-stdio', 'tailscale-ssh', 'ssh-wrapper'],
      allowedProjects: ['zavorth', 'principal', 'estudos'],
      riskCeiling: input.riskCeiling,
      approval: input.approval,
      maxTimeoutMs: 300000,
      parameterMode: 'schema-only',
      commandTemplateRequired: input.commandTemplateRequired === true,
      mcpBindingRequired: input.mcpBindingRequired === true,
      allowedSideEffects: input.sideEffects,
      receiptRequired: true,
    };
  }

  private withDefaultReason(
    violations: RemoteMeshPolicyViolation[],
    status: RemoteMeshPolicyEvaluationStatus,
  ): RemoteMeshPolicyViolation[] {
    if (violations.length > 0) {
      return violations;
    }
    return [
      violation(
        status === 'allowed' ? 'approval-required' : 'approval-required',
        status === 'allowed' ? 'info' : 'approval',
        null,
        status === 'allowed'
          ? 'Action satisfies the R2 allowlist without requiring approval.'
          : 'Action satisfies the R2 allowlist but requires operator approval.',
      ),
    ];
  }

  private catalogIsSafe(catalog: RemoteMeshPolicyCatalog): boolean {
    return catalog.commandTemplates.every((item) => item.rawShellForbidden && item.shellEscapingRequired)
      && catalog.mcpBindings.every((item) => item.requiresAuth && item.schemaLocked)
      && catalog.rules.every((item) => item.receiptRequired && item.parameterMode === 'schema-only');
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
        nested[key] = /token|secret|password|key/i.test(key)
          ? '[redacted]'
          : this.redactJson(nestedValue);
      }
      return nested;
    }
    return value;
  }
}

function template(
  id: string,
  toolId: string,
  adapter: RemoteMeshCommandTemplate['adapter'],
  previewTemplate: string,
  parameterRefs: string[],
): RemoteMeshCommandTemplate {
  return {
    id,
    toolId,
    adapter,
    parameterRefs,
    previewTemplate,
    rawShellForbidden: true,
    shellEscapingRequired: true,
    dryRunOnlyInR2: true,
  };
}

function binding(toolId: string, mcpToolName: string, scopes: string[]): RemoteMeshMcpBinding {
  return {
    toolId,
    mcpToolName,
    transport: 'mcp-http',
    requiresAuth: true,
    schemaLocked: true,
    scopes,
  };
}

function violation(
  code: RemoteMeshPolicyViolationCode,
  severity: RemoteMeshPolicyViolation['severity'],
  field: string | null,
  message: string,
): RemoteMeshPolicyViolation {
  return {
    code,
    severity,
    field,
    message,
  };
}
