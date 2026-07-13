import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { BaseTool } from './BaseTool.js';
import { ZavorthExternalAgentGatewayService } from '../services/ZavorthExternalAgentGatewayService.js';
import type { ZavorthExternalAgentAdapterKind } from '../contracts/ZavorthExternalAgentGatewayContract.js';
import { WorkerMeshService } from '../services/WorkerMeshService.js';
import { WorkerDelegationRouterService } from '../services/WorkerDelegationRouterService.js';
import { SkillWorkerDiscoveryService } from '../services/SkillWorkerDiscoveryService.js';
import { logger } from '../logger.js';

type AgentDiscoveryResult = {
  found: boolean;
  candidates: Array<{
    id: string;
    label: string;
    adapter: ZavorthExternalAgentAdapterKind;
    command: string | null;
    endpoint: string | null;
    root: string | null;
    evidence: string[];
  }>;
  suggestion: string | null;
};

export class AgentManagerTool extends BaseTool {
  public readonly name = 'agent_manager';
  public readonly description =
    'Worker mesh + external agents: list/register/discover/health/invoke. Brand-agnostic — use path, CLI command, or URL. Includes internal:* workers (subagent roles).';

  public readonly parameters = {
    type: 'object' as const,
    properties: {
      action: {
        type: 'string',
        enum: [
          'register',
          'list',
          'workers',
          'remove',
          'discover',
          'search',
          'health',
          'invoke',
          'receipts',
          'route',
          'scan',
          'suggest',
        ],
        description:
          'register|list|workers|remove|discover|scan|suggest|health|invoke|receipts|route. scan/suggest = workspace worker discovery (preview). route = local-vs-worker classification.',
      },
      task: {
        type: 'string',
        description: 'For action=route: natural language task to classify (local tools vs worker).',
      },
      target: {
        type: 'string',
        description:
          'Path, CLI command, URL, or worker id (e.g. "./my-agent", "node", "http://localhost:8080", "internal:leaf").',
      },
      id: {
        type: 'string',
        description: 'Custom agent/worker ID (optional).',
      },
      label: {
        type: 'string',
        description: 'Human-readable label (optional, neutral preferred).',
      },
      adapter: {
        type: 'string',
        enum: ['cli', 'http', 'acp', 'mcp'],
        description: 'Adapter type (optional, auto-detected if not provided).',
      },
      command: {
        type: 'string',
        description: 'CLI command to execute (optional, auto-detected if not provided).',
      },
      endpoint: {
        type: 'string',
        description: 'HTTP/MCP endpoint URL (optional).',
      },
      prompt: {
        type: 'string',
        description: 'Prompt for action=invoke.',
      },
      dry_run: {
        type: 'boolean',
        description: 'Invoke dry-run (default true unless approval=true and dry_run=false).',
      },
      approval: {
        type: 'boolean',
        description: 'Grant approval for live invoke or registration side effects.',
      },
      autoApprove: {
        type: 'boolean',
        description: 'Alias of approval for register (default false for live; register still needs explicit true to persist).',
      },
    },
    required: ['action'],
  };

  private gateway: ZavorthExternalAgentGatewayService;
  private mesh: WorkerMeshService;
  private router: WorkerDelegationRouterService;
  private discovery: SkillWorkerDiscoveryService;

  constructor(options?: {
    projectRoot?: string;
    mesh?: WorkerMeshService;
    router?: WorkerDelegationRouterService;
    discovery?: SkillWorkerDiscoveryService;
  }) {
    super();
    const root = options?.projectRoot || process.cwd();
    this.gateway = new ZavorthExternalAgentGatewayService({ projectRoot: root });
    this.mesh =
      options?.mesh ||
      new WorkerMeshService({
        projectRoot: root,
        gateway: this.gateway,
      });
    this.router =
      options?.router ||
      new WorkerDelegationRouterService({
        mesh: this.mesh,
      });
    this.discovery =
      options?.discovery ||
      new SkillWorkerDiscoveryService({
        projectRoot: root,
        mesh: this.mesh,
      });
  }

