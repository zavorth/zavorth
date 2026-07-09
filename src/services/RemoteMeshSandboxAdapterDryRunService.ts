import { createHash } from 'node:crypto';
import { ZAVORTH_REMOTE_MESH_SANDBOX_R3_ADAPTER_VERSION } from '../contracts/RemoteMeshSandboxAdapterContract.js';
import { RemoteMeshSandboxPolicyService } from './RemoteMeshSandboxPolicyService.js';

import type {
  RemoteExecutionReceipt,
  RemoteMeshJson,
  RemoteMeshTransportKind,
  RemoteNode,
  RemoteNotebookTool,
} from '../contracts/RemoteMeshSandboxContract.js';
import type {
  RemoteMeshAdapterDryRunBinding,
  RemoteMeshAdapterDryRunKind,
  RemoteMeshAdapterDryRunStatus,
  RemoteMeshSandboxAdapterSnapshot,
} from '../contracts/RemoteMeshSandboxAdapterContract.js';

import type {
  RemoteMeshCommandTemplate,
  RemoteMeshMcpBinding,
  RemoteMeshPolicyCatalog,
  RemoteMeshPolicyEvaluation,
  RemoteMeshSandboxPolicySnapshot,
} from '../contracts/RemoteMeshSandboxPolicyContract.js';

type RemoteMeshSandboxAdapterDryRunRuntime = {
  now?: () => Date;
  policyService?: RemoteMeshSandboxPolicyService;
};

type BindingContext = {
  nodes: RemoteNode[];
  tools: RemoteNotebookTool[];
  catalog: RemoteMeshPolicyCatalog;
};

export class RemoteMeshSandboxAdapterDryRunService {
  private readonly now: () => Date;
  private readonly policy: RemoteMeshSandboxPolicyService;

  constructor(runtime: RemoteMeshSandboxAdapterDryRunRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.policy = runtime.policyService || new RemoteMeshSandboxPolicyService({ now: this.now });
  }

  public buildSnapshot(): RemoteMeshSandboxAdapterSnapshot {
    const policySnapshot = this.policy.buildSnapshot();
    const context: BindingContext = {
      nodes: policySnapshot.nodes,
      tools: policySnapshot.tools,
      catalog: policySnapshot.catalog,
    };
    const bindings = policySnapshot.evaluations.flatMap((evaluation) =>
      this.buildBindingsForEvaluation(evaluation, context),
    );
    const receipts = bindings.map((binding) => binding.receipt);
    const blocked = bindings.filter((binding) => binding.status === 'blocked').length;

    return {
      generatedAt: this.now().toISOString(),
      contractVersion: ZAVORTH_REMOTE_MESH_SANDBOX_R3_ADAPTER_VERSION,
      phase: 'R3',
      status: this.bindingsAreSafe(bindings) ? 'adapter-dry-run-ready' : 'blocked',
      summary: {
        policyEvaluations: policySnapshot.evaluations.length,
        bindings: bindings.length,
        ready: bindings.filter((binding) => binding.status === 'ready').length,
        approvalRequired: bindings.filter((binding) => binding.status === 'approval-required').length,
        blocked,
        mcpDryRuns: this.countAdapter(bindings, 'mcp-dry-run'),
        sshWrapperDryRuns: this.countAdapter(bindings, 'ssh-wrapper-dry-run'),
        termuxProotDryRuns: this.countAdapter(bindings, 'termux-proot-dry-run'),
        policyBlocks: this.countAdapter(bindings, 'policy-block-dry-run'),
        receipts: receipts.length,
        remoteExecutionPerformed: false,
        liveNetworkCallPerformed: false,
        remoteProcessSpawned: false,
        filesystemMutationPerformed: false,
        rawCommandSerialized: false,
        secretValuesSerialized: false,
      },
      nodes: policySnapshot.nodes,
      tools: policySnapshot.tools,
      policyCatalog: policySnapshot.catalog,
      policyEvaluations: policySnapshot.evaluations,
      bindings,
      receipts,
      commands: {
        check: 'npm run remote-mesh:sandbox:adapters --silent',
        focusedTests: 'npx jest tests/services/RemoteMeshSandboxAdapterDryRunService.test.ts --runInBand',
        typecheck: 'npm run runtime:check --silent',
        nextStage: 'R4 - Owner-Gated Live Remote Activation',
      },
    };
  }

