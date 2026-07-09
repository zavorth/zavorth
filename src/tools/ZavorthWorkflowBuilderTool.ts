import fs from 'fs';
import path from 'path';
import { BaseTool } from './BaseTool.js';
import type { ToolDefinition } from '@zavorth/providers/ILlmProvider.js';
import { logger } from '../logger.js';

export interface WorkflowNode {
  id: string;
  type: 'trigger' | 'action' | 'condition' | 'transform' | 'output';
  name: string;
  config: Record<string, unknown>;
  position: { x: number; y: number };
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  condition?: string;
}

export interface Workflow {
  id: string;
  name: string;
  description: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  enabled: boolean;
  created_at: string;
  updated_at: string;
  run_count: number;
  last_run: string | null;
}

export class ZavorthWorkflowBuilderTool extends BaseTool {
  public readonly name = 'zavorth_workflow_builder';

  public readonly description =
    'Visual workflow builder — create, edit, and execute complex workflows with triggers, conditions, actions, and outputs via API.';

  public readonly parameters: ToolDefinition['parameters'] = {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        description: "Action: 'create', 'list', 'get', 'add_node', 'add_edge', 'remove_node', 'run', 'enable', 'disable', 'delete', 'export', 'import'.",
      },
      workflow_id: {
        type: 'string',
        description: 'Workflow ID.',
      },
      name: {
        type: 'string',
        description: 'Workflow name.',
      },
      description: {
        type: 'string',
        description: 'Workflow description.',
      },
      node_type: {
        type: 'string',
        description: "Node type: 'trigger', 'action', 'condition', 'transform', 'output'.",
      },
      node_name: {
        type: 'string',
        description: 'Node name.',
      },
      node_config: {
        type: 'string',
        description: 'JSON config for the node.',
      },
      source_node: {
        type: 'string',
        description: 'Source node ID for edges.',
      },
      target_node: {
        type: 'string',
        description: 'Target node ID for edges.',
      },
      condition: {
        type: 'string',
        description: 'Condition for conditional edges.',
      },
      workflow_json: {
        type: 'string',
        description: 'JSON workflow for import.',
      },
    },
    required: ['action'],
  };

  private readonly storageDir: string;
  private workflows: Map<string, Workflow> = new Map();

  constructor(options?: { storageDir?: string }) {
    super();
    this.storageDir = options?.storageDir || path.join(process.cwd(), 'data', 'runtime', 'workflows');
    if (!fs.existsSync(this.storageDir)) fs.mkdirSync(this.storageDir, { recursive: true });
    this.loadWorkflows();
  }

  private loadWorkflows(): void {
    const filePath = path.join(this.storageDir, 'workflows.json');
    if (!fs.existsSync(filePath)) return;
    try {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      this.workflows = new Map(Object.entries(data));
    } catch (error: unknown) {/* ignore */ logger.warn('[Zavorth Workflow Builder] JSON parse failed', error); }
  }

  private saveWorkflows(): void {
    fs.writeFileSync(
      path.join(this.storageDir, 'workflows.json'),
      JSON.stringify(Object.fromEntries(this.workflows), null, 2),
      'utf-8',
    );
  }

  public async execute(args: Record<string, unknown>): Promise<string> {
    const action = String(args.action || '');
    if (!action) return 'Error: "action" parameter is required.';

    switch (action) {
      case 'create': return this.createWorkflow(args);
      case 'list': return this.listWorkflows();
      case 'get': return this.getWorkflow(args);
      case 'add_node': return this.addNode(args);
      case 'add_edge': return this.addEdge(args);
      case 'remove_node': return this.removeNode(args);
      case 'run': return await this.runWorkflow(args);
      case 'enable': return this.toggleWorkflow(args, true);
      case 'disable': return this.toggleWorkflow(args, false);
      case 'delete': return this.deleteWorkflow(args);
      case 'export': return this.exportWorkflow(args);
      case 'import': return this.importWorkflow(args);
      default: return `Error: action "${action}" is invalid.`;
    }
  }

  private createWorkflow(args: Record<string, unknown>): string {
    const name = String(args.name || '');
    if (!name) return 'Error: "name" is required.';

    const id = `wf_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const workflow: Workflow = {
      id,
      name,
      description: String(args.description || ''),
      nodes: [],
      edges: [],
      enabled: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      run_count: 0,
      last_run: null,
    };

    this.workflows.set(id, workflow);
    this.saveWorkflows();
    return `Workflow "${name}" created with ID ${id}.`;
  }

  private listWorkflows(): string {
    if (this.workflows.size === 0) return 'No workflows created.';

    const lines: string[] = ['Workflows:'];
    for (const [, wf] of this.workflows) {
      const status = wf.enabled ? '✅' : '⏸️';
      lines.push(`  ${status} ${wf.id}: ${wf.name} (${wf.nodes.length} nodes, ${wf.edges.length} edges, ${wf.run_count} runs)`);
    }
    return lines.join('\n');
  }

  private getWorkflow(args: Record<string, unknown>): string {
    const id = String(args.workflow_id || '');
    if (!id) return 'Error: "workflow_id" is required.';

    const wf = this.workflows.get(id);
    if (!wf) return `Error: workflow "${id}" not found.`;

    const lines: string[] = [
      `Workflow: ${wf.name} (${wf.id})`,
      `  Description: ${wf.description}`,
      `  Enabled: ${wf.enabled}`,
      `  Runs: ${wf.run_count}`,
      `  Last run: ${wf.last_run || 'never'}`,
      '',
      'Nodes:',
    ];

    for (const node of wf.nodes) {
      const icon = { trigger: '⚡', action: '⚙️', condition: '🔀', transform: '🔄', output: '📤' }[node.type];
      lines.push(`  ${icon} ${node.id}: ${node.name} [${node.type}]`);
    }

    if (wf.edges.length > 0) {
      lines.push('', 'Edges:');
      for (const edge of wf.edges) {
        const srcNode = wf.nodes.find((n) => n.id === edge.source);
        const tgtNode = wf.nodes.find((n) => n.id === edge.target);
        lines.push(`  ${srcNode?.name || edge.source} → ${tgtNode?.name || edge.target}${edge.condition ? ` [${edge.condition}]` : ''}`);
      }
    }

    return lines.join('\n');
  }

  private addNode(args: Record<string, unknown>): string {
    const workflowId = String(args.workflow_id || '');
    const nodeName = String(args.node_name || '');
    const nodeType = String(args.node_type || 'action');
    if (!workflowId || !nodeName) return 'Error: "workflow_id" and "node_name" are required.';

    const wf = this.workflows.get(workflowId);
    if (!wf) return `Error: workflow "${workflowId}" not found.`;

    const validTypes = ['trigger', 'action', 'condition', 'transform', 'output'];
    if (!validTypes.includes(nodeType)) return `Error: invalid node type "${nodeType}".`;

    let config: Record<string, unknown> = {};
    if (typeof args.node_config === 'string') {
      try { config = JSON.parse(args.node_config); } catch (error: unknown) {logger.warn('[Zavorth Workflow Builder] JSON parse failed', error); return 'Error: invalid JSON for node_config.'; }
    }

    const nodeId = `node_${Date.now()}_${Math.random().toString(36).slice(2, 4)}`;
    wf.nodes.push({
      id: nodeId,
      type: nodeType as WorkflowNode['type'],
      name: nodeName,
      config,
      position: { x: wf.nodes.length * 200, y: 100 },
    });

    wf.updated_at = new Date().toISOString();
    this.saveWorkflows();

    return `Node "${nodeName}" (${nodeType}) added to workflow "${wf.name}" with ID ${nodeId}.`;
  }

  private addEdge(args: Record<string, unknown>): string {
    const workflowId = String(args.workflow_id || '');
    const source = String(args.source_node || '');
    const target = String(args.target_node || '');
    if (!workflowId || !source || !target) return 'Error: "workflow_id", "source_node", and "target_node" are required.';

    const wf = this.workflows.get(workflowId);
    if (!wf) return `Error: workflow "${workflowId}" not found.`;

    if (!wf.nodes.find((n) => n.id === source)) return `Error: source node "${source}" not found.`;
    if (!wf.nodes.find((n) => n.id === target)) return `Error: target node "${target}" not found.`;

    const edgeId = `edge_${Date.now()}`;
    wf.edges.push({
      id: edgeId,
      source,
      target,
      condition: typeof args.condition === 'string' ? args.condition : undefined,
    });

    wf.updated_at = new Date().toISOString();
    this.saveWorkflows();

    return `Edge created: ${source} → ${target}${args.condition ? ` [${args.condition}]` : ''}`;
  }

  private removeNode(args: Record<string, unknown>): string {
    const workflowId = String(args.workflow_id || '');
    const nodeId = String(args.source_node || '');
    if (!workflowId || !nodeId) return 'Error: "workflow_id" and "source_node" are required.';

    const wf = this.workflows.get(workflowId);
    if (!wf) return `Error: workflow "${workflowId}" not found.`;

    wf.nodes = wf.nodes.filter((n) => n.id !== nodeId);
    wf.edges = wf.edges.filter((e) => e.source !== nodeId && e.target !== nodeId);
    wf.updated_at = new Date().toISOString();
    this.saveWorkflows();

    return `Node "${nodeId}" and its edges removed.`;
  }

  private async runWorkflow(args: Record<string, unknown>): Promise<string> {
    const workflowId = String(args.workflow_id || '');
    if (!workflowId) return 'Error: "workflow_id" is required.';

    const wf = this.workflows.get(workflowId);
    if (!wf) return `Error: workflow "${workflowId}" not found.`;
    if (!wf.enabled) return `Error: workflow "${wf.name}" is disabled.`;

    const triggerNodes = wf.nodes.filter((n) => n.type === 'trigger');
    if (triggerNodes.length === 0) return 'Error: workflow has no trigger node.';

    wf.run_count++;
    wf.last_run = new Date().toISOString();
    wf.updated_at = new Date().toISOString();
    this.saveWorkflows();

    return [
      `Workflow "${wf.name}" executed:`,
      `  Run #${wf.run_count}`,
      `  Trigger: ${triggerNodes[0].name}`,
      `  Nodes: ${wf.nodes.length}`,
      `  Edges: ${wf.edges.length}`,
      '  Status: simulated (full execution requires runtime integration)',
    ].join('\n');
  }

  private toggleWorkflow(args: Record<string, unknown>, enabled: boolean): string {
    const workflowId = String(args.workflow_id || '');
    if (!workflowId) return 'Error: "workflow_id" is required.';

    const wf = this.workflows.get(workflowId);
    if (!wf) return `Error: workflow "${workflowId}" not found.`;

    wf.enabled = enabled;
    wf.updated_at = new Date().toISOString();
    this.saveWorkflows();

    return `Workflow "${wf.name}" ${enabled ? 'enabled' : 'disabled'}.`;
  }

  private deleteWorkflow(args: Record<string, unknown>): string {
    const workflowId = String(args.workflow_id || '');
    if (!workflowId) return 'Error: "workflow_id" is required.';

    if (!this.workflows.has(workflowId)) return `Error: workflow "${workflowId}" not found.`;
    this.workflows.delete(workflowId);
    this.saveWorkflows();

    return `Workflow "${workflowId}" deleted.`;
  }

  private exportWorkflow(args: Record<string, unknown>): string {
    const workflowId = String(args.workflow_id || '');
    if (!workflowId) return 'Error: "workflow_id" is required.';

    const wf = this.workflows.get(workflowId);
    if (!wf) return `Error: workflow "${workflowId}" not found.`;

    return JSON.stringify(wf, null, 2);
  }

  private importWorkflow(args: Record<string, unknown>): string {
    const workflowJson = String(args.workflow_json || '');
    if (!workflowJson) return 'Error: "workflow_json" is required.';

    try {
      const wf = JSON.parse(workflowJson) as Workflow;
      if (!wf.name) return 'Error: workflow must have a "name".';

      wf.id = `wf_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      wf.created_at = new Date().toISOString();
      wf.updated_at = new Date().toISOString();
      wf.run_count = 0;
      wf.last_run = null;

      this.workflows.set(wf.id, wf);
      this.saveWorkflows();

      return `Workflow "${wf.name}" imported with ID ${wf.id}.`;
    } catch (error: unknown) {logger.warn('[Zavorth Workflow Builder] creation failed', error); return 'Error: invalid JSON.'; }
  }
}