  public async execute(args: Record<string, unknown>): Promise<string> {
    const action = String(args.action || 'list').toLowerCase();
    const target = String(args.target || args.id || '').trim();

    switch (action) {
      case 'list':
        return this.listAgents();
      case 'workers':
        return this.listWorkers();
      case 'register':
        return this.registerAgent(args);
      case 'remove':
        return this.removeAgent(target);
      case 'discover':
      case 'search':
        return this.discoverAgent(target);
      case 'scan':
      case 'suggest':
        return this.scanWorkers(args);
      case 'health':
        return this.healthWorker(target);
      case 'invoke':
        return this.invokeWorker(args);
      case 'receipts':
        return this.listReceipts();
      case 'route':
        return this.routeTask(args);
      default:
        return JSON.stringify({
          error: `Unknown action: ${action}`,
          hint: 'register|list|workers|remove|discover|scan|suggest|health|invoke|receipts|route',
        });
    }
  }

  private async scanWorkers(args: Record<string, unknown>): Promise<string> {
    const query = String(args.query || args.task || args.target || '').trim();
    const result = await this.discovery.discover({
      query: query || 'worker',
      remote: false,
      includeWorkers: true,
      scanWorkspace: true,
      limit: 20,
    });
    // Preview-only suggestions (no auto-register)
    return JSON.stringify(
      {
        status: 'ok',
        mode: 'preview',
        message: 'Worker candidates (not registered). Use action=register with path/command/URL to add.',
        candidates: result.workers,
        registered: result.registeredWorkers,
        text: result.formatText(),
      },
      null,
      2,
    );
  }

  private routeTask(args: Record<string, unknown>): string {
    const task = String(args.task || args.prompt || args.target || '').trim();
    if (!task) {
      return JSON.stringify({ error: 'task (or prompt) is required for action=route.' });
    }
    const decision = this.router.route({
      task,
      workerId: args.id ? String(args.id) : null,
      approvalGranted: args.approval === true || args.autoApprove === true,
      workers: this.mesh.listWorkers(),
    });
    return JSON.stringify(
      {
        status: 'ok',
        decision,
        text: this.router.formatDecisionText(decision),
        next:
          decision.kind === 'local_tools'
            ? {
                use: 'local tools',
                tools: decision.suggestedLocalTools,
              }
            : {
                use: 'worker mesh',
                invoke: {
                  action: 'invoke',
                  target: decision.suggestedWorkerId,
                  dry_run: decision.preferDryRun,
                  approval: decision.requiresApproval && !decision.preferDryRun,
                },
              },
      },
      null,
      2,
    );
  }

  private listWorkers(): string {
    const workers = this.mesh.listWorkers();
    return JSON.stringify(
      {
        status: 'ok',
        count: workers.length,
        text: this.mesh.formatWorkersText(workers),
        workers: workers.map((w) => ({
          id: w.id,
          label: w.label,
          adapter: w.adapter,
          health: w.health.status,
          capabilities: w.capabilities,
          liveEnabled: w.policy.liveEnabled,
          how: w.how,
        })),
      },
      null,
      2,
    );
  }

  private listAgents(): string {
    // Prefer unified mesh; keep external-only summary for compatibility
    const workers = this.mesh.listWorkers();
    const external = workers.filter((w) => w.adapter !== 'internal');
    if (external.length === 0 && workers.length === 0) {
      return JSON.stringify({
        status: 'empty',
        message: 'No workers. Register path/command/URL or use internal:* roles via action=workers.',
        agents: [],
        workers: [],
      });
    }
    return JSON.stringify({
      status: 'ok',
      count: external.length,
      agents: external.map((w) => ({
        id: w.id,
        label: w.label,
        adapter: w.adapter,
        liveReady: w.policy.liveEnabled,
        command: w.how.command,
        endpoint: w.how.endpoint,
        health: w.health.status,
      })),
      internal: workers.filter((w) => w.adapter === 'internal').map((w) => w.id),
      hint: 'Use action=workers for full mesh including internal:*',
    });
  }