  public buildBindingsForEvaluation(
    evaluation: RemoteMeshPolicyEvaluation,
    context: Partial<BindingContext> = {},
  ): RemoteMeshAdapterDryRunBinding[] {
    const policySnapshot = this.ensureContext(context);
    const node = policySnapshot.nodes.find((candidate) => candidate.id === evaluation.targetNodeId) || null;
    const tool = policySnapshot.tools.find((candidate) => candidate.id === evaluation.toolId) || null;
    const template = evaluation.commandTemplateId
      ? policySnapshot.catalog.commandTemplates.find((candidate) => candidate.id === evaluation.commandTemplateId) || null
      : null;
    const mcpBinding = evaluation.mcpToolName
      ? policySnapshot.catalog.mcpBindings.find((candidate) => candidate.toolId === evaluation.toolId && candidate.mcpToolName === evaluation.mcpToolName) || null
      : null;

    if (evaluation.status === 'denied' || !tool || !node) {
      return [this.buildPolicyBlockBinding(evaluation)];
    }

    const bindings: RemoteMeshAdapterDryRunBinding[] = [];

    if (tool.transport === 'mcp-http' || tool.transport === 'mcp-stdio') {
      bindings.push(this.buildMcpBinding(evaluation, node, tool, template, mcpBinding));
      if (template) {
        bindings.push(this.buildSshWrapperBinding(evaluation, node, tool, template));
      }
    } else if (tool.transport === 'termux-proot') {
      bindings.push(this.buildTermuxBinding(evaluation, node, tool, template));
    } else if (tool.transport === 'ssh-wrapper' || tool.transport === 'tailscale-ssh') {
      bindings.push(this.buildSshWrapperBinding(evaluation, node, tool, template));
    } else {
      bindings.push(this.buildPolicyBlockBinding(evaluation));
    }

    return bindings;
  }

  private buildMcpBinding(
    evaluation: RemoteMeshPolicyEvaluation,
    node: RemoteNode,
    tool: RemoteNotebookTool,
    template: RemoteMeshCommandTemplate | null,
    mcpBinding: RemoteMeshMcpBinding | null,
  ): RemoteMeshAdapterDryRunBinding {
    const blocked = !mcpBinding || !mcpBinding.requiresAuth || !mcpBinding.schemaLocked;
    const status = this.statusFor(evaluation, blocked);
    const payload = {
      mcpToolName: mcpBinding?.mcpToolName || evaluation.mcpToolName || null,
      params: evaluation.sanitizedParams,
      scopes: mcpBinding?.scopes || [],
      schemaLocked: mcpBinding?.schemaLocked === true,
      requiresAuth: mcpBinding?.requiresAuth === true,
    };

    return this.binding({
      evaluation,
      node,
      tool,
      template,
      adapter: 'mcp-dry-run',
      status,
      transport: mcpBinding?.transport || tool.transport,
      mcpToolName: mcpBinding?.mcpToolName || evaluation.mcpToolName,
      adapterCall: {
        kind: 'mcp-tool-call',
        name: mcpBinding?.mcpToolName || evaluation.mcpToolName || 'missing-mcp-binding',
        transport: mcpBinding?.transport || tool.transport,
        endpointLabel: this.endpointFor(node, mcpBinding?.transport || tool.transport),
        payload,
        rawCommand: null,
      },
      commandTemplateIdRequired: Boolean(template),
      mcpBindingRequired: true,
    });
  }

  private buildSshWrapperBinding(
    evaluation: RemoteMeshPolicyEvaluation,
    node: RemoteNode,
    tool: RemoteNotebookTool,
    template: RemoteMeshCommandTemplate | null,
  ): RemoteMeshAdapterDryRunBinding {
    const status = this.statusFor(evaluation, !template);
    const payload = {
      commandTemplateId: template?.id || null,
      params: evaluation.sanitizedParams,
      timeoutMs: evaluation.receipt.actionId ? 300000 : 120000,
      rawCommand: null,
    };

    return this.binding({
      evaluation,
      node,
      tool,
      template,
      adapter: 'ssh-wrapper-dry-run',
      status,
      transport: 'ssh-wrapper',
      mcpToolName: null,
      adapterCall: {
        kind: 'ssh-wrapper-template',
        name: template?.id || 'missing-command-template',
        transport: 'ssh-wrapper',
        endpointLabel: this.endpointFor(node, 'tailscale-ssh') || this.endpointFor(node, 'ssh-wrapper'),
        payload,
        rawCommand: null,
      },
      commandTemplateIdRequired: true,
      mcpBindingRequired: false,
    });
  }