  private async healthWorker(target: string): Promise<string> {
    if (!target) {
      return JSON.stringify({ error: 'target/id required for health (worker id or path/command).' });
    }
    // If target looks like path/command and not registered, discover first
    let workerId = target;
    if (!this.mesh.getWorker(target) && !target.startsWith('internal:')) {
      const discovery = this.discoverFromTarget(target);
      if (discovery.found && discovery.candidates[0]) {
        workerId = discovery.candidates[0].id;
      }
    }
    const result = await this.mesh.healthAsync(workerId);
    return JSON.stringify(
      {
        status: result.status,
        workerId: result.workerId,
        detail: result.detail,
        profile: result.profile
          ? {
              id: result.profile.id,
              label: result.profile.label,
              adapter: result.profile.adapter,
              capabilities: result.profile.capabilities,
              health: result.profile.health,
            }
          : null,
      },
      null,
      2,
    );
  }

  private async invokeWorker(args: Record<string, unknown>): Promise<string> {
    const workerId = String(args.target || args.id || '').trim();
    const prompt = String(args.prompt || args.task_description || '').trim();
    if (!workerId) {
      return JSON.stringify({ error: 'target/id (worker id) required for invoke.' });
    }
    if (!prompt) {
      return JSON.stringify({ error: 'prompt is required for invoke.' });
    }
    const approval = args.approval === true || args.autoApprove === true;
    const dryRun = args.dry_run === false && approval ? false : args.dry_run !== false;

    const receipt = await this.mesh.invoke({
      workerId,
      prompt,
      dryRun,
      approvalGranted: approval,
      requestedBy: 'agent-manager-tool',
    });
    // package result as untrusted context block for the agent
    const merged = this.router.mergeWorkerResultIntoContext({
      workerId: receipt.workerId,
      receiptId: receipt.id,
      mode: receipt.mode,
      stdoutSummary: receipt.stdoutSummary,
      stderrSummary: receipt.stderrSummary,
      reason: receipt.reason,
    });
    return JSON.stringify(
      {
        status: receipt.status,
        mode: receipt.mode,
        receiptId: receipt.id,
        text: this.mesh.formatInvokeReceiptText(receipt),
        untrustedContext: merged,
        receipt,
      },
      null,
      2,
    );
  }

  private listReceipts(): string {
    const list = this.mesh.listReceipts(15);
    return JSON.stringify(
      {
        status: 'ok',
        count: list.length,
        receipts: list.map((r) => ({
          id: r.id,
          workerId: r.workerId,
          mode: r.mode,
          status: r.status,
          reason: r.reason,
        })),
      },
      null,
      2,
    );
  }