  private buildTermuxBinding(
    evaluation: RemoteMeshPolicyEvaluation,
    node: RemoteNode,
    tool: RemoteNotebookTool,
    template: RemoteMeshCommandTemplate | null,
  ): RemoteMeshAdapterDryRunBinding {
    const status = this.statusFor(evaluation, !template);
    const ttlMs = typeof evaluation.sanitizedParams.ttlMs === 'number'
      ? evaluation.sanitizedParams.ttlMs
      : 900000;
    const payload = {
      commandTemplateId: template?.id || null,
      params: evaluation.sanitizedParams,
      lifecycle: tool.id.endsWith('.destroy') ? 'destroy' : 'create',
      ttlMs,
      cleanupRequired: true,
      allowPersonalStorageAccess: false,
      prootIsSecurityBoundary: false,
    };

    return this.binding({
      evaluation,
      node,
      tool,
      template,
      adapter: 'termux-proot-dry-run',
      status,
      transport: 'termux-proot',
      mcpToolName: null,
      adapterCall: {
        kind: 'termux-proot-lifecycle',
        name: template?.id || 'missing-termux-template',
        transport: 'termux-proot',
        endpointLabel: this.endpointFor(node, 'termux-proot'),
        payload,
        rawCommand: null,
      },
      commandTemplateIdRequired: true,
      mcpBindingRequired: false,
    });
  }

  private buildPolicyBlockBinding(evaluation: RemoteMeshPolicyEvaluation): RemoteMeshAdapterDryRunBinding {
    const receipt = this.receipt({
      evaluation,
      adapter: 'policy-only',
      status: 'blocked',
      commandTemplateId: null,
      params: evaluation.sanitizedParams,
    });
    const adapterCall = {
      kind: 'policy-block' as const,
      name: 'policy.block',
      transport: 'policy-only' as const,
      endpointLabel: null,
      payload: {
        violations: evaluation.violations.map((item) => item.code),
        safeNextAction: evaluation.safeNextAction,
      },
      rawCommand: null,
    };

    return {
      id: `${evaluation.id}:policy-block-dry-run`,
      actionId: evaluation.actionId,
      evaluationId: evaluation.id,
      adapter: 'policy-block-dry-run',
      status: 'blocked',
      targetNodeId: evaluation.targetNodeId,
      toolId: evaluation.toolId,
      transport: 'policy-only',
      commandTemplateId: null,
      mcpToolName: null,
      approvalRequired: false,
      paramsRedacted: evaluation.sanitizedParams,
      preview: {
        humanSummary: evaluation.preview.humanSummary,
        adapterCall,
        commandTemplatePreview: null,
        rawCommand: null,
      },
      dryRunHashes: this.hashes(adapterCall, receipt),
      guards: this.guards({
        commandTemplateIdRequired: false,
        mcpBindingRequired: false,
        approvalRequired: false,
      }),
      receipt,
    };
  }

  private binding(input: {
    evaluation: RemoteMeshPolicyEvaluation;
    node: RemoteNode;
    tool: RemoteNotebookTool;
    template: RemoteMeshCommandTemplate | null;
    adapter: RemoteMeshAdapterDryRunKind;
    status: RemoteMeshAdapterDryRunStatus;
    transport: RemoteMeshTransportKind;
    mcpToolName: string | null;
    adapterCall: RemoteMeshAdapterDryRunBinding['preview']['adapterCall'];
    commandTemplateIdRequired: boolean;
    mcpBindingRequired: boolean;
  }): RemoteMeshAdapterDryRunBinding {
    const receipt = this.receipt({
      evaluation: input.evaluation,
      adapter: input.transport,
      status: input.status,
      commandTemplateId: input.template?.id || null,
      params: input.evaluation.sanitizedParams,
    });
    const approvalRequired = input.status === 'approval-required';

    return {
      id: `${input.evaluation.id}:${input.adapter}`,
      actionId: input.evaluation.actionId,
      evaluationId: input.evaluation.id,
      adapter: input.adapter,
      status: input.status,
      targetNodeId: input.node.id,
      toolId: input.tool.id,
      transport: input.transport,
      commandTemplateId: input.template?.id || null,
      mcpToolName: input.mcpToolName,
      approvalRequired,
      paramsRedacted: input.evaluation.sanitizedParams,
      preview: {
        humanSummary: input.evaluation.preview.humanSummary,
        adapterCall: input.adapterCall,
        commandTemplatePreview: input.template?.previewTemplate || input.evaluation.preview.commandTemplatePreview,
        rawCommand: null,
      },
      dryRunHashes: this.hashes(input.adapterCall, receipt),
      guards: this.guards({
        commandTemplateIdRequired: input.commandTemplateIdRequired,
        mcpBindingRequired: input.mcpBindingRequired,
        approvalRequired,
      }),
      receipt,
    };
  }