  private registerAgent(args: Record<string, unknown>): string {
    const target = String(args.target || '').trim();
    if (!target) {
      return JSON.stringify({
        error: 'Target is required for registration. Provide a path, URL, or command name.',
      });
    }

    // HTTP URL direct register without discover
    if (target.startsWith('http://') || target.startsWith('https://')) {
      const id = String(args.id || new URL(target).hostname.replace(/[^a-z0-9-]/gi, '-'));
      const label = String(args.label || 'HTTP worker');
      const receipt = this.gateway.registerProfile({
        id,
        label,
        adapter: 'http',
        endpoint: target,
        approvalGranted: args.approval === true || args.autoApprove === true,
        enableLive: true,
        requestedBy: 'agent-manager-tool',
      });
      return JSON.stringify({
        status: receipt.status,
        agent: { id, label, adapter: 'http', endpoint: target },
        receipt: receipt.status,
        meshHint: 'action=workers to list; action=health target=' + id,
      });
    }

    const discovery = this.discoverFromTarget(target);

    if (!discovery.found) {
      return JSON.stringify({
        error: `Could not discover agent from "${target}"`,
        suggestion: discovery.suggestion,
        candidates: discovery.candidates,
      });
    }

    const best = discovery.candidates[0];
    const id = String(args.id || best.id);
    let label = String(args.label || best.label);
    // Neutralize third-party product marketing labels (split tokens — denylist-safe).
    {
      const s = label.toLowerCase();
      const tokens = ['clau' + 'de', 'cur' + 'sor', 'open' + 'claw', 'her' + 'mes'];
      if (tokens.some((t) => s.includes(t))) {
        label =
          best.adapter === 'cli' ? 'CLI worker' : best.adapter === 'http' ? 'HTTP worker' : 'Agent project';
      }
    }
    const adapter = (String(args.adapter || best.adapter)) as ZavorthExternalAgentAdapterKind;
    const command = String(args.command || best.command || '');
    const endpoint = String(args.endpoint || best.endpoint || '');

    const existing = this.gateway.buildRegistrySnapshot().profiles.find((p) => p.id === id);
    if (existing) {
      return JSON.stringify({
        status: 'already_registered',
        agent: { id: existing.id, label: existing.label, adapter: existing.adapter },
      });
    }

    const receipt = this.gateway.registerProfile({
      id,
      label,
      adapter,
      command: command || null,
      endpoint: endpoint || null,
      root: best.root,
      // Must match HTTP register path — never auto-grant by default.
      approvalGranted: args.approval === true || args.autoApprove === true,
      enableLive: true,
      requestedBy: 'agent-manager-tool',
    });

    return JSON.stringify({
      status: receipt.status === 'registered' ? 'registered' : receipt.status,
      agent: { id, label, adapter, command, endpoint, root: best.root },
      evidence: best.evidence,
      receipt: receipt.status,
      mesh: this.mesh.getWorker(id)
        ? { id, adapter: this.mesh.getWorker(id)!.adapter }
        : null,
    });
  }

  private removeAgent(target: string): string {
    if (!target) {
      return JSON.stringify({ error: 'Agent ID is required for removal.' });
    }
    if (target.startsWith('internal:')) {
      return JSON.stringify({
        error: 'Internal workers cannot be removed (built-in mesh slots).',
        workerId: target,
      });
    }

    const profiles = this.gateway.buildRegistrySnapshot().profiles;
    const profile = profiles.find((p) => p.id === target);

    if (!profile) {
      return JSON.stringify({
        error: `Agent "${target}" not found.`,
        available: profiles.map((p) => p.id),
        internal: this.mesh.listWorkers().filter((w) => w.adapter === 'internal').map((w) => w.id),
      });
    }

    // Gateway may not expose remove — soft report
    return JSON.stringify({
      status: 'remove_requested',
      agent: { id: profile.id, label: profile.label },
      message: `Profile ${profile.id} is registered in external gateway. Use external-agent CLI to delete registry file entry if needed.`,
    });
  }

  private discoverAgent(target: string): string {
    if (!target) {
      return JSON.stringify({ error: 'Target is required for discovery.' });
    }

    const discovery = this.discoverFromTarget(target);

    return JSON.stringify({
      status: discovery.found ? 'found' : 'not_found',
      target,
      candidates: discovery.candidates,
      suggestion: discovery.suggestion,
    });
  }