  private receipt(input: {
    evaluation: RemoteMeshPolicyEvaluation;
    adapter: RemoteMeshTransportKind | 'policy-only';
    status: RemoteMeshAdapterDryRunStatus;
    commandTemplateId: string | null;
    params: Record<string, RemoteMeshJson>;
  }): RemoteExecutionReceipt {
    return {
      id: `remote-adapter-dry-run-receipt:${input.evaluation.id}:${input.adapter}`,
      actionId: input.evaluation.actionId,
      decisionId: input.evaluation.id,
      sessionId: null,
      nodeId: input.evaluation.targetNodeId,
      toolId: input.evaluation.toolId,
      adapter: input.adapter,
      status: input.status === 'ready'
        ? 'allowed'
        : input.status === 'approval-required'
          ? 'approval-required'
          : 'blocked',
      generatedAt: this.now().toISOString(),
      approvedBy: input.status === 'ready' ? 'policy' : 'not-approved',
      commandTemplateId: input.commandTemplateId,
      rawCommandSerialized: false,
      stdoutHash: this.hash({ type: 'stdout-preview', actionId: input.evaluation.actionId, adapter: input.adapter }),
      stderrHash: this.hash({ type: 'stderr-preview', actionId: input.evaluation.actionId, adapter: input.adapter }),
      paramsRedacted: input.params,
      noSecretsSerialized: true,
      mutationPerformed: false,
      cleanupRequired: input.adapter === 'termux-proot',
      cleanupCompleted: false,
    };
  }

  private statusFor(
    evaluation: RemoteMeshPolicyEvaluation,
    blocked: boolean,
  ): RemoteMeshAdapterDryRunStatus {
    if (blocked || evaluation.status === 'denied' || evaluation.status === 'needs-clarification') {
      return 'blocked';
    }
    if (evaluation.status === 'requires-approval') {
      return 'approval-required';
    }
    return 'ready';
  }

  private endpointFor(node: RemoteNode, transport: RemoteMeshTransportKind): string | null {
    return node.transports.find((candidate) => candidate.kind === transport)?.endpointLabel || null;
  }

  private ensureContext(context: Partial<BindingContext>): BindingContext {
    if (context.nodes && context.tools && context.catalog) {
      return {
        nodes: context.nodes,
        tools: context.tools,
        catalog: context.catalog,
      };
    }
    const snapshot: RemoteMeshSandboxPolicySnapshot = this.policy.buildSnapshot();
    return {
      nodes: context.nodes || snapshot.nodes,
      tools: context.tools || snapshot.tools,
      catalog: context.catalog || snapshot.catalog,
    };
  }

  private hashes(
    adapterCall: RemoteMeshAdapterDryRunBinding['preview']['adapterCall'],
    receipt: RemoteExecutionReceipt,
  ): RemoteMeshAdapterDryRunBinding['dryRunHashes'] {
    return {
      stdoutPreviewHash: receipt.stdoutHash || this.hash({ adapterCall, stream: 'stdout-preview' }),
      stderrPreviewHash: receipt.stderrHash || this.hash({ adapterCall, stream: 'stderr-preview' }),
      receiptPreviewHash: this.hash(receipt),
    };
  }

  private guards(input: {
    commandTemplateIdRequired: boolean;
    mcpBindingRequired: boolean;
    approvalRequired: boolean;
  }): RemoteMeshAdapterDryRunBinding['guards'] {
    return {
      noLiveNetworkCall: true,
      noRemoteProcessSpawn: true,
      noFilesystemMutation: true,
      noRawCommandSerialization: true,
      noSecretSerialization: true,
      commandTemplateIdRequired: input.commandTemplateIdRequired,
      mcpBindingRequired: input.mcpBindingRequired,
      approvalMustBeResolvedBeforeExecution: input.approvalRequired,
    };
  }

  private bindingsAreSafe(bindings: RemoteMeshAdapterDryRunBinding[]): boolean {
    return bindings.every((binding) =>
      binding.preview.rawCommand === null
      && binding.preview.adapterCall.rawCommand === null
      && binding.receipt.rawCommandSerialized === false
      && binding.receipt.noSecretsSerialized
      && !binding.receipt.mutationPerformed
      && binding.guards.noLiveNetworkCall
      && binding.guards.noRemoteProcessSpawn
      && binding.guards.noFilesystemMutation,
    );
  }

  private countAdapter(
    bindings: RemoteMeshAdapterDryRunBinding[],
    adapter: RemoteMeshAdapterDryRunKind,
  ): number {
    return bindings.filter((binding) => binding.adapter === adapter).length;
  }

  private hash(value: unknown): string {
    return createHash('sha256').update(JSON.stringify(value)).digest('hex');
  }
}