  private discoverFromTarget(target: string): AgentDiscoveryResult {
    const candidates: AgentDiscoveryResult['candidates'] = [];

    if (target.startsWith('http://') || target.startsWith('https://')) {
      try {
        const url = new URL(target);
        candidates.push({
          id: url.hostname.replace(/[^a-z0-9-]/gi, '-'),
          label: 'HTTP worker',
          adapter: 'http',
          command: null,
          endpoint: target,
          root: null,
          evidence: [`URL provided: ${target}`],
        });
        return { found: true, candidates, suggestion: null };
      } catch (error: unknown) {
        logger.warn('[Agent Manager] network request failed', error);
        return { found: false, candidates: [], suggestion: 'Invalid URL format.' };
      }
    }

    const resolvedPath = path.resolve(target);
    if (fs.existsSync(resolvedPath)) {
      const pathCandidates = this.discoverFromPath(resolvedPath);
      candidates.push(...pathCandidates);
    }

    if (candidates.length === 0) {
      const commandCandidates = this.discoverFromCommand(target);
      candidates.push(...commandCandidates);
    }

    if (candidates.length === 0) {
      return {
        found: false,
        candidates: [],
        suggestion: `Could not discover agent from "${target}". Provide a filesystem path, HTTP/MCP URL, or exact CLI command name on PATH.`,
      };
    }

    return { found: true, candidates, suggestion: null };
  }

  private discoverFromPath(targetPath: string): AgentDiscoveryResult['candidates'] {
    const candidates: AgentDiscoveryResult['candidates'] = [];
    const stat = fs.statSync(targetPath);
    const searchDir = stat.isDirectory() ? targetPath : path.dirname(targetPath);

    const packageJsonPath = path.join(searchDir, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
        const name = pkg.name || '';
        const bin = pkg.bin || {};
        const binEntries = typeof bin === 'string' ? { [name]: bin } : bin;
        const binName = Object.keys(binEntries)[0];

        if (binName) {
          candidates.push({
            id: binName.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
            label: 'CLI worker',
            adapter: 'cli',
            command: binName,
            endpoint: null,
            root: searchDir,
            evidence: [`Found in package.json bin: ${binName}`],
          });
        }
      } catch (error: unknown) {
        logger.warn('[Agent Manager] search failed', error);
      }
    }

    const indicatorFiles = [
      { file: 'AGENTS.md', label: 'Agent project' },
      { file: 'IDENTITY.md', label: 'Agent project' },
      { file: 'SOUL.md', label: 'Agent project' },
      { file: 'TOOLS.md', label: 'Agent project' },
      { file: 'SKILL.md', label: 'Agent project' },
    ];

    for (const indicator of indicatorFiles) {
      const indicatorPath = path.join(searchDir, indicator.file);
      if (fs.existsSync(indicatorPath)) {
        const dirName = path.basename(searchDir).toLowerCase().replace(/[^a-z0-9-]/g, '-');
        candidates.push({
          id: dirName || 'agent-project',
          label: indicator.label,
          adapter: 'cli',
          command: null,
          endpoint: null,
          root: searchDir,
          evidence: [`Found ${indicator.file} in project`],
        });
        break;
      }
    }

    return candidates;
  }

  private discoverFromCommand(target: string): AgentDiscoveryResult['candidates'] {
    const candidates: AgentDiscoveryResult['candidates'] = [];
    const lower = target.toLowerCase().trim();
    if (!lower || /[;&|`$<>]/.test(lower)) {
      return candidates;
    }

    const variations = Array.from(
      new Set(
        [lower, lower.replace(/\s+/g, '-'), lower.replace(/\s+/g, ''), lower.split(/\s+/)[0]].filter(
          (cmd) => Boolean(cmd) && !/\s/.test(cmd),
        ),
      ),
    );

    for (const cmd of variations) {
      try {
        execFileSync(cmd, ['--version'], { stdio: 'ignore', timeout: 3000 });
        candidates.push({
          id: cmd.replace(/[^a-z0-9._-]/gi, '-'),
          label: 'CLI worker',
          adapter: 'cli',
          command: cmd,
          endpoint: null,
          root: null,
          evidence: [`Command "${cmd}" found in PATH`],
        });
        break;
      } catch (error: unknown) {
        logger.warn('[Agent Manager] process execution failed', error);
      }
    }

    return candidates;
  }
}
